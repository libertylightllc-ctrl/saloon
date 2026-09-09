begin;

-- Separate names preserve unrelated tables in an existing project.
create schema if not exists salon_private;
revoke all on schema salon_private from public;
grant usage on schema salon_private to authenticated;

create table public.salon_shops (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,32}$'),
  name text not null check (length(trim(name)) between 1 and 160),
  country text not null check (country in ('AE','SA','QA','KW','BH','OM')),
  status text not null default 'active' check (status in ('active','suspended','archived')),
  vat_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.salon_platform_admins (
  user_id uuid primary key references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.salon_memberships (
  shop_id uuid not null references public.salon_shops(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','shop_admin','cashier','staff')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (shop_id,user_id)
);
create index salon_memberships_user on public.salon_memberships(user_id,shop_id);

-- Only a trusted server may provision memberships and platform admins.
-- User-editable Auth metadata is never consulted for authorization.
create function salon_private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.salon_platform_admins where user_id = (select auth.uid())
  );
$$;
create function salon_private.has_shop_role(target uuid, roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select salon_private.is_platform_admin() or exists (
    select 1 from public.salon_memberships m
    join public.salon_shops s on s.id = m.shop_id
    where m.shop_id = target and m.user_id = (select auth.uid())
      and m.active and s.status = 'active' and m.role = any(roles)
  );
$$;
revoke all on function salon_private.is_platform_admin() from public;
revoke all on function salon_private.has_shop_role(uuid,text[]) from public;
grant execute on function salon_private.is_platform_admin() to authenticated;
grant execute on function salon_private.has_shop_role(uuid,text[]) to authenticated;

alter table public.salon_shops enable row level security;
alter table public.salon_platform_admins enable row level security;
alter table public.salon_memberships enable row level security;
revoke all on public.salon_shops, public.salon_platform_admins, public.salon_memberships from anon, authenticated;
grant select on public.salon_shops, public.salon_memberships to authenticated;
grant all on public.salon_shops, public.salon_platform_admins, public.salon_memberships to service_role;

create policy salon_shop_read on public.salon_shops for select to authenticated
using (salon_private.has_shop_role(id, array['owner','shop_admin','cashier','staff']));
create policy salon_membership_read on public.salon_memberships for select to authenticated
using ((user_id = (select auth.uid()) and salon_private.has_shop_role(shop_id,array['owner','shop_admin','cashier','staff']))
  or salon_private.has_shop_role(shop_id,array['owner','shop_admin']));

create table public.salon_documents (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.salon_shops(id),
  subject_user_id uuid references auth.users(id),
  title text not null check (length(trim(title)) between 1 and 200),
  category text not null,
  issue_date date,
  expiry_date date,
  reminder_days integer not null default 30 check (reminder_days between 0 and 365),
  object_path text unique,
  created_at timestamptz not null default now(),
  check (issue_date is null or expiry_date is null or expiry_date >= issue_date),
  check (object_path is null or split_part(object_path,'/',1) = shop_id::text)
);
create index salon_documents_shop_expiry on public.salon_documents(shop_id,expiry_date);
alter table public.salon_documents enable row level security;
revoke all on public.salon_documents from anon, authenticated;
grant select, insert, update on public.salon_documents to authenticated;
grant all on public.salon_documents to service_role;
create policy salon_document_read on public.salon_documents for select to authenticated
using (salon_private.has_shop_role(shop_id,array['owner','shop_admin'])
  or (subject_user_id = (select auth.uid()) and salon_private.has_shop_role(shop_id,array['staff','cashier'])));
create policy salon_document_insert on public.salon_documents for insert to authenticated
with check (salon_private.has_shop_role(shop_id,array['owner','shop_admin']));
create policy salon_document_update on public.salon_documents for update to authenticated
using (salon_private.has_shop_role(shop_id,array['owner','shop_admin']))
with check (salon_private.has_shop_role(shop_id,array['owner','shop_admin']));

create table public.salon_audit_events (
  id bigint generated always as identity primary key,
  shop_id uuid references public.salon_shops(id),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_id text not null,
  created_at timestamptz not null default now()
);
alter table public.salon_audit_events enable row level security;
revoke all on public.salon_audit_events from anon, authenticated;
grant select on public.salon_audit_events to authenticated;
grant all on public.salon_audit_events to service_role;
grant usage, select on sequence public.salon_audit_events_id_seq to service_role;
create policy salon_audit_read on public.salon_audit_events for select to authenticated
using (salon_private.has_shop_role(shop_id,array['owner','shop_admin']));

create table public.salon_records (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.salon_shops(id),
  record_type text not null check (record_type in (
    'service','customer','appointment','queue_ticket','sale','purchase','expense',
    'inventory_item','cash_closing','staff_payment','inspection','hygiene_log',
    'product_registration','accounting_entry','shop_setting'
  )),
  external_id text not null,
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(shop_id,record_type,external_id)
);
create index salon_records_shop_type on public.salon_records(shop_id,record_type) where deleted_at is null;
alter table public.salon_records enable row level security;
revoke all on public.salon_records from anon, authenticated;
grant select,insert,update on public.salon_records to authenticated;
grant all on public.salon_records to service_role;

create function salon_private.can_read_record(target uuid, kind text, subject text, creator uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select salon_private.has_shop_role(target,array['owner','shop_admin','cashier'])
    or (salon_private.has_shop_role(target,array['staff']) and (
      kind in ('service','customer','appointment','queue_ticket','inventory_item','shop_setting')
      or subject = (select auth.uid())::text or creator = (select auth.uid())
    ));
$$;
create function salon_private.can_write_record(target uuid, kind text, creator uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select salon_private.has_shop_role(target,array['owner','shop_admin'])
    or (salon_private.has_shop_role(target,array['cashier']) and kind in (
      'customer','appointment','queue_ticket','sale','purchase','expense','inventory_item','cash_closing'
    ))
    or (salon_private.has_shop_role(target,array['staff']) and kind in ('sale','queue_ticket')
      and creator = (select auth.uid()));
$$;
revoke all on function salon_private.can_read_record(uuid,text,text,uuid) from public;
revoke all on function salon_private.can_write_record(uuid,text,uuid) from public;
grant execute on function salon_private.can_read_record(uuid,text,text,uuid) to authenticated;
grant execute on function salon_private.can_write_record(uuid,text,uuid) to authenticated;

create policy salon_record_read on public.salon_records for select to authenticated
using (salon_private.can_read_record(shop_id,record_type,data->>'subject_user_id',created_by));
create policy salon_record_insert on public.salon_records for insert to authenticated
with check (salon_private.can_write_record(shop_id,record_type,created_by));
create policy salon_record_update on public.salon_records for update to authenticated
using (salon_private.can_write_record(shop_id,record_type,created_by))
with check (salon_private.can_write_record(shop_id,record_type,created_by));

create function salon_private.touch_record() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
revoke all on function salon_private.touch_record() from public;
create trigger salon_record_touch before update on public.salon_records
for each row execute function salon_private.touch_record();

create function salon_private.audit_record() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.salon_audit_events(shop_id,actor_id,action,entity_id)
  values(new.shop_id,auth.uid(),'record.' || lower(TG_OP) || '.' || new.record_type,new.id::text);
  return new;
end;
$$;
revoke all on function salon_private.audit_record() from public;
create trigger salon_record_audit after insert or update on public.salon_records
for each row execute function salon_private.audit_record();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('salon-documents','salon-documents',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy salon_file_read on storage.objects for select to authenticated
using (bucket_id='salon-documents' and salon_private.can_read_record(
  ((storage.foldername(name))[1])::uuid,'shop_setting',null::text,null));
create policy salon_file_insert on storage.objects for insert to authenticated
with check (bucket_id='salon-documents' and salon_private.has_shop_role(
  ((storage.foldername(name))[1])::uuid,array['owner','shop_admin']));
create policy salon_file_update on storage.objects for update to authenticated
using (bucket_id='salon-documents' and salon_private.has_shop_role(
  ((storage.foldername(name))[1])::uuid,array['owner','shop_admin']))
with check (bucket_id='salon-documents' and salon_private.has_shop_role(
  ((storage.foldername(name))[1])::uuid,array['owner','shop_admin']));

create function salon_private.audit_document() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.salon_audit_events(shop_id,actor_id,action,entity_id)
  values(new.shop_id,auth.uid(),'document.' || lower(TG_OP),new.id::text);
  return new;
end;
$$;
revoke all on function salon_private.audit_document() from public;
create trigger salon_document_audit after insert or update on public.salon_documents
for each row execute function salon_private.audit_document();

commit;
