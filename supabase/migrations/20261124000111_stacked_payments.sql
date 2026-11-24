-- Platform console, Part A (owner's brief, 24 Nov 2026).
--
-- A5. Console → Plans showed "1 month · USD 0.00 · Paid until 28 Oct 2027" with nothing to say why. Paid-until is
-- worked out the same way for a recorded payment and a card payment: the months run on from the end of the time
-- still running (paid, free or pilot), else from that day. A payment made while earlier paid time was still running
-- is stacked on it. Each payment now says how much is stacked up to it: "13 months paid in 3 payments". A run of
-- stacked payments starts again after a gap or after the plan was ended. It also gives a payment's Test or Void mark
-- (A4). Reads only.

drop function public.admin_plan_events(integer);
create function public.admin_plan_events(p_limit integer default 200)
returns table (id uuid, business_id uuid, salon text, kind text, months integer, amount_minor bigint, currency text,
               paid_until date, note text, by_name text, created_at timestamptz, mark text, mark_reason text,
               stack_months integer, stack_payments integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    with paid as (
      select e.id, e.business_id, e.created_at, e.months, e.paid_until,
             (e.created_at at time zone coalesce(b.timezone, 'Asia/Dubai'))::date as paid_on,
             lag(e.paid_until) over w as prev_until, lag(e.created_at) over w as prev_at
      from plan_events e join businesses b on b.id = e.business_id
      where e.kind = 'activate'
      window w as (partition by e.business_id order by e.created_at)
    ), runs as (
      select p.*, sum(case when p.prev_until is null or p.paid_on > p.prev_until
                             or exists (select 1 from plan_events x where x.business_id = p.business_id and x.kind = 'end'
                                        and x.created_at > p.prev_at and x.created_at < p.created_at)
                           then 1 else 0 end)
                    over (partition by p.business_id order by p.created_at) as run
      from paid p
    ), stacked as (
      select r.id, sum(coalesce(r.months, 0)) over s as months, count(*) over s as payments
      from runs r
      window s as (partition by r.business_id, r.run order by r.created_at)
    )
    select e.id, e.business_id, b.name, e.kind::text, e.months, e.amount_minor, e.currency, e.paid_until, e.note,
           coalesce((select m.display_name from members m where m.user_id = e.created_by and m.business_id = e.business_id limit 1),
                    (select u.email::text from auth.users u where u.id = e.created_by)),
           e.created_at, pm.mark, pm.reason, st.months::int, st.payments::int
    from plan_events e
    join businesses b on b.id = e.business_id
    left join payment_marks pm on pm.event_id = e.id
    left join stacked st on st.id = e.id
    order by e.created_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;
revoke execute on function public.admin_plan_events(integer) from public, anon;
grant execute on function public.admin_plan_events(integer) to authenticated;
