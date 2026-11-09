-- A5 and D3 (owner's app check, 9 Nov 2026): Home → Staff today showed a stylist on their roster day off as
-- "Available", and the attendance board said "Not in yet" all day for a 10:00 shift nobody clocked in to.
--  * attendance_day: a rostered shift with no clock-in is "late_not_in" once it started more than the grace minutes ago
--    and "absent" once it has ended (or on an earlier day); "not_in" only before that.
--  * dashboard_today → staff_today: each person's status from the roster and the clock (day off, not in yet, late and
--    not in, on shift, on a break, done, absent, with a client) and their late minutes; "with a client" counts only
--    today's visits at this branch.

create or replace function public.attendance_day(p_branch uuid, p_date date default null)
returns table (employee_id uuid, full_name text, role_title text, colour text, shift_start text, shift_end text,
               status text, clock_in timestamptz, clock_out timestamptz, late boolean, late_minutes int,
               break_started_at timestamptz, break_minutes int)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner', 'cashier', 'staff', 'accountant']::member_role[]);
  v_today date := public.branch_today(p_branch);
  v_date date := coalesce(p_date, v_today);
  -- Today: the shift running now (it may have started yesterday). Other days: that day's shift.
  v_at timestamp := case when v_date = v_today then (now() at time zone public.branch_tz(p_branch))
                         else v_date + time '12:00' end;
  v_grace int := coalesce((public.branch_setting(p_branch, 'late_grace_min', '10'))::text::int, 10);
begin
  return query
    select e.id, e.full_name, e.role_title, e.colour, to_char(sh.shift_start, 'HH24:MI'), to_char(sh.shift_end, 'HH24:MI'),
           case when a.clock_out is not null then 'done'
                when br.open_since is not null then 'on_break'
                when a.id is not null then 'on_shift'
                when exists (select 1 from rosters x where x.employee_id = e.id) and sh.shift_start is null then 'off'
                -- A shift with no clock-in (owner's app check D3): absent once it has ended (or on an earlier day), late
                -- once it has started by more than the grace minutes, otherwise not in yet.
                when sh.shift_start is not null and (v_date < v_today or v_at >= sh.shift_end) then 'absent'
                when sh.shift_start is not null and v_date = v_today
                     and v_at > sh.shift_start + make_interval(mins => v_grace) then 'late_not_in'
                else 'not_in' end,
           a.clock_in, a.clock_out, coalesce(a.late, false), coalesce(a.late_minutes, 0),
           br.open_since, coalesce(br.minutes, 0)
    from employees e
    left join lateral public.shift_at(e.id, v_at) sh on true
    left join attendance a on a.employee_id = e.id and a.business_date = v_date
    left join lateral (
      select max(b.started_at) filter (where b.ended_at is null) as open_since,
             floor(sum(extract(epoch from coalesce(b.ended_at, now()) - b.started_at)) / 60)::int as minutes
      from attendance_breaks b where b.attendance_id = a.id) br on true
    where e.branch_id = p_branch and e.active
      and (m.role <> 'staff' or e.member_id = m.id)
    order by e.full_name;
end;
$$;


create or replace function public.dashboard_today(p_branch uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  m members := public.require_member(p_branch, array['owner', 'cashier', 'staff', 'accountant']::member_role[]);
  b branches;
  v_today date := public.branch_today(p_branch);
  v_front boolean := m.role in ('owner', 'cashier', 'accountant');
  v_me uuid;
  out jsonb := '{}';
begin
  select * into b from branches where id = p_branch;
  out := jsonb_build_object('business_date', v_today, 'role', m.role);

  if v_front then
    out := out || jsonb_build_object(
      -- Money out today: expenses (not reversed) and supplier payments (tables from migration …011).
      'money_out', jsonb_build_object(
          'expenses_minor', coalesce((select sum(amount_minor) from expenses
                                      where branch_id = p_branch and business_date = v_today and status = 'posted'), 0),
          'supplier_payments_minor', coalesce((select sum(amount_minor) from supplier_payments
                                               where branch_id = p_branch and business_date = v_today), 0)),
      -- Cash closing (tables from migration …012): today's status, closes waiting for the owner, and
      -- earlier days in the last week that had cash but were never submitted.
      'closing', jsonb_build_object(
          'today_status', coalesce((select status from cash_closings
                                    where branch_id = p_branch and business_date = v_today), 'open'),
          'pending_approval', (select count(*) from cash_closings
                               where branch_id = p_branch and status = 'pending_approval'),
          'pending', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'business_date', c.business_date,
                                 'variance_minor', c.variance_minor) order by c.business_date)
                               from cash_closings c where c.branch_id = p_branch and c.status = 'pending_approval'), '[]'),
          'unclosed_days', coalesce((select jsonb_agg(d.day order by d.day) from (
                               select distinct e.business_date as day from journal_entries e
                               join journal_lines l on l.entry_id = e.id and l.account_id = public.acct(b.business_id, 'cash')
                               where e.branch_id = p_branch and e.business_date between v_today - 7 and v_today - 1
                                 -- a day before the latest close can no longer be closed on its own
                                 and e.business_date > coalesce((select max(c.business_date) from cash_closings c
                                                                 where c.branch_id = p_branch and c.status <> 'draft'),
                                                                v_today - 8)) d), '[]')),
      -- Stock (…013): items at or below their reorder level; tools that need a service within a week.
      'stock', (select jsonb_build_object(
          'low', count(*) filter (where x.low),
          'low_items', coalesce(jsonb_agg(x.name order by x.qty) filter (where x.low), '[]'),
          'tools_due', count(*) filter (where x.kind = 'tool' and (x.condition = 'needs_service'
                                          or x.next_service_date <= v_today + 7)))
        from (select i.name, i.kind, i.condition, i.next_service_date, coalesce(sl.qty, 0) as qty,
                     i.kind <> 'tool' and i.reorder_level > 0 and coalesce(sl.qty, 0) <= i.reorder_level as low
              from inventory_items i
              left join stock_levels sl on sl.item_id = i.id and sl.branch_id = p_branch
              where i.business_id = b.business_id and i.active) x),
      'expected_cash', public.expected_cash(p_branch, v_today),
      'expected_cash_yesterday', public.expected_cash(p_branch, v_today - 1),
      'sales', (select jsonb_build_object(
          'count', count(*),
          'total_minor', coalesce(sum(total_minor), 0),
          'refunded_minor', coalesce((select sum(amount_minor) from refunds r
                                      where r.branch_id = p_branch and r.business_date = v_today), 0),
          'services', coalesce((select sum(sl.qty) from sale_lines sl join sales s2 on s2.id = sl.sale_id
                                where s2.branch_id = p_branch and s2.business_date = v_today and sl.kind = 'service'), 0))
        from sales where branch_id = p_branch and business_date = v_today),
      'payment_mix', (select jsonb_build_object(
          'cash', coalesce(sum(sp.amount_minor) filter (where sp.method = 'cash'), 0),
          'card', coalesce(sum(sp.amount_minor) filter (where sp.method = 'card'), 0),
          'wallet', coalesce(sum(sp.amount_minor) filter (where sp.method = 'wallet'), 0),
          'deposits', coalesce((select sum(deposit_applied_minor) from sales
                                where branch_id = p_branch and business_date = v_today), 0))
        from sale_payments sp join sales s on s.id = sp.sale_id
        where s.branch_id = p_branch and s.business_date = v_today),
      'revenue_7d', (select jsonb_agg(jsonb_build_object('date', d::date, 'total_minor', coalesce(
            (select sum(total_minor) from sales where branch_id = p_branch and business_date = d::date), 0))
            order by d)
        from generate_series(v_today - 6, v_today, interval '1 day') d),
      'top_services', coalesce((select jsonb_agg(t order by t.revenue_minor desc) from (
          select sl.name_snapshot as name, sum(sl.qty) as count, sum(sl.net_minor) as revenue_minor
          from sale_lines sl join sales s on s.id = sl.sale_id
          where s.branch_id = p_branch and s.business_date > v_today - 7 and sl.kind = 'service'
          group by sl.name_snapshot order by sum(sl.net_minor) desc limit 5) t), '[]'),
      'staff_today', coalesce((select jsonb_agg(jsonb_build_object(
            'employee_id', e.id, 'name', e.full_name, 'colour', e.colour,
            'services', coalesce(x.services, 0), 'sales_minor', coalesce(x.sales_minor, 0),
            'commission_minor', case when m.role = 'cashier' then null else coalesce(x.commission_minor, 0) end,
            'busy', exists (select 1 from appointments ap where ap.employee_id = e.id and ap.status = 'in_progress'
                            and ap.business_date = v_today and ap.branch_id = p_branch),
            -- Today from the roster and the clock (owner's app check A5): on shift, on a break, done, day off, not in
            -- yet, late and not in, absent; "available" only for someone with no roster at all who has not clocked in.
            'status', case when ad.status = 'not_in' and not exists (select 1 from rosters r where r.employee_id = e.id)
                           then 'available' else coalesce(ad.status, 'available') end,
            'late_minutes', case when ad.late then ad.late_minutes end,
            'shift_start', ad.shift_start, 'shift_end', ad.shift_end)
            order by coalesce(x.sales_minor, 0) desc, e.full_name)
          from employees e
          left join (select * from public.attendance_day(p_branch)) ad on ad.employee_id = e.id
          left join lateral (
            select sum(sl.qty) filter (where sl.kind = 'service') as services, sum(sl.net_minor) as sales_minor,
                   sum(sl.commission_minor) as commission_minor
            from sale_lines sl join sales s on s.id = sl.sale_id
            where sl.employee_id = e.id and s.business_date = v_today and s.branch_id = p_branch) x on true
          where e.branch_id = p_branch and e.active and e.role_title <> 'cashier'), '[]'),
      -- Supplier bills due within a week or overdue (owner and accountant; cashiers see no balances).
      'bills', case when m.role in ('owner', 'accountant') then (select jsonb_build_object(
          'overdue_count', count(*) filter (where due_date < v_today),
          'overdue_minor', coalesce(sum(total_minor - paid_minor) filter (where due_date < v_today), 0),
          'due_soon_count', count(*) filter (where due_date between v_today and v_today + 7),
          'due_soon_minor', coalesce(sum(total_minor - paid_minor) filter (where due_date between v_today and v_today + 7), 0))
        from purchase_bills where business_id = b.business_id and status in ('unpaid', 'partial')) end,
      -- Payroll (…016): a month waiting for approval, and paid WPS payslips still without the transfer proof.
      'payroll', case when m.role in ('owner', 'accountant') then jsonb_build_object(
          'pending_period', (select period from payroll_runs where business_id = b.business_id and status = 'generated'
                             order by period desc limit 1),
          'wps_missing', (select count(*) from payroll_lines l join payroll_runs r on r.id = l.run_id
                          where r.business_id = b.business_id and l.wps_status = 'required' and l.paid_at is not null)) end,
      -- Compliance (…017): readiness and records needing attention (owner); today's hygiene log (owner, cashier).
      'compliance', case when m.role = 'owner' then (select jsonb_build_object(
          'readiness', public.compliance_readiness(b.business_id),
          'attention', count(*) filter (where status <> 'valid'),
          -- One count per real status (owner's app check A4): "expired" only once the date has passed, and the days
          -- to the nearest expiry inside its reminder window.
          'expired', count(*) filter (where status = 'expired'),
          'missing', count(*) filter (where status = 'missing'),
          'missing_date', count(*) filter (where status = 'missing_date'),
          'evidence_missing', count(*) filter (where status = 'evidence_missing'),
          'due_soon', count(*) filter (where status = 'due_soon'),
          'soonest_days', min(days_left) filter (where status in ('due_soon', 'evidence_missing')
                                                   and days_left between 0 and reminder_days))
        from public.compliance_status(b.business_id)) end,
      'hygiene_signed', case when m.role in ('owner', 'cashier')
          then exists (select 1 from hygiene_logs where branch_id = p_branch and business_date = v_today) end,
      -- History is for the owner (and the read-only accountant), not the front desk.
      'activity', case when m.role in ('owner', 'accountant') then coalesce((select jsonb_agg(jsonb_build_object(
            'summary', al.summary, 'at', al.created_at, 'actor', mem.display_name) order by al.created_at desc)
          from (select * from audit_log
                where business_id = b.business_id and (branch_id = p_branch or branch_id is null)
                order by created_at desc limit 6) al
          left join members mem on mem.id = al.actor_member_id), '[]') end
    );
  end if;

  if m.role in ('owner', 'cashier', 'staff') then
    out := out || jsonb_build_object('appointments', (select jsonb_build_object(
        'completed', count(*) filter (where status = 'completed'),
        'waiting', count(*) filter (where status = 'waiting'),
        'in_progress', count(*) filter (where status = 'in_progress'),
        'booked', count(*) filter (where status = 'booked'),
        'no_show', count(*) filter (where status = 'no_show'))
      from appointments where branch_id = p_branch and business_date = v_today));
  end if;

  if m.role = 'owner' then
    out := out || jsonb_build_object('setup', jsonb_build_object(
      'services', exists (select 1 from services where business_id = b.business_id and status = 'active'),
      'staff', exists (select 1 from members where business_id = b.business_id and role <> 'owner'),
      'tax', coalesce((b.settings ->> 'tax_confirmed')::boolean, false),
      'opening_cash', coalesce((b.settings ->> 'opening_cash_set')::boolean, false),
      -- M2 steps (01-PRODUCT §3.1): opening stock counted, suppliers added.
      'opening_stock', coalesce((b.settings ->> 'opening_stock_set')::boolean, false),
      'suppliers', exists (select 1 from suppliers where business_id = b.business_id)));
  end if;

  if m.role = 'staff' then
    select id into v_me from employees where member_id = m.id;
    out := out || jsonb_build_object('me', jsonb_build_object(
      'services_today', coalesce((select sum(sl.qty) from sale_lines sl join sales s on s.id = sl.sale_id
         where sl.employee_id = v_me and s.business_id = m.business_id and s.business_date = v_today and sl.kind = 'service'), 0),
      'sales_today_minor', coalesce((select sum(sl.net_minor) from sale_lines sl join sales s on s.id = sl.sale_id
         where sl.employee_id = v_me and s.business_id = m.business_id and s.business_date = v_today), 0),
      -- The same figure payroll uses (after refunds, never on the tip).
      'commission_month_minor', public.commission_for(v_me, to_char(v_today, 'YYYY-MM'))));
  end if;

  return out;
end;
$$;

