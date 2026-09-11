create table if not exists public.salon_backups (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.salon_shops(id),
  label text not null check (length(trim(label)) between 3 and 120),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object'),
  record_count integer not null check (record_count>=0),
  document_count integer not null check (document_count>=0),
  audit_count integer not null check (audit_count>=0),
  checksum text not null check (checksum ~ '^[a-f0-9]{32}$'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists salon_backups_shop_created on public.salon_backups(shop_id,created_at desc);
alter table public.salon_backups enable row level security;
revoke all on public.salon_backups from anon,authenticated;
grant select on public.salon_backups to authenticated;
grant all on public.salon_backups to service_role;
drop policy if exists salon_backup_read on public.salon_backups;
create policy salon_backup_read on public.salon_backups for select to authenticated
using (salon_private.has_shop_role(shop_id,array['owner','shop_admin']));

create or replace function salon_private.protect_immutable_backup() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if coalesce(current_setting('salon.backup_admin',true),'')<>'1' then
    raise exception 'Cloud recovery snapshots are immutable';
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function salon_private.protect_immutable_backup() from public;
drop trigger if exists salon_backup_immutable_guard on public.salon_backups;
create trigger salon_backup_immutable_guard before update or delete on public.salon_backups
for each row execute function salon_private.protect_immutable_backup();

create or replace function public.salon_create_backup(target_shop uuid,backup_label text default 'Manual snapshot') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); payload jsonb; saved public.salon_backups%rowtype; records_total integer; documents_total integer; audits_total integer;
begin
  if actor is null or not (salon_private.is_platform_admin() or salon_private.has_shop_role(target_shop,array['owner','shop_admin'])) then
    raise exception 'Management authorization is required for cloud backups';
  end if;
  if length(trim(coalesce(backup_label,''))) not between 3 and 120 then raise exception 'Backup label must be between 3 and 120 characters'; end if;
  if not exists(select 1 from public.salon_shops where id=target_shop and status='active') then raise exception 'Shop is not active'; end if;
  select count(*) into records_total from public.salon_records where shop_id=target_shop;
  select count(*) into documents_total from public.salon_documents where shop_id=target_shop;
  select count(*) into audits_total from public.salon_audit_events where shop_id=target_shop;
  payload:=jsonb_build_object(
    'format','salon-control-cloud-backup','formatVersion',1,'createdAt',now(),'shopId',target_shop,
    'shop',(select to_jsonb(shop) from public.salon_shops shop where shop.id=target_shop),
    'memberships',coalesce((select jsonb_agg(jsonb_build_object('userId',membership.user_id,'role',membership.role,'active',membership.active,'createdAt',membership.created_at) order by membership.created_at) from public.salon_memberships membership where membership.shop_id=target_shop),'[]'::jsonb),
    'records',coalesce((select jsonb_agg(jsonb_build_object('id',record.id,'recordType',record.record_type,'externalId',record.external_id,'data',record.data,'createdBy',record.created_by,'createdAt',record.created_at,'updatedAt',record.updated_at,'deletedAt',record.deleted_at) order by record.created_at,record.id) from public.salon_records record where record.shop_id=target_shop),'[]'::jsonb),
    'documents',coalesce((select jsonb_agg(jsonb_build_object('id',document.id,'subjectUserId',document.subject_user_id,'title',document.title,'category',document.category,'issueDate',document.issue_date,'expiryDate',document.expiry_date,'reminderDays',document.reminder_days,'objectPath',document.object_path,'createdAt',document.created_at) order by document.created_at,document.id) from public.salon_documents document where document.shop_id=target_shop),'[]'::jsonb),
    'auditEvents',coalesce((select jsonb_agg(jsonb_build_object('id',event.id,'actorId',event.actor_id,'action',event.action,'entityId',event.entity_id,'createdAt',event.created_at) order by event.id) from public.salon_audit_events event where event.shop_id=target_shop),'[]'::jsonb)
  );
  insert into public.salon_backups(shop_id,label,snapshot,record_count,document_count,audit_count,checksum,created_by)
  values(target_shop,trim(backup_label),payload,records_total,documents_total,audits_total,md5(payload::text),actor) returning * into saved;
  insert into public.salon_audit_events(shop_id,actor_id,action,entity_id) values(target_shop,actor,'backup.created',saved.id::text);
  return jsonb_build_object('ok',true,'backup',jsonb_build_object('id',saved.id,'label',saved.label,'recordCount',saved.record_count,'documentCount',saved.document_count,'auditCount',saved.audit_count,'checksum',saved.checksum,'createdAt',saved.created_at));
end;
$$;
revoke all on function public.salon_create_backup(uuid,text) from public,anon;
grant execute on function public.salon_create_backup(uuid,text) to authenticated;

create or replace function public.salon_list_backups(target_shop uuid)
returns table(id uuid,label text,record_count integer,document_count integer,audit_count integer,checksum text,created_by uuid,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not (salon_private.is_platform_admin() or salon_private.has_shop_role(target_shop,array['owner','shop_admin'])) then
    raise exception 'Management authorization is required for cloud backups';
  end if;
  return query select backup.id,backup.label,backup.record_count,backup.document_count,backup.audit_count,backup.checksum,backup.created_by,backup.created_at
    from public.salon_backups backup where backup.shop_id=target_shop order by backup.created_at desc limit 50;
end;
$$;
revoke all on function public.salon_list_backups(uuid) from public,anon;
grant execute on function public.salon_list_backups(uuid) to authenticated;

create or replace function public.salon_get_backup(target_shop uuid,backup_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare backup public.salon_backups%rowtype;
begin
  if auth.uid() is null or not (salon_private.is_platform_admin() or salon_private.has_shop_role(target_shop,array['owner','shop_admin'])) then
    raise exception 'Management authorization is required for cloud backups';
  end if;
  select * into backup from public.salon_backups where id=backup_id and shop_id=target_shop;
  if not found then raise exception 'Cloud backup not found'; end if;
  return jsonb_build_object('id',backup.id,'label',backup.label,'createdAt',backup.created_at,'checksum',backup.checksum,'recordCount',backup.record_count,'documentCount',backup.document_count,'auditCount',backup.audit_count,'snapshot',backup.snapshot);
end;
$$;
revoke all on function public.salon_get_backup(uuid,uuid) from public,anon;
grant execute on function public.salon_get_backup(uuid,uuid) to authenticated;
