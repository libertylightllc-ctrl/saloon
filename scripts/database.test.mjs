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
      '202609100012_login_history.sql'
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
    await t.test('staff sale deducts recipe stock atomically and is idempotent', async () => {
      await db.exec('reset role');
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
    await t.test('cashier can refund once while staff cannot refund', async () => {
      const refund = {id:'refund-1',saleId:'sale-atomic-1',amount:15,payment:'Cash',reason:'Customer complaint',createdAt:new Date().toISOString()};
      await asUser(staff);
      await assert.rejects(db.query('select public.salon_refund_sale($1,$2,$3,$4::jsonb)', [a,'refund-1','sale-atomic-1',JSON.stringify(refund)]), /Not authorized/);
      await asUser(cashier);
      await db.query('select public.salon_refund_sale($1,$2,$3,$4::jsonb)', [a,'refund-1','sale-atomic-1',JSON.stringify(refund)]);
      assert.equal((await db.query("select data->>'status' status from public.salon_records where record_type='sale' and external_id='sale-atomic-1'")).rows[0].status,'Refunded');
      await assert.rejects(db.query('select public.salon_refund_sale($1,$2,$3,$4::jsonb)', [a,'refund-2','sale-atomic-1',JSON.stringify({...refund,id:'refund-2'})]), /already been refunded/);
    });
    await t.test('owner can save supplier account records', async () => {
      await asUser(owner);
      await db.query("insert into public.salon_records(shop_id,record_type,external_id,data,created_by) values ($1,'supplier','supplier-1','{\"name\":\"Vendor\"}',$2),($1,'supplier_payment','payment-1','{\"amount\":10}',$2)",[a,owner]);
      assert.equal((await db.query("select * from public.salon_records where record_type in ('supplier','supplier_payment')")).rows.length,2);
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
      await db.query("insert into public.salon_records(shop_id,record_type,external_id,data,created_by) values ($1,'queue_ticket','deposit-close-test',$2,$3)", [a, JSON.stringify({deposit:20,depositPayment:'Cash',depositStatus:'Held',createdAt:`${businessDate}T09:00:00.000Z`}), owner]);
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
      await asUser(owner);
      await db.query("update public.salon_records set data=$1 where shop_id=$2 and record_type='expense' and external_id='e1'", [JSON.stringify({amount:10,createdAt:`${period}-10T09:00:00.000Z`}),a]);
      await assert.rejects(db.query("insert into public.salon_records(shop_id,record_type,external_id,data,created_by) values ($1,'accounting_period','forged','{}',$2)",[a,owner]), /controlled close workflow/);
      await db.query('select public.salon_close_accounting_period($1,$2)',[a,period]);
      await assert.rejects(db.query("update public.salon_records set data=data || '{\"amount\":11}' where shop_id=$1 and external_id='e1'",[a]), /is closed/);
      await assert.rejects(db.query('select public.salon_reopen_accounting_period($1,$2,$3)',[a,period,'Owner correction']), /platform administrator/);
      await asUser(platform);
      await assert.rejects(db.query('select public.salon_reopen_accounting_period($1,$2,$3)',[a,period,'no']), /reason is required/);
      await db.query('select public.salon_reopen_accounting_period($1,$2,$3)',[a,period,'Approved correction request']);
      await asUser(owner);
      assert.equal((await db.query("update public.salon_records set data=data || '{\"amount\":11}' where shop_id=$1 and external_id='e1' returning id",[a])).rows.length,1);
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
      assert.equal((await db.query('select * from public.salon_documents')).rows.length,3);
      assert.equal((await db.query('select * from public.salon_records')).rows.length,15);
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
