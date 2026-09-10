import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

test('tenant foundation enforces database permissions', async (t) => {
  const db = new PGlite();
  const owner = '10000000-0000-0000-0000-000000000001';
  const staff = '10000000-0000-0000-0000-000000000002';
  const platform = '10000000-0000-0000-0000-000000000003';
  const cashier = '10000000-0000-0000-0000-000000000004';
  const a = '20000000-0000-0000-0000-000000000001';
  const b = '20000000-0000-0000-0000-000000000002';
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql immutable as
      $$ select string_to_array($1,'/') $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;
      grant usage on schema storage to authenticated;
      grant select,insert,update on storage.objects to authenticated;
    `);
    for (const migration of [
      '202609090001_tenant_foundation.sql',
      '202609090003_session_api.sql',
      '202609090004_record_types.sql',
      '202609100006_inventory_transactions.sql',
      '202609100007_supplier_refunds.sql',
      '202609100008_immutable_daily_close.sql',
      '202609100009_staff_payroll.sql',
      '202609100010_appointment_deposits.sql',
      '202609100011_accounting_period_lock.sql',
      '202609100012_login_history.sql',
      '202609100013_checkout_controls.sql',
      '202609100014_operational_documents.sql',
      '202609100015_controlled_expenses.sql',
      '202609100016_controlled_purchases.sql',
      '202609100017_controlled_supplier_payments.sql',
      '202609110018_controlled_inventory.sql',
      '202609110019_controlled_master_data.sql',
      '202609110020_controlled_crm_bookings.sql'
    ]) {
      await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'));
    }
    await db.query('insert into auth.users(id) values ($1),($2),($3),($4)', [owner,staff,platform,cashier]);
    await db.query("insert into public.salon_shops(id,code,name,country) values ($1,'SHOP_A','A','AE'),($2,'SHOP_B','B','QA')", [a,b]);
    await db.query("insert into public.salon_memberships(shop_id,user_id,role) values ($1,$2,'owner'),($1,$3,'staff'),($1,$4,'cashier')", [a,owner,staff,cashier]);
    await db.query('insert into public.salon_platform_admins(user_id) values ($1)',[platform]);
    await db.query("insert into public.salon_documents(shop_id,title,category,subject_user_id) values ($1,'Lease','lease',null),($1,'Staff health','health',$3),($2,'Other shop','lease',null)", [a,b,staff]);
    await db.query("insert into public.salon_records(shop_id,record_type,external_id,data,created_by) values ($1,'service','s1','{}',$2),($1,'expense','e1','{}',$2),($3,'service','s2','{}',$2)",[a,owner,b]);
    async function asUser(id) {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
      await db.exec('set role authenticated');
    }
    await t.test('owner sees only their shop and its documents', async () => {
      await asUser(owner);
      assert.equal((await db.query('select * from public.salon_shops')).rows.length,1);
      assert.equal((await db.query('select * from public.salon_documents')).rows.length,2);
      assert.equal((await db.query('select * from public.salon_records')).rows.length,2);
      assert.deepEqual((await db.query('select shop_code,role from public.salon_session()')).rows, [{shop_code:'SHOP_A',role:'owner'}]);
    });
    await t.test('owner cannot insert documents into another shop', async () => {
      await assert.rejects(db.query("insert into public.salon_documents(shop_id,title,category) values ($1,'Intrusion','lease')",[b]), /row-level security/);
    });
    await t.test('owner cannot promote themselves or forge audit events', async () => {
      await assert.rejects(db.query('insert into public.salon_platform_admins(user_id) values ($1)',[owner]), /permission denied/);
      await assert.rejects(db.query("update public.salon_memberships set role='owner'"), /permission denied/);
      await assert.rejects(db.query("insert into public.salon_audit_events(action,entity_id) values ('fake','fake')"), /permission denied/);
    });
    await t.test('staff sees only their own documents, cannot edit them', async () => {
      await asUser(staff);
      assert.deepEqual((await db.query('select title from public.salon_documents')).rows, [{title:'Staff health'}]);
      assert.deepEqual((await db.query('select record_type from public.salon_records')).rows, [{record_type:'service'}]);
      assert.equal((await db.query("update public.salon_documents set title='tampered' returning id")).rows.length,0);
      await assert.rejects(db.query("insert into public.salon_documents(shop_id,title,category) values ($1,'New','health')",[a]), /row-level security/);
    });
    await t.test('cashier can attach operational evidence only inside their shop', async () => {
      await asUser(cashier);
      const objectPath = `${a}/expense-receipt.pdf`;
      await db.query("insert into public.salon_documents(shop_id,title,category,object_path) values ($1,'Tea receipt','Expense receipt',$2)",[a,objectPath]);
      await db.query("insert into storage.objects(bucket_id,name) values ('salon-documents',$1)",[objectPath]);
      await assert.rejects(db.query("insert into public.salon_documents(shop_id,title,category) values ($1,'Other shop receipt','Expense receipt')",[b]), /row-level security/);
      await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('salon-documents',$1)",[`${b}/intrusion.pdf`]), /row-level security/);
    });
    await t.test('staff sale deducts recipe stock atomically and is idempotent', async () => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub','',false)");
      await db.query("insert into public.salon_records(shop_id,record_type,external_id,data,created_by) values ($1,'inventory_item','inv-blades',$2,$3)", [a, JSON.stringify({name:'Blades',unit:'pcs',quantity:5,unitCost:1}), owner]);
      await asUser(staff);
      const sale = {id:'sale-atomic-1',service:'Shave',payment:'Cash',amount:15,createdAt:new Date().toISOString()};
      const usage = [{itemId:'inv-blades',quantity:2}];
      await db.query('select public.salon_record_sale($1,$2,$3::jsonb,$4::jsonb)', [a,'sale-atomic-1',JSON.stringify(sale),JSON.stringify(usage)]);
      assert.equal(Number((await db.query("select (data->>'quantity')::numeric quantity from public.salon_records where record_type='inventory_item' and external_id='inv-blades'")).rows[0].quantity),3);
      await db.query('select public.salon_record_sale($1,$2,$3::jsonb,$4::jsonb)', [a,'sale-atomic-1',JSON.stringify(sale),JSON.stringify(usage)]);
      assert.equal(Number((await db.query("select (data->>'quantity')::numeric quantity from public.salon_records where record_type='inventory_item' and external_id='inv-blades'")).rows[0].quantity),3);
      await assert.rejects(db.query('select public.salon_record_sale($1,$2,$3::jsonb,$4::jsonb)', [a,'sale-atomic-2',JSON.stringify({...sale,id:'sale-atomic-2'}),JSON.stringify([{itemId:'inv-blades',quantity:4}])]), /Insufficient stock/);
    });
    await t.test('cashier can post cumulative partial refunds while staff cannot refund', async () => {
      const refund = {id:'refund-1',saleId:'sale-atomic-1',amount:5,revenueAmount:5,tipAmount:0,payment:'Cash',reason:'Customer complaint',createdAt:new Date().toISOString()};
      await asUser(staff);
      await assert.rejects(db.query('select public.salon_refund_sale($1,$2,$3,$4::jsonb)', [a,'refund-1','sale-atomic-1',JSON.stringify(refund)]), /Not authorized/);
      await asUser(cashier);
      await db.query('select public.salon_refund_sale($1,$2,$3,$4::jsonb)', [a,'refund-1','sale-atomic-1',JSON.stringify(refund)]);
      assert.equal((await db.query("select data->>'status' status from public.salon_records where record_type='sale' and external_id='sale-atomic-1'")).rows[0].status,'Partially refunded');
      await db.query('select public.salon_refund_sale($1,$2,$3,$4::jsonb)', [a,'refund-2','sale-atomic-1',JSON.stringify({...refund,id:'refund-2',amount:10,revenueAmount:10})]);
      assert.equal((await db.query("select data->>'status' status from public.salon_records where record_type='sale' and external_id='sale-atomic-1'")).rows[0].status,'Refunded');
      await assert.rejects(db.query('select public.salon_refund_sale($1,$2,$3,$4::jsonb)', [a,'refund-3','sale-atomic-1',JSON.stringify({...refund,id:'refund-3'})]), /remaining sale balance/);
    });
    await t.test('server validates split tender, tips and management discounts', async () => {
      const discounted = {id:'discounted-sale',service:'Cut',payment:'Split',paymentLines:[{method:'Cash',amount:10},{method:'Card',amount:13}],subtotal:20,discount:2,discountReason:'Loyalty',revenueAmount:18,tip:5,amount:23,amountPaid:23,cashAmount:10,createdAt:'2025-01-01T09:00:00.000Z'};
      await asUser(cashier);
      await assert.rejects(db.query('select public.salon_record_sale($1,$2,$3::jsonb,$4::jsonb)', [a,'discounted-sale',JSON.stringify(discounted),'[]']), /Management approval/);
      await asUser(owner);
      await db.query('select public.salon_record_sale($1,$2,$3::jsonb,$4::jsonb)', [a,'discounted-sale',JSON.stringify(discounted),'[]']);
      const saved = (await db.query("select data from public.salon_records where record_type='sale' and external_id='discounted-sale'")).rows[0].data;
      assert.equal(Number(saved.revenueAmount),18);
      assert.equal(Number(saved.tip),5);
      assert.equal(Number(saved.cashAmount),10);
      await assert.rejects(db.query('select public.salon_record_sale($1,$2,$3::jsonb,$4::jsonb)', [a,'bad-tender',JSON.stringify({...discounted,id:'bad-tender',discount:0,discountReason:'',revenueAmount:20,amount:25,paymentLines:[{method:'Cash',amount:24}],cashAmount:24}),'[]']), /Payment lines/);
    });
    await t.test('server controls expense posting and management reversals', async () => {
      const expense = {id:'expense-controlled',category:'Tea & Food',amount:12,payment:'Cash',note:'Team tea'};
      await asUser(cashier);
      await assert.rejects(db.query('select public.salon_record_expense($1,$2,$3::jsonb)',[a,'expense-bad',JSON.stringify({...expense,id:'expense-bad',amount:-1})]), /amount is invalid/);
      await db.query('select public.salon_record_expense($1,$2,$3::jsonb)',[a,expense.id,JSON.stringify(expense)]);
      await assert.rejects(db.query("update public.salon_records set data=data || '{\"amount\":999}' where shop_id=$1 and external_id=$2",[a,expense.id]), /controlled expense workflow/);
      await assert.rejects(db.query('select public.salon_reverse_expense($1,$2,$3)',[a,expense.id,'Duplicate entry']), /Management authorization/);
      await asUser(owner);
      await db.query('select public.salon_reverse_expense($1,$2,$3)',[a,expense.id,'Duplicate entry']);
      const reversed = (await db.query("select data from public.salon_records where shop_id=$1 and external_id=$2",[a,expense.id])).rows[0].data;
      assert.equal(reversed.status,'Reversed');
      assert.equal(Number(reversed.originalAmount),12);
      assert.equal(Number(reversed.amount),0);
    });
    await t.test('owner can save supplier account records', async () => {
      await asUser(owner);
      await db.query('select public.salon_save_supplier($1,$2,$3::jsonb,$4)',[a,'supplier-1',JSON.stringify({name:'Vendor',termsDays:30,openingBalance:0}),'']);
      assert.equal((await db.query("select * from public.salon_records where record_type='supplier'")).rows.length,1);
    });
    await t.test('server controls service and supplier master data', async () => {
      await asUser(owner);
      const service = {id:'service-controlled',name:'Precision Cut',category:'Hair',price:25,recipe:'Blade preparation',recipeItems:[{itemId:'inv-blades',quantity:1}]};
      await db.query('select public.salon_save_service($1,$2,$3::jsonb,$4)',[a,service.id,JSON.stringify(service),'']);
      await assert.rejects(db.query('select public.salon_save_service($1,$2,$3::jsonb,$4)',[a,service.id,JSON.stringify({...service,price:30}),'']), /change reason/);
      await db.query('select public.salon_save_service($1,$2,$3::jsonb,$4)',[a,service.id,JSON.stringify({...service,price:30}),'Annual price review']);
      await assert.rejects(db.query("update public.salon_records set data=data || '{\"price\":999}' where shop_id=$1 and record_type='service' and external_id=$2",[a,service.id]), /controlled master-data workflow/);
      await assert.rejects(db.query('select public.salon_save_service($1,$2,$3::jsonb,$4)',[a,'service-duplicate',JSON.stringify({...service,id:'service-duplicate'}),'']), /already exists/);
      await asUser(cashier);
      await assert.rejects(db.query('select public.salon_save_service($1,$2,$3::jsonb,$4)',[a,'cashier-service',JSON.stringify({...service,id:'cashier-service',name:'Cashier service'}),'']), /Management authorization/);
      await asUser(owner);
      await db.query('select public.salon_archive_service($1,$2,$3)',[a,service.id,'Service retired']);
      await assert.rejects(db.query('select public.salon_save_service($1,$2,$3::jsonb,$4)',[a,service.id,JSON.stringify({...service,price:35}),'Reopen']), /Archived service/);

      const supplier = {id:'supplier-controlled',name:'GCC Grooming Supply',phone:'0500000000',contact:'Accounts',termsDays:14,openingBalance:0};
      await db.query('select public.salon_save_supplier($1,$2,$3::jsonb,$4)',[a,supplier.id,JSON.stringify(supplier),'']);
      await assert.rejects(db.query('select public.salon_save_supplier($1,$2,$3::jsonb,$4)',[a,supplier.id,JSON.stringify({...supplier,termsDays:21}),'']), /change reason/);
      await db.query('select public.salon_save_supplier($1,$2,$3::jsonb,$4)',[a,supplier.id,JSON.stringify({...supplier,termsDays:21}),'Updated payment terms']);
      await assert.rejects(db.query("update public.salon_records set data=data || '{\"termsDays\":1}' where shop_id=$1 and record_type='supplier' and external_id=$2",[a,supplier.id]), /controlled master-data workflow/);
      await db.query('select public.salon_archive_supplier($1,$2,$3)',[a,supplier.id,'Supplier relationship ended']);
      await assert.rejects(db.query('select public.salon_save_supplier($1,$2,$3::jsonb,$4)',[a,supplier.id,JSON.stringify(supplier),'Reopen']), /Archived supplier/);
    });
    await t.test('server controls customers, bookings and deposit redemption', async () => {
      const today = new Date().toISOString().slice(0,10);
      const service = {id:'booking-service',name:'Booking Cut',category:'Hair',price:40,recipe:'No stock recipe',recipeItems:[]};
      const customer = {id:'customer-controlled',name:'Hassan Ali',phone:'+971 50 123 4567',preference:'Skin fade',riskNote:''};
      await asUser(owner);
      await db.query('select public.salon_save_service($1,$2,$3::jsonb,$4)',[a,service.id,JSON.stringify(service),'']);
      await asUser(cashier);
      await db.query('select public.salon_save_customer($1,$2,$3::jsonb)',[a,customer.id,JSON.stringify(customer)]);
      await assert.rejects(db.query("update public.salon_records set data=data || '{\"name\":\"Forged\"}' where shop_id=$1 and record_type='customer' and external_id=$2",[a,customer.id]), /controlled CRM workflow/);
      await assert.rejects(db.query('select public.salon_save_customer($1,$2,$3::jsonb)',[a,'customer-duplicate',JSON.stringify({...customer,id:'customer-duplicate'})]), /phone number already exists/);
      await asUser(staff);
      await assert.rejects(db.query('select public.salon_save_customer($1,$2,$3::jsonb)',[a,'staff-customer',JSON.stringify({...customer,id:'staff-customer',phone:'0509999999'})]), /Front desk authorization/);

      const booking = {id:'booking-controlled',customerId:customer.id,serviceId:service.id,service:service.name,staff:'Rafiq',type:'Appointment',date:today,time:'10:00',deposit:20,depositPayment:'Cash',cancellationPolicy:'refund'};
      await asUser(cashier);
      await db.query('select public.salon_record_booking($1,$2,$3::jsonb)',[a,booking.id,JSON.stringify(booking)]);
      await db.query('select public.salon_record_booking($1,$2,$3::jsonb)',[a,booking.id,JSON.stringify(booking)]);
      assert.equal((await db.query("select * from public.salon_records where shop_id=$1 and external_id=$2 and record_type in ('appointment','queue_ticket')",[a,booking.id])).rows.length,2);
      await assert.rejects(db.query('select public.salon_record_booking($1,$2,$3::jsonb)',[a,'booking-duplicate-slot',JSON.stringify({...booking,id:'booking-duplicate-slot'})]), /already booked/);
      await db.query('select public.salon_update_booking_status($1,$2,$3,$4)',[a,booking.id,'Waiting','']);
      await db.query('select public.salon_update_booking_status($1,$2,$3,$4)',[a,booking.id,'In chair','']);
      const sale = {id:'booking-sale',service:service.name,services:[service.name],serviceIds:[service.id],customerId:customer.id,customerName:customer.name,staff:'Rafiq',payment:'Cash',paymentLines:[{method:'Cash',amount:20}],subtotal:40,discount:0,revenueAmount:40,tip:0,amount:40,amountPaid:20,cashAmount:20,bookingId:booking.id,depositApplied:20,depositPayment:'Cash',createdAt:`${today}T10:30:00.000Z`};
      await db.query('select public.salon_record_sale($1,$2,$3::jsonb,$4::jsonb)',[a,sale.id,JSON.stringify(sale),'[]']);
      const redeemed = (await db.query("select data from public.salon_records where shop_id=$1 and record_type='queue_ticket' and external_id=$2",[a,booking.id])).rows[0].data;
      assert.equal(redeemed.status,'Completed');
      assert.equal(redeemed.depositStatus,'Redeemed');
      let savedCustomer = (await db.query("select data from public.salon_records where shop_id=$1 and record_type='customer' and external_id=$2",[a,customer.id])).rows[0].data;
      assert.equal(Number(savedCustomer.visits),1);

      const noShow = {...booking,id:'booking-no-show',time:'11:00',deposit:10,cancellationPolicy:'forfeit'};
      await db.query('select public.salon_record_booking($1,$2,$3::jsonb)',[a,noShow.id,JSON.stringify(noShow)]);
      await asUser(staff);
      await assert.rejects(db.query('select public.salon_update_booking_status($1,$2,$3,$4)',[a,noShow.id,'No-show','Customer absent']), /Front desk authorization/);
      await asUser(cashier);
      await db.query('select public.salon_update_booking_status($1,$2,$3,$4)',[a,noShow.id,'No-show','Customer did not arrive']);
      await db.query('select public.salon_update_booking_status($1,$2,$3,$4)',[a,noShow.id,'No-show','Customer did not arrive']);
      savedCustomer = (await db.query("select data from public.salon_records where shop_id=$1 and record_type='customer' and external_id=$2",[a,customer.id])).rows[0].data;
      assert.equal(Number(savedCustomer.noShows),1);
      const cancelled = {...booking,id:'booking-cancelled',time:'12:00',deposit:5,cancellationPolicy:'refund'};
      await db.query('select public.salon_record_booking($1,$2,$3::jsonb)',[a,cancelled.id,JSON.stringify(cancelled)]);
      await db.query('select public.salon_update_booking_status($1,$2,$3,$4)',[a,cancelled.id,'Cancelled','Customer requested cancellation']);
      assert.equal((await db.query("select data->>'depositStatus' status from public.salon_records where shop_id=$1 and record_type='queue_ticket' and external_id=$2",[a,cancelled.id])).rows[0].status,'Refunded');
    });
    await t.test('server posts and reverses purchases with stock atomically', async () => {
      const today = new Date().toISOString().slice(0,10);
      const purchase = {
        id:'purchase-controlled',supplierId:'supplier-1',inventoryItemId:'inv-tissues',invoiceNumber:'INV-1',
        invoiceDate:today,dueDate:today,type:'Consumable stock',item:'Tissues',qty:10,unit:'pcs',
        unitCost:2,discount:2,amountPaid:5,payment:'Cash'
      };
      const inventory = {id:'inv-tissues',name:'Tissues',type:'asset',unit:'pcs',reorderLevel:2,assignedTo:'Store room',condition:'Good'};
      await asUser(cashier);
      await assert.rejects(db.query('select public.salon_record_purchase($1,$2,$3::jsonb,$4::jsonb)',[a,'purchase-bad',JSON.stringify({...purchase,id:'purchase-bad',qty:-1}),JSON.stringify(inventory)]), /quantity is invalid/);
      await db.query('select public.salon_record_purchase($1,$2,$3::jsonb,$4::jsonb)',[a,purchase.id,JSON.stringify(purchase),JSON.stringify(inventory)]);
      let savedInventory = (await db.query("select data from public.salon_records where shop_id=$1 and record_type='inventory_item' and external_id='inv-tissues'",[a])).rows[0].data;
      assert.equal(Number(savedInventory.quantity),10);
      assert.equal(Number(savedInventory.unitCost),1.8);
      assert.equal(savedInventory.type,'consumable');
      await db.query('select public.salon_record_purchase($1,$2,$3::jsonb,$4::jsonb)',[a,purchase.id,JSON.stringify(purchase),JSON.stringify(inventory)]);
      assert.equal(Number((await db.query("select data->>'quantity' quantity from public.salon_records where shop_id=$1 and record_type='inventory_item' and external_id='inv-tissues'",[a])).rows[0].quantity),10);
      await assert.rejects(db.query("update public.salon_records set data=data || '{\"qty\":999}' where shop_id=$1 and record_type='purchase' and external_id=$2",[a,purchase.id]), /controlled purchase workflow/);
      await assert.rejects(db.query('select public.salon_reverse_purchase($1,$2,$3)',[a,purchase.id,'Duplicate bill']), /Management authorization/);
      await asUser(owner);
      await db.query('select public.salon_reverse_purchase($1,$2,$3)',[a,purchase.id,'Duplicate bill']);
      const reversed = (await db.query("select data from public.salon_records where shop_id=$1 and record_type='purchase' and external_id=$2",[a,purchase.id])).rows[0].data;
      savedInventory = (await db.query("select data from public.salon_records where shop_id=$1 and record_type='inventory_item' and external_id='inv-tissues'",[a])).rows[0].data;
      assert.equal(reversed.status,'Reversed');
      assert.equal(Number(savedInventory.quantity),0);
      assert.equal((await db.query("select * from public.salon_records where shop_id=$1 and record_type='stock_movement' and external_id='movement-purchase-reversal-purchase-controlled'",[a])).rows.length,1);
    });
    await t.test('server limits supplier payments to payable and controls reversals', async () => {
      const today = new Date().toISOString().slice(0,10);
      const purchase = {
        id:'payment-bill',supplierId:'supplier-1',inventoryItemId:'inv-payment-stock',invoiceNumber:'PAY-1',
        invoiceDate:today,dueDate:today,type:'Operational supply',item:'Payment test stock',qty:5,unit:'pcs',
        unitCost:10,discount:0,amountPaid:0,payment:'Bank'
      };
      const inventory = {id:'inv-payment-stock',name:'Payment test stock',unit:'pcs',reorderLevel:1,assignedTo:'Store room',condition:'Good'};
      const payment = {id:'payment-controlled',supplierId:'supplier-1',amount:20,payment:'Cash',reference:'PAYMENT-1'};
      await asUser(cashier);
      await db.query('select public.salon_record_purchase($1,$2,$3::jsonb,$4::jsonb)',[a,purchase.id,JSON.stringify(purchase),JSON.stringify(inventory)]);
      await assert.rejects(db.query('select public.salon_record_supplier_payment($1,$2,$3::jsonb)',[a,'payment-too-large',JSON.stringify({...payment,id:'payment-too-large',amount:51})]), /exceeds the current payable balance/);
      await db.query('select public.salon_record_supplier_payment($1,$2,$3::jsonb)',[a,payment.id,JSON.stringify(payment)]);
      await db.query('select public.salon_record_supplier_payment($1,$2,$3::jsonb)',[a,payment.id,JSON.stringify(payment)]);
      assert.equal((await db.query("select * from public.salon_records where shop_id=$1 and record_type='supplier_payment' and external_id=$2",[a,payment.id])).rows.length,1);
      await assert.rejects(db.query("update public.salon_records set data=data || '{\"amount\":1}' where shop_id=$1 and record_type='supplier_payment' and external_id=$2",[a,payment.id]), /controlled payment workflow/);
      await assert.rejects(db.query('select public.salon_reverse_supplier_payment($1,$2,$3)',[a,payment.id,'Duplicate payment']), /Management authorization/);
      await asUser(owner);
      await db.query('select public.salon_reverse_supplier_payment($1,$2,$3)',[a,payment.id,'Duplicate payment']);
      const reversed = (await db.query("select data from public.salon_records where shop_id=$1 and record_type='supplier_payment' and external_id=$2",[a,payment.id])).rows[0].data;
      assert.equal(reversed.status,'Reversed');
      assert.equal(Number(reversed.amount),20);
    });
    await t.test('server controls inventory edits, movements and recipe-safe archiving', async () => {
      const item = {id:'inv-controlled',name:'Controlled towels',type:'operational',unit:'pcs',quantity:10,reorderLevel:2,unitCost:3,assignedTo:'Store room',condition:'Good',maintenanceDate:''};
      await asUser(owner);
      await db.query('select public.salon_save_inventory_item($1,$2,$3,$4::jsonb,$5)',[a,item.id,'movement-inventory-opening',JSON.stringify(item),'Opening count']);
      await assert.rejects(db.query("update public.salon_records set data=data || '{\"quantity\":99}' where shop_id=$1 and record_type='inventory_item' and external_id=$2",[a,item.id]), /controlled inventory workflow/);
      await asUser(cashier);
      await db.query('select public.salon_record_stock_movement($1,$2,$3,$4,$5,$6)',[a,'movement-stock-out',item.id,'adjustment_out',3,'Issued to floor']);
      await db.query('select public.salon_record_stock_movement($1,$2,$3,$4,$5,$6)',[a,'movement-stock-out',item.id,'adjustment_out',3,'Issued to floor']);
      assert.equal(Number((await db.query("select data->>'quantity' quantity from public.salon_records where shop_id=$1 and record_type='inventory_item' and external_id=$2",[a,item.id])).rows[0].quantity),7);
      await db.query('select public.salon_record_stock_movement($1,$2,$3,$4,$5,$6)',[a,'movement-count',item.id,'count',4,'Physical count']);
      await assert.rejects(db.query('select public.salon_record_stock_movement($1,$2,$3,$4,$5,$6)',[a,'movement-negative',item.id,'adjustment_out',9,'Impossible issue']), /Insufficient stock/);
      await asUser(staff);
      await assert.rejects(db.query('select public.salon_record_stock_movement($1,$2,$3,$4,$5,$6)',[a,'movement-forged',item.id,'waste',1,'Forged waste']), /Not authorized/);
      await asUser(owner);
      await db.query('select public.salon_save_service($1,$2,$3::jsonb,$4)',[a,'inventory-recipe',JSON.stringify({id:'inventory-recipe',name:'Towel service',category:'Custom',price:10,recipe:'One towel',recipeItems:[{itemId:item.id,quantity:1}]}),'']);
      await assert.rejects(db.query('select public.salon_archive_inventory_item($1,$2,$3)',[a,item.id,'Retire item']), /active service recipes/);
      await db.query('select public.salon_archive_service($1,$2,$3)',[a,'inventory-recipe','Recipe retired']);
      await db.query('select public.salon_archive_inventory_item($1,$2,$3)',[a,item.id,'Retire item']);
      const archived = (await db.query("select data from public.salon_records where shop_id=$1 and record_type='inventory_item' and external_id=$2",[a,item.id])).rows[0].data;
      assert.equal(archived.active,false);
      assert.equal(Number(archived.quantity),4);
    });
    await t.test('owner manages payroll while staff sees only their own employment records', async () => {
      await asUser(owner);
      await db.query("insert into public.salon_records(shop_id,record_type,external_id,data,created_by) values ($1,'staff_profile','profile-1',$2,$3),($1,'attendance','attendance-1',$4,$3),($1,'payroll','payroll-1',$5,$3)",[
        a,
        JSON.stringify({name:'Team Member',subject_user_id:staff}),
        owner,
        JSON.stringify({staffId:'profile-1',subject_user_id:staff,status:'Present'}),
        JSON.stringify({staffId:'profile-1',subject_user_id:staff,period:'2026-09',netPay:3000,status:'Generated'})
      ]);
      await asUser(staff);
      assert.deepEqual((await db.query("select record_type from public.salon_records where record_type in ('staff_profile','attendance','payroll') order by record_type")).rows, [
        {record_type:'attendance'}, {record_type:'payroll'}, {record_type:'staff_profile'}
      ]);
      await assert.rejects(db.query("insert into public.salon_records(shop_id,record_type,external_id,data,created_by) values ($1,'payroll','forged','{}',$2)",[a,staff]), /row-level security/);
    });
    await t.test('daily close is server-calculated, cashier-submitted and owner-locked', async () => {
      const businessDate = new Date().toISOString().slice(0,10);
      await asUser(owner);
      await db.query('select public.salon_record_booking($1,$2,$3::jsonb)',[a,'deposit-close-test',JSON.stringify({id:'deposit-close-test',customerId:'customer-controlled',serviceId:'booking-service',service:'Booking Cut',staff:'Sameer',type:'Appointment',date:businessDate,time:'09:00',deposit:20,depositPayment:'Cash',cancellationPolicy:'refund'})]);
      await assert.rejects(db.query("insert into public.salon_records(shop_id,record_type,external_id,data,created_by) values ($1,'cash_closing','forged','{}',$2)",[a,owner]), /controlled close workflow/);
      await asUser(cashier);
      await assert.rejects(db.query('select public.salon_close_day($1,$2,$3::jsonb)', [a,`closing-${businessDate}`,JSON.stringify({businessDate,actual:5,reason:''})]), /variance reason/);
      await db.query('select public.salon_close_day($1,$2,$3::jsonb)', [a,`closing-${businessDate}`,JSON.stringify({businessDate,actual:20,reason:''})]);
      assert.equal((await db.query("select data->>'status' status from public.salon_records where record_type='cash_closing'")).rows[0].status,'Submitted');
      await asUser(owner);
      await db.query('select public.salon_close_day($1,$2,$3::jsonb)', [a,`closing-${businessDate}`,JSON.stringify({businessDate,actual:20,reason:''})]);
      assert.equal((await db.query("select data->>'status' status from public.salon_records where record_type='cash_closing'")).rows[0].status,'Approved');
      await assert.rejects(db.query('select public.salon_close_day($1,$2,$3::jsonb)', [a,'duplicate-close',JSON.stringify({businessDate,actual:20,reason:''})]), /approved and locked/);
    });
    await t.test('closed accounting periods reject changes until a platform reopen', async () => {
      const previous = new Date();
      previous.setUTCDate(1);
      previous.setUTCMonth(previous.getUTCMonth()-1);
      const period = previous.toISOString().slice(0,7);
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub','',false)");
      await db.query("update public.salon_records set data=$1 where shop_id=$2 and record_type='expense' and external_id='e1'", [JSON.stringify({id:'e1',category:'Other',amount:10,payment:'Cash',status:'Posted',createdAt:`${period}-10T09:00:00.000Z`}),a]);
      await asUser(owner);
      await assert.rejects(db.query("insert into public.salon_records(shop_id,record_type,external_id,data,created_by) values ($1,'accounting_period','forged','{}',$2)",[a,owner]), /controlled close workflow/);
      await db.query('select public.salon_close_accounting_period($1,$2)',[a,period]);
      await assert.rejects(db.query('select public.salon_reverse_expense($1,$2,$3)',[a,'e1','Period correction']), /is closed/);
      await assert.rejects(db.query('select public.salon_reopen_accounting_period($1,$2,$3)',[a,period,'Owner correction']), /platform administrator/);
      await asUser(platform);
      await assert.rejects(db.query('select public.salon_reopen_accounting_period($1,$2,$3)',[a,period,'no']), /reason is required/);
      await db.query('select public.salon_reopen_accounting_period($1,$2,$3)',[a,period,'Approved correction request']);
      await asUser(owner);
      await db.query('select public.salon_reverse_expense($1,$2,$3)',[a,'e1','Approved correction']);
      assert.equal((await db.query("select data->>'status' status from public.salon_records where external_id='e1'")).rows[0].status,'Reversed');
    });
    await t.test('login history is append-only and tenant scoped', async () => {
      await asUser(staff);
      await db.query('select public.salon_record_login($1)',[a]);
      assert.equal((await db.query('select * from public.salon_login_history($1)',[a])).rows.length,1);
      await assert.rejects(db.query('select public.salon_record_login($1)',[b]), /not active for this shop/);
      await assert.rejects(db.query('delete from public.salon_login_events'), /permission denied/);
      await asUser(owner);
      await db.query('select public.salon_record_login($1)',[a]);
      assert.equal((await db.query('select * from public.salon_login_history($1)',[a])).rows.length,2);
      await asUser(platform);
      await db.query('select public.salon_record_login(null)');
      assert.equal((await db.query('select * from public.salon_login_history(null)')).rows.length,1);
    });
    await t.test('platform admin can view all shops', async () => {
      await asUser(platform);
      assert.equal((await db.query('select * from public.salon_shops')).rows.length,2);
      assert.equal((await db.query('select * from public.salon_documents')).rows.length,4);
      assert.equal((await db.query('select * from public.salon_records')).rows.length,42);
      assert.deepEqual((await db.query('select shop_code,role from public.salon_session()')).rows, [{shop_code:'PLATFORM',role:'platform_admin'}]);
    });
    await t.test('suspension revokes existing sessions at query time', async () => {
      await db.exec('reset role');
      await db.query("update public.salon_shops set status='suspended' where id=$1",[a]);
      await asUser(owner);
      assert.equal((await db.query('select * from public.salon_shops')).rows.length,0);
      assert.equal((await db.query('select * from public.salon_documents')).rows.length,0);
    });
    await t.test('anonymous requests cannot read shop records', async () => {
      await db.exec('reset role; set role anon');
      await assert.rejects(db.query('select * from public.salon_shops'), /permission denied/);
    });
  } finally {
    await db.close();
  }
});
