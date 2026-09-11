create or replace function salon_private.protect_controlled_compliance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare kind text := case when tg_op='DELETE' then old.record_type else new.record_type end;
begin
  if kind in ('compliance_document','inspection','hygiene_log') and auth.uid() is not null
    and coalesce(current_setting('salon.compliance_rpc',true),'') <> '1'
  then raise exception 'Compliance records must use the controlled compliance workflow'; end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function salon_private.protect_controlled_compliance() from public;
drop trigger if exists salon_controlled_compliance_guard on public.salon_records;
create trigger salon_controlled_compliance_guard before insert or update or delete on public.salon_records
for each row execute function salon_private.protect_controlled_compliance();

create or replace function salon_private.can_manage_compliance(target_shop uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (salon_private.is_platform_admin() and exists(select 1 from public.salon_shops where id=target_shop and status='active'))
    or salon_private.has_shop_role(target_shop,array['owner','shop_admin']);
$$;
revoke all on function salon_private.can_manage_compliance(uuid) from public;

create or replace function public.salon_save_compliance_document(
  target_shop uuid,
  document_external_id text,
  document_data jsonb,
  change_reason text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  existing public.salon_records%rowtype;
  document_type text := trim(coalesce(document_data->>'type',''));
  holder_name text := trim(coalesce(document_data->>'holder',''));
  issue_value date;
  expiry_value date;
  reminder_value integer := coalesce((document_data->>'reminderDays')::integer,30);
  cost_value numeric := coalesce((document_data->>'renewalCost')::numeric,0);
  previous_history jsonb := '[]'::jsonb;
  evidence_file jsonb;
  normalized_document jsonb;
begin
  if actor is null or not salon_private.can_manage_compliance(target_shop) then raise exception 'Management authorization is required for compliance records'; end if;
  if length(trim(coalesce(document_external_id,'')))<3 then raise exception 'Compliance document reference is required'; end if;
  if length(document_type) not between 1 and 160 or length(holder_name) not between 1 and 160 then raise exception 'Document type and holder are required'; end if;
  if length(trim(coalesce(document_data->>'number','')))>160 then raise exception 'Document number is too long'; end if;
  issue_value := nullif(document_data->>'issueDate','')::date;
  expiry_value := nullif(document_data->>'expiryDate','')::date;
  if expiry_value is null then raise exception 'Expiry date is required'; end if;
  if issue_value is not null and expiry_value<issue_value then raise exception 'Expiry date cannot be before issue date'; end if;
  if reminder_value not between 1 and 365 or cost_value<0 or cost_value>100000000 then raise exception 'Reminder days or renewal cost is invalid'; end if;

  select * into existing from public.salon_records where shop_id=target_shop and record_type='compliance_document'
    and external_id=document_external_id and deleted_at is null for update;
  if existing.id is not null and not coalesce((existing.data->>'active')::boolean,true) then raise exception 'Archived compliance record cannot be edited'; end if;
  if existing.id is not null and length(trim(coalesce(change_reason,'')))<3 then raise exception 'Compliance change reason is required'; end if;
  if exists(select 1 from public.salon_records where shop_id=target_shop and record_type='compliance_document'
    and external_id<>document_external_id and deleted_at is null and coalesce((data->>'active')::boolean,true)
    and lower(data->>'type')=lower(document_type) and lower(data->>'holder')=lower(holder_name)) then
    raise exception 'An active record already exists for this document and holder';
  end if;

  if existing.id is not null then
    previous_history := case when jsonb_typeof(existing.data->'history')='array' then existing.data->'history' else '[]'::jsonb end;
    previous_history := previous_history || jsonb_build_array((existing.data-'history') || jsonb_build_object(
      'supersededAt',now(),'supersededBy',actor::text,'changeReason',trim(change_reason)
    ));
  end if;
  evidence_file := coalesce(document_data->'evidenceFile',existing.data->'evidenceFile','null'::jsonb);
  normalized_document := jsonb_build_object(
    'id',document_external_id,'type',document_type,'holder',holder_name,
    'number',trim(coalesce(document_data->>'number','')),'issueDate',coalesce(issue_value::text,''),
    'expiryDate',expiry_value::text,'renewalCost',cost_value,'reminderDays',reminder_value,
    'evidence',trim(coalesce(document_data->>'evidence',existing.data->>'evidence','')),
    'evidenceFile',evidence_file,'active',true,'history',previous_history,
    'updatedAt',now(),'updatedBy',actor::text,'changeReason',trim(coalesce(change_reason,''))
  );
  if existing.id is null then normalized_document := normalized_document || jsonb_build_object('createdAt',now(),'createdBy',actor::text);
  else normalized_document := normalized_document || jsonb_build_object('createdAt',coalesce(existing.data->>'createdAt',existing.created_at::text)); end if;
  perform set_config('salon.compliance_rpc','1',true);
  if existing.id is null then
    insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
    values(target_shop,'compliance_document',document_external_id,normalized_document,actor);
  else update public.salon_records set data=normalized_document where id=existing.id; end if;
  return jsonb_build_object('ok',true,'document',normalized_document);
end;
$$;
revoke all on function public.salon_save_compliance_document(uuid,text,jsonb,text) from public,anon;
grant execute on function public.salon_save_compliance_document(uuid,text,jsonb,text) to authenticated;

create or replace function public.salon_archive_compliance_document(target_shop uuid,document_external_id text,archive_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); existing public.salon_records%rowtype; archived_document jsonb;
begin
  if actor is null or not salon_private.can_manage_compliance(target_shop) then raise exception 'Management authorization is required for compliance records'; end if;
  if length(trim(coalesce(archive_reason,'')))<3 then raise exception 'Compliance archive reason is required'; end if;
  select * into existing from public.salon_records where shop_id=target_shop and record_type='compliance_document'
    and external_id=document_external_id and deleted_at is null for update;
  if not found then raise exception 'Compliance record not found'; end if;
  if not coalesce((existing.data->>'active')::boolean,true) then return jsonb_build_object('ok',true,'idempotent',true,'document',existing.data); end if;
  archived_document := existing.data || jsonb_build_object('active',false,'archiveReason',trim(archive_reason),'archivedAt',now(),'archivedBy',actor::text);
  perform set_config('salon.compliance_rpc','1',true);
  update public.salon_records set data=archived_document where id=existing.id;
  return jsonb_build_object('ok',true,'document',archived_document);
end;
$$;
revoke all on function public.salon_archive_compliance_document(uuid,text,text) from public,anon;
grant execute on function public.salon_archive_compliance_document(uuid,text,text) to authenticated;

create or replace function public.salon_sign_inspection(
  target_shop uuid,
  inspection_external_id text,
  inspection_data jsonb,
  change_reason text default ''
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); existing public.salon_records%rowtype; due_value date; history_value jsonb := '[]'::jsonb; normalized_inspection jsonb; signer_label text;
begin
  if actor is null or not salon_private.can_manage_compliance(target_shop) then raise exception 'Management authorization is required for inspections'; end if;
  if length(trim(coalesce(inspection_external_id,'')))<3 then raise exception 'Inspection reference is required'; end if;
  if length(trim(coalesce(inspection_data->>'record',''))) not between 1 and 160 then raise exception 'Inspection name is required'; end if;
  if length(trim(coalesce(inspection_data->>'cadence',''))) not between 1 and 80 then raise exception 'Inspection cadence is required'; end if;
  due_value := nullif(inspection_data->>'dueDate','')::date;
  if due_value is null then raise exception 'Inspection due date is required'; end if;
  if length(trim(coalesce(inspection_data->>'evidence','')))<1 and coalesce(inspection_data->'evidenceFile'->>'storagePath','')='' then
    raise exception 'Inspection evidence is required';
  end if;
  select * into existing from public.salon_records where shop_id=target_shop and record_type='inspection'
    and external_id=inspection_external_id and deleted_at is null for update;
  if existing.id is not null and length(trim(coalesce(change_reason,'')))<3 then raise exception 'Inspection correction reason is required'; end if;
  if existing.id is not null then
    history_value := case when jsonb_typeof(existing.data->'history')='array' then existing.data->'history' else '[]'::jsonb end;
    history_value := history_value || jsonb_build_array((existing.data-'history') || jsonb_build_object('supersededAt',now(),'changeReason',trim(change_reason)));
  end if;
  if salon_private.is_platform_admin() then signer_label := 'Platform Admin'; else
    select case membership.role when 'owner' then 'Owner' when 'shop_admin' then 'Shop Admin' else initcap(membership.role) end into signer_label
    from public.salon_memberships membership where membership.shop_id=target_shop and membership.user_id=actor and membership.active;
  end if;
  normalized_inspection := jsonb_build_object(
    'id',inspection_external_id,'record',trim(inspection_data->>'record'),'cadence',trim(inspection_data->>'cadence'),
    'dueDate',due_value::text,'evidence',trim(coalesce(inspection_data->>'evidence','')),
    'evidenceFile',coalesce(inspection_data->'evidenceFile',existing.data->'evidenceFile','null'::jsonb),
    'signedBy',coalesce(signer_label,'Management'),'signedById',actor::text,'signedAt',now(),'history',history_value
  );
  perform set_config('salon.compliance_rpc','1',true);
  if existing.id is null then insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
    values(target_shop,'inspection',inspection_external_id,normalized_inspection,actor);
  else update public.salon_records set data=normalized_inspection where id=existing.id; end if;
  return jsonb_build_object('ok',true,'inspection',normalized_inspection);
end;
$$;
revoke all on function public.salon_sign_inspection(uuid,text,jsonb,text) from public,anon;
grant execute on function public.salon_sign_inspection(uuid,text,jsonb,text) to authenticated;

create or replace function public.salon_record_hygiene_log(target_shop uuid,log_external_id text,log_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); normalized_log jsonb; existing public.salon_records%rowtype;
begin
  if actor is null or not salon_private.can_manage_compliance(target_shop) then raise exception 'Management authorization is required for hygiene logs'; end if;
  if length(trim(coalesce(log_external_id,'')))<3 then raise exception 'Hygiene log reference is required'; end if;
  if length(trim(coalesce(log_data->>'device',''))) not between 1 and 160 or length(trim(coalesce(log_data->>'cycle',''))) not between 1 and 240 then
    raise exception 'Hygiene device and cycle are required';
  end if;
  if length(trim(coalesce(log_data->>'evidence','')))<1 and coalesce(log_data->'evidenceFile'->>'storagePath','')='' then
    raise exception 'Hygiene evidence is required';
  end if;
  select * into existing from public.salon_records where shop_id=target_shop and record_type='hygiene_log'
    and external_id=log_external_id and deleted_at is null;
  if found then return jsonb_build_object('ok',true,'idempotent',true,'log',existing.data); end if;
  normalized_log := jsonb_build_object(
    'id',log_external_id,'loggedAt',now(),'time',to_char(now(),'HH24:MI'),
    'device',trim(log_data->>'device'),'operator',trim(coalesce(log_data->>'operator','')),
    'cycle',trim(log_data->>'cycle'),'solution',trim(coalesce(log_data->>'solution','')),
    'singleUse',trim(coalesce(log_data->>'singleUse','')),'evidence',trim(coalesce(log_data->>'evidence','')),
    'evidenceFile',coalesce(log_data->'evidenceFile','null'::jsonb),'status','Ready','createdBy',actor::text
  );
  perform set_config('salon.compliance_rpc','1',true);
  insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
  values(target_shop,'hygiene_log',log_external_id,normalized_log,actor);
  return jsonb_build_object('ok',true,'idempotent',false,'log',normalized_log);
end;
$$;
revoke all on function public.salon_record_hygiene_log(uuid,text,jsonb) from public,anon;
grant execute on function public.salon_record_hygiene_log(uuid,text,jsonb) to authenticated;
