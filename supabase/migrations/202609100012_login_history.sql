create table public.salon_login_events (
  id bigint generated always as identity primary key,
  shop_id uuid references public.salon_shops(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('platform_admin','owner','shop_admin','cashier','staff')),
  signed_in_at timestamptz not null default now(),
  check ((role='platform_admin') or shop_id is not null)
);
create index salon_login_events_shop_time on public.salon_login_events(shop_id,signed_in_at desc);
create index salon_login_events_user_time on public.salon_login_events(user_id,signed_in_at desc);
alter table public.salon_login_events enable row level security;
revoke all on public.salon_login_events from anon,authenticated;
grant all on public.salon_login_events to service_role;
grant usage,select on sequence public.salon_login_events_id_seq to service_role;

create or replace function public.salon_record_login(target_shop uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  event_id bigint;
  event_time timestamptz;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if salon_private.is_platform_admin() then
    actor_role := 'platform_admin';
    if target_shop is not null and not exists (select 1 from public.salon_shops where id=target_shop) then
      raise exception 'Shop not found';
    end if;
  else
    if target_shop is null then raise exception 'Shop is required'; end if;
    select membership.role into actor_role
    from public.salon_memberships membership
    join public.salon_shops shop on shop.id=membership.shop_id
    where membership.shop_id=target_shop and membership.user_id=actor
      and membership.active and shop.status='active';
    if actor_role is null then raise exception 'Account is not active for this shop'; end if;
  end if;
  insert into public.salon_login_events(shop_id,user_id,role)
  values(target_shop,actor,actor_role)
  returning id,signed_in_at into event_id,event_time;
  return jsonb_build_object(
    'id',event_id,'shop_id',target_shop,'user_id',actor,'role',actor_role,'signed_in_at',event_time
  );
end;
$$;
revoke all on function public.salon_record_login(uuid) from public,anon;
grant execute on function public.salon_record_login(uuid) to authenticated;

create or replace function public.salon_login_history(target_shop uuid default null)
returns table(id bigint,shop_id uuid,shop_code text,user_id uuid,account_label text,role text,signed_in_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  manager boolean := false;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if salon_private.is_platform_admin() then
    manager := true;
  elsif target_shop is not null then
    select membership.role into actor_role
    from public.salon_memberships membership
    join public.salon_shops shop on shop.id=membership.shop_id
    where membership.shop_id=target_shop and membership.user_id=actor
      and membership.active and shop.status='active';
    if actor_role is null then raise exception 'Account is not active for this shop'; end if;
    manager := actor_role in ('owner','shop_admin');
  else
    raise exception 'Shop is required';
  end if;

  return query
  select event.id,event.shop_id,coalesce(shop.code,'PLATFORM'),event.user_id,
    left(event.user_id::text,8),event.role,event.signed_in_at
  from public.salon_login_events event
  left join public.salon_shops shop on shop.id=event.shop_id
  where (event.shop_id is not distinct from target_shop)
    and (manager or event.user_id=actor)
  order by event.signed_in_at desc
  limit 50;
end;
$$;
revoke all on function public.salon_login_history(uuid) from public,anon;
grant execute on function public.salon_login_history(uuid) to authenticated;
