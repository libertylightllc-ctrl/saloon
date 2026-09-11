create table if not exists public.salon_access_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.salon_shops(id),
  user_id uuid not null references auth.users(id),
  status text not null default 'open' check (status in ('open','fulfilled','dismissed')),
  request_count integer not null default 1 check (request_count between 1 and 20),
  requested_at timestamptz not null default now(),
  last_requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolution text check (resolution is null or length(trim(resolution)) between 3 and 160)
);
create unique index if not exists salon_access_request_one_open on public.salon_access_requests(shop_id,user_id) where status='open';
create index if not exists salon_access_request_shop_status on public.salon_access_requests(shop_id,status,last_requested_at desc);
alter table public.salon_access_requests enable row level security;
revoke all on public.salon_access_requests from anon,authenticated;
grant select on public.salon_access_requests to authenticated;
grant all on public.salon_access_requests to service_role;
drop policy if exists salon_access_request_management_read on public.salon_access_requests;
create policy salon_access_request_management_read on public.salon_access_requests for select to authenticated
using (salon_private.has_shop_role(shop_id,array['owner','shop_admin']));

create or replace function salon_private.protect_access_request() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if coalesce(current_setting('salon.access_request_rpc',true),'')<>'1' then raise exception 'Access requests require the controlled recovery workflow'; end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function salon_private.protect_access_request() from public;
drop trigger if exists salon_access_request_guard on public.salon_access_requests;
create trigger salon_access_request_guard before update or delete on public.salon_access_requests
for each row execute function salon_private.protect_access_request();

create or replace function public.salon_request_access_help(shop_code text,login_username text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target_shop public.salon_shops%rowtype; target_user uuid; normalized_username text:=lower(trim(coalesce(login_username,''))); existing public.salon_access_requests%rowtype; has_existing boolean:=false;
begin
  if length(trim(coalesce(shop_code,'')))>32 or length(normalized_username)>64 then
    perform pg_sleep(0.15);
    return jsonb_build_object('ok',true,'accepted',true);
  end if;
  select * into target_shop from public.salon_shops where code=upper(trim(coalesce(shop_code,''))) and status='active';
  if found then
    select membership.user_id into target_user from public.salon_memberships membership
    join auth.users account on account.id=membership.user_id
    where membership.shop_id=target_shop.id and membership.active
      and lower(account.email)=lower(target_shop.code || '.' || normalized_username || '@auth.saloncontrol.app') limit 1;
  end if;
  if target_user is not null then
    select * into existing from public.salon_access_requests where shop_id=target_shop.id and user_id=target_user and status='open' for update;
    has_existing:=found;
    perform set_config('salon.access_request_rpc','1',true);
    if has_existing then
      if existing.last_requested_at<now()-interval '15 minutes' and existing.request_count<20 then
        update public.salon_access_requests set request_count=request_count+1,last_requested_at=now() where id=existing.id;
      end if;
    elsif (select count(*) from public.salon_access_requests where user_id=target_user and requested_at>now()-interval '24 hours')<3 then
      insert into public.salon_access_requests(shop_id,user_id) values(target_shop.id,target_user);
    end if;
  end if;
  perform pg_sleep(0.15);
  return jsonb_build_object('ok',true,'accepted',true);
end;
$$;
revoke all on function public.salon_request_access_help(text,text) from public;
grant execute on function public.salon_request_access_help(text,text) to anon,authenticated;

create or replace function public.salon_list_access_requests(target_shop uuid)
returns table(id uuid,user_id uuid,username text,display_name text,role text,status text,request_count integer,requested_at timestamptz,last_requested_at timestamptz,resolved_at timestamptz,resolution text)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not (salon_private.is_platform_admin() or salon_private.has_shop_role(target_shop,array['owner','shop_admin'])) then
    raise exception 'Management authorization is required';
  end if;
  return query select request.id,request.user_id,
    regexp_replace(split_part(account.email,'@',1),'^[^.]+\.',''),coalesce(account.raw_user_meta_data->>'display_name','Account'),membership.role,
    request.status,request.request_count,request.requested_at,request.last_requested_at,request.resolved_at,request.resolution
    from public.salon_access_requests request join auth.users account on account.id=request.user_id
    join public.salon_memberships membership on membership.shop_id=request.shop_id and membership.user_id=request.user_id
    where request.shop_id=target_shop order by (request.status='open') desc,request.last_requested_at desc limit 50;
end;
$$;
revoke all on function public.salon_list_access_requests(uuid) from public,anon;
grant execute on function public.salon_list_access_requests(uuid) to authenticated;

create or replace function public.salon_resolve_access_request(target_shop uuid,request_id uuid,resolution_status text,resolution_note text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); saved public.salon_access_requests%rowtype;
begin
  if actor is null or not (salon_private.is_platform_admin() or salon_private.has_shop_role(target_shop,array['owner','shop_admin'])) then
    raise exception 'Management authorization is required';
  end if;
  if resolution_status not in ('fulfilled','dismissed') then raise exception 'Unsupported recovery resolution'; end if;
  if length(trim(coalesce(resolution_note,''))) not between 3 and 160 then raise exception 'Resolution note must be between 3 and 160 characters'; end if;
  perform set_config('salon.access_request_rpc','1',true);
  update public.salon_access_requests set status=resolution_status,resolved_at=now(),resolved_by=actor,resolution=trim(resolution_note)
    where id=request_id and shop_id=target_shop and status='open' returning * into saved;
  if not found then raise exception 'Open access request not found'; end if;
  insert into public.salon_audit_events(shop_id,actor_id,action,entity_id) values(target_shop,actor,'access_request.' || resolution_status,saved.id::text);
  return jsonb_build_object('ok',true,'id',saved.id,'status',saved.status,'resolvedAt',saved.resolved_at);
end;
$$;
revoke all on function public.salon_resolve_access_request(uuid,uuid,text,text) from public,anon;
grant execute on function public.salon_resolve_access_request(uuid,uuid,text,text) to authenticated;
