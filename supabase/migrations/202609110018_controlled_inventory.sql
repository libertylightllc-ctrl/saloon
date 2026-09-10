alter function public.salon_record_sale(uuid,text,jsonb,jsonb) rename to salon_record_sale_inventory_internal;
revoke all on function public.salon_record_sale_inventory_internal(uuid,text,jsonb,jsonb) from public,anon,authenticated;
create function public.salon_record_sale(target_shop uuid,sale_external_id text,sale_data jsonb,stock_usage jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('salon.inventory_rpc','1',true);
  return public.salon_record_sale_inventory_internal(target_shop,sale_external_id,sale_data,stock_usage);
end;
$$;
revoke all on function public.salon_record_sale(uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.salon_record_sale(uuid,text,jsonb,jsonb) to authenticated;

alter function public.salon_record_purchase(uuid,text,jsonb,jsonb) rename to salon_record_purchase_inventory_internal;
revoke all on function public.salon_record_purchase_inventory_internal(uuid,text,jsonb,jsonb) from public,anon,authenticated;
create function public.salon_record_purchase(target_shop uuid,purchase_external_id text,purchase_data jsonb,inventory_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('salon.inventory_rpc','1',true);
  return public.salon_record_purchase_inventory_internal(target_shop,purchase_external_id,purchase_data,inventory_data);
end;
$$;
revoke all on function public.salon_record_purchase(uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.salon_record_purchase(uuid,text,jsonb,jsonb) to authenticated;

alter function public.salon_reverse_purchase(uuid,text,text) rename to salon_reverse_purchase_inventory_internal;
revoke all on function public.salon_reverse_purchase_inventory_internal(uuid,text,text) from public,anon,authenticated;
create function public.salon_reverse_purchase(target_shop uuid,purchase_external_id text,reversal_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('salon.inventory_rpc','1',true);
  return public.salon_reverse_purchase_inventory_internal(target_shop,purchase_external_id,reversal_reason);
end;
$$;
revoke all on function public.salon_reverse_purchase(uuid,text,text) from public,anon;
grant execute on function public.salon_reverse_purchase(uuid,text,text) to authenticated;

create or replace function salon_private.protect_controlled_inventory() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  kind text := case when tg_op='DELETE' then old.record_type else new.record_type end;
begin
  if kind in ('inventory_item','stock_movement') and auth.uid() is not null
    and coalesce(current_setting('salon.inventory_rpc',true),'') <> '1'
  then raise exception 'Inventory changes must use the controlled inventory workflow'; end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function salon_private.protect_controlled_inventory() from public;
drop trigger if exists salon_controlled_inventory_guard on public.salon_records;
create trigger salon_controlled_inventory_guard
before insert or update or delete on public.salon_records
for each row execute function salon_private.protect_controlled_inventory();

create or replace function public.salon_save_inventory_item(
  target_shop uuid,
  item_external_id text,
  change_external_id text,
  item_data jsonb,
  change_reason text default ''
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  existing public.salon_records%rowtype;
  item_exists boolean := false;
  quantity_value numeric := coalesce((item_data->>'quantity')::numeric,0);
  old_quantity numeric := 0;
  reorder_value numeric := coalesce((item_data->>'reorderLevel')::numeric,0);
  cost_value numeric := coalesce((item_data->>'unitCost')::numeric,0);
  delta numeric;
  normalized_item jsonb;
  movement jsonb;
begin
  if actor is null or not (salon_private.is_platform_admin() or salon_private.has_shop_role(target_shop,array['owner','shop_admin'])) then
    raise exception 'Management authorization is required to manage inventory items';
  end if;
  if length(trim(coalesce(item_external_id,''))) < 3 then raise exception 'Inventory item reference is required'; end if;
  if length(trim(coalesce(item_data->>'name',''))) not between 1 and 160 then raise exception 'Inventory item name is required'; end if;
  if coalesce(item_data->>'type','') not in ('consumable','retail','asset','operational') then raise exception 'Inventory item type is invalid'; end if;
  if length(trim(coalesce(item_data->>'unit',''))) not between 1 and 30 then raise exception 'Inventory unit is required'; end if;
  if quantity_value < 0 or quantity_value > 100000000 or reorder_value < 0 or reorder_value > 100000000
    or cost_value < 0 or cost_value > 10000000 then raise exception 'Inventory quantity or cost is invalid'; end if;

  select * into existing from public.salon_records where shop_id=target_shop and record_type='inventory_item'
    and external_id=item_external_id and deleted_at is null for update;
  item_exists := found;
  if item_exists then old_quantity := coalesce((existing.data->>'quantity')::numeric,0); end if;
  delta := quantity_value-old_quantity;
  if delta <> 0 and length(trim(coalesce(change_reason,''))) < 3 then raise exception 'Quantity change reason is required'; end if;
  if delta <> 0 and length(trim(coalesce(change_external_id,''))) < 3 then raise exception 'Inventory movement reference is required'; end if;

  normalized_item := jsonb_build_object(
    'id',item_external_id,'name',trim(item_data->>'name'),'type',item_data->>'type','unit',trim(item_data->>'unit'),
    'quantity',quantity_value,'reorderLevel',reorder_value,'unitCost',cost_value,
    'assignedTo',trim(coalesce(item_data->>'assignedTo','')),
    'condition',case when coalesce(item_data->>'condition','Good') in ('Good','Needs service','Under repair','Retired')
      then coalesce(item_data->>'condition','Good') else 'Good' end,
    'maintenanceDate',coalesce(item_data->>'maintenanceDate',''),'active',true
  );
  perform set_config('salon.inventory_rpc','1',true);
  if item_exists then
    update public.salon_records set data=normalized_item where id=existing.id;
  else
    insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
    values(target_shop,'inventory_item',item_external_id,normalized_item,actor);
  end if;
  if delta <> 0 then
    movement := jsonb_build_object(
      'id',change_external_id,'itemId',item_external_id,'itemName',normalized_item->>'name',
      'type',case when item_exists then 'opening_correction' else 'opening_balance' end,'quantity',delta,
      'unit',normalized_item->>'unit','unitCost',cost_value,'reference','inventory-' || item_external_id,
      'reason',trim(change_reason),'createdBy',actor::text,'createdAt',now()
    );
    insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
    values(target_shop,'stock_movement',change_external_id,movement,actor)
    on conflict(shop_id,record_type,external_id) do nothing;
  end if;
  return jsonb_build_object('ok',true,'inventoryItem',normalized_item,'movement',movement);
end;
$$;
revoke all on function public.salon_save_inventory_item(uuid,text,text,jsonb,text) from public,anon;
grant execute on function public.salon_save_inventory_item(uuid,text,text,jsonb,text) to authenticated;

create or replace function public.salon_record_stock_movement(
  target_shop uuid,
  movement_external_id text,
  item_external_id text,
  movement_type text,
  entered_quantity numeric,
  movement_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  existing_movement public.salon_records%rowtype;
  inventory_record public.salon_records%rowtype;
  old_quantity numeric;
  delta numeric;
  new_quantity numeric;
  normalized_inventory jsonb;
  movement jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if salon_private.is_platform_admin() then actor_role := 'platform_admin'; else
    select membership.role into actor_role from public.salon_memberships membership
    join public.salon_shops shop on shop.id=membership.shop_id
    where membership.shop_id=target_shop and membership.user_id=actor and membership.active and shop.status='active';
  end if;
  if actor_role is null or actor_role not in ('platform_admin','owner','shop_admin','cashier') then raise exception 'Not authorized to adjust stock'; end if;
  if movement_type not in ('adjustment_in','adjustment_out','waste','return','count') then raise exception 'Stock movement type is invalid'; end if;
  if entered_quantity is null or entered_quantity < 0 or entered_quantity > 100000000
    or (movement_type<>'count' and entered_quantity=0) then raise exception 'Stock movement quantity is invalid'; end if;
  if length(trim(coalesce(movement_reason,''))) < 3 then raise exception 'Stock movement reason is required'; end if;
  if length(trim(coalesce(movement_external_id,''))) < 3 then raise exception 'Stock movement reference is required'; end if;

  select * into existing_movement from public.salon_records where shop_id=target_shop and record_type='stock_movement'
    and external_id=movement_external_id and deleted_at is null;
  if found then
    select * into inventory_record from public.salon_records where shop_id=target_shop and record_type='inventory_item'
      and external_id=existing_movement.data->>'itemId' and deleted_at is null;
    return jsonb_build_object('ok',true,'idempotent',true,'inventoryItem',inventory_record.data,'movement',existing_movement.data);
  end if;
  select * into inventory_record from public.salon_records where shop_id=target_shop and record_type='inventory_item'
    and external_id=item_external_id and deleted_at is null for update;
  if not found or not coalesce((inventory_record.data->>'active')::boolean,true) then raise exception 'Active inventory item not found'; end if;
  old_quantity := coalesce((inventory_record.data->>'quantity')::numeric,0);
  delta := case when movement_type='count' then entered_quantity-old_quantity
    when movement_type in ('adjustment_out','waste','return') then -entered_quantity else entered_quantity end;
  new_quantity := old_quantity+delta;
  if new_quantity < 0 then raise exception 'Insufficient stock for this movement'; end if;
  normalized_inventory := inventory_record.data || jsonb_build_object('quantity',new_quantity);
  movement := jsonb_build_object(
    'id',movement_external_id,'itemId',item_external_id,'itemName',inventory_record.data->>'name',
    'type',movement_type,'quantity',delta,'unit',inventory_record.data->>'unit',
    'unitCost',coalesce((inventory_record.data->>'unitCost')::numeric,0),'reference',movement_external_id,
    'reason',trim(movement_reason),'createdBy',actor::text,'createdAt',now()
  );
  perform set_config('salon.inventory_rpc','1',true);
  update public.salon_records set data=normalized_inventory where id=inventory_record.id;
  insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
  values(target_shop,'stock_movement',movement_external_id,movement,actor);
  return jsonb_build_object('ok',true,'idempotent',false,'inventoryItem',normalized_inventory,'movement',movement);
end;
$$;
revoke all on function public.salon_record_stock_movement(uuid,text,text,text,numeric,text) from public,anon;
grant execute on function public.salon_record_stock_movement(uuid,text,text,text,numeric,text) to authenticated;

create or replace function public.salon_archive_inventory_item(
  target_shop uuid,
  item_external_id text,
  archive_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  inventory_record public.salon_records%rowtype;
begin
  if actor is null or not (salon_private.is_platform_admin() or salon_private.has_shop_role(target_shop,array['owner','shop_admin'])) then
    raise exception 'Management authorization is required to archive inventory';
  end if;
  if length(trim(coalesce(archive_reason,''))) < 3 then raise exception 'Inventory archive reason is required'; end if;
  select * into inventory_record from public.salon_records where shop_id=target_shop and record_type='inventory_item'
    and external_id=item_external_id and deleted_at is null for update;
  if not found then raise exception 'Inventory item not found'; end if;
  if not coalesce((inventory_record.data->>'active')::boolean,true) then
    return jsonb_build_object('ok',true,'idempotent',true,'inventoryItem',inventory_record.data);
  end if;
  if exists (
    select 1 from public.salon_records service
    cross join lateral jsonb_array_elements(case when jsonb_typeof(service.data->'recipeItems')='array' then service.data->'recipeItems' else '[]'::jsonb end) recipe
    where service.shop_id=target_shop and service.record_type='service' and service.deleted_at is null
      and coalesce((service.data->>'active')::boolean,true) and recipe->>'itemId'=item_external_id
  ) then raise exception 'Remove this item from active service recipes before archiving it'; end if;
  perform set_config('salon.inventory_rpc','1',true);
  update public.salon_records set data=inventory_record.data || jsonb_build_object(
    'active',false,'archiveReason',trim(archive_reason),'archivedBy',actor::text,'archivedAt',now()
  ) where id=inventory_record.id returning * into inventory_record;
  return jsonb_build_object('ok',true,'inventoryItem',inventory_record.data);
end;
$$;
revoke all on function public.salon_archive_inventory_item(uuid,text,text) from public,anon;
grant execute on function public.salon_archive_inventory_item(uuid,text,text) to authenticated;
