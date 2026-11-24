-- Platform console, Part A (owner's brief, 24 Nov 2026).
--
-- A1. An owner who deleted their account showed in Salons and Accounts as "Deleted user · AqUeh__IRYX…": the sign-in
-- service replaces a deleted account's email with a scrambled code, and the console showed it. The lists now say
-- when the account was deleted (owner_deleted_at, deleted_at) and never return that code.
-- A2. Every salon whose owner was deleted was flagged "Same owner name as …" with all the others, because they are all
-- called "Deleted user". The duplicate check now skips deleted accounts, and gives each other salon's code with its
-- name so salons with the same name can be told apart.
-- A6 (facts for the salon card): when and why a salon was closed, and by whom.
-- Reads only; nothing is changed or deleted.

drop function public.admin_salons();
create function public.admin_salons()
 RETURNS TABLE(business_id uuid, name text, code text, created_at timestamp with time zone, owner_name text,
               owner_email text, branches integer, paid_until date, active boolean, requested_at timestamp with time zone,
               requested_months integer, request_note text, country_code text, timezone text, people integer,
               monthly_minor bigint, plan_currency text, trial boolean, access_type text, free_until date,
               pilot_code text, admin_note text, staff integer, last_active timestamp with time zone,
               status text, ended_on date, owner_deleted_at timestamptz, closed_at timestamptz, close_note text,
               closed_by_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select b.id, b.name, b.code, b.created_at,
           case when od.deleted_at is null then m.display_name end,
           case when od.deleted_at is null then u.email::text end,
           (select count(*)::int from branches br where br.business_id = b.id),
           s.paid_until,
           b.closed_at is null
             and (not ps.billing_enabled
                  or coalesce(s.access_type = 'comp' or s.free_until >= d.today or s.paid_until >= d.today, false)),
           r.created_at, r.months, r.note, b.country_code, b.timezone, q.people, q.monthly_minor, q.currency,
           coalesce(s.access_type = 'trial', false), s.access_type, s.free_until, s.pilot_code, s.admin_note,
           (select count(*)::int from members mm where mm.business_id = b.id and mm.active and mm.role <> 'owner'),
           (select max(au.last_sign_in_at) from members mm join auth.users au on au.id = mm.user_id
            where mm.business_id = b.id),
           st.status,
           case when st.status = 'ended' then greatest(s.paid_until, s.free_until) end,
           od.deleted_at, b.closed_at, b.close_note,
           (select coalesce((select mm.display_name from members mm where mm.user_id = cu.id and mm.display_name <> 'Deleted user'
                             order by mm.created_at limit 1), cu.email::text)
            from auth.users cu where cu.id = b.closed_by)
    from businesses b
    cross join platform_settings ps
    cross join lateral (select (now() at time zone coalesce(b.timezone, 'Asia/Dubai'))::date as today) d
    left join lateral (select * from members mm where mm.business_id = b.id and mm.role = 'owner'
                       order by mm.created_at limit 1) m on true
    left join auth.users u on u.id = m.user_id
    -- Deleted: the sign-in service marked the account deleted, or it is gone altogether (then the salon's closing is
    -- the nearest date there is).
    cross join lateral (select case when m.id is null then null
                                    when u.id is null then coalesce(b.closed_at, m.created_at)
                                    else u.deleted_at end as deleted_at) od
    left join subscriptions s on s.business_id = b.id
    cross join lateral (select public.salon_status(b.closed_at, s.access_type, s.free_until, s.paid_until, d.today) as status) st
    join public.plan_quotes() q on q.business_id = b.id
    left join lateral (select * from plan_events e where e.business_id = b.id and e.kind = 'request'
                         and not exists (select 1 from plan_events a where a.business_id = b.id
                                         and a.kind in ('activate', 'end') and a.created_at > e.created_at)
                       order by e.created_at desc limit 1) r on true
    where not b.is_demo
    order by (r.created_at is not null) desc, b.created_at desc;
end;
$$;
revoke execute on function public.admin_salons() from public, anon;
grant execute on function public.admin_salons() to authenticated;

drop function public.admin_accounts();
create function public.admin_accounts()
returns table (user_id uuid, email text, username text, display_name text, role text, business_id uuid, salon text,
               active boolean, created_at timestamptz, last_sign_in_at timestamptz, confirmed boolean, provider text,
               platform_owner boolean, phone text, whatsapp_ok boolean, whatsapp_ok_at timestamptz,
               deleted_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select u.id,
           case when u.deleted_at is not null or u.email like '%.staff.internal' then null else u.email::text end,
           case when u.deleted_at is null then m.username end,
           case when u.deleted_at is null or m.display_name <> 'Deleted user' then m.display_name end,
           m.role::text, m.business_id, b.name, m.active, u.created_at, u.last_sign_in_at,
           u.email_confirmed_at is not null, coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
           exists (select 1 from platform_admins p where p.user_id = u.id),
           case when u.deleted_at is null then c.phone end, coalesce(c.whatsapp_ok, false) and u.deleted_at is null,
           case when u.deleted_at is null then c.whatsapp_ok_at end,
           u.deleted_at
    from auth.users u
    left join members m on m.user_id = u.id
    left join businesses b on b.id = m.business_id
    left join owner_contacts c on c.user_id = u.id
    order by u.created_at desc;
end;
$$;
revoke execute on function public.admin_accounts() from public, anon;
grant execute on function public.admin_accounts() to authenticated;

drop function public.admin_salon_duplicates();
create function public.admin_salon_duplicates()
returns table (business_id uuid, reason text, others jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    with owners as (
      select b.id, b.name, b.code,
             nullif(lower(regexp_replace(btrim(coalesce(m.display_name, '')), '\s+', ' ', 'g')), '') as owner_name,
             oc.phone
      from businesses b
      join lateral (select * from members mm where mm.business_id = b.id and mm.role = 'owner'
                    order by mm.created_at limit 1) m on true
      -- A deleted account is no one's duplicate: they are all "Deleted user" (A2).
      join auth.users u on u.id = m.user_id and u.deleted_at is null
      left join owner_contacts oc on oc.user_id = m.user_id
      where not b.is_demo
    )
    select a.id, 'name'::text, jsonb_agg(jsonb_build_object('name', o.name, 'code', o.code) order by o.name, o.code)
    from owners a join owners o on o.id <> a.id and o.owner_name = a.owner_name
    where char_length(a.owner_name) >= 2
    group by a.id
    union all
    select a.id, 'phone'::text, jsonb_agg(jsonb_build_object('name', o.name, 'code', o.code) order by o.name, o.code)
    from owners a join owners o on o.id <> a.id and o.phone = a.phone
    group by a.id;
end;
$$;
revoke execute on function public.admin_salon_duplicates() from public, anon;
grant execute on function public.admin_salon_duplicates() to authenticated;
