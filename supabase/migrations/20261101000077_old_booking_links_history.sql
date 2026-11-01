-- Owner's fix list, 1 Nov 2026 (D3 not working): a salon's old booking links must keep working. Migration 75 kept an
-- old link only when it was changed after that migration went live, so links changed before it (Red Rose's on 20 and
-- 31 Oct) were lost and showed "This booking page is not available". Now:
--   1. every change of a branch's link keeps the old one, whatever makes the change;
--   2. the old links are found again in the salons' Activity ("Online booking on: …") and kept;
--   3. the booking page can tell a link whose salon switched booking off from a link that never existed.
-- Nothing existing is changed or removed.

-- 1. Every change of a branch's link keeps the old one (set_online_booking already does; this also covers any other way).
create function public.keep_old_booking_link() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into booking_old_links (slug, branch_id) values (old.booking_slug, new.id)
  on conflict (slug, branch_id) do update set replaced_at = now();
  return null;
end;
$$;

create trigger branches_keep_old_booking_link after update of booking_slug on public.branches
for each row when (old.booking_slug is not null and old.booking_slug is distinct from new.booking_slug)
execute function public.keep_old_booking_link();

-- 2. Old links from the Activity: every link a branch's "Online booking on: <link>" or "(was <link>)" names that is no
--    salon's current link. Kept as replaced when the branch next named another link. Running it again adds nothing.
create function public.backfill_booking_old_links() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  with mentions as (
    select a.entity_id as branch_id, a.created_at, m[1] as slug, m[2] as was
    from audit_log a
    cross join lateral regexp_match(a.summary, '^Online booking (?:on: ([a-z0-9-]+)|off)(?: \(was ([a-z0-9-]+)\))?$') m
    where a.entity_type = 'branch' and a.summary like 'Online booking %'
  ), used as (
    select branch_id, slug, created_at from mentions where slug is not null
    union all
    select branch_id, was, created_at from mentions where was is not null
  ), old as (
    select u.branch_id, u.slug, max(u.created_at) as last_seen
    from used u join branches b on b.id = u.branch_id
    where u.slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'
      and not exists (select 1 from branches c where c.booking_slug = u.slug)
    group by u.branch_id, u.slug
  )
  insert into booking_old_links (slug, branch_id, replaced_at)
  select o.slug, o.branch_id,
         coalesce((select min(n.created_at) from mentions n
                   where n.branch_id = o.branch_id and n.created_at >= o.last_seen and n.slug <> o.slug), o.last_seen)
  from old o
  on conflict (slug, branch_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.keep_old_booking_link(), public.backfill_booking_old_links() from public, anon, authenticated;

select public.backfill_booking_old_links();

-- 3. For the booking page: what a link is. 'open' (the page), 'moved' with the salon's current link, 'off' (a salon's
--    link, current or old, whose page is off), or 'unknown' (no salon ever had it).
create function public.public_booking_status(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_now text;
begin
  if (public.booking_branch(v_slug)).id is not null then
    return jsonb_build_object('status', 'open');
  end if;
  v_now := public.public_booking_link(v_slug);
  if v_now is not null then
    return jsonb_build_object('status', 'moved', 'link', v_now);
  end if;
  if exists (select 1 from branches where booking_slug = v_slug) or exists (select 1 from booking_old_links where slug = v_slug) then
    return jsonb_build_object('status', 'off');
  end if;
  return jsonb_build_object('status', 'unknown');
end;
$$;

revoke execute on function public.public_booking_status(text) from public;
grant execute on function public.public_booking_status(text) to anon, authenticated;
