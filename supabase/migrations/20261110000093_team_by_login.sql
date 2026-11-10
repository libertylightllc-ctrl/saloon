-- Part B, step 5 (brief B2 "Team", B7): the team by login type.
-- * Clock in and out: everyone clocks themselves; owner and manager clock anyone; the front desk clocks someone else
--   with a manager's or the owner's PIN. A missed clock-out from an earlier day is filled in by the owner, or by a
--   manager with a reason (fix_clock_out).
-- * Rosters: owner and manager change them; front desk and accountant see them; stylists see their own.
-- * Payroll: the accountant records bonuses, deductions and advances, works the month out and pays it; only the owner
--   approves. Nobody away from the drawer pays in cash: the accountant pays by bank.
-- * Staff list: managers see the team, never salaries.
-- * Logins: managers get a staff record like everyone who works on the floor; the owner changes a login's type
--   (set_login_type); a manager resets the password of, or switches off, front desk and stylist logins in their own
--   branches (login_admin_for, used by the manage-staff-login server function).
-- * Jobs (B7): Stylist/Barber ('staff', named by the salon's mode), Therapist, Nail technician, Makeup artist,
--   Receptionist, Cashier, Manager, Assistant, Accountant. Receptionists, cashiers, accountants and assistants take
--   no bookings of their own (takes_clients).

alter table public.employees drop constraint employees_role_title_check;
alter table public.employees add constraint employees_role_title_check check (role_title = any (array[
  'staff', 'therapist', 'nail_technician', 'makeup_artist', 'receptionist', 'cashier', 'manager', 'assistant',
  'accountant']));

-- Jobs that are booked for services (the booking page, slots, Home's Staff today, Staff sales).
create function public.takes_clients(p_role_title text) returns boolean
language sql immutable set search_path = public as $$
  select p_role_title not in ('cashier', 'receptionist', 'accountant', 'assistant')
$$;

-- ── Who reads rosters and attendance ───────────────────────────────────────────────────────────
drop policy "members read rosters" on public.rosters;
create policy "team reads rosters" on public.rosters for select to authenticated
  using (business_id in (select public.my_business_ids_at('viewRoster', 'yes'))
         or employee_id in (select public.my_employee_ids()));
drop policy "front desk reads attendance" on public.attendance;
create policy "team reads attendance" on public.attendance for select to authenticated
  using ((business_id in (select public.my_business_ids_at('viewAttendance', 'yes'))
          and branch_id in (select public.my_branch_ids()))
         or employee_id in (select public.my_employee_ids()));
drop policy "front desk reads breaks" on public.attendance_breaks;
create policy "team reads breaks" on public.attendance_breaks for select to authenticated
  using ((business_id in (select public.my_business_ids_at('viewAttendance', 'yes'))
          and branch_id in (select public.my_branch_ids()))
         or exists (select 1 from attendance a where a.id = attendance_breaks.attendance_id
                    and a.employee_id in (select public.my_employee_ids())));


-- Clocking someone else in or out.
CREATE OR REPLACE FUNCTION public.clock(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  e employees;
  m members;
  a attendance;
  b attendance_breaks;
  v_self boolean;
  v_at timestamptz := coalesce(nullif(p ->> 'at', '')::timestamptz, now());
  -- "Now" (no time typed in): never earlier than what it follows, even if the server's clock has just stepped back.
  v_now boolean := nullif(p ->> 'at', '') is null;
  v_tz text;
  v_today date;
  v_start timestamp;
  v_late_min int := 0;
  v_grace int;
begin
  select * into e from employees where id = (p ->> 'employee_id')::uuid and active;
  if e.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_member(e.branch_id, array['owner', 'manager', 'cashier', 'staff']::member_role[]);
  v_self := e.member_id = m.id;
  -- Someone else: owner and manager; the front desk with a PIN (checked below, once the row exists); stylists never.
  if not v_self and public.role_level(m.role, 'recordAttendance') is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_tz := public.branch_tz(e.branch_id);
  v_today := public.branch_today(e.branch_id);
  if (v_at at time zone v_tz)::date <> v_today or v_at > now() + interval '1 minute'
     or (v_self and m.role <> 'owner' and abs(extract(epoch from v_at - now())) > 60) then
    raise exception 'invalid_time' using errcode = '22023';
  end if;
  select * into a from attendance where employee_id = e.id and business_date = v_today for update;

  if p ->> 'action' = 'in' then
    if a.id is not null then
      raise exception 'already_clocked_in' using errcode = '22023';
    end if;
    select shift_start into v_start from public.shift_at(e.id, v_at at time zone v_tz);
    if v_start is not null then
      v_late_min := greatest(0, floor(extract(epoch from (v_at at time zone v_tz) - v_start) / 60)::int);
    end if;
    v_grace := coalesce((public.branch_setting(e.branch_id, 'late_grace_min', '10'))::text::int, 10);
    insert into attendance (business_id, branch_id, employee_id, business_date, clock_in, late, late_minutes, clock_in_by)
    values (e.business_id, e.branch_id, e.id, v_today, v_at, v_late_min > v_grace,
            case when v_late_min > v_grace then v_late_min else 0 end, m.id)
    returning * into a;
    perform public.write_audit(e.business_id, e.branch_id, m.id, 'clock_in', 'attendance', a.id,
      e.full_name || ' clocked in at ' || to_char(v_at at time zone v_tz, 'HH24:MI')
      || case when a.late then ' (late ' || a.late_minutes || ' min)' else '' end
      || case when v_self then '' else ' — recorded by ' || m.display_name end);
  elsif p ->> 'action' = 'out' then
    if a.id is null or a.clock_out is not null then
      raise exception 'not_clocked_in' using errcode = '22023';
    end if;
    -- A time typed in counts to the minute: the same minute as a.clock_in is fine, and never earlier than it.
    if not v_now and v_at < date_trunc('minute', a.clock_in) then
      raise exception 'invalid_time' using errcode = '22023';
    end if;
    v_at := greatest(v_at, a.clock_in);
    -- Clocking out while on a break ends the break then.
    update attendance_breaks set ended_at = greatest(v_at, started_at), ended_by = m.id
    where attendance_id = a.id and ended_at is null;
    update attendance set clock_out = v_at, clock_out_by = m.id where id = a.id returning * into a;
    perform public.write_audit(e.business_id, e.branch_id, m.id, 'clock_out', 'attendance', a.id,
      e.full_name || ' clocked out at ' || to_char(v_at at time zone v_tz, 'HH24:MI')
      || case when v_self then '' else ' — recorded by ' || m.display_name end);
  elsif p ->> 'action' = 'break_start' then
    if a.id is null or a.clock_out is not null then
      raise exception 'not_clocked_in' using errcode = '22023';
    end if;
    if exists (select 1 from attendance_breaks where attendance_id = a.id and ended_at is null) then
      raise exception 'on_break' using errcode = '22023';
    end if;
    -- A time typed in counts to the minute: the same minute as a.clock_in is fine, and never earlier than it.
    if not v_now and v_at < date_trunc('minute', a.clock_in) then
      raise exception 'invalid_time' using errcode = '22023';
    end if;
    v_at := greatest(v_at, a.clock_in);
    insert into attendance_breaks (business_id, branch_id, attendance_id, started_at, started_by)
    values (a.business_id, a.branch_id, a.id, v_at, m.id);
    perform public.write_audit(e.business_id, e.branch_id, m.id, 'break_start', 'attendance', a.id,
      e.full_name || ' started a break at ' || to_char(v_at at time zone v_tz, 'HH24:MI')
      || case when v_self then '' else ' — recorded by ' || m.display_name end);
  elsif p ->> 'action' = 'break_end' then
    select * into b from attendance_breaks where attendance_id = a.id and ended_at is null for update;
    if b.id is null then
      raise exception 'not_on_break' using errcode = '22023';
    end if;
    -- A time typed in counts to the minute: the same minute as b.started_at is fine, and never earlier than it.
    if not v_now and v_at < date_trunc('minute', b.started_at) then
      raise exception 'invalid_time' using errcode = '22023';
    end if;
    v_at := greatest(v_at, b.started_at);
    update attendance_breaks set ended_at = v_at, ended_by = m.id where id = b.id;
    perform public.write_audit(e.business_id, e.branch_id, m.id, 'break_end', 'attendance', a.id,
      e.full_name || ' back from a break at ' || to_char(v_at at time zone v_tz, 'HH24:MI')
      || ' (' || floor(extract(epoch from v_at - b.started_at) / 60)::int || ' min)'
      || case when v_self then '' else ' — recorded by ' || m.display_name end);
  elsif p ->> 'action' = 'resume' then
    -- Clocked out by mistake, or out for a while and back: the day goes on, the time away counts as a break.
    if a.id is null or a.clock_out is null then
      raise exception 'not_clocked_in' using errcode = '22023';
    end if;
    -- A time typed in counts to the minute: the same minute as a.clock_out is fine, and never earlier than it.
    if not v_now and v_at < date_trunc('minute', a.clock_out) then
      raise exception 'invalid_time' using errcode = '22023';
    end if;
    v_at := greatest(v_at, a.clock_out);
    insert into attendance_breaks (business_id, branch_id, attendance_id, started_at, ended_at, started_by, ended_by)
    values (a.business_id, a.branch_id, a.id, a.clock_out, v_at, a.clock_out_by, m.id);
    perform public.write_audit(e.business_id, e.branch_id, m.id, 'resume', 'attendance', a.id,
      e.full_name || ' back at work at ' || to_char(v_at at time zone v_tz, 'HH24:MI')
      || ' (had clocked out at ' || to_char(a.clock_out at time zone v_tz, 'HH24:MI') || ')'
      || case when v_self then '' else ' — recorded by ' || m.display_name end);
    update attendance set clock_out = null, clock_out_by = null where id = a.id returning * into a;
  else
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if not v_self and public.role_level(m.role, 'recordAttendance') = 'pin' then
    perform public.use_approval(nullif(p ->> 'approval_id', '')::uuid, m.id, e.branch_id, 'clock_other', null, null,
                                'attendance', a.id);
  end if;
  return to_jsonb(a);
end;
$function$;

-- A clock-out that was missed on an earlier day: the owner, or a manager with a reason. Open breaks end then too.
create function public.fix_clock_out(p_attendance uuid, p_at timestamptz, p_reason text default null) returns jsonb
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
  if a.clock_out is not null or a.business_date >= public.branch_today(a.branch_id) then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if public.role_level(m.role, 'fixAttendance') = 'reason' and length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if p_at is null or p_at < date_trunc('minute', a.clock_in) or p_at > now() or p_at > a.clock_in + interval '24 hours' then
    raise exception 'invalid_time' using errcode = '22023';
  end if;
  update attendance_breaks set ended_at = greatest(p_at, started_at), ended_by = m.id
  where attendance_id = a.id and ended_at is null;
  update attendance set clock_out = greatest(p_at, clock_in), clock_out_by = m.id where id = a.id returning * into a;
  perform public.write_audit(a.business_id, a.branch_id, m.id, 'clock_out', 'attendance', a.id,
    e.full_name || '''s missed clock-out on ' || to_char(a.business_date, 'FMDD Mon') || ' set to '
    || to_char(a.clock_out at time zone v_tz, 'HH24:MI') || ' by ' || m.display_name
    || coalesce(': ' || nullif(btrim(p_reason), ''), ''));
  return to_jsonb(a);
end;
$$;
revoke execute on function public.fix_clock_out(uuid, timestamptz, text) from public, anon;

-- Rosters: owner and manager.
create or replace function public.set_roster(p_employee uuid, p_days jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  e employees;
  m members;
  d jsonb;
begin
  select * into e from employees where id = p_employee;
  if e.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_can(e.branch_id, 'manageRoster');
  delete from rosters where employee_id = e.id;
  for d in select * from jsonb_array_elements(coalesce(p_days, '[]')) loop
    if (d ->> 'weekday')::int not between 0 and 6 or (d ->> 'start')::time = (d ->> 'end')::time then
      raise exception 'invalid_roster' using errcode = '22023';
    end if;
    insert into rosters (employee_id, business_id, weekday, start_time, end_time)
    values (e.id, e.business_id, (d ->> 'weekday')::int, (d ->> 'start')::time, (d ->> 'end')::time);
  end loop;
  perform public.write_audit(e.business_id, e.branch_id, m.id, 'update', 'roster', e.id,
    'Updated the weekly roster of ' || e.full_name);
end;
$$;

-- Payroll: the owner and the accountant work it out; only the owner approves (approve_payroll is unchanged).
create or replace function public.generate_payroll(p_business uuid, p_period text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m members;
  r payroll_runs;
begin
  m := public.require_can_business(p_business, 'runPayroll');
  if p_period !~ '^\d{4}-\d{2}$' or p_period > to_char(public.business_today(p_business), 'YYYY-MM') then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  select * into r from payroll_runs where business_id = p_business and period = p_period for update;
  if r.status in ('approved', 'paid') then
    raise exception 'payroll_approved' using errcode = '22023';
  end if;
  if r.id is null then
    insert into payroll_runs (business_id, period, generated_by) values (p_business, p_period, m.id) returning * into r;
  else
    -- A draft is only figures: replace them.
    delete from payroll_lines where run_id = r.id;
    update payroll_runs set generated_by = m.id, generated_at = now() where id = r.id;
  end if;
  insert into payroll_lines (run_id, business_id, branch_id, employee_id, base_minor, commission_minor, bonus_minor,
                             deductions_minor, advances_minor, net_minor, wps_status)
  select r.id, p_business, f.branch_id, f.employee_id, f.base_minor, f.commission_minor, f.bonus_minor,
         f.deductions_minor, f.advances_minor, f.net_minor, f.wps_status
  from public.payroll_figures(p_business, p_period) f;
  perform public.write_audit(p_business, null, m.id, 'generate', 'payroll_run', r.id,
    'Generated payroll ' || p_period || ': net ' || public.fmt_money(
      coalesce((select sum(net_minor) from payroll_lines where run_id = r.id), 0)::bigint));
  return r.id;
end;
$function$;

create or replace function public.pay_payroll_line(p_line uuid, p_method text) returns void
language plpgsql security definer set search_path = public as $$
declare
  l payroll_lines;
  r payroll_runs;
  e employees;
  m members;
  v_method payment_method := p_method::payment_method;
begin
  select * into l from payroll_lines where id = p_line for update;
  if l.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into r from payroll_runs where id = l.run_id for update;
  select * into e from employees where id = l.employee_id;
  m := public.require_can(l.branch_id, 'payPayroll');
  if r.status <> 'approved' or l.paid_at is not null then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if v_method not in ('cash', 'bank') then
    raise exception 'invalid_payment' using errcode = '22023';
  end if;
  -- Cash comes out of the drawer: only people who work the drawer pay in cash.
  if v_method = 'cash' and public.role_level(m.role, 'countCash') is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update payroll_lines set paid_method = v_method, paid_at = now(), paid_by = m.id where id = l.id;
  perform public.post_journal(l.business_id, l.branch_id, public.branch_today(l.branch_id), 'payroll_payment', l.id,
    'Salary ' || r.period || ' — ' || e.full_name, m.id,
    jsonb_build_array(jsonb_build_object('account', 'salaries_payable', 'debit', l.net_minor),
                      jsonb_build_object('account', public.paid_from_account(v_method), 'credit', l.net_minor)));
  if not exists (select 1 from payroll_lines where run_id = r.id and paid_at is null) then
    update payroll_runs set status = 'paid' where id = r.id;
  end if;
  perform public.write_audit(l.business_id, l.branch_id, m.id, 'pay', 'payroll_line', l.id,
    'Paid ' || r.period || ' salary ' || public.fmt_money(l.net_minor) || ' to ' || e.full_name || ' by ' || v_method);
end;
$$;

create or replace function public.record_adjustment(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  e employees;
  m members;
  v_kind text := p ->> 'kind';
  v_amount bigint := (p ->> 'amount_minor')::bigint;
  v_method payment_method := case when p ->> 'kind' = 'advance'
                                  then coalesce(nullif(p ->> 'method', ''), 'cash')::payment_method end;
  v_ref text := nullif(p ->> 'client_ref', '');
  v_today date;
  v_period text;
  v_id uuid;
begin
  select * into e from employees where id = (p ->> 'employee_id')::uuid;
  if e.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_can(e.branch_id, 'recordPay');
  if v_ref is not null and exists (select 1 from payroll_adjustments where client_ref = v_ref and business_id = m.business_id) then
    return jsonb_build_object('adjustment_id',
      (select id from payroll_adjustments where client_ref = v_ref and business_id = m.business_id), 'repeated', true);
  end if;
  if v_kind not in ('bonus', 'deduction', 'advance') then
    raise exception 'invalid_line' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if v_method is not null and v_method not in ('cash', 'bank') then
    raise exception 'invalid_payment' using errcode = '22023';
  end if;
  -- Cash comes out of the drawer: only people who work the drawer pay in cash.
  if v_method = 'cash' and public.role_level(m.role, 'countCash') is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_today := public.branch_today(e.branch_id);
  v_period := to_char(v_today, 'YYYY-MM');
  if exists (select 1 from payroll_runs where business_id = e.business_id and period = v_period and status <> 'generated') then
    raise exception 'payroll_approved' using errcode = '22023';
  end if;
  insert into payroll_adjustments (business_id, branch_id, employee_id, period, kind, amount_minor, method, business_date,
                                   note, client_ref, created_by)
  values (e.business_id, e.branch_id, e.id, v_period, v_kind, v_amount, v_method, v_today,
          nullif(btrim(p ->> 'note'), ''), v_ref, m.id)
  returning id into v_id;
  if v_kind = 'advance' then
    perform public.post_journal(e.business_id, e.branch_id, v_today, 'staff_advance', v_id, 'Advance to ' || e.full_name, m.id,
      jsonb_build_array(jsonb_build_object('account', 'staff_advances', 'debit', v_amount),
                        jsonb_build_object('account', public.paid_from_account(v_method), 'credit', v_amount)));
  end if;
  perform public.write_audit(e.business_id, e.branch_id, m.id, 'create', 'payroll_adjustment', v_id,
    initcap(v_kind) || ' ' || public.fmt_money(v_amount) || ' for ' || e.full_name
    || coalesce(': ' || nullif(btrim(p ->> 'note'), ''), ''));
  return jsonb_build_object('adjustment_id', v_id, 'repeated', false);
end;
$$;

create or replace function public.reverse_adjustment(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a payroll_adjustments;
  m members;
begin
  select * into a from payroll_adjustments where id = p_id for update;
  if a.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_can(a.branch_id, 'recordPay');
  -- Cash comes out of the drawer: only people who work the drawer pay in cash.
  if a.method = 'cash' and public.role_level(m.role, 'countCash') is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if a.status <> 'posted' then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if exists (select 1 from payroll_runs where business_id = a.business_id and period = a.period and status <> 'generated') then
    raise exception 'payroll_approved' using errcode = '22023';
  end if;
  update payroll_adjustments set status = 'reversed', reverse_reason = btrim(p_reason) where id = a.id;
  if a.kind = 'advance' then
    perform public.post_journal(a.business_id, a.branch_id, public.branch_today(a.branch_id), 'staff_advance_reversal', a.id,
      'Advance reversed', m.id,
      jsonb_build_array(jsonb_build_object('account', public.paid_from_account(a.method), 'debit', a.amount_minor),
                        jsonb_build_object('account', 'staff_advances', 'credit', a.amount_minor)));
  end if;
  perform public.write_audit(a.business_id, a.branch_id, m.id, 'reverse', 'payroll_adjustment', a.id,
    'Reversed ' || a.kind || ' ' || public.fmt_money(a.amount_minor) || ': ' || btrim(p_reason));
end;
$$;

create or replace function public.attach_wps_evidence(p_line uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare
  l payroll_lines;
  m members;
begin
  select * into l from payroll_lines where id = p_line for update;
  if l.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_can(l.branch_id, 'payPayroll');
  if l.paid_at is null or l.wps_status = 'na' then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if split_part(p_path, '/', 1) <> l.business_id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'documents' and o.name = p_path) then
    raise exception 'receipt_missing' using errcode = '22023';
  end if;
  update payroll_lines set wps_status = 'proven', wps_evidence_path = p_path where id = l.id;
  perform public.write_audit(l.business_id, l.branch_id, m.id, 'attach', 'payroll_line', l.id, 'Added WPS transfer proof');
end;
$$;

-- The staff list: owner, manager (no salaries) and accountant.
create or replace function public.staff_directory(p_business uuid)
returns table (employee_id uuid, branch_id uuid, member_id uuid, username text, full_name text, employee_code text,
               role_title text, commission_bps int, base_salary_minor bigint, wps_required boolean, phone text,
               colour text, active boolean, roster jsonb)
language plpgsql stable security definer set search_path = public as $$
declare
  me members := public.require_can_business(p_business, 'viewStaff');
  v_pay boolean := public.role_level(me.role, 'viewPayroll') is not null;
begin
  return query
    select e.id, e.branch_id, e.member_id, m.username, e.full_name, e.employee_code, e.role_title, e.commission_bps,
           case when v_pay then e.base_salary_minor end, e.wps_required, e.phone, e.colour, e.active and coalesce(m.active, true),
           coalesce((select jsonb_agg(jsonb_build_object('weekday', r.weekday, 'start', to_char(r.start_time, 'HH24:MI'),
                                                         'end', to_char(r.end_time, 'HH24:MI')) order by r.weekday)
                     from rosters r where r.employee_id = e.id), '[]')
    from employees e left join members m on m.id = e.member_id
    where e.business_id = p_business
    order by e.active desc, e.full_name;
end;
$$;

-- A manager's login comes with their place on the staff list, like the front desk's and stylists'.
CREATE OR REPLACE FUNCTION public.register_staff_member(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_member uuid;
  v_employee uuid;
  v_matches int;
  v_business uuid := (p ->> 'business_id')::uuid;
  v_name text := btrim(p ->> 'display_name');
  v_role member_role := (p ->> 'role')::member_role;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_role = 'owner' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  insert into members (business_id, user_id, role, display_name, username, default_branch_id)
  values (v_business, (p ->> 'user_id')::uuid, v_role, v_name, p ->> 'username', (p ->> 'branch_id')::uuid)
  returning id into v_member;
  insert into member_branches (member_id, branch_id) values (v_member, (p ->> 'branch_id')::uuid);

  -- The person may already be on the staff list: their login joins that record.
  if nullif(p ->> 'employee_id', '') is not null then
    select id into v_employee from employees
    where id = (p ->> 'employee_id')::uuid and business_id = v_business and member_id is null
    for update;
    if v_employee is null then
      raise exception 'employee_has_login' using errcode = '22023';
    end if;
  elsif v_role in ('staff', 'cashier', 'manager') then
    select (array_agg(id))[1], count(*) into v_employee, v_matches from employees
    where business_id = v_business and member_id is null and active and lower(btrim(full_name)) = lower(v_name);
    if v_matches <> 1 then
      v_employee := null;
    end if;
  end if;

  if v_employee is not null then
    update employees
    set member_id = v_member,
        commission_bps = case when commission_bps = 0 then coalesce((p ->> 'commission_bps')::int, 0) else commission_bps end,
        colour = coalesce(colour, p ->> 'colour')
    where id = v_employee;
  elsif v_role in ('staff', 'cashier', 'manager') then
    insert into employees (business_id, branch_id, member_id, full_name, role_title, commission_bps, colour)
    values (v_business, (p ->> 'branch_id')::uuid, v_member, v_name, v_role::text,
            coalesce((p ->> 'commission_bps')::int, 0), p ->> 'colour')
    returning id into v_employee;
  end if;
  perform public.write_audit(v_business, (p ->> 'branch_id')::uuid, (p ->> 'actor_member_id')::uuid, 'create', 'member',
    v_member, 'Created login ' || (p ->> 'username') || ' (' || v_role::text || ') for ' || v_name);
  return jsonb_build_object('member_id', v_member, 'employee_id', v_employee);
end;
$function$;

-- Who may reset this login's password or switch it off: the owner for anyone but the owner; a manager for front desk
-- and stylist logins that work in one of the manager's branches. For the manage-staff-login server function (service
-- role), which passes the signed-in user. Returns the member acting.
create function public.login_admin_for(p_user uuid, p_target uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  t members;
  me members;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into t from members where id = p_target;
  if t.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into me from members where business_id = t.business_id and user_id = p_user and active;
  if me.id is null or t.role = 'owner' or t.id = me.id
     or public.role_level(me.role, 'resetLogin') is null
     or (public.role_level(me.role, 'resetLogin') = 'branch'
         and (t.role not in ('cashier', 'staff')
              or not exists (select 1 from member_branches a join member_branches b on b.branch_id = a.branch_id
                             where a.member_id = me.id and b.member_id = t.id))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return me.id;
end;
$$;
revoke execute on function public.login_admin_for(uuid, uuid) from public, anon, authenticated;
grant execute on function public.login_admin_for(uuid, uuid) to service_role;

-- The owner changes a login's type (Front desk, Stylist / therapist, Manager, Accountant). Nothing else changes: the
-- person keeps their staff record, sales, pay and history.
create function public.set_login_type(p_member uuid, p_role public.member_role) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t members;
  m members;
  v_branch uuid;
begin
  select * into t from members where id = p_member for update;
  if t.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_can_business(t.business_id, 'manageUsers');
  if t.role = 'owner' or p_role = 'owner' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if t.role = p_role then
    return to_jsonb(t);
  end if;
  update members set role = p_role where id = t.id returning * into t;
  -- A login that works the floor has a place on the staff list.
  -- An accountant had every branch and none of their own: a floor login works in the salon's first branch until
  -- the owner picks another.
  v_branch := coalesce(t.default_branch_id, (select branch_id from member_branches where member_id = t.id limit 1),
                       (select id from branches where business_id = t.business_id order by created_at, id limit 1));
  if p_role <> 'accountant' and not exists (select 1 from member_branches where member_id = t.id) then
    insert into member_branches (member_id, branch_id) values (t.id, v_branch);
  end if;
  if p_role <> 'accountant' and not exists (select 1 from employees where member_id = t.id) then
    insert into employees (business_id, branch_id, member_id, full_name, role_title)
    values (t.business_id, v_branch, t.id, left(t.display_name, 60), case p_role when 'manager' then 'manager'
                                                                        when 'cashier' then 'cashier' else 'staff' end);
  end if;
  perform public.write_audit(t.business_id, t.default_branch_id, m.id, 'update', 'member', t.id,
    'Changed ' || t.display_name || '''s login to ' || p_role::text);
  return to_jsonb(t);
end;
$$;
revoke execute on function public.set_login_type(uuid, public.member_role) from public, anon;

-- Only jobs that take clients (report_staff).
create or replace function public.report_staff(p_branch uuid, p_month text)
returns table (employee_id uuid, full_name text, services numeric, sales_minor bigint, revenue_minor bigint,
               commission_minor bigint, tips_minor bigint, days_worked int, late_days int)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner', 'accountant']::member_role[]);
  b record := public.month_bounds(p_month);
begin
  return query
    select e.id, e.full_name,
      coalesce((select sum(sl.qty) from sale_lines sl join sales s on s.id = sl.sale_id
                where sl.employee_id = e.id and s.business_date between b.d_from and b.d_to and sl.kind = 'service'), 0),
      coalesce((select sum(sl.net_minor) from sale_lines sl join sales s on s.id = sl.sale_id
                where sl.employee_id = e.id and s.business_date between b.d_from and b.d_to), 0)::bigint,
      -- Revenue after the refunds made this month (their share without the tip), as the books have it.
      (coalesce((select sum(sl.net_minor - sl.vat_minor) from sale_lines sl join sales s on s.id = sl.sale_id
                 where sl.employee_id = e.id and s.business_date between b.d_from and b.d_to), 0)
       - coalesce((select sum(round(x.rev::numeric * (r.amount_minor - r.tip_minor) / nullif(s.total_minor - s.tip_minor, 0)))
                   from refunds r join sales s on s.id = r.sale_id,
                     lateral (select sum(sl.net_minor - sl.vat_minor) as rev from sale_lines sl
                              where sl.sale_id = s.id and sl.employee_id = e.id) x
                   where r.branch_id = p_branch and x.rev is not null
                     and r.business_date between b.d_from and b.d_to), 0))::bigint,
      public.commission_for(e.id, p_month),
      -- Tips they keep: this month's tips less any tip refunded this month.
      (coalesce((select sum(s.tip_minor) from sales s where s.tip_employee_id = e.id
                 and s.business_date between b.d_from and b.d_to), 0)
       - coalesce((select sum(r.tip_minor) from refunds r join sales s on s.id = r.sale_id
                   where s.tip_employee_id = e.id and r.business_date between b.d_from and b.d_to), 0))::bigint,
      (select count(*)::int from attendance a where a.employee_id = e.id and a.business_date between b.d_from and b.d_to),
      (select count(*)::int from attendance a where a.employee_id = e.id and a.late and a.business_date between b.d_from and b.d_to)
    from employees e
    where e.branch_id = p_branch and public.takes_clients(e.role_title)
      and (e.active or exists (select 1 from sale_lines sl join sales s on s.id = sl.sale_id
                               where sl.employee_id = e.id and s.business_date between b.d_from and b.d_to))
    order by 4 desc, e.full_name, e.id;
end;
$$;

-- Only jobs that take clients (book_slots).
create or replace function public.book_slots(p_branch uuid, p_date date, p_duration int, p_employee uuid default null)
returns table (slot text, starts_at timestamptz, available boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  b branches;
  tz text := public.branch_tz(p_branch);
  v_min int := 0;
  v_len int := greatest(coalesce(p_duration, 30), 5);
  v_staff int;
  v_busy int;
  v_has_staff boolean;
begin
  select * into b from branches where id = p_branch;
  if not (extract(dow from p_date)::int in (select jsonb_array_elements_text(b.opening_hours -> 'days')::int)) then
    return;
  end if;
  v_has_staff := exists (select 1 from employees e where e.branch_id = p_branch and e.active
                           and public.takes_clients(e.role_title) and (p_employee is null or e.id = p_employee));
  while v_min + v_len <= 1440 loop
    starts_at := (p_date::timestamp + make_interval(mins => v_min)) at time zone tz;
    if starts_at > now() then
      select count(*) into v_staff from employees e
      where e.branch_id = p_branch and e.active and public.takes_clients(e.role_title)
        and (p_employee is null or e.id = p_employee)
        and public.rostered(e.id, p_date, v_min, v_min + v_len);
      -- A salon with nobody to book yet (only the owner) takes one booking at a time.
      if v_staff > 0 or (p_employee is null and not v_has_staff) then
        select count(*) into v_busy from appointments a
        where a.branch_id = p_branch and a.status in ('booked', 'waiting', 'in_progress')
          and (p_employee is null or a.employee_id = p_employee)
          and tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_min))
              && tstzrange(starts_at, starts_at + make_interval(mins => v_len));
        slot := to_char(p_date::timestamp + make_interval(mins => v_min), 'HH24:MI');
        available := v_busy < greatest(v_staff, 1);
        return next;
      end if;
    end if;
    v_min := v_min + 30;
  end loop;
end;
$$;

-- Only jobs that take clients (public_booking_page).
create or replace function public.public_booking_page(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  b branches := public.booking_branch(p_slug);
  bu businesses;
begin
  if b.id is null then
    return null;
  end if;
  select * into bu from businesses where id = b.business_id;
  return jsonb_build_object(
    'salon', jsonb_build_object(
      'business_name', bu.name, 'branch_name', b.name, 'mode', b.mode, 'address', b.address, 'phone', b.phone,
      'logo_path', b.logo_path, 'cover_path', b.cover_path, 'instagram', b.instagram,
      'open_days', b.opening_hours -> 'days', 'currency', bu.currency, 'timezone', bu.timezone,
      'country_code', bu.country_code, 'today', public.branch_today(b.id),
      'cancel_cutoff_hours', coalesce((b.settings ->> 'cancel_cutoff_hours')::int, 12),
      'tax_added', b.vat_mode = 'on' and not b.tax_inclusive and b.tax_rate_bps > 0, 'tax_name', b.tax_name),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'translations', c.translations)
                                             order by c.sort, c.name)
                            from service_categories c where c.business_id = b.business_id and not c.archived
                              and exists (select 1 from services s where s.category_id = c.id and s.status = 'active')), '[]'),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'category_id', s.category_id, 'name', s.name,
                                             'translations', s.translations, 'price_minor', s.price_minor,
                                             'duration_min', s.duration_min) order by s.name)
                          from services s where s.business_id = b.business_id and s.status = 'active'), '[]'),
    'staff', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', public.public_staff_name(e.full_name))
                                        order by e.full_name)
                       from employees e where e.branch_id = b.id and e.active and public.takes_clients(e.role_title)), '[]'));
end;
$$;

-- Only jobs that take clients (public_booking_slots).
CREATE OR REPLACE FUNCTION public.public_booking_slots(p_slug text, p_date date, p_services uuid[], p_employee uuid DEFAULT NULL::uuid)
 RETURNS TABLE(slot text, starts_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  b branches := public.booking_branch(p_slug);
  v_len int;
  v_room boolean;
  v_rostered boolean;
begin
  if b.id is null or p_date is null or p_date < public.branch_today(b.id) or p_date > public.branch_today(b.id) + 30 then
    return;
  end if;
  select l.minutes, l.needs_room into v_len, v_room from public.booking_length(b.business_id, p_services) l;
  if v_len is null then
    return;
  end if;
  if p_employee is not null and not exists (select 1 from employees e where e.id = p_employee and e.branch_id = b.id
                                              and e.active and public.takes_clients(e.role_title)) then
    return;
  end if;
  v_rostered := exists (select 1 from rosters r join employees e on e.id = r.employee_id where e.branch_id = b.id and e.active);
  return query
    select s.slot, s.starts_at from public.book_slots(b.id, p_date, v_len, p_employee) s
    where s.available and s.starts_at >= now() + interval '30 minutes'
      and (v_rostered or s.slot between '09:00' and '23:30')
      and (not (v_room and public.mode_uses_rooms(b.mode)) or public.free_room(b.id, s.starts_at, v_len) is not null)
    order by s.starts_at;
end;
$function$;

-- Only jobs that take clients (dashboard_today).
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
