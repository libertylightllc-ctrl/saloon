-- M1 · Queue & appointments (01-PRODUCT §3.3).

create function public.method_account(p_method public.payment_method) returns text
language sql immutable as $$
  select case p_method
    when 'cash' then 'cash' when 'card' then 'card_clearing'
    when 'wallet' then 'wallet_clearing' else 'bank' end
$$;

create function public.branch_tz(p_branch uuid) returns text
language sql stable security definer set search_path = public as $$
  select bu.timezone from branches b join businesses bu on bu.id = b.business_id where b.id = p_branch
$$;

-- p: {branch_id, kind: walk_in|booking, customer_id, guest_name, service_ids[], employee_id, room_id,
--     scheduled_at, notes, deposit_minor, deposit_method, source}
create function public.create_appointment(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_member(v_branch, array['owner', 'cashier', 'staff']::member_role[]);
  b branches;
  v_kind text := coalesce(p ->> 'kind', 'walk_in');
  v_id uuid;
  v_customer customers;
  v_name text;
  v_at timestamptz;
  v_duration int := 0;
  v_employee uuid := nullif(p ->> 'employee_id', '')::uuid;
  v_room uuid := nullif(p ->> 'room_id', '')::uuid;
  v_deposit bigint := coalesce((p ->> 'deposit_minor')::bigint, 0);
  v_method payment_method := nullif(p ->> 'deposit_method', '')::payment_method;
  v_needs_room boolean := false;
  s record;
  v_service_ids uuid[] := coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'service_ids', '[]'))::uuid), '{}');
begin
  select * into b from branches where id = v_branch;
  if v_kind not in ('walk_in', 'booking') then
    raise exception 'invalid_kind' using errcode = '22023';
  end if;

  if nullif(p ->> 'customer_id', '') is not null then
    select * into v_customer from customers
    where id = (p ->> 'customer_id')::uuid and business_id = b.business_id;
    if v_customer.id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    v_name := v_customer.name;
  else
    v_name := nullif(btrim(p ->> 'guest_name'), '');
  end if;

  for s in
    select * from services where id = any (v_service_ids) and business_id = b.business_id and status = 'active'
  loop
    v_duration := v_duration + s.duration_min + s.buffer_min;
    v_needs_room := v_needs_room or s.requires_room;
  end loop;
  if (select count(*) from services where id = any (v_service_ids) and business_id = b.business_id and status = 'active')
     <> coalesce(array_length(v_service_ids, 1), 0) then
    raise exception 'service_unavailable' using errcode = '22023';
  end if;
  if v_kind = 'booking' and coalesce(array_length(v_service_ids, 1), 0) = 0 then
    raise exception 'services_required' using errcode = '22023';
  end if;
  if v_duration = 0 then
    v_duration := 30;
  end if;

  if v_employee is not null
     and not exists (select 1 from employees where id = v_employee and branch_id = v_branch and active) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_room is not null and not exists (select 1 from rooms where id = v_room and branch_id = v_branch and active) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if b.mode = 'ladies' and v_needs_room and v_room is null then
    raise exception 'room_required' using errcode = '22023';
  end if;

  if v_kind = 'booking' then
    v_at := (p ->> 'scheduled_at')::timestamptz;
    if v_at is null then
      raise exception 'time_required' using errcode = '22023';
    end if;
    if exists (
      select 1 from appointments a
      where a.branch_id = v_branch and a.status in ('booked', 'waiting', 'in_progress')
        and ((v_employee is not null and a.employee_id = v_employee) or (v_room is not null and a.room_id = v_room))
        and tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_min))
            && tstzrange(v_at, v_at + make_interval(mins => v_duration))
    ) then
      raise exception 'slot_taken' using errcode = '23P01';
    end if;
  else
    v_at := now();
    v_deposit := 0;
  end if;

  if v_deposit < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if v_deposit > 0 and (v_method is null or v_method = 'bank') then
    raise exception 'deposit_method_required' using errcode = '22023';
  end if;

  insert into appointments (business_id, branch_id, customer_id, customer_name, source, status, scheduled_at,
                            business_date, duration_min, checked_in_at, employee_id, room_id, notes,
                            deposit_minor, deposit_status, deposit_method, created_by)
  values (b.business_id, v_branch, v_customer.id, v_name,
          case when v_kind = 'walk_in' then 'walk_in' else coalesce(nullif(p ->> 'source', ''), 'staff') end::appointment_source,
          case when v_kind = 'walk_in' then 'waiting' else 'booked' end::appointment_status,
          v_at, (v_at at time zone public.branch_tz(v_branch))::date, v_duration,
          case when v_kind = 'walk_in' then now() end, v_employee, v_room, nullif(btrim(p ->> 'notes'), ''),
          v_deposit, case when v_deposit > 0 then 'held' else 'none' end::deposit_status,
          case when v_deposit > 0 then v_method end, m.id)
  returning id into v_id;

  insert into appointment_services (appointment_id, service_id, name_snapshot, employee_id, duration_min, price_minor)
  select v_id, s2.id, s2.name, v_employee, s2.duration_min, s2.price_minor
  from services s2 where s2.id = any (v_service_ids);

  if v_deposit > 0 then
    perform public.post_journal(b.business_id, v_branch, public.branch_today(v_branch), 'deposit', v_id,
      'Deposit taken', m.id,
      jsonb_build_array(jsonb_build_object('account', public.method_account(v_method), 'debit', v_deposit),
                        jsonb_build_object('account', 'deposits_held', 'credit', v_deposit)));
  end if;

  perform public.write_audit(b.business_id, v_branch, m.id, 'create', 'appointment', v_id,
    case when v_kind = 'walk_in' then 'Added walk-in ' else 'Booked ' end || coalesce(v_name, 'guest'));
  return v_id;
end;
$$;

create function public.appointment_for_update(p_id uuid) returns public.appointments
language plpgsql security definer set search_path = public as $$
declare
  a appointments;
begin
  select * into a from appointments where id = p_id for update;
  if a.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return a;
end;
$$;

create function public.check_in(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a appointments := public.appointment_for_update(p_id);
  m members := public.require_member(a.branch_id, array['owner', 'cashier', 'staff']::member_role[]);
begin
  if a.status <> 'booked' then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  update appointments set status = 'waiting', checked_in_at = now(), updated_at = now() where id = p_id;
  perform public.write_audit(a.business_id, a.branch_id, m.id, 'update', 'appointment', p_id,
    'Checked in ' || coalesce(a.customer_name, 'guest'));
end;
$$;

create function public.start_service(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a appointments := public.appointment_for_update(p_id);
  m members := public.require_member(a.branch_id, array['owner', 'cashier', 'staff']::member_role[]);
  v_mine uuid;
begin
  if a.status not in ('booked', 'waiting') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  select id into v_mine from employees where member_id = m.id and active;
  if m.role = 'staff' and a.employee_id is not null and a.employee_id is distinct from v_mine then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update appointments set
    status = 'in_progress', started_at = now(), checked_in_at = coalesce(checked_in_at, now()),
    employee_id = coalesce(employee_id, case when m.role = 'staff' then v_mine end), updated_at = now()
  where id = p_id;
  perform public.write_audit(a.business_id, a.branch_id, m.id, 'update', 'appointment', p_id,
    'Started ' || coalesce(a.customer_name, 'guest'));
end;
$$;

-- Deposit outcome: forfeit (other income) or refund (back through the method it was taken with).
create function public.settle_deposit(a public.appointments, p_actor uuid, p_outcome text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if a.deposit_status <> 'held' or a.deposit_minor <= 0 then
    return;
  end if;
  perform public.post_journal(a.business_id, a.branch_id, public.branch_today(a.branch_id),
    'deposit_' || p_outcome, a.id, case when p_outcome = 'forfeit' then 'Deposit forfeited' else 'Deposit refunded' end,
    p_actor,
    jsonb_build_array(
      jsonb_build_object('account', 'deposits_held', 'debit', a.deposit_minor),
      jsonb_build_object('account',
        case when p_outcome = 'forfeit' then 'other_income' else public.method_account(a.deposit_method) end,
        'credit', a.deposit_minor)));
  update appointments set deposit_status = case when p_outcome = 'forfeit' then 'forfeited' else 'refunded' end::deposit_status
  where id = a.id;
end;
$$;

create function public.mark_no_show(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a appointments := public.appointment_for_update(p_id);
  m members := public.require_member(a.branch_id, array['owner', 'cashier']::member_role[]);
begin
  if a.status not in ('booked', 'waiting') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  update appointments set status = 'no_show', updated_at = now() where id = p_id;
  if a.customer_id is not null then
    update customers set
      no_show_count = no_show_count + 1,
      risk_flags = case when no_show_count + 1 >= 2 and not ('no_show' = any (risk_flags))
                        then array_append(risk_flags, 'no_show') else risk_flags end
    where id = a.customer_id;
  end if;
  perform public.settle_deposit(a, m.id, 'forfeit');
  perform public.write_audit(a.business_id, a.branch_id, m.id, 'update', 'appointment', p_id,
    'Marked no-show ' || coalesce(a.customer_name, 'guest'));
end;
$$;

create function public.cancel_appointment(p_id uuid, p_reason text) returns text
language plpgsql security definer set search_path = public as $$
declare
  a appointments := public.appointment_for_update(p_id);
  m members := public.require_member(a.branch_id, array['owner', 'cashier']::member_role[]);
  v_cutoff int := coalesce((public.branch_setting(a.branch_id, 'cancel_cutoff_hours', '12') #>> '{}')::int, 12);
  v_outcome text := 'none';
begin
  if a.status not in ('booked', 'waiting') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update appointments set status = 'cancelled', cancel_reason = btrim(p_reason), updated_at = now() where id = p_id;
  if a.deposit_status = 'held' then
    v_outcome := case when now() < a.scheduled_at - make_interval(hours => v_cutoff) then 'refund' else 'forfeit' end;
    perform public.settle_deposit(a, m.id, v_outcome);
  end if;
  perform public.write_audit(a.business_id, a.branch_id, m.id, 'update', 'appointment', p_id,
    'Cancelled ' || coalesce(a.customer_name, 'guest') || ': ' || btrim(p_reason));
  return v_outcome;
end;
$$;

-- Free start times for a booking (30-minute steps within opening hours).
-- Bookable start times for a day, every 30 minutes from opening. Hours that close at or before
-- they open run past midnight (18:00 → 02:00), and `starts_at` is the exact instant to book.
create function public.available_slots(p_branch uuid, p_date date, p_duration int, p_employee uuid default null)
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
  select count(*) into v_staff from employees where branch_id = p_branch and active;
  v_min := v_open;
  while v_min + v_len <= v_close loop
    starts_at := (p_date::timestamp + make_interval(mins => v_min)) at time zone tz;
    select count(*) into v_busy from appointments a
    where a.branch_id = p_branch and a.status in ('booked', 'waiting', 'in_progress')
      and (p_employee is null or a.employee_id = p_employee)
      and tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_min))
          && tstzrange(starts_at, starts_at + make_interval(mins => v_len));
    slot := to_char(p_date::timestamp + make_interval(mins => v_min), 'HH24:MI');
    available := starts_at > now()
      and case when p_employee is null then v_busy < greatest(v_staff, 1) else v_busy = 0 end;
    return next;
    v_min := v_min + 30;
  end loop;
end;
$$;
