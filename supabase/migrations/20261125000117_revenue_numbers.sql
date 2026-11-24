-- Platform console, Part B (owner's brief, 24 Nov 2026): the money cards. Test salons are left out (and payments marked
-- Test or Void, A4); amounts stay in their own currency here and the console converts them to the reporting currency.
--
-- B1 Monthly recurring revenue: what each paying salon pays a month, from its latest real payment (AED 990 for 12
--    months is AED 82.50 a month). Salons switched on without a payment (an amount of 0) are counted as paying but add
--    nothing, and the console says how many. Last month's figure is the same rule on the last day of last month (Dubai
--    calendar, as the console's "This month").
-- B4 Free-period conversion: of the salons whose free period or pilot ended in the last 90 days (their own calendar),
--    how many have paid. Closed salons are counted: one that left without paying is a lost conversion.
-- B5 Churn: salons that stopped paying this month, with what they paid a month and where they are now: ended, closed,
--    or back on free time (a plan ended while free days were left, or the team gave free time).

-- What a salon paid a month by its latest counted payment up to a moment.
create function public.salon_monthly(p_business uuid, p_at timestamptz)
returns table (currency text, monthly_minor bigint)
language sql stable security definer set search_path = public as $$
  select coalesce(e.currency, 'AED'), round(e.amount_minor::numeric / e.months)::bigint
  from plan_events e
  where e.business_id = p_business and e.kind = 'activate' and e.amount_minor > 0 and e.months > 0
    and e.created_at <= p_at and public.payment_counted(e.id, e.business_id)
  order by e.created_at desc
  limit 1
$$;
revoke execute on function public.salon_monthly(uuid, timestamptz) from public, anon, authenticated;

create function public.admin_revenue() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', now() at time zone 'Asia/Dubai')::date;
  v_cut timestamptz := (date_trunc('month', now() at time zone 'Asia/Dubai')) at time zone 'Asia/Dubai';
  v_now jsonb;
  v_prev jsonb;
  v_conversion jsonb;
  v_churn jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  -- Paying now.
  with paying as (
    select b.id, m.currency, m.monthly_minor
    from businesses b join subscriptions s on s.business_id = b.id
    left join lateral public.salon_monthly(b.id, 'infinity') m on true
    where not b.is_demo and not exists (select 1 from test_salons t where t.business_id = b.id and t.test)
      and public.salon_status(b.closed_at, s.access_type, s.free_until, s.paid_until, public.business_today(b.id)) = 'paid'
  )
  select jsonb_build_object(
           'paying', (select count(*) from paying),
           'paying_unpriced', (select count(*) from paying where monthly_minor is null),
           'mrr', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'minor', total) order by total desc)
                            from (select currency, sum(monthly_minor) as total from paying where monthly_minor is not null group by 1) x), '[]'))
    into v_now;

  -- Paying on the last day of last month: open then, and its paid time (as the latest payment or end before the
  -- month began left it) reached that day.
  with paying as (
    select b.id, m.currency, m.monthly_minor
    from businesses b
    left join lateral public.salon_monthly(b.id, v_cut - interval '1 microsecond') m on true
    where not b.is_demo and b.created_at < v_cut and (b.closed_at is null or b.closed_at >= v_cut)
      and not exists (select 1 from test_salons t where t.business_id = b.id and t.test)
      and (select e.paid_until from plan_events e where e.business_id = b.id and e.kind in ('activate', 'end')
             and e.created_at < v_cut order by e.created_at desc limit 1) >= v_month - 1
  )
  select jsonb_build_object(
           'paying_prev', (select count(*) from paying),
           'mrr_prev', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'minor', total) order by total desc)
                                 from (select currency, sum(monthly_minor) as total from paying where monthly_minor is not null group by 1) x), '[]'))
    into v_prev;

  select jsonb_build_object('ended', count(*), 'paid', count(*) filter (where paid))
    into v_conversion
  from (select exists (select 1 from plan_events e where e.business_id = b.id and e.kind = 'activate' and e.amount_minor > 0
                         and public.payment_counted(e.id, e.business_id)) as paid
        from businesses b join subscriptions s on s.business_id = b.id
        where not b.is_demo and not exists (select 1 from test_salons t where t.business_id = b.id and t.test)
          and s.access_type <> 'comp' and s.free_until is not null
          and s.free_until < public.business_today(b.id) and s.free_until >= public.business_today(b.id) - 90) c;

  -- Stopped paying this month: the first unpaid day, or the day it closed while still paid.
  select coalesce(jsonb_agg(jsonb_build_object('business_id', id, 'name', name, 'code', code, 'stopped_on', stopped_on,
                                               'status', status, 'currency', currency, 'minor', monthly_minor)
                            order by stopped_on desc, name), '[]')
    into v_churn
  from (select b.id, b.name, b.code, m.currency, m.monthly_minor,
               public.salon_status(b.closed_at, s.access_type, s.free_until, s.paid_until, public.business_today(b.id)) as status,
               least(coalesce((b.closed_at at time zone b.timezone)::date, s.paid_until + 1), s.paid_until + 1) as stopped_on
        from businesses b join subscriptions s on s.business_id = b.id
        join lateral public.salon_monthly(b.id, 'infinity') m on true
        where not b.is_demo and not exists (select 1 from test_salons t where t.business_id = b.id and t.test)
          and s.paid_until is not null
          and public.salon_status(b.closed_at, s.access_type, s.free_until, s.paid_until, public.business_today(b.id)) <> 'paid') x
  where stopped_on >= v_month and stopped_on <= (now() at time zone 'Asia/Dubai')::date;

  return v_now || v_prev || jsonb_build_object('month', v_month, 'conversion', v_conversion, 'churn', v_churn);
end;
$$;
revoke execute on function public.admin_revenue() from public, anon;
grant execute on function public.admin_revenue() to authenticated;
