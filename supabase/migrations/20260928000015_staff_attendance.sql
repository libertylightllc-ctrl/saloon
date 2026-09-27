-- M3 · Staff profiles, weekly rosters (they feed booking availability) and attendance with a late flag
-- (01-PRODUCT §3.10). Salaries are for the owner and the accountant only.

alter table public.employees
  add column employee_code text check (employee_code is null or length(employee_code) <= 20),
  add column base_salary_minor bigint not null default 0 check (base_salary_minor >= 0),
  add column wps_required boolean not null default false,
  add column phone text check (phone is null or length(phone) <= 20),
  add constraint employees_role_title_check check (role_title in ('staff', 'therapist', 'cashier', 'manager'));

-- Everyone in the salon sees who works there; only the owner and accountant see pay (staff_directory()).
revoke select on public.employees from authenticated;
grant select (id, business_id, branch_id, member_id, full_name, role_title, commission_bps, colour, active, created_at,
              employee_code, wps_required, phone)
  on public.employees to authenticated;

-- One shift per weekday (0 = Sunday). An employee with no roster at all follows the opening hours.
create table public.rosters (
  employee_id uuid not null references public.employees (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time <> start_time),
  primary key (employee_id, weekday)
);
alter table public.rosters enable row level security;
create policy "members read rosters" on public.rosters for select to authenticated using (public.is_member(business_id));
revoke insert, update, delete, truncate, references, trigger on public.rosters from anon, authenticated;

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  business_date date not null,
  clock_in timestamptz not null,
  clock_out timestamptz check (clock_out is null or clock_out >= clock_in),
  late boolean not null default false,
  late_minutes int not null default 0,
  clock_in_by uuid references public.members (id) on delete set null,
  clock_out_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (employee_id, business_date)
);
create index attendance_branch_date_idx on public.attendance (branch_id, business_date);
alter table public.attendance enable row level security;
-- The front desk sees the branch; a staff member sees their own days.
create policy "front desk reads attendance" on public.attendance for select to authenticated
  using ((public.has_role(business_id, array['owner', 'cashier', 'accountant']::public.member_role[])
          and public.can_use_branch(branch_id))
         or exists (select 1 from employees e join members m on m.id = e.member_id
                    where e.id = employee_id and m.user_id = auth.uid()));
revoke insert, update, delete, truncate, references, trigger on public.attendance from anon, authenticated;

-- ── Helpers ─────────────────────────────────────────────────────────────────────────────

-- Minutes from midnight; a shift that ends at or before it starts runs past midnight.
create function public.shift_minutes(p_start time, p_end time, out from_min int, out to_min int)
language sql immutable as $$
  select (extract(epoch from p_start) / 60)::int,
         (extract(epoch from p_end) / 60)::int
           + case when p_end <= p_start then 1440 else 0 end
$$;

-- Is the employee working on this date from minute a to minute b (minutes from that day's midnight)?
create function public.rostered(p_employee uuid, p_date date, p_from int, p_to int) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from rosters where employee_id = p_employee) then true
    else exists (select 1 from rosters r, public.shift_minutes(r.start_time, r.end_time) s
                 where r.employee_id = p_employee and r.weekday = extract(dow from p_date)::int
                   and p_from >= s.from_min and p_to <= s.to_min)
  end
$$;

-- ── Staff ───────────────────────────────────────────────────────────────────────────────

-- The staff list with pay, for the owner and the accountant.
create function public.staff_directory(p_business uuid)
returns table (employee_id uuid, branch_id uuid, member_id uuid, username text, full_name text, employee_code text,
               role_title text, commission_bps int, base_salary_minor bigint, wps_required boolean, phone text,
               colour text, active boolean, roster jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(p_business, array['owner', 'accountant']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select e.id, e.branch_id, e.member_id, m.username, e.full_name, e.employee_code, e.role_title, e.commission_bps,
           e.base_salary_minor, e.wps_required, e.phone, e.colour, e.active and coalesce(m.active, true),
           coalesce((select jsonb_agg(jsonb_build_object('weekday', r.weekday, 'start', to_char(r.start_time, 'HH24:MI'),
                                                         'end', to_char(r.end_time, 'HH24:MI')) order by r.weekday)
                     from rosters r where r.employee_id = e.id), '[]')
    from employees e left join members m on m.id = e.member_id
    where e.business_id = p_business
    order by e.active desc, e.full_name;
end;
$$;

-- Add or edit a staff profile (owner). New people without a login are added here; logins come from
-- Team & logins. p: {business_id, branch_id, id?, full_name, employee_code, role_title, base_salary_minor,
-- commission_bps, wps_required, phone, colour, active}
create function public.save_employee(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := (p ->> 'business_id')::uuid;
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_name text := nullif(btrim(p ->> 'full_name'), '');
  m members;
  e employees;
begin
  select * into m from members where business_id = v_business and user_id = auth.uid() and active and role = 'owner';
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_name is null or length(v_name) > 60 then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if coalesce((p ->> 'commission_bps')::int, 0) not between 0 and 10000 then
    raise exception 'invalid_commission' using errcode = '22023';
  end if;
  if coalesce((p ->> 'base_salary_minor')::bigint, 0) < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if v_id is null then
    if not exists (select 1 from branches where id = (p ->> 'branch_id')::uuid and business_id = v_business) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    insert into employees (business_id, branch_id, full_name, employee_code, role_title, base_salary_minor, commission_bps,
                           wps_required, phone, colour)
    values (v_business, (p ->> 'branch_id')::uuid, v_name, nullif(btrim(p ->> 'employee_code'), ''),
            coalesce(nullif(p ->> 'role_title', ''), 'staff'), coalesce((p ->> 'base_salary_minor')::bigint, 0),
            coalesce((p ->> 'commission_bps')::int, 0), coalesce((p ->> 'wps_required')::boolean, false),
            nullif(btrim(p ->> 'phone'), ''), nullif(p ->> 'colour', ''))
    returning * into e;
    perform public.write_audit(v_business, e.branch_id, m.id, 'create', 'employee', e.id, 'Added staff ' || v_name);
  else
    select * into e from employees where id = v_id and business_id = v_business for update;
    if e.id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    update employees set
      full_name = v_name,
      employee_code = nullif(btrim(p ->> 'employee_code'), ''),
      role_title = coalesce(nullif(p ->> 'role_title', ''), role_title),
      base_salary_minor = coalesce((p ->> 'base_salary_minor')::bigint, base_salary_minor),
      commission_bps = coalesce((p ->> 'commission_bps')::int, commission_bps),
      wps_required = coalesce((p ->> 'wps_required')::boolean, wps_required),
      phone = nullif(btrim(p ->> 'phone'), ''),
      colour = coalesce(nullif(p ->> 'colour', ''), colour),
      -- A person with a login is switched on and off with the login (Team & logins).
      active = case when member_id is null then coalesce((p ->> 'active')::boolean, active) else active end
    where id = v_id;
    perform public.write_audit(v_business, e.branch_id, m.id, 'update', 'employee', e.id,
      'Updated staff ' || v_name
      || case when coalesce((p ->> 'base_salary_minor')::bigint, e.base_salary_minor) <> e.base_salary_minor
              then ' (salary ' || public.fmt_money(e.base_salary_minor) || ' → '
                   || public.fmt_money((p ->> 'base_salary_minor')::bigint) || ')' else '' end);
  end if;
  return e.id;
end;
$$;

-- Replace an employee's weekly roster (owner). p_days: [{weekday, start: 'HH:MM', end: 'HH:MM'}]; [] = no roster.
create function public.set_roster(p_employee uuid, p_days jsonb) returns void
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
  m := public.require_member(e.branch_id, array['owner']::member_role[]);
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

-- ── Attendance ─────────────────────────────────────────────────────────────────────────

-- Clock in or out. Staff and cashiers clock themselves; the owner and a cashier can record for others,
-- with the time it happened (today, not in the future). Late = after the roster start plus the grace
-- minutes (branch setting late_grace_min, default 10). p: {employee_id, action: in|out, at?}
create function public.clock(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e employees;
  m members;
  a attendance;
  v_self boolean;
  v_at timestamptz := coalesce(nullif(p ->> 'at', '')::timestamptz, now());
  v_tz text;
  v_today date;
  v_start time;
  v_late_min int := 0;
  v_grace int;
begin
  select * into e from employees where id = (p ->> 'employee_id')::uuid and active;
  if e.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_member(e.branch_id, array['owner', 'cashier', 'staff']::member_role[]);
  v_self := e.member_id = m.id;
  if not v_self and m.role = 'staff' then
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
    select start_time into v_start from rosters where employee_id = e.id and weekday = extract(dow from v_today)::int;
    if v_start is not null then
      v_late_min := greatest(0, floor(extract(epoch from (v_at at time zone v_tz) - (v_today + v_start)) / 60)::int);
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
    if v_at < a.clock_in then
      raise exception 'invalid_time' using errcode = '22023';
    end if;
    update attendance set clock_out = v_at, clock_out_by = m.id where id = a.id returning * into a;
    perform public.write_audit(e.business_id, e.branch_id, m.id, 'clock_out', 'attendance', a.id,
      e.full_name || ' clocked out at ' || to_char(v_at at time zone v_tz, 'HH24:MI')
      || case when v_self then '' else ' — recorded by ' || m.display_name end);
  else
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  return to_jsonb(a);
end;
$$;

-- A day's attendance board. Owner, cashier, accountant: everyone in the branch; staff: themselves.
create function public.attendance_day(p_branch uuid, p_date date default null)
returns table (employee_id uuid, full_name text, role_title text, colour text, shift_start text, shift_end text,
               status text, clock_in timestamptz, clock_out timestamptz, late boolean, late_minutes int)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner', 'cashier', 'staff', 'accountant']::member_role[]);
  v_date date := coalesce(p_date, public.branch_today(p_branch));
begin
  return query
    select e.id, e.full_name, e.role_title, e.colour, to_char(r.start_time, 'HH24:MI'), to_char(r.end_time, 'HH24:MI'),
           case when a.clock_out is not null then 'done'
                when a.id is not null then 'on_shift'
                when exists (select 1 from rosters x where x.employee_id = e.id) and r.employee_id is null then 'off'
                else 'not_in' end,
           a.clock_in, a.clock_out, coalesce(a.late, false), coalesce(a.late_minutes, 0)
    from employees e
    left join rosters r on r.employee_id = e.id and r.weekday = extract(dow from v_date)::int
    left join attendance a on a.employee_id = e.id and a.business_date = v_date
    where e.branch_id = p_branch and e.active
      and (m.role <> 'staff' or e.member_id = m.id)
    order by e.full_name;
end;
$$;

-- ── Booking availability follows the rosters ───────────────────────────────────────────
-- Bookable start times for a day, every 30 minutes from opening. Hours that close at or before they open run
-- past midnight. With p_employee: that person must be rostered and free; otherwise fewer bookings than
-- rostered people (cashiers excluded) must overlap the slot.
create or replace function public.available_slots(p_branch uuid, p_date date, p_duration int, p_employee uuid default null)
returns table (slot text, starts_at timestamptz, available boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  b branches;
  tz text := public.branch_tz(p_branch);
  v_open int;
  v_close int;
  v_min int;
  v_len int := greatest(coalesce(p_duration, 30), 5);
  v_staff int;
  v_busy int;
begin
  if not public.can_use_branch(p_branch) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into b from branches where id = p_branch;
  if not (extract(dow from p_date)::int in (select jsonb_array_elements_text(b.opening_hours -> 'days')::int)) then
    return;
  end if;
  v_open := extract(epoch from (b.opening_hours ->> 'open')::time)::int / 60;
  v_close := extract(epoch from (b.opening_hours ->> 'close')::time)::int / 60;
  if v_close <= v_open then
    v_close := v_close + 1440;
  end if;
  v_min := v_open;
  while v_min + v_len <= v_close loop
    starts_at := (p_date::timestamp + make_interval(mins => v_min)) at time zone tz;
    select count(*) into v_staff from employees e
    where e.branch_id = p_branch and e.active and e.role_title <> 'cashier'
      and (p_employee is null or e.id = p_employee)
      and public.rostered(e.id, p_date, v_min, v_min + v_len);
    select count(*) into v_busy from appointments a
    where a.branch_id = p_branch and a.status in ('booked', 'waiting', 'in_progress')
      and (p_employee is null or a.employee_id = p_employee)
      and tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_min))
          && tstzrange(starts_at, starts_at + make_interval(mins => v_len));
    slot := to_char(p_date::timestamp + make_interval(mins => v_min), 'HH24:MI');
    available := starts_at > now()
      and case when p_employee is null
               then v_busy < greatest(v_staff, case when exists (select 1 from employees e where e.branch_id = p_branch
                                                                  and e.active and e.role_title <> 'cashier') then 0 else 1 end)
               else v_staff > 0 and v_busy = 0 end;
    return next;
    v_min := v_min + 30;
  end loop;
end;
$$;

revoke execute on function public.shift_minutes(time, time), public.rostered(uuid, date, int, int),
  public.staff_directory(uuid), public.save_employee(jsonb), public.set_roster(uuid, jsonb), public.clock(jsonb),
  public.attendance_day(uuid, date) from public, anon;
revoke execute on function public.rostered(uuid, date, int, int) from authenticated;
grant execute on function public.staff_directory(uuid), public.save_employee(jsonb), public.set_roster(uuid, jsonb),
  public.clock(jsonb), public.attendance_day(uuid, date) to authenticated;

alter publication supabase_realtime add table public.attendance, public.rosters;
