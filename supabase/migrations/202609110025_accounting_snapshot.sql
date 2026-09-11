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
    select record_type,external_id,data from public.salon_records
    where shop_id=target_shop and deleted_at is null
  ), lines as (
    select 'Opening'::text event_date,'1000 Cash on hand'::text account,'Opening cash float'::text description,
      coalesce(nullif(data->>'openingCash','')::numeric,0) debit,0::numeric credit,'opening'::text source,'operations'::text source_id,1 line_order
    from records where record_type='shop_setting' and external_id='operations' and coalesce(nullif(data->>'openingCash','')::numeric,0)>0
    union all
    select 'Opening','3000 Owner capital','Opening cash float',0,coalesce(nullif(data->>'openingCash','')::numeric,0),'opening','operations',2
    from records where record_type='shop_setting' and external_id='operations' and coalesce(nullif(data->>'openingCash','')::numeric,0)>0
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
