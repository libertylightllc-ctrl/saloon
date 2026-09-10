create or replace function salon_private.protect_controlled_supplier_payment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  kind text := case when tg_op='DELETE' then old.record_type else new.record_type end;
begin
  if kind='supplier_payment' and auth.uid() is not null
    and coalesce(current_setting('salon.supplier_payment_rpc',true),'') <> '1'
  then raise exception 'Supplier payments must use the controlled payment workflow'; end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function salon_private.protect_controlled_supplier_payment() from public;
drop trigger if exists salon_controlled_supplier_payment_guard on public.salon_records;
create trigger salon_controlled_supplier_payment_guard
before insert or update or delete on public.salon_records
for each row execute function salon_private.protect_controlled_supplier_payment();

create or replace function public.salon_record_supplier_payment(
  target_shop uuid,
  payment_external_id text,
  payment_data jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  supplier_record public.salon_records%rowtype;
  existing public.salon_records%rowtype;
  supplier_id text := coalesce(payment_data->>'supplierId','');
  payment_amount numeric := coalesce((payment_data->>'amount')::numeric,0);
  opening_balance numeric := 0;
  billed_balance numeric := 0;
  prior_payments numeric := 0;
  available_balance numeric;
  normalized_payment jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if salon_private.is_platform_admin() then actor_role := 'platform_admin'; else
    select membership.role into actor_role from public.salon_memberships membership
    join public.salon_shops shop on shop.id=membership.shop_id
    where membership.shop_id=target_shop and membership.user_id=actor
      and membership.active and shop.status='active';
  end if;
  if actor_role is null or actor_role not in ('platform_admin','owner','shop_admin','cashier') then
    raise exception 'Not authorized to record supplier payments';
  end if;
  if length(trim(coalesce(payment_external_id,''))) < 3 then raise exception 'Payment reference is required'; end if;
  if payment_amount <= 0 or payment_amount > 100000000 then raise exception 'Supplier payment amount is invalid'; end if;
  if coalesce(payment_data->>'payment','') not in ('Cash','Card','Bank') then raise exception 'Supplier payment method is invalid'; end if;
  if length(coalesce(payment_data->>'reference','')) > 160 then raise exception 'Supplier payment reference is too long'; end if;

  select * into existing from public.salon_records where shop_id=target_shop and record_type='supplier_payment'
    and external_id=payment_external_id and deleted_at is null for update;
  if found then return jsonb_build_object('ok',true,'idempotent',true,'payment',existing.data); end if;
  select * into supplier_record from public.salon_records where shop_id=target_shop and record_type='supplier'
    and external_id=supplier_id and deleted_at is null and coalesce((data->>'active')::boolean,true) for share;
  if not found then raise exception 'Active supplier not found'; end if;

  opening_balance := coalesce((supplier_record.data->>'openingBalance')::numeric,0);
  select coalesce(sum(greatest(
    coalesce((data->>'qty')::numeric,0)*coalesce((data->>'unitCost')::numeric,0)
      -coalesce((data->>'discount')::numeric,0)-coalesce((data->>'amountPaid')::numeric,0),0
  )),0) into billed_balance from public.salon_records
    where shop_id=target_shop and record_type='purchase' and deleted_at is null
      and data->>'supplierId'=supplier_id and coalesce(data->>'status','Posted')<>'Reversed';
  select coalesce(sum((data->>'amount')::numeric),0) into prior_payments from public.salon_records
    where shop_id=target_shop and record_type='supplier_payment' and deleted_at is null
      and data->>'supplierId'=supplier_id and coalesce(data->>'status','Posted')<>'Reversed';
  available_balance := greatest(opening_balance+billed_balance-prior_payments,0);
  if payment_amount > available_balance then raise exception 'Supplier payment exceeds the current payable balance'; end if;

  normalized_payment := jsonb_build_object(
    'id',payment_external_id,'supplierId',supplier_id,'supplier',coalesce(supplier_record.data->>'name','Supplier'),
    'amount',payment_amount,'payment',payment_data->>'payment','reference',trim(coalesce(payment_data->>'reference','')),
    'status','Posted','createdBy',actor::text,'createdAt',now()
  );
  perform set_config('salon.supplier_payment_rpc','1',true);
  insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
  values(target_shop,'supplier_payment',payment_external_id,normalized_payment,actor);
  return jsonb_build_object('ok',true,'idempotent',false,'payment',normalized_payment,'remainingBalance',available_balance-payment_amount);
end;
$$;
revoke all on function public.salon_record_supplier_payment(uuid,text,jsonb) from public,anon;
grant execute on function public.salon_record_supplier_payment(uuid,text,jsonb) to authenticated;

create or replace function public.salon_reverse_supplier_payment(
  target_shop uuid,
  payment_external_id text,
  reversal_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  payment_record public.salon_records%rowtype;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if salon_private.is_platform_admin() then actor_role := 'platform_admin'; else
    select membership.role into actor_role from public.salon_memberships membership
    join public.salon_shops shop on shop.id=membership.shop_id
    where membership.shop_id=target_shop and membership.user_id=actor
      and membership.active and shop.status='active';
  end if;
  if actor_role is null or actor_role not in ('platform_admin','owner','shop_admin') then
    raise exception 'Management authorization is required to reverse supplier payments';
  end if;
  if length(trim(coalesce(reversal_reason,''))) < 3 then raise exception 'Supplier payment reversal reason is required'; end if;
  select * into payment_record from public.salon_records where shop_id=target_shop and record_type='supplier_payment'
    and external_id=payment_external_id and deleted_at is null for update;
  if not found then raise exception 'Supplier payment not found'; end if;
  if payment_record.data->>'status'='Reversed' then raise exception 'Supplier payment is already reversed'; end if;
  perform set_config('salon.supplier_payment_rpc','1',true);
  update public.salon_records set data=payment_record.data || jsonb_build_object(
    'status','Reversed','reversalReason',trim(reversal_reason),'reversedBy',actor::text,'reversedAt',now()
  ) where id=payment_record.id returning * into payment_record;
  return jsonb_build_object('ok',true,'payment',payment_record.data);
end;
$$;
revoke all on function public.salon_reverse_supplier_payment(uuid,text,text) from public,anon;
grant execute on function public.salon_reverse_supplier_payment(uuid,text,text) to authenticated;
