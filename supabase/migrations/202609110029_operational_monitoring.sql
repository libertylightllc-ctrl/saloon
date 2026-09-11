create table if not exists public.salon_client_events (
  id bigint generated always as identity primary key,
  shop_id uuid references public.salon_shops(id),
  user_id uuid not null references auth.users(id),
  severity text not null check (severity in ('warning','error')),
  category text not null check (length(category) between 2 and 60),
  fingerprint text not null check (length(fingerprint) between 8 and 64),
  message text not null check (length(message) between 1 and 500),
  route text not null default '',
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context)='object'),
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolution text check (resolution is null or length(trim(resolution)) between 3 and 240)
);
create index if not exists salon_client_events_open on public.salon_client_events(resolved_at,created_at desc);
create index if not exists salon_client_events_shop on public.salon_client_events(shop_id,created_at desc);
alter table public.salon_client_events enable row level security;
revoke all on public.salon_client_events from anon,authenticated;
grant select on public.salon_client_events to authenticated;
grant all on public.salon_client_events to service_role;
drop policy if exists salon_client_event_platform_read on public.salon_client_events;
create policy salon_client_event_platform_read on public.salon_client_events for select to authenticated
using (salon_private.is_platform_admin());

create or replace function salon_private.protect_client_event() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if coalesce(current_setting('salon.monitoring_rpc',true),'')<>'1' then raise exception 'Operational events are append-only'; end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function salon_private.protect_client_event() from public;
drop trigger if exists salon_client_event_immutable_guard on public.salon_client_events;
create trigger salon_client_event_immutable_guard before update or delete on public.salon_client_events
for each row execute function salon_private.protect_client_event();

create or replace function public.salon_report_client_event(
  target_shop uuid,event_severity text,event_category text,event_fingerprint text,event_message text,event_route text,event_context jsonb,event_occurred_at timestamptz
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); safe_message text; saved_id bigint; safe_context jsonb;
begin
  if actor is null then raise exception 'Authentication is required'; end if;
  if target_shop is null then
    if not salon_private.is_platform_admin() then raise exception 'A shop is required'; end if;
  elsif not salon_private.has_shop_role(target_shop,array['owner','shop_admin','cashier','staff']) then raise exception 'Account is not active for this shop'; end if;
  if event_severity not in ('warning','error') then raise exception 'Unsupported event severity'; end if;
  if length(trim(coalesce(event_category,''))) not between 2 and 60 then raise exception 'Event category is invalid'; end if;
  if (select count(*) from public.salon_client_events where user_id=actor and created_at>now()-interval '1 hour')>=60 then
    return jsonb_build_object('ok',false,'accepted',false,'reason','rate_limited');
  end if;
  safe_message:=left(trim(coalesce(event_message,'Unknown application error')),500);
  safe_message:=regexp_replace(safe_message,'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}','[email]','g');
  safe_message:=regexp_replace(safe_message,'(?i)(bearer|token|password)[ :=]+[^ ]+','\1 [redacted]','g');
  safe_context:=jsonb_strip_nulls(jsonb_build_object(
    'operation',left(coalesce(event_context->>'operation',''),80),
    'release',left(coalesce(event_context->>'release',''),40),
    'online',event_context->'online',
    'viewport',left(coalesce(event_context->>'viewport',''),30),
    'status',left(coalesce(event_context->>'status',''),12)
  ));
  insert into public.salon_client_events(shop_id,user_id,severity,category,fingerprint,message,route,context,occurred_at)
  values(target_shop,actor,event_severity,trim(event_category),left(coalesce(nullif(event_fingerprint,''),md5(event_category||safe_message||coalesce(event_route,''))),64),
    safe_message,left(split_part(coalesce(event_route,''),'?',1),180),safe_context,least(coalesce(event_occurred_at,now()),now()+interval '5 minutes')) returning id into saved_id;
  return jsonb_build_object('ok',true,'accepted',true,'id',saved_id);
end;
$$;
revoke all on function public.salon_report_client_event(uuid,text,text,text,text,text,jsonb,timestamptz) from public,anon;
grant execute on function public.salon_report_client_event(uuid,text,text,text,text,text,jsonb,timestamptz) to authenticated;

create or replace function public.salon_platform_health() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare active_shops integer; shops_without_backup integer; errors_24h integer; unresolved integer; last_event timestamptz; latest_backup timestamptz;
begin
  if auth.uid() is null or not salon_private.is_platform_admin() then raise exception 'Platform Admin authorization is required'; end if;
  select count(*) into active_shops from public.salon_shops where status='active';
  select count(*) into shops_without_backup from public.salon_shops shop where shop.status='active'
    and not exists(select 1 from public.salon_backups backup where backup.shop_id=shop.id);
  select count(*) filter(where severity='error' and created_at>now()-interval '24 hours'),count(*) filter(where resolved_at is null),max(created_at)
    into errors_24h,unresolved,last_event from public.salon_client_events;
  select max(created_at) into latest_backup from public.salon_backups;
  return jsonb_build_object('ok',true,'status',case when errors_24h>0 or shops_without_backup>0 then 'attention' else 'healthy' end,
    'checkedAt',now(),'activeShops',active_shops,'shopsWithoutBackup',shops_without_backup,'errors24h',errors_24h,
    'unresolvedEvents',unresolved,'lastEventAt',last_event,'latestBackupAt',latest_backup);
end;
$$;
revoke all on function public.salon_platform_health() from public,anon;
grant execute on function public.salon_platform_health() to authenticated;

create or replace function public.salon_list_client_events(event_limit integer default 50)
returns table(id bigint,shop_id uuid,shop_code text,severity text,category text,fingerprint text,message text,route text,context jsonb,occurred_at timestamptz,resolved_at timestamptz,resolution text)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not salon_private.is_platform_admin() then raise exception 'Platform Admin authorization is required'; end if;
  return query select event.id,event.shop_id,shop.code,event.severity,event.category,event.fingerprint,event.message,event.route,event.context,
    event.occurred_at,event.resolved_at,event.resolution from public.salon_client_events event
    left join public.salon_shops shop on shop.id=event.shop_id order by event.resolved_at nulls first,event.created_at desc limit least(greatest(event_limit,1),100);
end;
$$;
revoke all on function public.salon_list_client_events(integer) from public,anon;
grant execute on function public.salon_list_client_events(integer) to authenticated;

create or replace function public.salon_resolve_client_event(event_id bigint,resolution_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); saved public.salon_client_events%rowtype;
begin
  if actor is null or not salon_private.is_platform_admin() then raise exception 'Platform Admin authorization is required'; end if;
  if length(trim(coalesce(resolution_note,''))) not between 3 and 240 then raise exception 'Resolution note must be between 3 and 240 characters'; end if;
  perform set_config('salon.monitoring_rpc','1',true);
  update public.salon_client_events set resolved_at=now(),resolved_by=actor,resolution=trim(resolution_note) where id=event_id and resolved_at is null returning * into saved;
  if not found then raise exception 'Open operational event not found'; end if;
  insert into public.salon_audit_events(shop_id,actor_id,action,entity_id) values(saved.shop_id,actor,'monitoring.resolved',saved.id::text);
  return jsonb_build_object('ok',true,'id',saved.id,'resolvedAt',saved.resolved_at);
end;
$$;
revoke all on function public.salon_resolve_client_event(bigint,text) from public,anon;
grant execute on function public.salon_resolve_client_event(bigint,text) to authenticated;
