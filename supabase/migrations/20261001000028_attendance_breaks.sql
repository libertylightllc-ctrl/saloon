-- Breaks and a safer clock-out (owner, 2026-10-01): the big "Clock out" on Home was easy to tap by mistake, which
-- ended the day for good, and some shops clock out for a break and back in.
--  · Breaks: start and end a break while on shift (several a day); clocking out ends an open break.
--  · Back to work: after clocking out the day can go on; the time away is recorded as a break.
--  · The day board shows who is on a break and how long breaks took.

create table public.attendance_breaks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  attendance_id uuid not null references public.attendance (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz check (ended_at is null or ended_at >= started_at),
  started_by uuid references public.members (id) on delete set null,
  ended_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index attendance_breaks_attendance_idx on public.attendance_breaks (attendance_id);
-- One open break at a time.
create unique index attendance_breaks_open_idx on public.attendance_breaks (attendance_id) where ended_at is null;
alter table public.attendance_breaks enable row level security;
-- Who may read a break: whoever may read its day (front desk of the branch, or the person themselves).
create policy "front desk reads breaks" on public.attendance_breaks for select to authenticated
  using (
    (business_id in (select public.my_business_ids(array['owner', 'cashier', 'accountant']::member_role[]))
     and branch_id in (select public.my_branch_ids()))
    or exists (select 1 from attendance a join employees e on e.id = a.employee_id join members m on m.id = e.member_id
               where a.id = attendance_breaks.attendance_id and m.user_id = auth.uid()));
revoke insert, update, delete, truncate, references, trigger on public.attendance_breaks from anon, authenticated;
create trigger attendance_breaks_broadcast after insert or delete or update on public.attendance_breaks
  for each row execute function public.broadcast_change('branch');
create trigger attendance_breaks_plan before insert or update on public.attendance_breaks
  for each row execute function public.gate_plan();

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
    if v_at < a.clock_in then
      raise exception 'invalid_time' using errcode = '22023';
    end if;
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
    if v_at < a.clock_in then
      raise exception 'invalid_time' using errcode = '22023';
    end if;
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
    if v_at < b.started_at then
      raise exception 'invalid_time' using errcode = '22023';
    end if;
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
    if v_at < a.clock_out then
      raise exception 'invalid_time' using errcode = '22023';
    end if;
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
  return to_jsonb(a);
end;
$function$;

drop function public.attendance_day(uuid, date);
create function public.attendance_day(p_branch uuid, p_date date default null)
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
begin
  return query
    select e.id, e.full_name, e.role_title, e.colour, to_char(sh.shift_start, 'HH24:MI'), to_char(sh.shift_end, 'HH24:MI'),
           case when a.clock_out is not null then 'done'
                when br.open_since is not null then 'on_break'
                when a.id is not null then 'on_shift'
                when exists (select 1 from rosters x where x.employee_id = e.id) and sh.shift_start is null then 'off'
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
revoke execute on function public.attendance_day(uuid, date) from public, anon;
grant execute on function public.attendance_day(uuid, date) to authenticated;
