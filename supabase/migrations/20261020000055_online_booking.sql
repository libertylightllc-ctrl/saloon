-- The salon's online booking link (owner, 2026-10-20: "start with number one, online booking link"). Each branch can
-- switch on a public page, saloqo.com/b/<link>: the salon, its services and prices, who works there, real free times;
-- a customer books with a name and phone number, no account and no download. The booking lands in the queue at once
-- (source 'app': booked by the customer) and the owner and cashier are told. The customer gets a page to see or cancel
-- it (saloqo.com/booking/<token>), within the salon's cancel cut-off. No commission, no cost.
-- Fixed for now: bookable from 30 minutes ahead up to 30 days ahead; up to 3 upcoming online bookings per phone
-- number at a salon; up to 30 online bookings per hour per branch (against floods).

alter table public.branches add column booking_slug text unique
  check (booking_slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$');
alter table public.appointments add column booking_token text unique;

-- ── The link ───────────────────────────────────────────────────────────────────────────────

-- A link from a name: "Al Barsha Gents" → "al-barsha-gents" (then -2, -3… when taken); "salon" when the name has no
-- Latin letters or digits.
create function public.unique_booking_slug(p_name text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  v_base text := left(trim(both '-' from regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g')), 34);
  v_slug text;
  v_n int := 1;
begin
  v_base := trim(both '-' from v_base);
  if char_length(v_base) < 3 then
    v_base := 'salon' || case when v_base = '' then '' else '-' || v_base end;
  end if;
  v_slug := v_base;
  while exists (select 1 from branches where booking_slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end;
$$;

-- Switches the branch's booking page on or off, and sets its link (made from the salon's name when none is given and
-- the branch has none yet). Gives back the link. Owner.
create function public.set_online_booking(p_branch uuid, p_on boolean, p_slug text default null) returns text
language plpgsql security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner']::member_role[]);
  b branches;
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_name text;
begin
  select * into b from branches where id = p_branch for update;
  if v_slug <> '' then
    if v_slug !~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$' then
      raise exception 'invalid_booking_link' using errcode = '22023';
    end if;
    if exists (select 1 from branches where booking_slug = v_slug and id <> p_branch) then
      raise exception 'link_taken' using errcode = '23505';
    end if;
  elsif b.booking_slug is not null then
    v_slug := b.booking_slug;
  else
    select bu.name || case when (select count(*) from branches x where x.business_id = bu.id) > 1 then ' ' || b.name else '' end
    into v_name from businesses bu where bu.id = b.business_id;
    v_slug := public.unique_booking_slug(v_name);
  end if;
  update branches set booking_slug = v_slug, settings = settings || jsonb_build_object('online_booking', coalesce(p_on, false))
  where id = p_branch;
  perform public.write_audit(m.business_id, p_branch, m.id, 'update', 'branch', p_branch,
    case when p_on then 'Online booking on: ' || v_slug else 'Online booking off' end);
  return v_slug;
end;
$$;

-- ── Free times (shared by staff and the booking page) ──────────────────────────────────────

-- The free-time rules of available_slots (migration 43), without the sign-in check, for the booking page to use.
create function public.book_slots(p_branch uuid, p_date date, p_duration int, p_employee uuid default null)
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

create or replace function public.available_slots(p_branch uuid, p_date date, p_duration int, p_employee uuid default null)
returns table (slot text, starts_at timestamptz, available boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_use_branch(p_branch) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query select * from public.book_slots(p_branch, p_date, p_duration, p_employee);
end;
$$;

-- ── The booking page (open to anyone holding the link) ─────────────────────────────────────

-- The branch behind a link, when its page is on and its plan is (null otherwise).
create function public.booking_branch(p_slug text) returns branches
language sql stable security definer set search_path = public as $$
  select b.* from branches b join businesses bu on bu.id = b.business_id
  where b.booking_slug = lower(btrim(coalesce(p_slug, ''))) and coalesce((b.settings ->> 'online_booking')::boolean, false)
    and bu.closed_at is null and public.plan_active(b.business_id)
$$;

-- "Rafiq Ahmed" → "Rafiq A.": who does the work, without full names on a public page.
create function public.public_staff_name(p_full text) returns text
language sql immutable set search_path = public as $$
  select split_part(btrim(p_full), ' ', 1)
    || case when split_part(btrim(p_full), ' ', 2) <> '' then ' ' || left(split_part(btrim(p_full), ' ', 2), 1) || '.' else '' end
$$;

-- What the booking page shows: the salon, its services and prices, and who can be booked. Null for a link that is
-- unknown or switched off.
create function public.public_booking_page(p_slug text) returns jsonb
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
      'logo_path', b.logo_path, 'open_days', b.opening_hours -> 'days', 'currency', bu.currency, 'timezone', bu.timezone,
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
                       from employees e where e.branch_id = b.id and e.active and e.role_title <> 'cashier'), '[]'));
end;
$$;

-- How long the picked services take (with their buffers; 30 minutes when none has a time), and whether one needs a
-- room (ladies salons: treatment rooms). Null when a service is not this salon's active service.
create function public.booking_length(p_business uuid, p_services uuid[]) returns table (minutes int, needs_room boolean)
language sql stable security definer set search_path = public as $$
  select case when sum(coalesce(s.duration_min, 0) + s.buffer_min) > 0 then sum(coalesce(s.duration_min, 0) + s.buffer_min)::int else 30 end,
         bool_or(s.requires_room)
  from services s
  where s.id = any (p_services) and s.business_id = p_business and s.status = 'active'
  having count(*) = cardinality(p_services) and cardinality(p_services) > 0
$$;

-- A free room for [p_at, p_at + p_minutes) at the branch, or null.
create function public.free_room(p_branch uuid, p_at timestamptz, p_minutes int) returns uuid
language sql stable security definer set search_path = public as $$
  select r.id from rooms r
  where r.branch_id = p_branch and r.active
    and not exists (select 1 from appointments a
                    where a.room_id = r.id and a.status in ('booked', 'waiting', 'in_progress')
                      and tstzrange(a.scheduled_at, a.scheduled_at + make_interval(mins => a.duration_min))
                          && tstzrange(p_at, p_at + make_interval(mins => p_minutes)))
  order by r.name limit 1
$$;

-- Free start times on a day for the picked services, with anyone (null) or one person: from 30 minutes ahead, up to 30
-- days ahead. Until the salon sets rosters (which decide its hours), starts from 09:00 to 23:30 only: customers are not
-- offered the night.
create function public.public_booking_slots(p_slug text, p_date date, p_services uuid[], p_employee uuid default null)
returns table (slot text, starts_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
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
                                              and e.active and e.role_title <> 'cashier') then
    return;
  end if;
  v_rostered := exists (select 1 from rosters r join employees e on e.id = r.employee_id where e.branch_id = b.id and e.active);
  return query
    select s.slot, s.starts_at from public.book_slots(b.id, p_date, v_len, p_employee) s
    where s.available and s.starts_at >= now() + interval '30 minutes'
      and (v_rostered or s.slot between '09:00' and '23:30')
      and (not (v_room and b.mode = 'ladies') or public.free_room(b.id, s.starts_at, v_len) is not null)
    order by s.starts_at;
end;
$$;

-- Books it: p = {slug, service_ids, employee_id?, starts_at, name, phone, notes?}. The customer is found by phone
-- number (the last 9 digits) among the salon's customers, or added. Gives back {token, scheduled_at}.
create function public.public_book(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  b branches := public.booking_branch(p ->> 'slug');
  v_services uuid[] := coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'service_ids', '[]'))::uuid), '{}');
  v_employee uuid := nullif(p ->> 'employee_id', '')::uuid;
  v_at timestamptz := nullif(p ->> 'starts_at', '')::timestamptz;
  v_name text := btrim(coalesce(p ->> 'name', ''));
  v_phone text := btrim(coalesce(p ->> 'phone', ''));
  v_digits text := regexp_replace(coalesce(p ->> 'phone', ''), '\D', '', 'g');
  v_notes text := nullif(btrim(coalesce(p ->> 'notes', '')), '');
  v_len int;
  v_room boolean;
  v_room_id uuid;
  c customers;
  v_id uuid;
  v_token text := translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');
begin
  if b.id is null then
    raise exception 'booking_unavailable' using errcode = 'P0002';
  end if;
  -- One booking at a time per branch, so two people cannot take the last free time together.
  perform 1 from branches where id = b.id for update;
  if char_length(v_name) not between 2 and 80 then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if v_phone !~ '^\+?[0-9 ()-]{7,24}$' or char_length(v_digits) not between 7 and 15 then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if char_length(coalesce(v_notes, '')) > 300 then
    raise exception 'too_long' using errcode = '22023';
  end if;
  select l.minutes, l.needs_room into v_len, v_room from public.booking_length(b.business_id, v_services) l;
  if cardinality(v_services) = 0 then
    raise exception 'services_required' using errcode = '22023';
  end if;
  if v_len is null then
    raise exception 'service_unavailable' using errcode = '22023';
  end if;
  if v_at is null or not exists (
    select 1 from public.public_booking_slots(p ->> 'slug', (v_at at time zone public.branch_tz(b.id))::date, v_services, v_employee) s
    where s.starts_at = v_at) then
    raise exception 'slot_taken' using errcode = '23P01';
  end if;
  -- Against floods: a few upcoming online bookings per phone number, and a cap per hour per branch.
  if (select count(*) from appointments a join customers cu on cu.id = a.customer_id
      where a.business_id = b.business_id and a.source = 'app' and a.status = 'booked' and a.scheduled_at > now()
        and right(regexp_replace(coalesce(cu.phone, ''), '\D', '', 'g'), 9) = right(v_digits, 9)) >= 3 then
    raise exception 'too_many_bookings' using errcode = '22023';
  end if;
  if (select count(*) from appointments a where a.branch_id = b.id and a.source = 'app'
      and a.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  if v_room and b.mode = 'ladies' then
    v_room_id := public.free_room(b.id, v_at, v_len);
  end if;

  select * into c from customers
  where business_id = b.business_id and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9) = right(v_digits, 9)
  order by last_visit_at desc nulls last, created_at desc limit 1;
  if c.id is null then
    insert into customers (business_id, name, phone) values (b.business_id, v_name, v_phone) returning * into c;
  end if;

  insert into appointments (business_id, branch_id, customer_id, customer_name, source, status, scheduled_at,
                            business_date, duration_min, employee_id, room_id, notes, booking_token)
  values (b.business_id, b.id, c.id, c.name, 'app', 'booked', v_at, (v_at at time zone public.branch_tz(b.id))::date,
          v_len, v_employee, v_room_id, v_notes, v_token)
  returning id into v_id;
  insert into appointment_services (appointment_id, service_id, name_snapshot, employee_id, duration_min, price_minor)
  select v_id, s.id, s.name, v_employee, coalesce(s.duration_min, 0), s.price_minor
  from services s where s.id = any (v_services);
  perform public.write_audit(b.business_id, b.id, null, 'create', 'appointment', v_id, 'Booked online: ' || c.name);
  return jsonb_build_object('token', v_token, 'scheduled_at', v_at);
end;
$$;

-- The customer's own booking, behind the token in its link.
create function public.public_booking(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  a appointments;
  b branches;
  bu businesses;
  v_cutoff int;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{24}$' then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  select * into a from appointments where booking_token = p_token;
  if a.id is null then
    return null;
  end if;
  select * into b from branches where id = a.branch_id;
  select * into bu from businesses where id = a.business_id;
  v_cutoff := coalesce((b.settings ->> 'cancel_cutoff_hours')::int, 12);
  return jsonb_build_object(
    'status', a.status, 'scheduled_at', a.scheduled_at, 'duration_min', a.duration_min, 'customer_name', a.customer_name,
    'staff_name', (select public.public_staff_name(e.full_name) from employees e where e.id = a.employee_id),
    'services', coalesce((select jsonb_agg(jsonb_build_object('name', x.name_snapshot, 'price_minor', x.price_minor))
                          from appointment_services x where x.appointment_id = a.id), '[]'),
    'can_cancel', a.status = 'booked' and now() <= a.scheduled_at - make_interval(hours => v_cutoff),
    'salon', jsonb_build_object(
      'business_name', bu.name, 'branch_name', b.name, 'mode', b.mode, 'address', b.address, 'phone', b.phone,
      'logo_path', b.logo_path, 'currency', bu.currency, 'timezone', bu.timezone, 'country_code', bu.country_code,
      'slug', case when coalesce((b.settings ->> 'online_booking')::boolean, false) then b.booking_slug end,
      'cancel_cutoff_hours', v_cutoff));
end;
$$;

-- The customer cancels: only a booking still to come, before the salon's cut-off. The salon is told.
create function public.public_booking_cancel(p_token text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a appointments;
  v_cutoff int;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{24}$' then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  select * into a from appointments where booking_token = p_token for update;
  if a.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if a.status <> 'booked' then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  v_cutoff := coalesce((public.branch_setting(a.branch_id, 'cancel_cutoff_hours', '12') #>> '{}')::int, 12);
  if now() > a.scheduled_at - make_interval(hours => v_cutoff) then
    raise exception 'too_late_to_cancel' using errcode = '22023';
  end if;
  update appointments set status = 'cancelled', cancel_reason = 'Cancelled online by the customer', updated_at = now()
  where id = a.id;
  perform public.write_audit(a.business_id, a.branch_id, null, 'update', 'appointment', a.id,
    'Cancelled online by ' || coalesce(a.customer_name, 'the customer'));
  perform public.notify(a.business_id, a.branch_id, array['owner', 'cashier']::member_role[], 'online_cancelled',
    'Online booking cancelled', coalesce(a.customer_name, 'A customer') || ' · '
      || to_char(a.scheduled_at at time zone public.branch_tz(a.branch_id), 'Dy DD Mon HH24:MI'),
    'appointment', a.id, jsonb_build_object('customer', a.customer_name, 'at', a.scheduled_at));
end;
$$;

-- A booking made online tells the owner and cashier as "New online booking".
create or replace function public.on_booking_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tz text := public.branch_tz(new.branch_id);
begin
  if new.status = 'booked' then
    perform public.notify(new.business_id, new.branch_id, array['owner', 'cashier']::member_role[],
      case when new.source = 'app' then 'online_booking' else 'new_booking' end,
      case when new.source = 'app' then 'New online booking' else 'New booking' end,
      coalesce(new.customer_name, 'A guest') || ' · ' || to_char(new.scheduled_at at time zone tz, 'Dy DD Mon HH24:MI'),
      'appointment', new.id,
      jsonb_build_object('customer', new.customer_name, 'at', new.scheduled_at, 'source', new.source));
  end if;
  return new;
end;
$$;

revoke execute on function public.unique_booking_slug(text), public.book_slots(uuid, date, int, uuid),
  public.booking_branch(text), public.booking_length(uuid, uuid[]), public.free_room(uuid, timestamptz, int),
  public.public_staff_name(text)
  from public, anon, authenticated;
revoke execute on function public.set_online_booking(uuid, boolean, text) from public, anon;
grant execute on function public.set_online_booking(uuid, boolean, text) to authenticated;
-- The booking page, its free times, booking, and the customer's own booking: open to visitors.
revoke execute on function public.public_booking_page(text), public.public_booking_slots(text, date, uuid[], uuid),
  public.public_book(jsonb), public.public_booking(text), public.public_booking_cancel(text)
  from public;
grant execute on function public.public_booking_page(text), public.public_booking_slots(text, date, uuid[], uuid),
  public.public_book(jsonb), public.public_booking(text), public.public_booking_cancel(text)
  to anon, authenticated;
