create or replace function salon_private.protect_cash_closing() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (case when tg_op='DELETE' then old.record_type else new.record_type end)='cash_closing'
    and coalesce(current_setting('salon.close_rpc',true),'') <> '1'
  then
    raise exception 'Cash closing records must use the controlled close workflow';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists salon_cash_closing_guard on public.salon_records;
create trigger salon_cash_closing_guard
before insert or update or delete on public.salon_records
for each row execute function salon_private.protect_cash_closing();

create or replace function public.salon_close_day(
  target_shop uuid,
  closing_external_id text,
  closing_data jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  business_date date;
  existing public.salon_records%rowtype;
  opening_amount numeric := 0;
  cash_sales numeric := 0;
  cash_refunds numeric := 0;
  cash_purchases numeric := 0;
  cash_expenses numeric := 0;
  cash_supplier_payments numeric := 0;
  expected_amount numeric;
  actual_amount numeric;
  difference_amount numeric;
  close_status text;
  authoritative jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if salon_private.is_platform_admin() then
    actor_role := 'platform_admin';
  else
    select membership.role into actor_role
    from public.salon_memberships membership
    join public.salon_shops shop on shop.id=membership.shop_id
    where membership.shop_id=target_shop and membership.user_id=actor
      and membership.active and shop.status='active';
  end if;
  if actor_role is null or actor_role not in ('platform_admin','owner','shop_admin','cashier') then
    raise exception 'Not authorized to close this shop';
  end if;
  if not exists (select 1 from public.salon_shops where id=target_shop and status='active') then
    raise exception 'Shop is not active';
  end if;

  business_date := coalesce(nullif(closing_data->>'businessDate','')::date,current_date);
  perform set_config('salon.close_rpc','1',true);
  select * into existing from public.salon_records
    where shop_id=target_shop and record_type='cash_closing' and deleted_at is null
      and data->>'businessDate'=business_date::text
    for update;

  if found then
    if existing.data->>'status'='Approved' then raise exception 'This business date is already approved and locked'; end if;
    if actor_role not in ('platform_admin','owner','shop_admin') then raise exception 'Owner approval is required'; end if;
    update public.salon_records set data=existing.data || jsonb_build_object(
      'status','Approved','approvedBy',actor::text,'approvedAt',now()
    ) where id=existing.id returning * into existing;
    return jsonb_build_object('ok',true,'approved',true,'closing',existing.data);
  end if;

  select coalesce((record.data->>'openingCash')::numeric,0) into opening_amount
  from public.salon_records record
  where record.shop_id=target_shop and record.record_type='shop_setting'
    and record.external_id='operations' and record.deleted_at is null
  order by record.updated_at desc limit 1;
  opening_amount := coalesce(opening_amount,0);

  select coalesce(sum((record.data->>'amount')::numeric),0) into cash_sales
  from public.salon_records record where record.shop_id=target_shop and record.record_type='sale'
    and record.deleted_at is null and record.data->>'payment'='Cash'
    and left(record.data->>'createdAt',10)=business_date::text;
  select coalesce(sum((record.data->>'amount')::numeric),0) into cash_refunds
  from public.salon_records record where record.shop_id=target_shop and record.record_type='refund'
    and record.deleted_at is null and record.data->>'payment'='Cash'
    and left(record.data->>'createdAt',10)=business_date::text;
  select coalesce(sum(least(
    coalesce((record.data->>'amountPaid')::numeric,0),
    greatest(coalesce((record.data->>'qty')::numeric,0) * coalesce((record.data->>'unitCost')::numeric,0) - coalesce((record.data->>'discount')::numeric,0),0)
  )),0) into cash_purchases
  from public.salon_records record where record.shop_id=target_shop and record.record_type='purchase'
    and record.deleted_at is null and record.data->>'payment'='Cash'
    and coalesce(record.data->>'status','Posted') <> 'Reversed'
    and left(record.data->>'createdAt',10)=business_date::text;
  select coalesce(sum((record.data->>'amount')::numeric),0) into cash_expenses
  from public.salon_records record where record.shop_id=target_shop and record.record_type='expense'
    and record.deleted_at is null and record.data->>'payment'='Cash'
    and left(record.data->>'createdAt',10)=business_date::text;
  select coalesce(sum((record.data->>'amount')::numeric),0) into cash_supplier_payments
  from public.salon_records record where record.shop_id=target_shop and record.record_type='supplier_payment'
    and record.deleted_at is null and record.data->>'payment'='Cash'
    and coalesce(record.data->>'status','Posted') <> 'Reversed'
    and left(record.data->>'createdAt',10)=business_date::text;

  expected_amount := opening_amount + cash_sales - cash_refunds - cash_purchases - cash_expenses - cash_supplier_payments;
  actual_amount := coalesce((closing_data->>'actual')::numeric,0);
  difference_amount := actual_amount - expected_amount;
  if difference_amount <> 0 and coalesce(trim(closing_data->>'reason'),'')='' then
    raise exception 'A variance reason is required';
  end if;
  close_status := case when actor_role='cashier' then 'Submitted' else 'Approved' end;
  authoritative := closing_data || jsonb_build_object(
    'id',closing_external_id,'businessDate',business_date::text,
    'openingCash',opening_amount,'cashSales',cash_sales,'cashRefunds',cash_refunds,
    'cashPurchases',cash_purchases + cash_supplier_payments,'cashExpenses',cash_expenses,
    'expected',expected_amount,'actual',actual_amount,'difference',difference_amount,
    'status',close_status,'createdBy',actor::text,'createdAt',now()
  );
  if close_status='Approved' then
    authoritative := authoritative || jsonb_build_object('approvedBy',actor::text,'approvedAt',now());
  else
    authoritative := authoritative || jsonb_build_object('submittedBy',actor::text);
  end if;
  insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
  values(target_shop,'cash_closing',closing_external_id,authoritative,actor);
  return jsonb_build_object('ok',true,'approved',close_status='Approved','closing',authoritative);
end;
$$;
revoke all on function public.salon_close_day(uuid,text,jsonb) from public,anon;
grant execute on function public.salon_close_day(uuid,text,jsonb) to authenticated;
