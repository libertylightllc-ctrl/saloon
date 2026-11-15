-- Part C1 (owner's app check, 9 Nov 2026; plan in docs/PART-C-F-PLAN.md): base pay by the days someone was employed.
-- * Every staff member has a start date (the day they were added, unless the owner sets another) and, once removed or
--   switched off, a leaving date (cleared when brought back).
-- * Base pay for a month = monthly salary × days employed in that month ÷ days in the month, rounded to the nearest
--   fils. Someone switched off before this change, with no leaving date known, is paid no base, as before.
-- * Each payroll line keeps "days employed" and "days in the month" (lines saved before this change have none).
-- Approved and paid months are never worked out again; a month still in draft shows "out of date" and is worked out
-- again before approval, as for any other change.

alter table public.employees
  add column started_on date,
  add column left_on date,
  add constraint employees_left_after_start check (left_on is null or started_on is null or left_on >= started_on);

alter table public.payroll_lines
  add column days_employed int check (days_employed between 0 and 31),
  add column days_in_month int check (days_in_month between 28 and 31);

-- Start dates for everyone already on the staff list: the day they were added, in the salon's own time.
update public.employees e
set started_on = (e.created_at at time zone coalesce(b.timezone, 'Asia/Dubai'))::date
from public.businesses b
where b.id = e.business_id and e.started_on is null;

-- Leaving dates for people removed from the staff (archived): the day it was done, from the activity log.
update public.employees e
set left_on = greatest(e.started_on, (x.archived_at at time zone coalesce(b.timezone, 'Asia/Dubai'))::date)
from public.businesses b,
     (select a.entity_id, max(a.created_at) as archived_at from public.audit_log a
      where a.entity_type = 'employee' and a.summary like 'Archived %' group by a.entity_id) x
where b.id = e.business_id and x.entity_id = e.id and not e.active and e.left_on is null;

-- A new staff member starts on the salon's today unless a date is given.
create function public.employee_start_date() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.started_on := coalesce(new.started_on, public.business_today(new.business_id));
  return new;
end;
$$;
create trigger employees_start_date before insert on public.employees
  for each row execute function public.employee_start_date();
revoke execute on function public.employee_start_date() from public, anon, authenticated;

alter table public.employees alter column started_on set not null;

-- Days someone was employed in a month (start and leaving days count), and the month's length.
create function public.days_employed(e public.employees, p_period text) returns int
language sql immutable set search_path = public as $$
  select case
    when not e.active and e.left_on is null then 0
    else greatest(0, least(coalesce(e.left_on, (to_date(p_period, 'YYYY-MM') + interval '1 month - 1 day')::date),
                           (to_date(p_period, 'YYYY-MM') + interval '1 month - 1 day')::date)
                     - greatest(e.started_on, to_date(p_period, 'YYYY-MM')) + 1)
  end
$$;

drop function public.payroll_figures(uuid, text);
create function public.payroll_figures(p_business uuid, p_period text)
returns table (employee_id uuid, branch_id uuid, base_minor bigint, commission_minor bigint, bonus_minor bigint,
               deductions_minor bigint, advances_minor bigint, net_minor bigint, wps_status text,
               days_employed int, days_in_month int)
language plpgsql stable security definer set search_path = public as $$
declare
  e employees;
  v_days int;
  v_month_days int := extract(day from (to_date(p_period, 'YYYY-MM') + interval '1 month - 1 day'))::int;
  v_base bigint;
  v_comm bigint;
  v_bonus bigint;
  v_ded bigint;
  v_outstanding bigint;
  v_adv bigint;
  v_gross bigint;
begin
  for e in select * from employees where business_id = p_business order by full_name loop
    v_days := public.days_employed(e, p_period);
    -- Salary × days ÷ days in the month, rounded half up (whole months pay the salary exactly).
    v_base := (e.base_salary_minor * v_days * 2 + v_month_days) / (2 * v_month_days);
    v_comm := public.commission_for(e.id, p_period);
    select coalesce(sum(a.amount_minor) filter (where a.kind = 'bonus'), 0),
           coalesce(sum(a.amount_minor) filter (where a.kind = 'deduction'), 0)
      into v_bonus, v_ded
    from payroll_adjustments a where a.employee_id = e.id and a.period = p_period and a.status = 'posted';
    -- Advances not yet recovered by an approved month (this one's included).
    v_outstanding := coalesce((select sum(a.amount_minor) from payroll_adjustments a
                               where a.employee_id = e.id and a.kind = 'advance' and a.status = 'posted'
                                 and a.period <= p_period), 0)
                   - coalesce((select sum(l.advances_minor) from payroll_lines l join payroll_runs x on x.id = l.run_id
                               where l.employee_id = e.id and x.status <> 'generated' and x.period < p_period), 0);
    continue when v_base = 0 and v_comm = 0 and v_bonus = 0 and v_ded = 0 and v_outstanding <= 0;
    v_ded := least(v_ded, v_base + v_comm + v_bonus);
    v_gross := v_base + v_comm + v_bonus - v_ded;
    v_adv := least(greatest(v_outstanding, 0), v_gross);
    employee_id := e.id; branch_id := e.branch_id; base_minor := v_base; commission_minor := v_comm;
    bonus_minor := v_bonus; deductions_minor := v_ded; advances_minor := v_adv; net_minor := v_gross - v_adv;
    wps_status := case when e.wps_required then 'required' else 'na' end;
    days_employed := v_days; days_in_month := v_month_days;
    return next;
  end loop;
end;
$$;
revoke execute on function public.payroll_figures(uuid, text) from public, anon, authenticated;
revoke execute on function public.days_employed(public.employees, text) from public, anon;

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
                             deductions_minor, advances_minor, net_minor, wps_status, days_employed, days_in_month)
  select r.id, p_business, f.branch_id, f.employee_id, f.base_minor, f.commission_minor, f.bonus_minor,
         f.deductions_minor, f.advances_minor, f.net_minor, f.wps_status, f.days_employed, f.days_in_month
  from public.payroll_figures(p_business, p_period) f;
  perform public.write_audit(p_business, null, m.id, 'generate', 'payroll_run', r.id,
    'Generated payroll ' || p_period || ': net ' || public.fmt_money(
      coalesce((select sum(net_minor) from payroll_lines where run_id = r.id), 0)::bigint));
  return r.id;
end;
$function$;

-- The staff form keeps the start and leaving dates; switching someone off without a date leaves them today.
create or replace function public.save_employee(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := (p ->> 'business_id')::uuid;
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_name text := nullif(btrim(p ->> 'full_name'), '');
  v_today date := public.business_today(v_business);
  v_start date := nullif(p ->> 'started_on', '')::date;
  v_left date := nullif(p ->> 'left_on', '')::date;
  v_active boolean;
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
  -- A start date up to a year ahead (someone joining next month); a leaving date not before the start.
  if v_start is not null and (v_start > v_today + 366 or v_start < date '2000-01-01') then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  if v_id is null then
    if not exists (select 1 from branches where id = (p ->> 'branch_id')::uuid and business_id = v_business) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    insert into employees (business_id, branch_id, full_name, employee_code, role_title, base_salary_minor, commission_bps,
                           wps_required, phone, colour, started_on)
    values (v_business, (p ->> 'branch_id')::uuid, v_name, nullif(btrim(p ->> 'employee_code'), ''),
            coalesce(nullif(p ->> 'role_title', ''), 'staff'), coalesce((p ->> 'base_salary_minor')::bigint, 0),
            coalesce((p ->> 'commission_bps')::int, 0), coalesce((p ->> 'wps_required')::boolean, false),
            nullif(btrim(p ->> 'phone'), ''), nullif(p ->> 'colour', ''), coalesce(v_start, v_today))
    returning * into e;
    perform public.write_audit(v_business, e.branch_id, m.id, 'create', 'employee', e.id, 'Added staff ' || v_name);
  else
    select * into e from employees where id = v_id and business_id = v_business for update;
    if e.id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    -- A person with a login is switched on and off with the login (Team & logins).
    v_active := case when e.member_id is null then coalesce((p ->> 'active')::boolean, e.active) else e.active end;
    v_start := coalesce(v_start, e.started_on);
    -- Someone working here has no leaving date; someone switched off keeps theirs, or leaves today.
    v_left := case when v_active then null
                   when p ? 'left_on' then coalesce(v_left, e.left_on, v_today)
                   else coalesce(e.left_on, v_today) end;
    if v_left is not null and v_left < v_start then
      raise exception 'invalid_date' using errcode = '22023';
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
      active = v_active,
      started_on = v_start,
      left_on = v_left
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

-- Removing someone with records archives them and keeps today as their leaving date; bringing them back clears it.
create or replace function public.remove_staff(p_employee uuid, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e employees;
  m members;
  v_user uuid;
begin
  select * into e from employees where id = p_employee for update;
  if e.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from members o where o.id = p_actor and o.business_id = e.business_id and o.role = 'owner' and o.active) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if e.member_id is not null then
    select * into m from members where id = e.member_id for update;
    v_user := m.user_id;
  end if;

  if not public.staff_has_records(e.id) then
    delete from employees where id = e.id;
    if m.id is not null then
      delete from members where id = m.id;
    end if;
    perform public.write_audit(e.business_id, e.branch_id, p_actor, 'delete', 'employee', e.id,
      'Removed ' || e.full_name || ' from the staff (no records)');
    return jsonb_build_object('mode', 'removed', 'user_id', v_user);
  end if;

  update employees set active = false,
    left_on = greatest(started_on, coalesce(left_on, public.business_today(e.business_id)))
  where id = e.id;
  if m.id is not null then
    update members set active = false where id = m.id;
    delete from push_tokens where member_id = m.id;
    delete from member_pins where member_id = m.id;
  end if;
  perform public.write_audit(e.business_id, e.branch_id, p_actor, 'update', 'employee', e.id,
    'Archived ' || e.full_name || ' (records kept; login off)');
  return jsonb_build_object('mode', 'archived', 'user_id', v_user);
end;
$$;

create or replace function public.restore_staff(p_employee uuid, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e employees;
  v_user uuid;
begin
  select * into e from employees where id = p_employee for update;
  if e.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from members o where o.id = p_actor and o.business_id = e.business_id and o.role = 'owner' and o.active) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update employees set active = true, left_on = null where id = e.id;
  if e.member_id is not null then
    update members set active = true where id = e.member_id returning user_id into v_user;
  end if;
  perform public.write_audit(e.business_id, e.branch_id, p_actor, 'update', 'employee', e.id,
    'Brought ' || e.full_name || ' back to the staff');
  return jsonb_build_object('mode', 'restored', 'user_id', v_user);
end;
$$;

-- The staff list carries the two dates (everyone who reads the list may see them; they are not pay).
drop function public.staff_directory(uuid);
create function public.staff_directory(p_business uuid)
returns table (employee_id uuid, branch_id uuid, member_id uuid, username text, full_name text, employee_code text,
               role_title text, commission_bps int, base_salary_minor bigint, wps_required boolean, phone text,
               colour text, active boolean, roster jsonb, started_on date, left_on date)
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
                     from rosters r where r.employee_id = e.id), '[]'),
           e.started_on, e.left_on
    from employees e left join members m on m.id = e.member_id
    where e.business_id = p_business
    order by e.active desc, e.full_name;
end;
$$;
revoke execute on function public.staff_directory(uuid) from public, anon;
grant execute on function public.staff_directory(uuid) to authenticated;
