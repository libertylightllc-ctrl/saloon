create or replace function public.salon_accounting_snapshot(target_shop uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  ledger jsonb;
begin
  if actor is null or not (
    salon_private.is_platform_admin() or salon_private.has_shop_role(target_shop,array['owner','shop_admin'])
  ) then raise exception 'Management authorization is required for accounting'; end if;
  if not exists(select 1 from public.salon_shops where id=target_shop and status='active') then raise exception 'Shop is not active'; end if;

  with records as (
    select record.record_type,record.external_id,record.data,
      coalesce((select profile.data->>'name' from public.salon_records profile where profile.shop_id=target_shop
        and profile.record_type='staff_profile' and profile.external_id=record.data->>'staffId' and profile.deleted_at is null),'Staff') staff_name
    from public.salon_records record where record.shop_id=target_shop and record.deleted_at is null
  ), lines as (
    select 'Opening'::text event_date,'1000 Cash on hand'::text account,'Opening cash float'::text description,
      coalesce(nullif(data->>'openingCash','')::numeric,0) debit,0::numeric credit,'opening'::text source,'operations'::text source_id,1 line_order
    from records where record_type='shop_setting' and external_id='operations' and coalesce(nullif(data->>'openingCash','')::numeric,0)>0
    union all
    select 'Opening','3000 Owner capital','Opening cash float',0,coalesce(nullif(data->>'openingCash','')::numeric,0),'opening','operations',2
    from records where record_type='shop_setting' and external_id='operations' and coalesce(nullif(data->>'openingCash','')::numeric,0)>0
    union all
    select coalesce(data->>'createdAt',''),case when coalesce(data->>'depositPayment','Cash')='Cash' then '1000 Cash on hand' else '1010 Bank / card clearing' end,
      concat(coalesce(data->>'customerName','Customer'),' · booking deposit · ',coalesce(data->>'service','Service')),
      coalesce(nullif(data->>'deposit','')::numeric,0),0,'booking-deposit',external_id,1
    from records where record_type='queue_ticket' and coalesce(nullif(data->>'deposit','')::numeric,0)>0
    union all
    select coalesce(data->>'createdAt',''),'2300 Customer deposits',concat(coalesce(data->>'customerName','Customer'),' · booking deposit'),
      0,coalesce(nullif(data->>'deposit','')::numeric,0),'booking-deposit',external_id,2
    from records where record_type='queue_ticket' and coalesce(nullif(data->>'deposit','')::numeric,0)>0
    union all
    select coalesce(data->>'cancelledAt',''),'2300 Customer deposits',concat(coalesce(data->>'customerName','Customer'),' · cancelled deposit refund'),
      coalesce(nullif(data->>'deposit','')::numeric,0),0,'deposit-refund',external_id,3
    from records where record_type='queue_ticket' and data->>'depositStatus'='Refunded'
    union all
    select coalesce(data->>'cancelledAt',''),case when coalesce(data->>'depositPayment','Cash')='Cash' then '1000 Cash on hand' else '1010 Bank / card clearing' end,
      concat(coalesce(data->>'customerName','Customer'),' · cancelled deposit refund'),0,
      coalesce(nullif(data->>'deposit','')::numeric,0),'deposit-refund',external_id,4
    from records where record_type='queue_ticket' and data->>'depositStatus'='Refunded'
    union all
    select coalesce(data->>'cancelledAt',''),'2300 Customer deposits',concat(coalesce(data->>'customerName','Customer'),' · forfeited deposit'),
      coalesce(nullif(data->>'deposit','')::numeric,0),0,'deposit-forfeit',external_id,3
    from records where record_type='queue_ticket' and data->>'depositStatus'='Forfeited'
    union all
    select coalesce(data->>'cancelledAt',''),'4100 Forfeited deposit income',concat(coalesce(data->>'customerName','Customer'),' · forfeited deposit'),
      0,coalesce(nullif(data->>'deposit','')::numeric,0),'deposit-forfeit',external_id,4
    from records where record_type='queue_ticket' and data->>'depositStatus'='Forfeited'
    union all
    select coalesce(data->>'createdAt',''),'1000 Cash on hand',
      concat(coalesce(data->>'customerName','Walk-in'),' · ',coalesce(data->>'service','Sale')),
      case when coalesce(data->>'payment','')='Cash' then coalesce(nullif(data->>'amountPaid','')::numeric,nullif(data->>'amount','')::numeric,0) else coalesce(nullif(data->>'cashAmount','')::numeric,0) end,0,'sale',external_id,1
    from records where record_type='sale' and coalesce(data->>'status','Posted')<>'Reversed'
      and (case when coalesce(data->>'payment','')='Cash' then coalesce(nullif(data->>'amountPaid','')::numeric,nullif(data->>'amount','')::numeric,0) else coalesce(nullif(data->>'cashAmount','')::numeric,0) end)>0
    union all
    select coalesce(data->>'createdAt',''),'1010 Bank / card clearing',concat(coalesce(data->>'customerName','Walk-in'),' · ',coalesce(data->>'service','Sale')),
      greatest(coalesce(nullif(data->>'amountPaid','')::numeric,nullif(data->>'amount','')::numeric,0)-case when coalesce(data->>'payment','')='Cash' then coalesce(nullif(data->>'amountPaid','')::numeric,nullif(data->>'amount','')::numeric,0) else coalesce(nullif(data->>'cashAmount','')::numeric,0) end,0),0,'sale',external_id,2
    from records where record_type='sale' and coalesce(data->>'status','Posted')<>'Reversed'
      and greatest(coalesce(nullif(data->>'amountPaid','')::numeric,nullif(data->>'amount','')::numeric,0)-case when coalesce(data->>'payment','')='Cash' then coalesce(nullif(data->>'amountPaid','')::numeric,nullif(data->>'amount','')::numeric,0) else coalesce(nullif(data->>'cashAmount','')::numeric,0) end,0)>0
    union all
    select coalesce(data->>'createdAt',''),'2300 Customer deposits',concat(coalesce(data->>'customerName','Walk-in'),' · deposit applied'),
      coalesce(nullif(data->>'depositApplied','')::numeric,0),0,'sale-deposit',external_id,2
    from records where record_type='sale' and coalesce(nullif(data->>'depositApplied','')::numeric,0)>0
    union all
    select coalesce(data->>'createdAt',''),'4000 Service revenue',concat(coalesce(data->>'customerName','Walk-in'),' · ',coalesce(data->>'service','Sale')),
      0,coalesce(nullif(data->>'revenueAmount','')::numeric,coalesce(nullif(data->>'amount','')::numeric,0)-coalesce(nullif(data->>'tip','')::numeric,0)),'sale',external_id,3
    from records where record_type='sale' and coalesce(data->>'status','Posted')<>'Reversed'
    union all
    select coalesce(data->>'createdAt',''),'2400 Staff tips payable',concat(coalesce(data->>'customerName','Walk-in'),' · staff tip'),
      0,coalesce(nullif(data->>'tip','')::numeric,0),'sale-tip',external_id,4
    from records where record_type='sale' and coalesce(nullif(data->>'tip','')::numeric,0)>0
    union all
    select coalesce(data->>'createdAt',''),'4000 Service revenue',concat('Refund · ',coalesce(data->>'reason','Approved refund')),
      coalesce(nullif(data->>'revenueAmount','')::numeric,coalesce(nullif(data->>'amount','')::numeric,0)-coalesce(nullif(data->>'tipAmount','')::numeric,0)),0,'refund',external_id,1
    from records where record_type='refund'
    union all
    select coalesce(data->>'createdAt',''),'2400 Staff tips payable',concat('Refund · ',coalesce(data->>'reason','Approved refund')),
      coalesce(nullif(data->>'tipAmount','')::numeric,0),0,'refund-tip',external_id,2
    from records where record_type='refund' and coalesce(nullif(data->>'tipAmount','')::numeric,0)>0
    union all
    select coalesce(data->>'createdAt',''),'1000 Cash on hand',concat('Refund · ',coalesce(data->>'reason','Approved refund')),0,
      case when coalesce(data->>'payment','')='Cash' then coalesce(nullif(data->>'amount','')::numeric,0) else coalesce(nullif(data->>'cashAmount','')::numeric,0) end,'refund',external_id,3
    from records where record_type='refund' and (case when coalesce(data->>'payment','')='Cash' then coalesce(nullif(data->>'amount','')::numeric,0) else coalesce(nullif(data->>'cashAmount','')::numeric,0) end)>0
    union all
    select coalesce(data->>'createdAt',''),'1010 Bank / card clearing',concat('Refund · ',coalesce(data->>'reason','Approved refund')),0,
      greatest(coalesce(nullif(data->>'amount','')::numeric,0)-case when coalesce(data->>'payment','')='Cash' then coalesce(nullif(data->>'amount','')::numeric,0) else coalesce(nullif(data->>'cashAmount','')::numeric,0) end,0),'refund',external_id,4
    from records where record_type='refund' and greatest(coalesce(nullif(data->>'amount','')::numeric,0)-case when coalesce(data->>'payment','')='Cash' then coalesce(nullif(data->>'amount','')::numeric,0) else coalesce(nullif(data->>'cashAmount','')::numeric,0) end,0)>0
    union all
    select coalesce(data->>'invoiceDate',data->>'createdAt',''),case coalesce(data->>'type','') when 'Reusable tool / asset' then '1500 Reusable tools and equipment' when 'Operational supply' then '6100 Shop operating expenses' else '1200 Inventory and supplies' end,
      concat(coalesce(data->>'supplier','Supplier'),' · ',coalesce(data->>'item','Purchase')),
      coalesce(nullif(data->>'qty','')::numeric,0)*coalesce(nullif(data->>'unitCost','')::numeric,0)-coalesce(nullif(data->>'discount','')::numeric,0),0,'purchase',external_id,1
    from records where record_type='purchase' and coalesce(data->>'status','Posted')<>'Reversed'
    union all
    select coalesce(data->>'invoiceDate',data->>'createdAt',''),case when coalesce(data->>'payment','')='Cash' then '1000 Cash on hand' else '1010 Bank / card clearing' end,
      concat(coalesce(data->>'supplier','Supplier'),' · payment'),0,coalesce(nullif(data->>'amountPaid','')::numeric,0),'purchase-payment',external_id,2
    from records where record_type='purchase' and coalesce(data->>'status','Posted')<>'Reversed' and coalesce(nullif(data->>'amountPaid','')::numeric,0)>0
    union all
    select coalesce(data->>'invoiceDate',data->>'createdAt',''),'2000 Supplier payable',concat(coalesce(data->>'supplier','Supplier'),' · balance'),0,
      greatest(coalesce(nullif(data->>'qty','')::numeric,0)*coalesce(nullif(data->>'unitCost','')::numeric,0)-coalesce(nullif(data->>'discount','')::numeric,0)-coalesce(nullif(data->>'amountPaid','')::numeric,0),0),'purchase-credit',external_id,3
    from records where record_type='purchase' and coalesce(data->>'status','Posted')<>'Reversed'
    union all
    select coalesce(data->>'createdAt',''),'6100 Shop operating expenses',concat(coalesce(data->>'category','Expense'),' · ',coalesce(data->>'note','')),
      coalesce(nullif(data->>'amount','')::numeric,0),0,'expense',external_id,1
    from records where record_type='expense' and coalesce(data->>'status','Posted')<>'Reversed'
    union all
    select coalesce(data->>'createdAt',''),case when coalesce(data->>'payment','')='Cash' then '1000 Cash on hand' else '1010 Bank / card clearing' end,
      concat(coalesce(data->>'category','Expense'),' · payment'),0,coalesce(nullif(data->>'amount','')::numeric,0),'expense',external_id,2
    from records where record_type='expense' and coalesce(data->>'status','Posted')<>'Reversed'
    union all
    select coalesce(data->>'createdAt',''),'2000 Supplier payable',concat(coalesce(data->>'supplier','Supplier'),' · account payment'),
      coalesce(nullif(data->>'amount','')::numeric,0),0,'supplier-payment',external_id,1
    from records where record_type='supplier_payment' and coalesce(data->>'status','Posted')<>'Reversed'
    union all
    select coalesce(data->>'createdAt',''),case when coalesce(data->>'payment','')='Cash' then '1000 Cash on hand' else '1010 Bank / card clearing' end,
      concat(coalesce(data->>'supplier','Supplier'),' · account payment'),0,coalesce(nullif(data->>'amount','')::numeric,0),'supplier-payment',external_id,2
    from records where record_type='supplier_payment' and coalesce(data->>'status','Posted')<>'Reversed'
    union all
    select 'Opening','3900 Opening balance equity',concat(coalesce(data->>'name','Supplier'),' · opening payable'),
      coalesce(nullif(data->>'openingBalance','')::numeric,0),0,'supplier-opening',external_id,1
    from records where record_type='supplier' and coalesce(nullif(data->>'openingBalance','')::numeric,0)>0
    union all
    select 'Opening','2000 Supplier payable',concat(coalesce(data->>'name','Supplier'),' · opening payable'),0,
      coalesce(nullif(data->>'openingBalance','')::numeric,0),'supplier-opening',external_id,2
    from records where record_type='supplier' and coalesce(nullif(data->>'openingBalance','')::numeric,0)>0
    union all
    select coalesce(data->>'createdAt',''),'6400 Salary and benefits expense',concat(staff_name,' · payroll ',coalesce(data->>'period','')),
      coalesce(nullif(data->>'basePay','')::numeric,0)+coalesce(nullif(data->>'additions','')::numeric,0),0,'payroll-accrual',external_id,1
    from records where record_type='payroll' and coalesce(nullif(data->>'basePay','')::numeric,0)+coalesce(nullif(data->>'additions','')::numeric,0)>0
    union all
    select coalesce(data->>'createdAt',''),'2200 Payroll payable',concat(staff_name,' · payroll ',coalesce(data->>'period','')),0,
      coalesce(nullif(data->>'basePay','')::numeric,0)+coalesce(nullif(data->>'additions','')::numeric,0),'payroll-accrual',external_id,2
    from records where record_type='payroll' and coalesce(nullif(data->>'basePay','')::numeric,0)+coalesce(nullif(data->>'additions','')::numeric,0)>0
    union all
    select coalesce(data->>'createdAt',''),'6300 Staff commission expense',concat(staff_name,' · commission ',coalesce(data->>'period','')),
      coalesce(nullif(data->>'commission','')::numeric,0),0,'commission-accrual',external_id,3
    from records where record_type='payroll' and coalesce(nullif(data->>'commission','')::numeric,0)>0
    union all
    select coalesce(data->>'createdAt',''),'7000 Staff commission payable',concat(staff_name,' · commission ',coalesce(data->>'period','')),0,
      coalesce(nullif(data->>'commission','')::numeric,0),'commission-accrual',external_id,4
    from records where record_type='payroll' and coalesce(nullif(data->>'commission','')::numeric,0)>0
    union all
    select coalesce(data->>'createdAt',''),'2200 Payroll payable',concat(staff_name,' · deductions ',coalesce(data->>'period','')),
      coalesce(nullif(data->>'deductions','')::numeric,0),0,'payroll-deduction',external_id,5
    from records where record_type='payroll' and coalesce(nullif(data->>'deductions','')::numeric,0)>0
    union all
    select coalesce(data->>'createdAt',''),'1300 Staff advances receivable',concat(staff_name,' · deductions ',coalesce(data->>'period','')),0,
      coalesce(nullif(data->>'deductions','')::numeric,0),'payroll-deduction',external_id,6
    from records where record_type='payroll' and coalesce(nullif(data->>'deductions','')::numeric,0)>0
    union all
    select coalesce(data->>'paidAt',''),'2200 Payroll payable',concat(staff_name,' · payroll payment'),
      greatest(coalesce(nullif(data->>'basePay','')::numeric,0)+coalesce(nullif(data->>'additions','')::numeric,0)-coalesce(nullif(data->>'deductions','')::numeric,0),0),0,'payroll-payment',external_id,7
    from records where record_type='payroll' and data->>'status'='Paid'
    union all
    select coalesce(data->>'paidAt',''),'7000 Staff commission payable',concat(staff_name,' · commission payment'),
      coalesce(nullif(data->>'commission','')::numeric,0),0,'payroll-payment',external_id,8
    from records where record_type='payroll' and data->>'status'='Paid' and coalesce(nullif(data->>'commission','')::numeric,0)>0
    union all
    select coalesce(data->>'paidAt',''),case when coalesce(data->>'paymentMethod','')='Cash' then '1000 Cash on hand' else '1010 Bank / card clearing' end,
      concat(staff_name,' · payroll payment'),0,coalesce(nullif(data->>'netPay','')::numeric,0),'payroll-payment',external_id,9
    from records where record_type='payroll' and data->>'status'='Paid'
    union all
    select coalesce(data->>'createdAt',''),'5100 Service material cost',concat(coalesce(data->>'itemName','Inventory'),' · service use'),
      abs(coalesce(nullif(data->>'quantity','')::numeric,0))*coalesce(nullif(data->>'unitCost','')::numeric,0),0,'stock-use',external_id,1
    from records where record_type='stock_movement' and data->>'type'='service_use'
    union all
    select coalesce(data->>'createdAt',''),'1200 Inventory and supplies',concat(coalesce(data->>'itemName','Inventory'),' · service use'),0,
      abs(coalesce(nullif(data->>'quantity','')::numeric,0))*coalesce(nullif(data->>'unitCost','')::numeric,0),'stock-use',external_id,2
    from records where record_type='stock_movement' and data->>'type'='service_use'
    union all
    select coalesce(data->>'createdAt',''),case when coalesce(nullif(data->>'difference','')::numeric,0)<0 then '6200 Cash shortage / overage' else '1000 Cash on hand' end,
      coalesce(data->>'reason','Cash closing difference'),abs(coalesce(nullif(data->>'difference','')::numeric,0)),0,'cash-close',external_id,1
    from records where record_type='cash_closing' and coalesce(nullif(data->>'difference','')::numeric,0)<>0
    union all
    select coalesce(data->>'createdAt',''),case when coalesce(nullif(data->>'difference','')::numeric,0)<0 then '1000 Cash on hand' else '6200 Cash shortage / overage' end,
      coalesce(data->>'reason','Cash closing difference'),0,abs(coalesce(nullif(data->>'difference','')::numeric,0)),'cash-close',external_id,2
    from records where record_type='cash_closing' and coalesce(nullif(data->>'difference','')::numeric,0)<>0
  ), totals as (
    select coalesce(sum(debit),0) total_debit,coalesce(sum(credit),0) total_credit,
      coalesce(sum(case when account='1000 Cash on hand' then debit-credit else 0 end),0) cash_balance,
      coalesce(sum(case when account='4000 Service revenue' then credit-debit else 0 end),0) revenue,
      coalesce(sum(case when split_part(account,' ',1) in ('5000','5100','6100','6200','6300','6400') then debit-credit else 0 end),0) costs
    from lines
  )
  select jsonb_build_object(
    'entries',coalesce((select jsonb_agg(jsonb_build_object('date',event_date,'account',account,'description',description,'debit',debit,'credit',credit,'source',source,'sourceId',source_id) order by event_date,source_id,line_order) from lines),'[]'::jsonb),
    'totalDebit',total_debit,'totalCredit',total_credit,'balanced',abs(total_debit-total_credit)<0.01,
    'cashBalance',cash_balance,'revenue',revenue,'costs',costs,'result',revenue-costs,
    'source','Supabase controlled records','generatedAt',now()
  ) into ledger from totals;
  return ledger;
end;
$$;
revoke all on function public.salon_accounting_snapshot(uuid) from public,anon;
grant execute on function public.salon_accounting_snapshot(uuid) to authenticated;
