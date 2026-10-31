-- Owner's fix list (final brief, 31 Oct 2026) D3: a changed booking link keeps working. When an owner changes their
-- link (Branch settings → Online booking → Change link), the old one is kept and sends people to the new one; the
-- website answers the old address with a permanent redirect. An old link stays the salon's: no other salon can take it,
-- so a link already shared on Instagram or Google Maps never opens someone else's page. Nothing existing is changed or
-- removed.

-- 1. Old links, with the branch they lead to.
create table public.booking_old_links (
  slug text not null,
  branch_id uuid not null references public.branches (id) on delete cascade,
  replaced_at timestamptz not null default now(),
  primary key (slug, branch_id)
);
alter table public.booking_old_links enable row level security;
revoke all on public.booking_old_links from anon, authenticated;

-- 2. Changing the link keeps the old one (as migration 55, plus the old link kept, and other salons' old links taken).
create or replace function public.set_online_booking(p_branch uuid, p_on boolean, p_slug text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner']::member_role[]);
  b branches;
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_name text;
begin
  select * into b from branches where id = p_branch for update;
  if v_slug <> '' then
    if v_slug !~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$' then
      raise exception 'invalid_booking_link' using errcode = '22023';
    end if;
    if exists (select 1 from branches where booking_slug = v_slug and id <> p_branch)
       or exists (select 1 from booking_old_links where slug = v_slug and branch_id <> p_branch) then
      raise exception 'link_taken' using errcode = '23505';
    end if;
  elsif b.booking_slug is not null then
    v_slug := b.booking_slug;
  else
    select bu.name || case when (select count(*) from branches x where x.business_id = bu.id) > 1 then ' ' || b.name else '' end
    into v_name from businesses bu where bu.id = b.business_id;
    v_slug := public.unique_booking_slug(v_name);
  end if;
  if b.booking_slug is not null and b.booking_slug <> v_slug then
    insert into booking_old_links (slug, branch_id) values (b.booking_slug, p_branch)
    on conflict (slug, branch_id) do update set replaced_at = now();
  end if;
  update branches set booking_slug = v_slug, settings = settings || jsonb_build_object('online_booking', coalesce(p_on, false))
  where id = p_branch;
  perform public.write_audit(m.business_id, p_branch, m.id, 'update', 'branch', p_branch,
    case when p_on then 'Online booking on: ' || v_slug else 'Online booking off' end
    || case when b.booking_slug is not null and b.booking_slug <> v_slug then ' (was ' || b.booking_slug || ')' else '' end);
  return v_slug;
end;
$$;

-- A new salon's link is never someone's old one (as migration 55, plus old links).
create or replace function public.unique_booking_slug(p_name text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_base text := left(trim(both '-' from regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g')), 34);
  v_slug text;
  v_n int := 1;
begin
  v_base := trim(both '-' from v_base);
  if char_length(v_base) < 3 then
    v_base := 'salon' || case when v_base = '' then '' else '-' || v_base end;
  end if;
  v_slug := v_base;
  while exists (select 1 from branches where booking_slug = v_slug)
        or exists (select 1 from booking_old_links where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end;
$$;

-- 3. For visitors: where an old link leads now (the current link of its booking page, while the page is on); null for
--    a link that is current, unknown, or whose page is off.
create function public.public_booking_link(p_slug text) returns text
language sql stable security definer set search_path = public as $$
  select b.booking_slug
  from booking_old_links o join branches b on b.id = o.branch_id
  where o.slug = lower(btrim(coalesce(p_slug, ''))) and b.booking_slug is distinct from o.slug
    and (public.booking_branch(b.booking_slug)).id is not null
    and not exists (select 1 from branches c where c.booking_slug = o.slug)
  order by o.replaced_at desc
  limit 1
$$;

revoke execute on function public.public_booking_link(text) from public;
grant execute on function public.public_booking_link(text) to anon, authenticated;
