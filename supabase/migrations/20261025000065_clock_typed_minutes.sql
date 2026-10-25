-- Times typed in on the attendance board count to the minute (2026-10-25). The board types "15:04" (15:04:00) while a
-- clock-in made a few seconds earlier is 15:04:37, so a break, clock-out or return recorded in the same minute as the
-- event it follows was refused as "not today or in the future" (caught by the browser tests' proof). The time now
-- counts from that event: never earlier than it, and refused only when a whole minute earlier.
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
  return to_jsonb(a);
end;
$function$;
