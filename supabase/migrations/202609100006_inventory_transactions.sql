alter table public.salon_records drop constraint salon_records_record_type_check;
alter table public.salon_records add constraint salon_records_record_type_check check (record_type in (
  'service','customer','appointment','queue_ticket','sale','purchase','expense',
  'inventory_item','stock_movement','cash_closing','staff_payment','inspection','hygiene_log',
  'compliance_document','document_chain','product_registration','accounting_entry','shop_setting'
));

create or replace function salon_private.can_write_record(target uuid, kind text, creator uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select salon_private.has_shop_role(target,array['owner','shop_admin'])
    or (salon_private.has_shop_role(target,array['cashier']) and kind in (
      'customer','appointment','queue_ticket','sale','purchase','expense','inventory_item','stock_movement','cash_closing'
    ))
    or (salon_private.has_shop_role(target,array['staff']) and (
      kind='queue_ticket' or (kind='sale' and creator=(select auth.uid()))
    ));
$$;
revoke all on function salon_private.can_write_record(uuid,text,uuid) from public;
grant execute on function salon_private.can_write_record(uuid,text,uuid) to authenticated;

create or replace function public.salon_record_sale(
  target_shop uuid,
  sale_external_id text,
  sale_data jsonb,
  stock_usage jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  usage_line jsonb;
  inventory_record public.salon_records%rowtype;
  requested numeric;
  available numeric;
  movement_id text;
begin
  if actor is null or not (
    (salon_private.is_platform_admin() and exists (
      select 1 from public.salon_shops shop where shop.id=target_shop and shop.status='active'
    )) or exists (
      select 1 from public.salon_memberships membership
      join public.salon_shops shop on shop.id=membership.shop_id
      where membership.shop_id=target_shop and membership.user_id=actor and membership.active
        and membership.role in ('owner','shop_admin','cashier','staff') and shop.status='active'
    )
  ) then raise exception 'Not authorized for this shop'; end if;
  if jsonb_typeof(stock_usage) <> 'array' then raise exception 'Stock usage must be an array'; end if;

  if exists (
    select 1 from public.salon_records
    where shop_id=target_shop and record_type='sale' and external_id=sale_external_id and deleted_at is null
  ) then return jsonb_build_object('ok',true,'idempotent',true); end if;

  for usage_line in select value from jsonb_array_elements(stock_usage) order by value->>'itemId'
  loop
    requested := coalesce((usage_line->>'quantity')::numeric,0);
    if requested <= 0 then raise exception 'Recipe quantities must be above zero'; end if;
    select * into inventory_record from public.salon_records
      where shop_id=target_shop and record_type='inventory_item'
        and external_id=usage_line->>'itemId' and deleted_at is null for update;
    if not found then raise exception 'Inventory item % is missing', usage_line->>'itemId'; end if;
    available := coalesce((inventory_record.data->>'quantity')::numeric,0);
    if available < requested then
      raise exception 'Insufficient stock for %: % available, % required', inventory_record.data->>'name', available, requested;
    end if;
    update public.salon_records set data=jsonb_set(data,'{quantity}',to_jsonb(available-requested),true)
      where id=inventory_record.id;
    movement_id := sale_external_id || ':' || (usage_line->>'itemId');
    insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
    values(target_shop,'stock_movement',movement_id,jsonb_build_object(
      'id',movement_id,'itemId',usage_line->>'itemId','itemName',inventory_record.data->>'name',
      'type','service_use','quantity',-requested,'unit',inventory_record.data->>'unit',
      'unitCost',coalesce((inventory_record.data->>'unitCost')::numeric,0),
      'reference',sale_external_id,'reason',coalesce(sale_data->>'service','Service sale'),
      'createdBy',actor::text,'createdAt',now()
    ),actor) on conflict(shop_id,record_type,external_id) do nothing;
  end loop;

  insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
  values(target_shop,'sale',sale_external_id,sale_data,actor);
  return jsonb_build_object('ok',true,'idempotent',false);
end;
$$;
revoke all on function public.salon_record_sale(uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.salon_record_sale(uuid,text,jsonb,jsonb) to authenticated;
