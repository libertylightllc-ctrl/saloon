-- No opening and closing times (owner, 2026-10-07: a salon open 09:00 to midnight could not be set up; "remove the
-- opening and closing time"). A branch keeps only its open days. Bookings can be made at any time of an open day;
-- when staff have rosters, only rostered times are offered (a shift past midnight covers the next morning). Times
-- already stored in branches.opening_hours are left as they were and no longer used.

alter table public.branches alter column opening_hours set default '{"days":[0,1,2,3,4,5,6]}';

-- Rostered for [p_from, p_to) minutes of p_date: a shift that day, or the previous day's shift running past midnight.
create or replace function public.rostered(p_employee uuid, p_date date, p_from int, p_to int) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when not exists (select 1 from rosters where employee_id = p_employee) then true
    else exists (select 1 from rosters r, public.shift_minutes(r.start_time, r.end_time) s
                 where r.employee_id = p_employee
                   and ((r.weekday = extract(dow from p_date)::int and p_from >= s.from_min and p_to <= s.to_min)
                     or (r.weekday = extract(dow from p_date - 1)::int and p_from + 1440 >= s.from_min
                         and p_to + 1440 <= s.to_min)))
  end
$$;

-- Bookable start times for an open day, every 30 minutes from 00:00. Times already past, and times nobody is
-- rostered for, are not offered; with p_employee, that person must be rostered and free; otherwise fewer bookings
-- than rostered people (cashiers excluded) must overlap the slot.
create or replace function public.available_slots(p_branch uuid, p_date date, p_duration int, p_employee uuid default null)
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
  if not public.can_use_branch(p_branch) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into b from branches where id = p_branch;
  if not (extract(dow from p_date)::int in (select jsonb_array_elements_text(b.opening_hours -> 'days')::int)) then
    return;
  end if;
  v_has_staff := exists (select 1 from employees e where e.branch_id = p_branch and e.active
                           and e.role_title <> 'cashier' and (p_employee is null or e.id = p_employee));
  while v_min + v_len <= 1440 loop
    starts_at := (p_date::timestamp + make_interval(mins => v_min)) at time zone tz;
    if starts_at > now() then
      select count(*) into v_staff from employees e
      where e.branch_id = p_branch and e.active and e.role_title <> 'cashier'
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

-- Branch settings also change the open days (owner).
create or replace function public.update_branch(p_branch uuid, p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  m members := public.require_member(p_branch, array['owner']::member_role[]);
  v_settings jsonb := coalesce(p -> 'settings', '{}'::jsonb);
  v_allowed text[] := array['waiting_target_min', 'cancel_cutoff_hours', 'default_deposit_minor',
                            'staff_can_sell', 'block_insufficient_stock', 'late_grace_min', 'require_hygiene_evidence',
                            'receipt_mode'];
  k text;
  v_days jsonb;
begin
  for k in select jsonb_object_keys(v_settings) loop
    if not (k = any (v_allowed)) then
      raise exception 'unknown_setting: %', k using errcode = '22023';
    end if;
  end loop;
  -- Customer receipt after a sale: none, a simple printed/shared receipt, or sent on WhatsApp.
  if v_settings ? 'receipt_mode' and not (v_settings ->> 'receipt_mode' = any (array['off', 'simple', 'whatsapp'])) then
    raise exception 'unknown_setting: receipt_mode' using errcode = '22023';
  end if;
  if p ? 'vat_mode' and p ->> 'vat_mode' = 'on'
     and (select country_code from businesses where id = m.business_id) = 'AE'
     and coalesce(btrim(p ->> 'trn'), (select trn from branches where id = p_branch), '') !~ '^[0-9]{15}$' then
    raise exception 'trn_required' using errcode = '22023';
  end if;
  if p ? 'tax_rate_bps' and (coalesce((p ->> 'tax_rate_bps')::numeric, -1) not between 0 and 3000
                             or (p ->> 'tax_rate_bps')::numeric <> round((p ->> 'tax_rate_bps')::numeric, 1)) then
    raise exception 'invalid_tax_rate' using errcode = '22023';
  end if;
  -- Open days: weekday numbers, 0 = Sunday; at least one.
  if p ? 'open_days' then
    if jsonb_typeof(p -> 'open_days') <> 'array' or jsonb_array_length(p -> 'open_days') = 0
       or exists (select 1 from jsonb_array_elements(p -> 'open_days') d
                  where jsonb_typeof(d) <> 'number' or d::text !~ '^[0-6]$') then
      raise exception 'days_required' using errcode = '22023';
    end if;
    select jsonb_agg(distinct d::int order by d::int) into v_days from jsonb_array_elements_text(p -> 'open_days') d;
  end if;
  update branches set
    name = coalesce(nullif(btrim(p ->> 'name'), ''), name),
    address = case when p ? 'address' then nullif(btrim(p ->> 'address'), '') else address end,
    phone = case when p ? 'phone' then nullif(btrim(p ->> 'phone'), '') else phone end,
    vat_mode = coalesce((p ->> 'vat_mode')::vat_mode, vat_mode),
    trn = case when p ? 'trn' then nullif(btrim(p ->> 'trn'), '') else trn end,
    tax_name = coalesce(nullif(btrim(p ->> 'tax_name'), ''), tax_name),
    tax_rate_bps = coalesce((p ->> 'tax_rate_bps')::numeric, tax_rate_bps),
    tax_inclusive = coalesce((p ->> 'tax_inclusive')::boolean, tax_inclusive),
    tax_id_label = coalesce(nullif(btrim(p ->> 'tax_id_label'), ''), tax_id_label),
    opening_hours = case when v_days is null then opening_hours else jsonb_set(opening_hours, '{days}', v_days) end,
    settings = settings || v_settings || jsonb_build_object('tax_confirmed', true)
  where id = p_branch;
  perform public.write_audit(m.business_id, p_branch, m.id, 'update', 'branch', p_branch, 'Updated branch settings');
end;
$$;
