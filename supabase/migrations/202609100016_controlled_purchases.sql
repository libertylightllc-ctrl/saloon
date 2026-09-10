create or replace function salon_private.protect_controlled_purchase() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  kind text := case when tg_op='DELETE' then old.record_type else new.record_type end;
begin
  if kind='purchase' and auth.uid() is not null
    and coalesce(current_setting('salon.purchase_rpc',true),'') <> '1'
  then raise exception 'Purchases must use the controlled purchase workflow'; end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function salon_private.protect_controlled_purchase() from public;
drop trigger if exists salon_controlled_purchase_guard on public.salon_records;
create trigger salon_controlled_purchase_guard
before insert or update or delete on public.salon_records
for each row execute function salon_private.protect_controlled_purchase();

create or replace function public.salon_record_purchase(
  target_shop uuid,
  purchase_external_id text,
  purchase_data jsonb,
  inventory_data jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  supplier_record public.salon_records%rowtype;
  inventory_record public.salon_records%rowtype;
  movement_record public.salon_records%rowtype;
  existing public.salon_records%rowtype;
  supplier_id text := coalesce(purchase_data->>'supplierId','');
  inventory_id text := coalesce(purchase_data->>'inventoryItemId','');
  item_name text := trim(coalesce(purchase_data->>'item',''));
  unit_name text := trim(coalesce(purchase_data->>'unit',''));
  item_type text := coalesce(purchase_data->>'type','');
  quantity_value numeric := coalesce((purchase_data->>'qty')::numeric,0);
  unit_cost_value numeric := coalesce((purchase_data->>'unitCost')::numeric,0);
  discount_value numeric := coalesce((purchase_data->>'discount')::numeric,0);
  amount_paid_value numeric := coalesce((purchase_data->>'amountPaid')::numeric,0);
  total_value numeric;
  net_unit_cost numeric;
  old_quantity numeric;
  old_unit_cost numeric;
  new_quantity numeric;
  weighted_unit_cost numeric;
  invoice_date date := coalesce(nullif(purchase_data->>'invoiceDate','')::date,current_date);
  due_date date := coalesce(nullif(purchase_data->>'dueDate','')::date,invoice_date);
  normalized_purchase jsonb;
  normalized_inventory jsonb;
  movement jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if salon_private.is_platform_admin() then actor_role := 'platform_admin'; else
    select membership.role into actor_role from public.salon_memberships membership
    join public.salon_shops shop on shop.id=membership.shop_id
    where membership.shop_id=target_shop and membership.user_id=actor
      and membership.active and shop.status='active';
  end if;
  if actor_role is null or actor_role not in ('platform_admin','owner','shop_admin','cashier') then
    raise exception 'Not authorized to record purchases';
  end if;
  if not exists (select 1 from public.salon_shops where id=target_shop and status='active') then raise exception 'Shop is not active'; end if;
  if length(trim(coalesce(purchase_external_id,''))) < 3 then raise exception 'Purchase reference is required'; end if;
  if length(item_name) not between 1 and 160 or length(unit_name) not between 1 and 30 then raise exception 'Purchase item and unit are required'; end if;
  if item_type not in ('Consumable stock','Retail product','Reusable tool / asset','Operational supply') then raise exception 'Purchase item type is invalid'; end if;
  if quantity_value <= 0 or quantity_value > 100000000 then raise exception 'Purchase quantity is invalid'; end if;
  if unit_cost_value < 0 or unit_cost_value > 10000000 then raise exception 'Purchase unit cost is invalid'; end if;
  total_value := quantity_value*unit_cost_value-discount_value;
  if discount_value < 0 or total_value < 0 then raise exception 'Purchase discount is invalid'; end if;
  if amount_paid_value < 0 or amount_paid_value > total_value then raise exception 'Purchase payment exceeds the bill total'; end if;
  if coalesce(purchase_data->>'payment','') not in ('Cash','Card','Bank') then raise exception 'Purchase payment method is invalid'; end if;
  if due_date < invoice_date then raise exception 'Purchase due date cannot be before invoice date'; end if;
  if length(inventory_id) < 3 then raise exception 'Inventory item reference is required'; end if;

  select * into existing from public.salon_records where shop_id=target_shop and record_type='purchase'
    and external_id=purchase_external_id and deleted_at is null for update;
  if found then
    select * into inventory_record from public.salon_records where shop_id=target_shop and record_type='inventory_item'
      and external_id=existing.data->>'inventoryItemId' and deleted_at is null;
    select * into movement_record from public.salon_records where shop_id=target_shop and record_type='stock_movement'
      and external_id='movement-purchase-' || purchase_external_id and deleted_at is null;
    return jsonb_build_object(
      'ok',true,'idempotent',true,'purchase',existing.data,
      'inventoryItem',inventory_record.data,'movement',movement_record.data
    );
  end if;
  select * into supplier_record from public.salon_records where shop_id=target_shop and record_type='supplier'
    and external_id=supplier_id and deleted_at is null and coalesce((data->>'active')::boolean,true) for share;
  if not found then raise exception 'Active supplier not found'; end if;

  net_unit_cost := case when quantity_value=0 then 0 else total_value/quantity_value end;
  select * into inventory_record from public.salon_records where shop_id=target_shop and record_type='inventory_item'
    and external_id=inventory_id and deleted_at is null for update;
  if found then
    if coalesce(inventory_record.data->>'unit','') <> unit_name then raise exception 'Inventory unit does not match the purchase'; end if;
    if lower(trim(coalesce(inventory_record.data->>'name',''))) <> lower(item_name) then raise exception 'Inventory item does not match the purchase'; end if;
    if not coalesce((inventory_record.data->>'active')::boolean,true) then raise exception 'Inventory item is archived'; end if;
    old_quantity := coalesce((inventory_record.data->>'quantity')::numeric,0);
    old_unit_cost := coalesce((inventory_record.data->>'unitCost')::numeric,0);
    new_quantity := old_quantity+quantity_value;
    weighted_unit_cost := case when new_quantity=0 then 0 else (old_quantity*old_unit_cost+quantity_value*net_unit_cost)/new_quantity end;
    normalized_inventory := inventory_record.data || jsonb_build_object('quantity',new_quantity,'unitCost',weighted_unit_cost);
    update public.salon_records set data=normalized_inventory where id=inventory_record.id;
  else
    normalized_inventory := jsonb_build_object(
      'id',inventory_id,'name',item_name,'type',case item_type
        when 'Consumable stock' then 'consumable'
        when 'Retail product' then 'retail'
        when 'Reusable tool / asset' then 'asset'
        else 'operational'
      end,
      'unit',unit_name,'quantity',quantity_value,'reorderLevel',coalesce((inventory_data->>'reorderLevel')::numeric,0),
      'unitCost',net_unit_cost,'assignedTo',coalesce(inventory_data->>'assignedTo','Store room'),
      'condition',coalesce(inventory_data->>'condition','Good'),'maintenanceDate',coalesce(inventory_data->>'maintenanceDate',''),
      'active',true
    );
    insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
    values(target_shop,'inventory_item',inventory_id,normalized_inventory,actor);
  end if;

  normalized_purchase := jsonb_build_object(
    'id',purchase_external_id,'supplierId',supplier_id,'supplier',coalesce(supplier_record.data->>'name','Supplier'),
    'invoiceNumber',trim(coalesce(purchase_data->>'invoiceNumber','')),'invoiceDate',invoice_date::text,'dueDate',due_date::text,
    'type',item_type,'item',item_name,'qty',quantity_value,'unit',unit_name,'unitCost',unit_cost_value,
    'discount',discount_value,'amountPaid',amount_paid_value,'payment',purchase_data->>'payment',
    'inventoryItemId',inventory_id,'status','Posted','createdBy',actor::text,'createdAt',now()
  );
  if jsonb_typeof(purchase_data->'evidenceFile')='object' then
    normalized_purchase := normalized_purchase || jsonb_build_object('evidenceFile',purchase_data->'evidenceFile');
  end if;
  movement := jsonb_build_object(
    'id','movement-purchase-' || purchase_external_id,'itemId',inventory_id,'itemName',item_name,
    'type','purchase','quantity',quantity_value,'unit',unit_name,'unitCost',net_unit_cost,
    'reference',purchase_external_id,'reason',coalesce(supplier_record.data->>'name','Supplier'),
    'createdBy',actor::text,'createdAt',now()
  );
  perform set_config('salon.purchase_rpc','1',true);
  insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
  values(target_shop,'purchase',purchase_external_id,normalized_purchase,actor);
  insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
  values(target_shop,'stock_movement','movement-purchase-' || purchase_external_id,movement,actor);
  return jsonb_build_object('ok',true,'purchase',normalized_purchase,'inventoryItem',normalized_inventory,'movement',movement);
end;
$$;
revoke all on function public.salon_record_purchase(uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.salon_record_purchase(uuid,text,jsonb,jsonb) to authenticated;

create or replace function public.salon_reverse_purchase(
  target_shop uuid,
  purchase_external_id text,
  reversal_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  purchase_record public.salon_records%rowtype;
  inventory_record public.salon_records%rowtype;
  quantity_value numeric;
  available numeric;
  supplier_id text;
  other_balance numeric := 0;
  opening_balance numeric := 0;
  account_payments numeric := 0;
  normalized_inventory jsonb;
  movement jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if salon_private.is_platform_admin() then actor_role := 'platform_admin'; else
    select membership.role into actor_role from public.salon_memberships membership
    join public.salon_shops shop on shop.id=membership.shop_id
    where membership.shop_id=target_shop and membership.user_id=actor
      and membership.active and shop.status='active';
  end if;
  if actor_role is null or actor_role not in ('platform_admin','owner','shop_admin') then
    raise exception 'Management authorization is required to reverse purchases';
  end if;
  if length(trim(coalesce(reversal_reason,''))) < 3 then raise exception 'Purchase reversal reason is required'; end if;
  select * into purchase_record from public.salon_records where shop_id=target_shop and record_type='purchase'
    and external_id=purchase_external_id and deleted_at is null for update;
  if not found then raise exception 'Purchase not found'; end if;
  if purchase_record.data->>'status'='Reversed' then raise exception 'Purchase is already reversed'; end if;
  quantity_value := coalesce((purchase_record.data->>'qty')::numeric,0);
  supplier_id := purchase_record.data->>'supplierId';
  select * into inventory_record from public.salon_records where shop_id=target_shop and record_type='inventory_item'
    and external_id=purchase_record.data->>'inventoryItemId' and deleted_at is null for update;
  if not found then raise exception 'Purchased inventory item not found'; end if;
  available := coalesce((inventory_record.data->>'quantity')::numeric,0);
  if available < quantity_value then raise exception 'Insufficient remaining stock to reverse this purchase'; end if;

  select coalesce((data->>'openingBalance')::numeric,0) into opening_balance from public.salon_records
    where shop_id=target_shop and record_type='supplier' and external_id=supplier_id and deleted_at is null;
  opening_balance := coalesce(opening_balance,0);
  select coalesce(sum(greatest(
    coalesce((data->>'qty')::numeric,0)*coalesce((data->>'unitCost')::numeric,0)-coalesce((data->>'discount')::numeric,0)
      -coalesce((data->>'amountPaid')::numeric,0),0
  )),0) into other_balance from public.salon_records
    where shop_id=target_shop and record_type='purchase' and external_id<>purchase_external_id and deleted_at is null
      and data->>'supplierId'=supplier_id and coalesce(data->>'status','Posted')<>'Reversed';
  select coalesce(sum((data->>'amount')::numeric),0) into account_payments from public.salon_records
    where shop_id=target_shop and record_type='supplier_payment' and deleted_at is null
      and data->>'supplierId'=supplier_id and coalesce(data->>'status','Posted')<>'Reversed';
  if opening_balance+other_balance < account_payments then
    raise exception 'Reverse allocated supplier payments before reversing this bill';
  end if;

  normalized_inventory := inventory_record.data || jsonb_build_object('quantity',available-quantity_value);
  movement := jsonb_build_object(
    'id','movement-purchase-reversal-' || purchase_external_id,
    'itemId',purchase_record.data->>'inventoryItemId','itemName',purchase_record.data->>'item',
    'type','purchase_reversal','quantity',-quantity_value,'unit',purchase_record.data->>'unit',
    'unitCost',coalesce((inventory_record.data->>'unitCost')::numeric,0),'reference',purchase_external_id,
    'reason',trim(reversal_reason),'createdBy',actor::text,'createdAt',now()
  );
  perform set_config('salon.purchase_rpc','1',true);
  update public.salon_records set data=normalized_inventory where id=inventory_record.id;
  update public.salon_records set data=purchase_record.data || jsonb_build_object(
    'status','Reversed','reversalReason',trim(reversal_reason),'reversedBy',actor::text,'reversedAt',now()
  ) where id=purchase_record.id returning * into purchase_record;
  insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
  values(target_shop,'stock_movement','movement-purchase-reversal-' || purchase_external_id,movement,actor);
  return jsonb_build_object('ok',true,'purchase',purchase_record.data,'inventoryItem',normalized_inventory,'movement',movement);
end;
$$;
revoke all on function public.salon_reverse_purchase(uuid,text,text) from public,anon;
grant execute on function public.salon_reverse_purchase(uuid,text,text) to authenticated;
