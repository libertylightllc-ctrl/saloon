-- The platform console's Overview counted the accounts four times, asking "is this a test account?" once for every
-- account each time (accounts, sign-ups in 7 and 30 days, signed in in 7 days). With a few thousand accounts that
-- took over 2 seconds on an idle computer and ran past the 8-second limit on a busy one ("The server is taking too
-- long"). It now goes through the accounts once and works out which are test accounts in the same pass. Same numbers
-- as before (migration 78): an account is a test account when all the salons it belongs to are test salons; an
-- account with no salon is not one. The test-salon check (is_test_salon) is written into each count the same way, so
-- every count is one pass too. Reads only; nothing else changes.
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', now() at time zone 'Asia/Dubai')::date;
  v_groups jsonb;
  v_accounts jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select jsonb_build_object(
           'salons', count(*) filter (where st <> 'closed'),
           'salons_closed', count(*) filter (where st = 'closed'),
           'salons_plan_active', count(*) filter (where st = 'paid'),
           'salons_trial', count(*) filter (where st = 'free'),
           'salons_pilot', count(*) filter (where st = 'pilot'),
           'salons_comp', count(*) filter (where st = 'comp'),
           'salons_ended', count(*) filter (where st = 'ended'))
    into v_groups
    from (select public.salon_status(b.closed_at, s.access_type, s.free_until, s.paid_until, public.business_today(b.id)) as st
          from businesses b left join subscriptions s on s.business_id = b.id
          where not b.is_demo and not exists (select 1 from test_salons t where t.business_id = b.id and t.test)) g;

  -- Every account once: does it belong to a salon, and to one that is not a test salon (is_test_account, in one pass).
  select jsonb_build_object(
           'accounts', count(*) filter (where real_account),
           'no_salon', count(*) filter (where not has_salon),
           'signups_7d', count(*) filter (where real_account and created_at > now() - interval '7 days'),
           'signups_30d', count(*) filter (where real_account and created_at > now() - interval '30 days'),
           'signed_in_7d', count(*) filter (where real_account and last_sign_in_at > now() - interval '7 days'))
    into v_accounts
    from (select u.created_at, u.last_sign_in_at, m.user_id is not null as has_salon,
                 m.user_id is null or m.real_salon as real_account
          from auth.users u
          left join (select m.user_id, bool_or(coalesce(not t.test, true)) as real_salon
                     from members m left join test_salons t on t.business_id = m.business_id
                     group by m.user_id) m on m.user_id = u.id) a;

  return v_groups || v_accounts || jsonb_build_object(
    'salons_test', (select count(*) from businesses where not is_demo and exists (select 1 from test_salons t where t.business_id = businesses.id and t.test)),
    'billing_enabled', (select billing_enabled from platform_settings),
    'pilot_places_left', (select greatest(pilot_max_salons - public.pilot_active_count(), 0) from platform_settings),
    'pilot_applications_new', (select count(*) from pilot_applications where status = 'new'),
    'plan_requests_open', (select count(distinct e.business_id) from plan_events e where e.kind = 'request'
                             and not exists (select 1 from test_salons t where t.business_id = e.business_id and t.test)
                             and not exists (select 1 from plan_events a where a.business_id = e.business_id
                                             and a.kind in ('activate', 'end') and a.created_at > e.created_at)),
    'branches', (select count(*) from branches br join businesses b on b.id = br.business_id
                 where not b.is_demo and not exists (select 1 from test_salons t where t.business_id = b.id and t.test)),
    'owners', (select count(*) from members m join businesses b on b.id = m.business_id
               where m.role = 'owner' and not b.is_demo and not exists (select 1 from test_salons t where t.business_id = b.id and t.test)),
    'staff_logins', (select count(*) from members m join businesses b on b.id = m.business_id
                     where m.role <> 'owner' and not b.is_demo and not exists (select 1 from test_salons t where t.business_id = b.id and t.test)),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('code', country_code, 'salons', n) order by n desc)
                           from (select country_code, count(*) as n from businesses
                                 where not is_demo and not exists (select 1 from test_salons t where t.business_id = businesses.id and t.test) group by 1) c), '[]'),
    'sales_month', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'count', n, 'total_minor', total) order by total desc)
                             from (select b.currency, count(*) as n, sum(s.total_minor) as total from sales s
                                   join businesses b on b.id = s.business_id
                                   where not b.is_demo and not exists (select 1 from test_salons t where t.business_id = b.id and t.test) and s.business_date >= v_month
                                   group by 1) x), '[]'),
    'plan_income', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'total_minor', total) order by total desc)
                             from (select coalesce(e.currency, 'AED') as currency, sum(e.amount_minor) as total from plan_events e
                                   where e.kind = 'activate' and e.amount_minor > 0 and not exists (select 1 from test_salons t where t.business_id = e.business_id and t.test)
                                   group by 1) y), '[]')
  );
end;
$$;
