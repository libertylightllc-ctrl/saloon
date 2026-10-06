-- The platform console (owner, 2026-10-06: "i need a dev account where we can have info about everything"): one
-- place for the platform owner to see the whole service — totals, every salon with its activity, every sign-in
-- account, every plan request and payment, the recent history across salons — and to name other platform owners.
-- Platform owners only (each function checks); a platform owner needs no salon of their own. Salons' customer lists
-- and phone numbers are not shown here: the salon controls those (privacy policy and data processing terms).

-- Totals across the service.
create function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', now() at time zone 'Asia/Dubai')::date;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'salons', (select count(*) from businesses where not is_demo),
    'salons_plan_active', (select count(*) from businesses b join subscriptions s on s.business_id = b.id
                           where not b.is_demo and s.paid_until >= public.business_today(b.id)),
    'plan_requests_open', (select count(distinct e.business_id) from plan_events e where e.kind = 'request'
                             and not exists (select 1 from plan_events a where a.business_id = e.business_id
                                             and a.kind in ('activate', 'end') and a.created_at > e.created_at)),
    'branches', (select count(*) from branches br join businesses b on b.id = br.business_id where not b.is_demo),
    'accounts', (select count(*) from auth.users),
    'owners', (select count(*) from members m join businesses b on b.id = m.business_id where m.role = 'owner' and not b.is_demo),
    'staff_logins', (select count(*) from members m join businesses b on b.id = m.business_id where m.role <> 'owner' and not b.is_demo),
    'no_salon', (select count(*) from auth.users u where not exists (select 1 from members m where m.user_id = u.id)),
    'signups_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'signups_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'signed_in_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('code', country_code, 'salons', n) order by n desc)
                           from (select country_code, count(*) as n from businesses where not is_demo group by 1) c), '[]'),
    'sales_month', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'count', n, 'total_minor', total) order by total desc)
                             from (select b.currency, count(*) as n, sum(s.total_minor) as total from sales s
                                   join businesses b on b.id = s.business_id
                                   where not b.is_demo and s.business_date >= v_month group by 1) x), '[]'),
    'plan_income', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'total_minor', total) order by total desc)
                             from (select coalesce(e.currency, 'AED') as currency, sum(e.amount_minor) as total from plan_events e
                                   where e.kind = 'activate' and e.amount_minor > 0 group by 1) y), '[]')
  );
end;
$$;

-- Each salon's activity, beside admin_salons (owner, plan and requests).
create function public.admin_salon_stats()
returns table (business_id uuid, currency text, mode text, staff integer, customers integer, services integer,
               sales_30d integer, sales_month_minor bigint, last_sale_at timestamptz, last_sign_in_at timestamptz,
               closed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select b.id, b.currency,
           (select string_agg(distinct br.mode::text, ', ') from branches br where br.business_id = b.id),
           (select count(*)::int from employees e where e.business_id = b.id and e.active),
           (select count(*)::int from customers c where c.business_id = b.id),
           (select count(*)::int from services sv where sv.business_id = b.id and sv.status = 'active'),
           (select count(*)::int from sales s where s.business_id = b.id and s.created_at > now() - interval '30 days'),
           (select coalesce(sum(s.total_minor), 0)::bigint from sales s where s.business_id = b.id
              and s.business_date >= date_trunc('month', public.business_today(b.id))::date),
           (select max(s.created_at) from sales s where s.business_id = b.id),
           (select max(u.last_sign_in_at) from members m join auth.users u on u.id = m.user_id where m.business_id = b.id),
           not exists (select 1 from members m where m.business_id = b.id and m.role = 'owner' and m.active)
    from businesses b
    where not b.is_demo;
end;
$$;

-- Every sign-in account: owners by email, staff by their salon username.
create function public.admin_accounts()
returns table (user_id uuid, email text, username text, display_name text, role text, business_id uuid, salon text,
               active boolean, created_at timestamptz, last_sign_in_at timestamptz, confirmed boolean, provider text,
               platform_owner boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select u.id, case when u.email like '%.staff.internal' then null else u.email::text end, m.username,
           m.display_name, m.role::text, m.business_id, b.name, m.active, u.created_at, u.last_sign_in_at,
           u.email_confirmed_at is not null, coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
           exists (select 1 from platform_admins p where p.user_id = u.id)
    from auth.users u
    left join members m on m.user_id = u.id
    left join businesses b on b.id = m.business_id
    order by u.created_at desc;
end;
$$;

-- Every plan request, payment and ending, newest first.
create function public.admin_plan_events(p_limit integer default 200)
returns table (id uuid, business_id uuid, salon text, kind text, months integer, amount_minor bigint, currency text,
               paid_until date, note text, by_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select e.id, e.business_id, b.name, e.kind::text, e.months, e.amount_minor, e.currency, e.paid_until, e.note,
           coalesce((select m.display_name from members m where m.user_id = e.created_by and m.business_id = e.business_id limit 1),
                    (select u.email::text from auth.users u where u.id = e.created_by)),
           e.created_at
    from plan_events e join businesses b on b.id = e.business_id
    order by e.created_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;

-- The history across salons (or one salon), newest first.
create function public.admin_activity(p_business uuid default null, p_limit integer default 200)
returns table (id uuid, business_id uuid, salon text, actor text, action text, entity_type text, summary text,
               created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select l.id, l.business_id, b.name, m.display_name, l.action, l.entity_type, l.summary, l.created_at
    from audit_log l
    join businesses b on b.id = l.business_id
    left join members m on m.id = l.actor_member_id
    where p_business is null or l.business_id = p_business
    order by l.created_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;

-- Name or remove a platform owner by the email they sign in with. The last one cannot be removed.
create function public.admin_set_platform_owner(p_email text, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email)) and email not like '%.staff.internal';
  if v_user is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_on then
    insert into platform_admins (user_id) values (v_user) on conflict do nothing;
  else
    if (select count(*) from platform_admins) <= 1 and exists (select 1 from platform_admins where user_id = v_user) then
      raise exception 'invalid_status' using errcode = '22023';
    end if;
    delete from platform_admins where user_id = v_user;
  end if;
end;
$$;

revoke execute on function public.admin_overview(), public.admin_salon_stats(), public.admin_accounts(),
  public.admin_plan_events(integer), public.admin_activity(uuid, integer), public.admin_set_platform_owner(text, boolean)
  from public, anon;
grant execute on function public.admin_overview(), public.admin_salon_stats(), public.admin_accounts(),
  public.admin_plan_events(integer), public.admin_activity(uuid, integer), public.admin_set_platform_owner(text, boolean)
  to authenticated;
