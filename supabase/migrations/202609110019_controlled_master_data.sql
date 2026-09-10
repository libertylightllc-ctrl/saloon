create or replace function salon_private.protect_controlled_master_data() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  kind text := case when tg_op='DELETE' then old.record_type else new.record_type end;
begin
  if kind in ('service','supplier') and auth.uid() is not null
    and coalesce(current_setting('salon.master_data_rpc',true),'') <> '1'
  then raise exception 'Services and suppliers must use the controlled master-data workflow'; end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function salon_private.protect_controlled_master_data() from public;
drop trigger if exists salon_controlled_master_data_guard on public.salon_records;
create trigger salon_controlled_master_data_guard
before insert or update or delete on public.salon_records
for each row execute function salon_private.protect_controlled_master_data();

create or replace function public.salon_save_service(
  target_shop uuid,
  service_external_id text,
  service_data jsonb,
  change_reason text default ''
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  existing public.salon_records%rowtype;
  duplicate_record public.salon_records%rowtype;
  recipe_line jsonb;
  normalized_service jsonb;
  service_name text := trim(coalesce(service_data->>'name',''));
  price_value numeric := coalesce((service_data->>'price')::numeric,-1);
  recipe_items jsonb := coalesce(service_data->'recipeItems','[]'::jsonb);
  names jsonb := case when jsonb_typeof(service_data->'names')='object' then service_data->'names' else '{}'::jsonb end;
  material_change boolean := false;
begin
  if actor is null or not (salon_private.is_platform_admin() or salon_private.has_shop_role(target_shop,array['owner','shop_admin'])) then
    raise exception 'Management authorization is required to manage services';
  end if;
  if length(trim(coalesce(service_external_id,''))) < 3 then raise exception 'Service reference is required'; end if;
  if length(service_name) not between 1 and 160 then raise exception 'Service name is required'; end if;
  if coalesce(service_data->>'category','') not in ('Hair','Beard','Color','Face','Massage','Custom') then raise exception 'Service category is invalid'; end if;
  if price_value < 0 or price_value > 1000000 then raise exception 'Service price is invalid'; end if;
  if length(coalesce(service_data->>'recipe','')) > 500 then raise exception 'Service recipe note is too long'; end if;
  if jsonb_typeof(recipe_items)<>'array' or jsonb_array_length(recipe_items)>50 then raise exception 'Service recipe is invalid'; end if;
  for recipe_line in select value from jsonb_array_elements(recipe_items)
  loop
    if length(coalesce(recipe_line->>'itemId',''))<3 or coalesce((recipe_line->>'quantity')::numeric,0)<=0 then
      raise exception 'Service recipe line is invalid';
    end if;
    if not exists (
      select 1 from public.salon_records inventory where inventory.shop_id=target_shop
        and inventory.record_type='inventory_item' and inventory.external_id=recipe_line->>'itemId'
        and inventory.deleted_at is null and coalesce((inventory.data->>'active')::boolean,true)
    ) then raise exception 'Service recipe inventory item is missing or archived'; end if;
  end loop;
  select * into existing from public.salon_records where shop_id=target_shop and record_type='service'
    and external_id=service_external_id and deleted_at is null for update;
  if existing.id is not null and not coalesce((existing.data->>'active')::boolean,true) then
    raise exception 'Archived service cannot be edited';
  end if;
  select * into duplicate_record from public.salon_records where shop_id=target_shop and record_type='service'
    and lower(data->>'name')=lower(service_name) and external_id<>service_external_id and deleted_at is null
    and coalesce((data->>'active')::boolean,true) limit 1;
  if found then raise exception 'An active service with this name already exists'; end if;

  normalized_service := jsonb_build_object(
    'id',service_external_id,'name',service_name,'names',names,'category',service_data->>'category',
    'price',price_value,'recipe',trim(coalesce(service_data->>'recipe','')),'recipeItems',recipe_items,'active',true
  );
  if existing.id is not null then
    material_change := (existing.data - array['updatedAt','updatedBy','changeReason'])
      is distinct from (normalized_service - array['updatedAt','updatedBy','changeReason']);
    if material_change and length(trim(coalesce(change_reason,'')))<3 then raise exception 'Service change reason is required'; end if;
    normalized_service := normalized_service || jsonb_build_object(
      'createdAt',coalesce(existing.data->>'createdAt',existing.created_at::text),
      'updatedAt',now(),'updatedBy',actor::text,'changeReason',trim(change_reason)
    );
  else
    normalized_service := normalized_service || jsonb_build_object('createdAt',now(),'createdBy',actor::text);
  end if;
  perform set_config('salon.master_data_rpc','1',true);
  if existing.id is not null then update public.salon_records set data=normalized_service where id=existing.id;
  else insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
    values(target_shop,'service',service_external_id,normalized_service,actor); end if;
  return jsonb_build_object('ok',true,'service',normalized_service);
end;
$$;
revoke all on function public.salon_save_service(uuid,text,jsonb,text) from public,anon;
grant execute on function public.salon_save_service(uuid,text,jsonb,text) to authenticated;

create or replace function public.salon_archive_service(target_shop uuid,service_external_id text,archive_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); service_record public.salon_records%rowtype;
begin
  if actor is null or not (salon_private.is_platform_admin() or salon_private.has_shop_role(target_shop,array['owner','shop_admin'])) then raise exception 'Management authorization is required to archive services'; end if;
  if length(trim(coalesce(archive_reason,'')))<3 then raise exception 'Service archive reason is required'; end if;
  select * into service_record from public.salon_records where shop_id=target_shop and record_type='service'
    and external_id=service_external_id and deleted_at is null for update;
  if not found then raise exception 'Service not found'; end if;
  if not coalesce((service_record.data->>'active')::boolean,true) then return jsonb_build_object('ok',true,'idempotent',true,'service',service_record.data); end if;
  perform set_config('salon.master_data_rpc','1',true);
  update public.salon_records set data=service_record.data || jsonb_build_object(
    'active',false,'archiveReason',trim(archive_reason),'archivedAt',now(),'archivedBy',actor::text
  ) where id=service_record.id returning * into service_record;
  return jsonb_build_object('ok',true,'service',service_record.data);
end;
$$;
revoke all on function public.salon_archive_service(uuid,text,text) from public,anon;
grant execute on function public.salon_archive_service(uuid,text,text) to authenticated;

create or replace function public.salon_save_supplier(target_shop uuid,supplier_external_id text,supplier_data jsonb,change_reason text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); existing public.salon_records%rowtype; duplicate_record public.salon_records%rowtype;
  supplier_name text := trim(coalesce(supplier_data->>'name',''));
  terms_value integer := coalesce((supplier_data->>'termsDays')::integer,0);
  opening_value numeric := coalesce((supplier_data->>'openingBalance')::numeric,0);
  normalized_supplier jsonb;
  has_activity boolean := false;
begin
  if actor is null or not (salon_private.is_platform_admin() or salon_private.has_shop_role(target_shop,array['owner','shop_admin'])) then raise exception 'Management authorization is required to manage suppliers'; end if;
  if length(trim(coalesce(supplier_external_id,'')))<3 then raise exception 'Supplier reference is required'; end if;
  if length(supplier_name) not between 1 and 160 then raise exception 'Supplier name is required'; end if;
  if terms_value<0 or terms_value>3650 or opening_value<0 or opening_value>100000000 then raise exception 'Supplier terms or opening balance is invalid'; end if;
  if length(coalesce(supplier_data->>'phone',''))>80 or length(coalesce(supplier_data->>'contact',''))>160 then raise exception 'Supplier contact details are too long'; end if;
  select * into existing from public.salon_records where shop_id=target_shop and record_type='supplier'
    and external_id=supplier_external_id and deleted_at is null for update;
  if existing.id is not null and not coalesce((existing.data->>'active')::boolean,true) then
    raise exception 'Archived supplier cannot be edited';
  end if;
  select * into duplicate_record from public.salon_records where shop_id=target_shop and record_type='supplier'
    and lower(data->>'name')=lower(supplier_name) and external_id<>supplier_external_id and deleted_at is null
    and coalesce((data->>'active')::boolean,true) limit 1;
  if found then raise exception 'An active supplier with this name already exists'; end if;
  if existing.id is not null then
    select exists(select 1 from public.salon_records activity where activity.shop_id=target_shop and activity.deleted_at is null
      and activity.record_type in ('purchase','supplier_payment') and activity.data->>'supplierId'=supplier_external_id) into has_activity;
    if has_activity and opening_value<>coalesce((existing.data->>'openingBalance')::numeric,0) then raise exception 'Opening balance cannot change after supplier activity exists'; end if;
    if length(trim(coalesce(change_reason,'')))<3 then raise exception 'Supplier change reason is required'; end if;
  end if;
  normalized_supplier := jsonb_build_object(
    'id',supplier_external_id,'name',supplier_name,'phone',trim(coalesce(supplier_data->>'phone','')),
    'contact',trim(coalesce(supplier_data->>'contact','')),'termsDays',terms_value,'openingBalance',opening_value,'active',true
  );
  if existing.id is not null then normalized_supplier := normalized_supplier || jsonb_build_object(
    'createdAt',coalesce(existing.data->>'createdAt',existing.created_at::text),'updatedAt',now(),'updatedBy',actor::text,'changeReason',trim(change_reason));
  else normalized_supplier := normalized_supplier || jsonb_build_object('createdAt',now(),'createdBy',actor::text); end if;
  perform set_config('salon.master_data_rpc','1',true);
  if existing.id is not null then update public.salon_records set data=normalized_supplier where id=existing.id;
  else insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
    values(target_shop,'supplier',supplier_external_id,normalized_supplier,actor); end if;
  return jsonb_build_object('ok',true,'supplier',normalized_supplier);
end;
$$;
revoke all on function public.salon_save_supplier(uuid,text,jsonb,text) from public,anon;
grant execute on function public.salon_save_supplier(uuid,text,jsonb,text) to authenticated;

create or replace function public.salon_archive_supplier(target_shop uuid,supplier_external_id text,archive_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); supplier_record public.salon_records%rowtype;
  opening_balance numeric := 0; billed_balance numeric := 0; prior_payments numeric := 0; payable numeric;
begin
  if actor is null or not (salon_private.is_platform_admin() or salon_private.has_shop_role(target_shop,array['owner','shop_admin'])) then raise exception 'Management authorization is required to archive suppliers'; end if;
  if length(trim(coalesce(archive_reason,'')))<3 then raise exception 'Supplier archive reason is required'; end if;
  select * into supplier_record from public.salon_records where shop_id=target_shop and record_type='supplier'
    and external_id=supplier_external_id and deleted_at is null for update;
  if not found then raise exception 'Supplier not found'; end if;
  if not coalesce((supplier_record.data->>'active')::boolean,true) then return jsonb_build_object('ok',true,'idempotent',true,'supplier',supplier_record.data); end if;
  opening_balance := coalesce((supplier_record.data->>'openingBalance')::numeric,0);
  select coalesce(sum(greatest(coalesce((data->>'qty')::numeric,0)*coalesce((data->>'unitCost')::numeric,0)
    -coalesce((data->>'discount')::numeric,0)-coalesce((data->>'amountPaid')::numeric,0),0)),0) into billed_balance
    from public.salon_records where shop_id=target_shop and record_type='purchase' and deleted_at is null
      and data->>'supplierId'=supplier_external_id and coalesce(data->>'status','Posted')<>'Reversed';
  select coalesce(sum((data->>'amount')::numeric),0) into prior_payments from public.salon_records
    where shop_id=target_shop and record_type='supplier_payment' and deleted_at is null
      and data->>'supplierId'=supplier_external_id and coalesce(data->>'status','Posted')<>'Reversed';
  payable := opening_balance+billed_balance-prior_payments;
  if abs(payable)>0.0005 then raise exception 'Supplier balance must be zero before archiving'; end if;
  perform set_config('salon.master_data_rpc','1',true);
  update public.salon_records set data=supplier_record.data || jsonb_build_object(
    'active',false,'archiveReason',trim(archive_reason),'archivedAt',now(),'archivedBy',actor::text
  ) where id=supplier_record.id returning * into supplier_record;
  return jsonb_build_object('ok',true,'supplier',supplier_record.data);
end;
$$;
revoke all on function public.salon_archive_supplier(uuid,text,text) from public,anon;
grant execute on function public.salon_archive_supplier(uuid,text,text) to authenticated;
