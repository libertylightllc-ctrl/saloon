create or replace function salon_private.audit_record() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('salon.restore_rpc',true),'')='1' then return new; end if;
  insert into public.salon_audit_events(shop_id,actor_id,action,entity_id)
  values(new.shop_id,auth.uid(),'record.' || lower(TG_OP) || '.' || new.record_type,new.id::text);
  return new;
end;
$$;
revoke all on function salon_private.audit_record() from public;

create or replace function salon_private.audit_document() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(current_setting('salon.restore_rpc',true),'')='1' then return new; end if;
  insert into public.salon_audit_events(shop_id,actor_id,action,entity_id)
  values(new.shop_id,auth.uid(),'document.' || lower(TG_OP),new.id::text);
  return new;
end;
$$;
revoke all on function salon_private.audit_document() from public;

create or replace function salon_private.apply_sale_to_customer_booking() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ticket_record public.salon_records%rowtype; deposit_expected numeric; booking_id text := coalesce(new.data->>'bookingId',''); customer_id text := coalesce(new.data->>'customerId','');
begin
  if new.record_type<>'sale' or coalesce(current_setting('salon.restore_rpc',true),'')='1' then return new; end if;
  if booking_id<>'' then
    select * into ticket_record from public.salon_records where shop_id=new.shop_id and record_type='queue_ticket'
      and external_id=booking_id and deleted_at is null for update;
    if not found or ticket_record.data->>'status' not in ('Booked','Waiting','In chair') then raise exception 'Selected booking is not available'; end if;
    if ticket_record.data->>'customerId'<>customer_id then raise exception 'Booking customer does not match the sale'; end if;
    deposit_expected := least(coalesce((ticket_record.data->>'deposit')::numeric,0),coalesce((new.data->>'amount')::numeric,0));
    if abs(coalesce((new.data->>'depositApplied')::numeric,0)-deposit_expected)>0.0005 then raise exception 'Booking deposit does not match the held balance'; end if;
    if deposit_expected>0 and ticket_record.data->>'depositStatus'<>'Held' then raise exception 'Booking deposit is not available'; end if;
  end if;
  perform set_config('salon.crm_rpc','1',true);
  if booking_id<>'' then
    update public.salon_records set data=data || jsonb_build_object('status','Completed','depositStatus',case when deposit_expected>0 then 'Redeemed' else 'None' end,
      'saleId',new.external_id,'completedAt',coalesce(new.data->>'createdAt',now()::text),'updatedAt',now()) where id=ticket_record.id;
    update public.salon_records set data=data || jsonb_build_object('status','Completed','depositStatus',case when deposit_expected>0 then 'Redeemed' else 'None' end,
      'saleId',new.external_id,'completedAt',coalesce(new.data->>'createdAt',now()::text),'updatedAt',now())
      where shop_id=new.shop_id and record_type='appointment' and external_id=booking_id and deleted_at is null;
  end if;
  if customer_id<>'' and customer_id<>'walk-in-guest' then update public.salon_records set data=data || jsonb_build_object(
    'visits',coalesce((data->>'visits')::integer,0)+1,'lastVisit',left(coalesce(new.data->>'createdAt',now()::text),10),'updatedAt',now())
    where shop_id=new.shop_id and record_type='customer' and external_id=customer_id and deleted_at is null; end if;
  return new;
end;
$$;
revoke all on function salon_private.apply_sale_to_customer_booking() from public;

create or replace function public.salon_preview_restore(target_shop uuid,backup_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare backup public.salon_backups%rowtype; shop public.salon_shops%rowtype; current_records integer; current_documents integer; missing_files integer;
begin
  if auth.uid() is null or not salon_private.is_platform_admin() then
    raise exception 'Platform Admin authorization is required for recovery';
  end if;
  select * into shop from public.salon_shops where id=target_shop;
  if not found then raise exception 'Shop not found'; end if;
  select * into backup from public.salon_backups where id=backup_id and shop_id=target_shop;
  if not found then raise exception 'Cloud backup not found'; end if;
  if md5(backup.snapshot::text)<>backup.checksum
    or backup.snapshot->>'format'<>'salon-control-cloud-backup'
    or backup.snapshot->>'formatVersion'<>'1'
    or (backup.snapshot->>'shopId')::uuid<>target_shop then
    raise exception 'Backup integrity verification failed';
  end if;
  select count(*) into current_records from public.salon_records where shop_id=target_shop;
  select count(*) into current_documents from public.salon_documents where shop_id=target_shop;
  select count(*) into missing_files
    from jsonb_array_elements(backup.snapshot->'documents') document
    where nullif(document->>'objectPath','') is not null
      and not exists(select 1 from storage.objects object where object.bucket_id='salon-documents' and object.name=document->>'objectPath');
  return jsonb_build_object(
    'ok',true,'backupId',backup.id,'label',backup.label,'createdAt',backup.created_at,'checksum',backup.checksum,
    'shopCode',shop.code,'shopName',shop.name,
    'currentRecordCount',current_records,'snapshotRecordCount',jsonb_array_length(backup.snapshot->'records'),
    'currentDocumentCount',current_documents,'snapshotDocumentCount',jsonb_array_length(backup.snapshot->'documents'),
    'missingFileCount',missing_files,'confirmationText','RESTORE ' || shop.code,
    'preserved',jsonb_build_array('shop identity','user access','audit history','stored file blobs')
  );
end;
$$;
revoke all on function public.salon_preview_restore(uuid,uuid) from public,anon;
grant execute on function public.salon_preview_restore(uuid,uuid) to authenticated;

create or replace function public.salon_restore_backup(target_shop uuid,backup_id uuid,confirmation_text text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); backup public.salon_backups%rowtype; shop public.salon_shops%rowtype; item jsonb; safety_result jsonb; safety_id uuid; restored_records integer:=0; restored_documents integer:=0;
begin
  if actor is null or not salon_private.is_platform_admin() then
    raise exception 'Platform Admin authorization is required for recovery';
  end if;
  select * into shop from public.salon_shops where id=target_shop;
  if not found then raise exception 'Shop not found'; end if;
  if confirmation_text is distinct from 'RESTORE ' || shop.code then raise exception 'Recovery confirmation does not match'; end if;
  select * into backup from public.salon_backups where id=backup_id and shop_id=target_shop for share;
  if not found then raise exception 'Cloud backup not found'; end if;
  if md5(backup.snapshot::text)<>backup.checksum
    or backup.snapshot->>'format'<>'salon-control-cloud-backup'
    or backup.snapshot->>'formatVersion'<>'1'
    or (backup.snapshot->>'shopId')::uuid<>target_shop then
    raise exception 'Backup integrity verification failed';
  end if;

  safety_result:=public.salon_create_backup(target_shop,'Automatic pre-restore snapshot');
  safety_id:=(safety_result->'backup'->>'id')::uuid;
  perform set_config('salon.restore_rpc','1',true);
  perform set_config('salon.close_rpc','1',true);
  perform set_config('salon.period_rpc','1',true);
  perform set_config('salon.expense_rpc','1',true);
  perform set_config('salon.purchase_rpc','1',true);
  perform set_config('salon.supplier_payment_rpc','1',true);
  perform set_config('salon.inventory_rpc','1',true);
  perform set_config('salon.master_data_rpc','1',true);
  perform set_config('salon.crm_rpc','1',true);
  perform set_config('salon.payroll_rpc','1',true);
  perform set_config('salon.compliance_rpc','1',true);

  delete from public.salon_documents where shop_id=target_shop;
  delete from public.salon_records where shop_id=target_shop;
  for item in select value from jsonb_array_elements(backup.snapshot->'records') loop
    insert into public.salon_records(id,shop_id,record_type,external_id,data,created_by,created_at,updated_at,deleted_at)
    values((item->>'id')::uuid,target_shop,item->>'recordType',item->>'externalId',item->'data',nullif(item->>'createdBy','')::uuid,
      (item->>'createdAt')::timestamptz,(item->>'updatedAt')::timestamptz,nullif(item->>'deletedAt','')::timestamptz);
    restored_records:=restored_records+1;
  end loop;
  for item in select value from jsonb_array_elements(backup.snapshot->'documents') loop
    insert into public.salon_documents(id,shop_id,subject_user_id,title,category,issue_date,expiry_date,reminder_days,object_path,created_at)
    values((item->>'id')::uuid,target_shop,nullif(item->>'subjectUserId','')::uuid,item->>'title',item->>'category',
      nullif(item->>'issueDate','')::date,nullif(item->>'expiryDate','')::date,coalesce((item->>'reminderDays')::integer,30),nullif(item->>'objectPath',''),(item->>'createdAt')::timestamptz);
    restored_documents:=restored_documents+1;
  end loop;
  insert into public.salon_audit_events(shop_id,actor_id,action,entity_id)
  values(target_shop,actor,'backup.restored',backup.id::text || ':safety:' || safety_id::text);
  return jsonb_build_object('ok',true,'backupId',backup.id,'safetyBackupId',safety_id,'recordCount',restored_records,'documentCount',restored_documents,'restoredAt',now());
end;
$$;
revoke all on function public.salon_restore_backup(uuid,uuid,text) from public,anon;
grant execute on function public.salon_restore_backup(uuid,uuid,text) to authenticated;
