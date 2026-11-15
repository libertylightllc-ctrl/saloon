-- Part D1 (owner's app check, 9 Nov 2026): a shift still open when its day has ended is closed as "No clock-out".
-- * attendance.no_clock_out marks a shift the app closed because nobody clocked out. The end is the roster's end for that
--   shift (no roster, or a clock-in after the roster ended: the clock-in time, so 0 hours); an open break ends then too.
-- * close_open_shifts runs every hour (with the hourly alerts, before the missed clock-out alert), so a shift never
--   carries into the next day.
-- * The owner, or a manager with a reason, fixes it with the real time (fix_clock_out, as for a missed clock-out); the
--   mark goes and the alert ends then.
-- * Home → Needs attention counts them for the owner and managers (dashboard_today.missed_clock_outs); Attendance lists
--   them, and that day shows "No clock-out" (attendance_day status no_clock_out).
-- Nothing recorded is deleted; the audit trail says the shift was closed with no clock-out.

alter table public.attendance add column no_clock_out boolean not null default false;
alter table public.attendance add constraint attendance_no_clock_out_closed check (not no_clock_out or clock_out is not null);

create function public.close_open_shifts(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  a record;
  v_end timestamptz;
  n int := 0;
begin
  for a in
    select at.id, at.business_id, at.branch_id, at.employee_id, at.business_date, at.clock_in, e.full_name,
           public.branch_tz(at.branch_id) as tz
    from attendance at join employees e on e.id = at.employee_id
    where at.clock_out is null
      and at.business_date < (p_now at time zone public.branch_tz(at.branch_id))::date
    for update of at
  loop
    -- The roster's end for the shift the person clocked in to; never before the clock-in, never after now.
    select sh.shift_end at time zone a.tz into v_end
    from public.shift_at(a.employee_id, (a.clock_in at time zone a.tz)) sh;
    v_end := least(greatest(a.clock_in, coalesce(v_end, a.clock_in)), p_now);
    update attendance_breaks set ended_at = greatest(v_end, started_at)
    where attendance_id = a.id and ended_at is null;
    update attendance set clock_out = v_end, no_clock_out = true where id = a.id;
    perform public.write_audit(a.business_id, a.branch_id, null, 'clock_out', 'attendance', a.id,
      a.full_name || ' did not clock out on ' || to_char(a.business_date, 'FMDD Mon') || ': shift closed at '
      || to_char(v_end at time zone a.tz, 'HH24:MI'));
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- A missed clock-out, or a shift closed with no clock-out: the owner, or a manager with a reason, sets the real time.
create or replace function public.fix_clock_out(p_attendance uuid, p_at timestamptz, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a attendance;
  e employees;
  m members;
  v_tz text;
begin
  select * into a from attendance where id = p_attendance for update;
  if a.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_can(a.branch_id, 'fixAttendance');
  select * into e from employees where id = a.employee_id;
  v_tz := public.branch_tz(a.branch_id);
  if (a.clock_out is not null and not a.no_clock_out) or a.business_date >= public.branch_today(a.branch_id) then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if public.role_level(m.role, 'fixAttendance') = 'reason' and length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if p_at is null or p_at < date_trunc('minute', a.clock_in) or p_at > now() or p_at > a.clock_in + interval '24 hours' then
    raise exception 'invalid_time' using errcode = '22023';
  end if;
  -- Breaks still open, or ended only because the shift was closed: they end at the real time.
  update attendance_breaks set ended_at = greatest(p_at, started_at), ended_by = m.id
  where attendance_id = a.id
    and (ended_at is null or (a.no_clock_out and ended_by is null and ended_at >= a.clock_out));
  update attendance set clock_out = greatest(p_at, clock_in), clock_out_by = m.id, no_clock_out = false
  where id = a.id returning * into a;
  perform public.write_audit(a.business_id, a.branch_id, m.id, 'clock_out', 'attendance', a.id,
    e.full_name || '''s missed clock-out on ' || to_char(a.business_date, 'FMDD Mon') || ' set to '
    || to_char(a.clock_out at time zone v_tz, 'HH24:MI') || ' by ' || m.display_name
    || coalesce(': ' || nullif(btrim(p_reason), ''), ''));
  return to_jsonb(a);
end;
$$;

-- The missed clock-out alert (managers, or the owner) covers shifts closed with no clock-out, and ends once fixed.
create or replace function public.notify_missed_clock_outs(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  a record;
  n int := 0;
begin
  for a in
    select at.*, e.full_name from attendance at join employees e on e.id = at.employee_id
    where (at.clock_out is null or at.no_clock_out) and at.business_date < public.branch_today(at.branch_id)
      and at.business_date >= public.branch_today(at.branch_id) - 7
  loop
    n := n + public.notify(a.business_id, a.branch_id, array['manager']::member_role[], 'missed_clock_out',
      'Missed clock-out', a.full_name || ' · ' || to_char(a.business_date, 'Dy DD Mon') || ' · clocked in at '
      || to_char(a.clock_in at time zone public.branch_tz(a.branch_id), 'HH24:MI'),
      'attendance', a.id, jsonb_build_object('name', a.full_name, 'date', a.business_date), 'missed:' || a.id, null, true);
  end loop;
  return n;
end;
$$;

create or replace function public.on_attendance_fixed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (old.clock_out is null or old.no_clock_out) and new.clock_out is not null and not new.no_clock_out then
    perform public.end_alerts('attendance', new.id, array['missed_clock_out']);
  end if;
  return new;
end;
$$;
drop trigger attendance_end_alerts on public.attendance;
create trigger attendance_end_alerts after update of clock_out, no_clock_out on public.attendance
  for each row execute function public.on_attendance_fixed();

-- Every hour: close the shifts left open on earlier days, then the alerts (each sent once).
create or replace function public.role_alerts() returns int
language plpgsql security definer set search_path = public as $$
begin
  perform public.close_open_shifts();
  return public.notify_missed_clock_outs() + public.notify_bills_due() + public.notify_month_ready();
end;
$$;

revoke execute on function public.close_open_shifts(timestamptz), public.notify_missed_clock_outs(timestamptz),
  public.on_attendance_fixed(), public.role_alerts() from public, anon, authenticated;

-- A day's attendance: "No clock-out" for a shift the app closed.
create or replace function public.attendance_day(p_branch uuid, p_date date default null)
returns table (employee_id uuid, full_name text, role_title text, colour text, shift_start text, shift_end text,
               status text, clock_in timestamptz, clock_out timestamptz, late boolean, late_minutes int,
               break_started_at timestamptz, break_minutes int)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner', 'manager', 'cashier', 'staff', 'accountant']::member_role[]);
  v_today date := public.branch_today(p_branch);
  v_date date := coalesce(p_date, v_today);
  -- Today: the shift running now (it may have started yesterday). Other days: that day's shift.
  v_at timestamp := case when v_date = v_today then (now() at time zone public.branch_tz(p_branch))
                         else v_date + time '12:00' end;
  v_grace int := coalesce((public.branch_setting(p_branch, 'late_grace_min', '10'))::text::int, 10);
begin
  return query
    select e.id, e.full_name, e.role_title, e.colour, to_char(sh.shift_start, 'HH24:MI'), to_char(sh.shift_end, 'HH24:MI'),
           case when a.no_clock_out then 'no_clock_out'
                when a.clock_out is not null then 'done'
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

-- Home: the missed clock-outs to fix.
create or replace function public.dashboard_today(p_branch uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  m members := public.require_member(p_branch, array['owner', 'manager', 'cashier', 'staff', 'accountant']::member_role[]);
  b branches;
  v_today date := public.branch_today(p_branch);
  v_front boolean := m.role in ('owner', 'manager', 'cashier', 'accountant');
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
      -- Stock (owner's app check A6): low is above zero and at or below the reorder level; out of stock is zero or
      -- below, counted here only for items that had stock at this branch (a new item not stocked yet is not news).
      -- Tools that need a service within a week.
      'stock', (select jsonb_build_object(
          'low', count(*) filter (where x.state = 'low'),
          'low_items', coalesce(jsonb_agg(x.name order by x.qty) filter (where x.state = 'low'), '[]'),
          'out', count(*) filter (where x.state = 'out' and x.had_stock),
          'out_items', coalesce(jsonb_agg(x.name order by x.qty) filter (where x.state = 'out' and x.had_stock), '[]'),
          'tools_due', count(*) filter (where x.kind = 'tool' and (x.condition = 'needs_service'
                                          or x.next_service_date <= v_today + 7)))
        from (select i.name, i.kind, i.condition, i.next_service_date, coalesce(sl.qty, 0) as qty,
                     public.stock_state(i.kind, i.active, coalesce(sl.qty, 0), i.reorder_level) as state,
                     public.had_stock(i.id, p_branch) as had_stock
              from inventory_items i
              left join stock_levels sl on sl.item_id = i.id and sl.branch_id = p_branch
              where i.business_id = b.business_id and i.active) x),
      -- Blind count: hidden from the front desk until today's count is in (null = hidden).
      'expected_cash', case when public.cash_visible(p_branch, v_today, m.role)
                            then public.drawer_cash_on(p_branch, v_today) end,
      'expected_cash_yesterday', case when public.cash_visible(p_branch, v_today - 1, m.role)
                                      then public.drawer_cash_on(p_branch, v_today - 1) end,
      'sales', (select jsonb_build_object(
          'count', count(*),
          -- Sales never include the tip (owner's app check A7); the day's tips are given apart.
          'total_minor', coalesce(sum(total_minor - tip_minor), 0),
          'tips_minor', coalesce(sum(tip_minor), 0),
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
            (select sum(total_minor - tip_minor) from sales where branch_id = p_branch and business_date = d::date), 0))
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
            'commission_minor', case when m.role in ('cashier', 'manager') then null else coalesce(x.commission_minor, 0) end,
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
          where e.branch_id = p_branch and e.active and public.takes_clients(e.role_title)), '[]'),
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
      -- Shifts on earlier days with no clock-out (owner's app check D1), for those who fix them (owner, manager).
      'missed_clock_outs', case when public.role_level(m.role, 'fixAttendance') is not null then
          (select count(*) from attendance a where a.branch_id = p_branch and a.business_date < v_today
             and (a.clock_out is null or a.no_clock_out)) end,
      'hygiene_signed', case when m.role in ('owner', 'manager', 'cashier')
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

  if m.role in ('owner', 'manager', 'cashier', 'staff') then
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
      'commission_month_minor', public.commission_for(v_me, to_char(v_today, 'YYYY-MM')),
      -- Their tips today (brief B8), less any tip refunded today, as the staff report counts them.
      'tips_today_minor', coalesce((select sum(s.tip_minor) from sales s
         where s.tip_employee_id = v_me and s.branch_id = p_branch and s.business_date = v_today), 0)
        - coalesce((select sum(r.tip_minor) from refunds r join sales s on s.id = r.sale_id
         where s.tip_employee_id = v_me and r.branch_id = p_branch and r.business_date = v_today), 0)));
  end if;

  return out;
end;
$$;
