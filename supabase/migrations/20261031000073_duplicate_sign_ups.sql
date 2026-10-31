-- Owner's fix list (final brief, 31 Oct 2026) C4: duplicate sign-ups. One owner signed up three times with three
-- emails. Sign-up now asks before a second salon is started with a number that already has one, and Console → Salons
-- marks salons that look like the same owner. Nothing existing is changed or removed.

-- 1. "This number already has a salon on Saloqo. Sign in instead?" The sign-up page asks this before creating an
--    account with a mobile / WhatsApp number that the owner of an open salon already gave. The answer is yes or no
--    only. To stop anyone looking numbers up in bulk, one address may ask 10 times an hour and everyone together
--    1,000 times a day; past that the answer is no (sign-up goes on as before).
create table public.phone_checks (
  source_hash text not null,
  created_at timestamptz not null default now()
);
create index phone_checks_source_idx on public.phone_checks (source_hash, created_at);
alter table public.phone_checks enable row level security;
revoke all on public.phone_checks from anon, authenticated;

create function public.phone_has_salon(p_phone text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  -- The visitor's address, as for pilot applications: Cloudflare's (set by Supabase's edge, not by the visitor), else
  -- the proxies' (the local stack).
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_ip text := coalesce(v_headers ->> 'cf-connecting-ip',
                        nullif(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1), ''),
                        v_headers ->> 'x-real-ip', '');
  v_hash text := md5('saloqo-phone:' || btrim(v_ip));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
begin
  if v_phone !~ '^\+[0-9]{7,15}$' then
    return false;
  end if;
  delete from phone_checks where created_at < now() - interval '1 day';
  if (select count(*) from phone_checks where source_hash = v_hash and created_at > now() - interval '1 hour') >= 10
     or (select count(*) from phone_checks) >= 1000 then
    return false;
  end if;
  insert into phone_checks (source_hash) values (v_hash);
  return exists (select 1 from owner_contacts oc
                 join members m on m.user_id = oc.user_id and m.role = 'owner' and m.active
                 join businesses b on b.id = m.business_id and b.closed_at is null and not b.is_demo
                 where oc.phone = v_phone);
end;
$$;

-- 2. Likely duplicates for Console → Salons: salons whose owners have the same name (ignoring case and extra spaces)
--    or gave the same number, with the names of the other salons. One row per salon and reason ('name' or 'phone').
create function public.admin_salon_duplicates()
returns table (business_id uuid, reason text, others text[])
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    with owners as (
      select b.id, b.name,
             nullif(lower(regexp_replace(btrim(coalesce(m.display_name, '')), '\s+', ' ', 'g')), '') as owner_name,
             oc.phone
      from businesses b
      left join lateral (select * from members mm where mm.business_id = b.id and mm.role = 'owner'
                         order by mm.created_at limit 1) m on true
      left join owner_contacts oc on oc.user_id = m.user_id
      where not b.is_demo
    )
    select a.id, 'name'::text, array_agg(o.name order by o.name)
    from owners a join owners o on o.id <> a.id and o.owner_name = a.owner_name
    where char_length(a.owner_name) >= 2
    group by a.id
    union all
    select a.id, 'phone'::text, array_agg(o.name order by o.name)
    from owners a join owners o on o.id <> a.id and o.phone = a.phone
    group by a.id;
end;
$$;

revoke execute on function public.phone_has_salon(text), public.admin_salon_duplicates() from public, anon, authenticated;
grant execute on function public.phone_has_salon(text) to anon, authenticated;
grant execute on function public.admin_salon_duplicates() to authenticated;
