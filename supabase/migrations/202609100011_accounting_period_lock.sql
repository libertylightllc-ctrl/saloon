alter table public.salon_records drop constraint salon_records_record_type_check;
alter table public.salon_records add constraint salon_records_record_type_check check (record_type in (
  'service','customer','appointment','queue_ticket','sale','refund','purchase','supplier','supplier_payment','expense',
  'inventory_item','stock_movement','cash_closing','staff_payment','staff_profile','attendance','staff_adjustment','payroll',
  'inspection','hygiene_log','compliance_document','document_chain','product_registration','accounting_entry','accounting_period','shop_setting'
));

create or replace function salon_private.record_business_period(payload jsonb) returns text
language sql immutable set search_path = '' as $$
  select left(coalesce(
    nullif(payload->>'businessDate',''),nullif(payload->>'date',''),nullif(payload->>'invoiceDate',''),
    nullif(payload->>'paidAt',''),nullif(payload->>'createdAt','')
  ),7);
$$;
revoke all on function salon_private.record_business_period(jsonb) from public;

create or replace function salon_private.protect_closed_accounting_period() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  payload jsonb;
  target_shop uuid;
  kind text;
  period text;
begin
  payload := case when tg_op='DELETE' then old.data else new.data end;
  target_shop := case when tg_op='DELETE' then old.shop_id else new.shop_id end;
  kind := case when tg_op='DELETE' then old.record_type else new.record_type end;

  if kind='accounting_period' then
    if coalesce(current_setting('salon.period_rpc',true),'') <> '1' then
      raise exception 'Accounting periods must use the controlled close workflow';
    end if;
    return case when tg_op='DELETE' then old else new end;
  end if;

  if kind <> all(array[
    'sale','refund','purchase','supplier_payment','expense','stock_movement',
    'cash_closing','staff_adjustment','payroll','accounting_entry'
  ]) then return case when tg_op='DELETE' then old else new end; end if;

  if tg_op='UPDATE' and new.data is not distinct from old.data
    and new.deleted_at is not distinct from old.deleted_at
    and new.shop_id=old.shop_id and new.record_type=old.record_type
  then return new; end if;

  period := salon_private.record_business_period(payload);
  if period is not null and exists (
    select 1 from public.salon_records lock_record
    where lock_record.shop_id=target_shop and lock_record.record_type='accounting_period'
      and lock_record.deleted_at is null and lock_record.data->>'period'=period
      and lock_record.data->>'status'='Closed'
  ) then
    raise exception 'Accounting period % is closed',period;
  end if;

  if tg_op='UPDATE' then
    period := salon_private.record_business_period(old.data);
    if period is not null and exists (
      select 1 from public.salon_records lock_record
      where lock_record.shop_id=old.shop_id and lock_record.record_type='accounting_period'
        and lock_record.deleted_at is null and lock_record.data->>'period'=period
        and lock_record.data->>'status'='Closed'
    ) then raise exception 'Accounting period % is closed',period; end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function salon_private.protect_closed_accounting_period() from public;
drop trigger if exists salon_accounting_period_guard on public.salon_records;
create trigger salon_accounting_period_guard
before insert or update or delete on public.salon_records
for each row execute function salon_private.protect_closed_accounting_period();

create or replace function public.salon_close_accounting_period(target_shop uuid,target_period text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  existing public.salon_records%rowtype;
  snapshot jsonb;
begin
  if actor is null or not (
    salon_private.is_platform_admin() or salon_private.has_shop_role(target_shop,array['owner','shop_admin'])
  ) then raise exception 'Not authorized to close accounting periods'; end if;
  if target_period !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Invalid accounting period'; end if;
  if target_period >= to_char(current_date,'YYYY-MM') then raise exception 'Only a completed month can be closed'; end if;
  if exists (
    select 1 from public.salon_records record where record.shop_id=target_shop
      and record.record_type='cash_closing' and record.deleted_at is null
      and left(record.data->>'businessDate',7)=target_period and record.data->>'status'<>'Approved'
  ) then raise exception 'Submitted cash closings must be approved before month close'; end if;

  perform set_config('salon.period_rpc','1',true);
  select * into existing from public.salon_records
  where shop_id=target_shop and record_type='accounting_period'
    and external_id='period-' || target_period and deleted_at is null for update;
  if found and existing.data->>'status'='Closed' then raise exception 'Accounting period % is already closed',target_period; end if;

  snapshot := jsonb_build_object(
    'id','period-' || target_period,'period',target_period,'status','Closed',
    'salesCount',(select count(*) from public.salon_records r where r.shop_id=target_shop and r.record_type='sale' and r.deleted_at is null and salon_private.record_business_period(r.data)=target_period),
    'purchasesCount',(select count(*) from public.salon_records r where r.shop_id=target_shop and r.record_type='purchase' and r.deleted_at is null and salon_private.record_business_period(r.data)=target_period and coalesce(r.data->>'status','Posted')<>'Reversed'),
    'expensesCount',(select count(*) from public.salon_records r where r.shop_id=target_shop and r.record_type='expense' and r.deleted_at is null and salon_private.record_business_period(r.data)=target_period),
    'payrollCount',(select count(*) from public.salon_records r where r.shop_id=target_shop and r.record_type='payroll' and r.deleted_at is null and r.data->>'period'=target_period),
    'closedBy',actor::text,'closedAt',now()
  );
  if found then
    update public.salon_records set data=snapshot where id=existing.id;
  else
    insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
    values(target_shop,'accounting_period','period-' || target_period,snapshot,actor);
  end if;
  return jsonb_build_object('ok',true,'period',snapshot);
end;
$$;
revoke all on function public.salon_close_accounting_period(uuid,text) from public,anon;
grant execute on function public.salon_close_accounting_period(uuid,text) to authenticated;

create or replace function public.salon_reopen_accounting_period(target_shop uuid,target_period text,reopen_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  existing public.salon_records%rowtype;
begin
  if actor is null or not salon_private.is_platform_admin() then
    raise exception 'Only a platform administrator can reopen accounting periods';
  end if;
  if length(trim(coalesce(reopen_reason,''))) < 5 then raise exception 'A reopen reason is required'; end if;
  perform set_config('salon.period_rpc','1',true);
  select * into existing from public.salon_records
  where shop_id=target_shop and record_type='accounting_period'
    and external_id='period-' || target_period and deleted_at is null for update;
  if not found or existing.data->>'status'<>'Closed' then raise exception 'Closed accounting period not found'; end if;
  update public.salon_records set data=existing.data || jsonb_build_object(
    'status','Reopened','reopenedBy',actor::text,'reopenedAt',now(),'reopenReason',trim(reopen_reason)
  ) where id=existing.id returning * into existing;
  return jsonb_build_object('ok',true,'period',existing.data);
end;
$$;
revoke all on function public.salon_reopen_accounting_period(uuid,text,text) from public,anon;
grant execute on function public.salon_reopen_accounting_period(uuid,text,text) to authenticated;
