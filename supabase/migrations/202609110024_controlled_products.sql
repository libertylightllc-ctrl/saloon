create or replace function salon_private.protect_controlled_compliance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare kind text := case when tg_op='DELETE' then old.record_type else new.record_type end;
begin
  if kind in ('compliance_document','inspection','hygiene_log','product_registration') and auth.uid() is not null
    and coalesce(current_setting('salon.compliance_rpc',true),'') <> '1'
  then raise exception 'Compliance records must use the controlled compliance workflow'; end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function salon_private.protect_controlled_compliance() from public;

create or replace function public.salon_save_product_registration(
  target_shop uuid,
  product_external_id text,
  product_data jsonb,
  change_reason text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  existing public.salon_records%rowtype;
  product_name text := trim(coalesce(product_data->>'name',''));
  sku_value text := trim(coalesce(product_data->>'sku',''));
  status_value text := trim(coalesce(product_data->>'status','Pending'));
  expiry_value date;
  previous_history jsonb := '[]'::jsonb;
  evidence_file jsonb;
  normalized_product jsonb;
begin
  if actor is null or not salon_private.can_manage_compliance(target_shop) then raise exception 'Management authorization is required for product compliance'; end if;
  if length(trim(coalesce(product_external_id,'')))<3 then raise exception 'Product record reference is required'; end if;
  if length(product_name) not between 1 and 160 then raise exception 'Product name is required'; end if;
  if length(sku_value) not between 1 and 160 then raise exception 'Product barcode or SKU is required'; end if;
  if status_value not in ('Verified','Pending','Blocked','Not required') then raise exception 'Product compliance status is invalid'; end if;
  expiry_value := nullif(product_data->>'expiryDate','')::date;
  if status_value='Verified' and length(trim(coalesce(product_data->>'authorityReference','')))<1
    and length(trim(coalesce(product_data->>'evidence','')))<1
    and coalesce(product_data->'evidenceFile'->>'storagePath','')=''
  then raise exception 'Verified products require an authority reference or evidence'; end if;

  select * into existing from public.salon_records where shop_id=target_shop and record_type='product_registration'
    and external_id=product_external_id and deleted_at is null for update;
  if existing.id is not null and not coalesce((existing.data->>'active')::boolean,true) then raise exception 'Archived product record cannot be edited'; end if;
  if existing.id is not null and length(trim(coalesce(change_reason,'')))<3 then raise exception 'Product compliance change reason is required'; end if;
  if exists(select 1 from public.salon_records where shop_id=target_shop and record_type='product_registration'
    and external_id<>product_external_id and deleted_at is null and coalesce((data->>'active')::boolean,true)
    and lower(data->>'sku')=lower(sku_value)) then raise exception 'An active product already uses this barcode or SKU'; end if;

  if existing.id is not null then
    previous_history := case when jsonb_typeof(existing.data->'history')='array' then existing.data->'history' else '[]'::jsonb end;
    previous_history := previous_history || jsonb_build_array((existing.data-'history') || jsonb_build_object(
      'supersededAt',now(),'supersededBy',actor::text,'changeReason',trim(change_reason)
    ));
  end if;
  evidence_file := coalesce(product_data->'evidenceFile',existing.data->'evidenceFile','null'::jsonb);
  normalized_product := jsonb_build_object(
    'id',product_external_id,'name',product_name,'brand',trim(coalesce(product_data->>'brand','')),
    'sku',sku_value,'authorityReference',trim(coalesce(product_data->>'authorityReference','')),
    'expiryDate',coalesce(expiry_value::text,''),'supplier',trim(coalesce(product_data->>'supplier','')),
    'status',status_value,'evidence',trim(coalesce(product_data->>'evidence',existing.data->>'evidence','')),
    'evidenceFile',evidence_file,'active',true,'history',previous_history,
    'updatedAt',now(),'updatedBy',actor::text,'changeReason',trim(coalesce(change_reason,''))
  );
  if existing.id is null then normalized_product := normalized_product || jsonb_build_object('createdAt',now(),'createdBy',actor::text);
  else normalized_product := normalized_product || jsonb_build_object('createdAt',coalesce(existing.data->>'createdAt',existing.created_at::text)); end if;
  perform set_config('salon.compliance_rpc','1',true);
  if existing.id is null then
    insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
    values(target_shop,'product_registration',product_external_id,normalized_product,actor);
  else update public.salon_records set data=normalized_product where id=existing.id; end if;
  return jsonb_build_object('ok',true,'product',normalized_product);
end;
$$;
revoke all on function public.salon_save_product_registration(uuid,text,jsonb,text) from public,anon;
grant execute on function public.salon_save_product_registration(uuid,text,jsonb,text) to authenticated;

create or replace function public.salon_archive_product_registration(target_shop uuid,product_external_id text,archive_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); existing public.salon_records%rowtype; archived_product jsonb;
begin
  if actor is null or not salon_private.can_manage_compliance(target_shop) then raise exception 'Management authorization is required for product compliance'; end if;
  if length(trim(coalesce(archive_reason,'')))<3 then raise exception 'Product archive reason is required'; end if;
  select * into existing from public.salon_records where shop_id=target_shop and record_type='product_registration'
    and external_id=product_external_id and deleted_at is null for update;
  if not found then raise exception 'Product compliance record not found'; end if;
  if not coalesce((existing.data->>'active')::boolean,true) then return jsonb_build_object('ok',true,'idempotent',true,'product',existing.data); end if;
  archived_product := existing.data || jsonb_build_object('active',false,'archiveReason',trim(archive_reason),'archivedAt',now(),'archivedBy',actor::text);
  perform set_config('salon.compliance_rpc','1',true);
  update public.salon_records set data=archived_product where id=existing.id;
  return jsonb_build_object('ok',true,'product',archived_product);
end;
$$;
revoke all on function public.salon_archive_product_registration(uuid,text,text) from public,anon;
grant execute on function public.salon_archive_product_registration(uuid,text,text) to authenticated;
