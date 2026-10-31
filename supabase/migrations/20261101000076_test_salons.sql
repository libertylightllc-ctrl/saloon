-- Test salons (owner's final brief E1, 31 Oct 2026). A platform owner marks a salon as a test salon in Console → Salons
-- (Red Rose, Demo Shop, their own test accounts). Test salons are left out of every Overview number — salons, branches,
-- plan requests, accounts and sign-ups (an account only in test salons), countries, sales this month, plan payments
-- received — and of the pilot's places, so a test salon never holds one of them. The salon itself works as before;
-- nothing is deleted. Only platform owners can see or change the mark; every change goes to Console → Changes.

create table public.test_salons (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  test boolean not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);
alter table public.test_salons enable row level security;
revoke all on table public.test_salons from public, anon, authenticated;

create function public.is_test_salon(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select t.test from test_salons t where t.business_id = p_business), false);
$$;

-- An account counts in the Overview unless every salon it belongs to is a test salon.
create function public.is_test_account(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members m where m.user_id = p_user)
     and not exists (select 1 from members m where m.user_id = p_user and not public.is_test_salon(m.business_id));
$$;

revoke execute on function public.is_test_salon(uuid), public.is_test_account(uuid) from public, anon, authenticated;

create function public.admin_set_test_salon(p_business uuid, p_test boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_before boolean;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_test is null or not exists (select 1 from businesses where id = p_business) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_before := public.is_test_salon(p_business);
  if v_before = p_test then
    return p_test;
  end if;
  insert into test_salons (business_id, test, changed_by) values (p_business, p_test, auth.uid())
  on conflict (business_id) do update set test = excluded.test, changed_by = excluded.changed_by, changed_at = now();
  perform public.platform_audit_write('salon:test', p_business, null, jsonb_build_object('test', v_before),
    jsonb_build_object('test', p_test));
  return p_test;
end;
$$;

create function public.admin_test_salons() returns table (business_id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query select t.business_id from test_salons t where t.test;
end;
$$;

revoke execute on function public.admin_set_test_salon(uuid, boolean), public.admin_test_salons() from public, anon;
grant execute on function public.admin_set_test_salon(uuid, boolean), public.admin_test_salons() to authenticated;

-- The pilot's places (Overview, Console → Settings, the homepage's pilot bar): as migration 66, without test salons.
create or replace function public.pilot_active_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from subscriptions s join businesses b on b.id = s.business_id
  where s.access_type = 'pilot' and b.closed_at is null and not b.is_demo
    and not public.is_test_salon(b.id)
    and s.free_until >= public.business_today(b.id);
$$;

-- The Overview: as migration 66, without test salons, plus how many were left out.
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', now() at time zone 'Asia/Dubai')::date;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'salons', (select count(*) from businesses where not is_demo and closed_at is null and not public.is_test_salon(id)),
    'salons_closed', (select count(*) from businesses where not is_demo and closed_at is not null and not public.is_test_salon(id)),
    'salons_plan_active', (select count(*) from businesses b join subscriptions s on s.business_id = b.id
                           where not b.is_demo and b.closed_at is null and not public.is_test_salon(b.id)
                             and s.paid_until >= public.business_today(b.id)),
    'salons_trial', (select count(*) from businesses b join subscriptions s on s.business_id = b.id
                     where not b.is_demo and b.closed_at is null and not public.is_test_salon(b.id) and s.access_type = 'trial'
                       and s.free_until >= public.business_today(b.id)),
    'salons_pilot', public.pilot_active_count(),
    'salons_comp', (select count(*) from businesses b join subscriptions s on s.business_id = b.id
                    where not b.is_demo and b.closed_at is null and not public.is_test_salon(b.id) and s.access_type = 'comp'),
    'salons_test', (select count(*) from businesses where not is_demo and public.is_test_salon(id)),
    'billing_enabled', (select billing_enabled from platform_settings),
    'pilot_places_left', (select greatest(pilot_max_salons - public.pilot_active_count(), 0) from platform_settings),
    'pilot_applications_new', (select count(*) from pilot_applications where status = 'new'),
    'plan_requests_open', (select count(distinct e.business_id) from plan_events e where e.kind = 'request'
                             and not public.is_test_salon(e.business_id)
                             and not exists (select 1 from plan_events a where a.business_id = e.business_id
                                             and a.kind in ('activate', 'end') and a.created_at > e.created_at)),
    'branches', (select count(*) from branches br join businesses b on b.id = br.business_id
                 where not b.is_demo and not public.is_test_salon(b.id)),
    'accounts', (select count(*) from auth.users u where not public.is_test_account(u.id)),
    'owners', (select count(*) from members m join businesses b on b.id = m.business_id
               where m.role = 'owner' and not b.is_demo and not public.is_test_salon(b.id)),
    'staff_logins', (select count(*) from members m join businesses b on b.id = m.business_id
                     where m.role <> 'owner' and not b.is_demo and not public.is_test_salon(b.id)),
    'no_salon', (select count(*) from auth.users u where not exists (select 1 from members m where m.user_id = u.id)),
    'signups_7d', (select count(*) from auth.users u where u.created_at > now() - interval '7 days' and not public.is_test_account(u.id)),
    'signups_30d', (select count(*) from auth.users u where u.created_at > now() - interval '30 days' and not public.is_test_account(u.id)),
    'signed_in_7d', (select count(*) from auth.users u where u.last_sign_in_at > now() - interval '7 days' and not public.is_test_account(u.id)),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('code', country_code, 'salons', n) order by n desc)
                           from (select country_code, count(*) as n from businesses
                                 where not is_demo and not public.is_test_salon(id) group by 1) c), '[]'),
    'sales_month', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'count', n, 'total_minor', total) order by total desc)
                             from (select b.currency, count(*) as n, sum(s.total_minor) as total from sales s
                                   join businesses b on b.id = s.business_id
                                   where not b.is_demo and not public.is_test_salon(b.id) and s.business_date >= v_month
                                   group by 1) x), '[]'),
    'plan_income', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'total_minor', total) order by total desc)
                             from (select coalesce(e.currency, 'AED') as currency, sum(e.amount_minor) as total from plan_events e
                                   where e.kind = 'activate' and e.amount_minor > 0 and not public.is_test_salon(e.business_id)
                                   group by 1) y), '[]')
  );
end;
$$;
