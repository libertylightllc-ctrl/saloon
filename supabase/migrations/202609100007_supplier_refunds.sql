alter table public.salon_records drop constraint salon_records_record_type_check;
alter table public.salon_records add constraint salon_records_record_type_check check (record_type in (
  'service','customer','appointment','queue_ticket','sale','refund','purchase','supplier','supplier_payment','expense',
  'inventory_item','stock_movement','cash_closing','staff_payment','inspection','hygiene_log',
  'compliance_document','document_chain','product_registration','accounting_entry','shop_setting'
));

create or replace function salon_private.can_write_record(target uuid, kind text, creator uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select salon_private.is_platform_admin()
    or salon_private.has_shop_role(target,array['owner','shop_admin'])
    or (salon_private.has_shop_role(target,array['cashier']) and kind in (
      'customer','appointment','queue_ticket','sale','refund','purchase','supplier_payment',
      'expense','inventory_item','stock_movement','cash_closing'
    ))
    or (salon_private.has_shop_role(target,array['staff']) and (
      kind='queue_ticket' or (kind='sale' and creator=(select auth.uid()))
    ));
$$;
revoke all on function salon_private.can_write_record(uuid,text,uuid) from public;
grant execute on function salon_private.can_write_record(uuid,text,uuid) to authenticated;

create or replace function public.salon_refund_sale(
  target_shop uuid,
  refund_external_id text,
  sale_external_id text,
  refund_data jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  sale_record public.salon_records%rowtype;
  sale_amount numeric;
  refund_amount numeric;
begin
  if actor is null or not (
    (salon_private.is_platform_admin() and exists (
      select 1 from public.salon_shops shop where shop.id=target_shop and shop.status='active'
    )) or exists (
      select 1 from public.salon_memberships membership
      join public.salon_shops shop on shop.id=membership.shop_id
      where membership.shop_id=target_shop and membership.user_id=actor and membership.active
        and membership.role in ('owner','shop_admin','cashier') and shop.status='active'
    )
  ) then raise exception 'Not authorized to refund sales for this shop'; end if;

  if exists (
    select 1 from public.salon_records
    where shop_id=target_shop and record_type='refund' and external_id=refund_external_id and deleted_at is null
  ) then return jsonb_build_object('ok',true,'idempotent',true); end if;

  select * into sale_record from public.salon_records
  where shop_id=target_shop and record_type='sale' and external_id=sale_external_id and deleted_at is null
  for update;
  if not found then raise exception 'Sale not found'; end if;

  if exists (
    select 1 from public.salon_records
    where shop_id=target_shop and record_type='refund'
      and data->>'saleId'=sale_external_id and deleted_at is null
  ) then raise exception 'Sale has already been refunded'; end if;

  sale_amount := coalesce((sale_record.data->>'amount')::numeric,0);
  refund_amount := coalesce((refund_data->>'amount')::numeric,0);
  if sale_amount <= 0 or refund_amount <> sale_amount then
    raise exception 'MVP refunds must reverse the full sale amount';
  end if;
  if coalesce(refund_data->>'reason','') = '' then raise exception 'Refund reason is required'; end if;
  if coalesce(refund_data->>'payment','') <> coalesce(sale_record.data->>'payment','') then
    raise exception 'Refund payment method must match the sale';
  end if;

  insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
  values(target_shop,'refund',refund_external_id,refund_data,actor);
  update public.salon_records
    set data=data || jsonb_build_object(
      'status','Refunded',
      'refundedAt',coalesce(refund_data->>'createdAt',now()::text),
      'refundId',refund_external_id
    )
  where id=sale_record.id;

  return jsonb_build_object('ok',true,'idempotent',false);
end;
$$;
revoke all on function public.salon_refund_sale(uuid,text,text,jsonb) from public,anon;
grant execute on function public.salon_refund_sale(uuid,text,text,jsonb) to authenticated;
