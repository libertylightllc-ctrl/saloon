-- Platform console, Part B (owner's brief, 24 Nov 2026).
-- B8 New sign-ups: salons made each week, by country, for the last 12 weeks (this one included, so far). Weeks start
--    on Monday on the Dubai calendar, as the console's other weeks and months. Test and demo salons are left out;
--    closed salons are counted (they did sign up).

create function public.admin_signups_weekly(p_weeks integer default 12) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_weeks integer := least(greatest(coalesce(p_weeks, 12), 1), 52);
  v_this date := date_trunc('week', now() at time zone 'Asia/Dubai')::date;
  v_from date;
  v jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_from := v_this - 7 * (v_weeks - 1);
  select jsonb_build_object(
           'weeks', (select jsonb_agg(d::date order by d) from generate_series(v_from, v_this, interval '7 days') d),
           'counts', coalesce(jsonb_agg(jsonb_build_object('week', x.week, 'country_code', x.country_code, 'salons', x.salons)
                                        order by x.week, x.salons desc, x.country_code), '[]'))
    into v
  from (select date_trunc('week', b.created_at at time zone 'Asia/Dubai')::date as week, b.country_code, count(*)::int as salons
        from businesses b
        where not b.is_demo and b.created_at >= v_from::timestamp at time zone 'Asia/Dubai'
          and not exists (select 1 from test_salons t where t.business_id = b.id and t.test)
        group by 1, 2) x;
  return v;
end;
$$;
revoke execute on function public.admin_signups_weekly(integer) from public, anon;
grant execute on function public.admin_signups_weekly(integer) to authenticated;
