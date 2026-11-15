-- Owner's app check F1: Branch settings took "000000000" (and the booking page's Call button used it), and a customer's
-- number was kept as "55512345", without +974. Phone numbers now pass one check everywhere: the length of a number in
-- the salon's country (or in the country of the code it starts with), and not all one digit. They are saved with the
-- country code, "+974 5551 2345" ("0501234567" typed in the UAE is "+971 50 123 4567"). The app checks the same from
-- the same table (src/lib/phone.ts; a Jest test compares the two).
--   * New and changed numbers of customers, branches, staff, logins and suppliers are checked and tidied here, however
--     they are saved. Numbers already saved stay as they are until someone changes them, except:
--   * Customers' numbers that are valid local numbers for the salon's country get the country code (the owner's
--     choice), so returning clients are found again by the booking page; anything else is left exactly as typed. The
--     activity records each salon's change with the numbers before and after.
--   * Customers can be searched by digits whatever the spacing (phone_digits).
--   * The booking page checks and matches the number the same way.

create table public.phone_rules (
  country_code text primary key,
  dial text not null,
  min_len int not null,
  max_len int not null,
  trunk text not null
);
alter table public.phone_rules enable row level security;
revoke all on public.phone_rules from anon, authenticated;
insert into public.phone_rules (country_code, dial, min_len, max_len, trunk) values
  ('AE', '971', 8, 9, '0'),
  ('SA', '966', 8, 9, '0'),
  ('QA', '974', 8, 8, '0'),
  ('KW', '965', 8, 8, '0'),
  ('BH', '973', 8, 8, '0'),
  ('OM', '968', 8, 8, '0'),
  ('EG', '20', 8, 10, '0'),
  ('JO', '962', 8, 9, '0'),
  ('MA', '212', 9, 9, '0'),
  ('TN', '216', 8, 8, '0'),
  ('TR', '90', 10, 10, '0'),
  ('ZA', '27', 9, 9, '0'),
  ('NG', '234', 8, 10, '0'),
  ('KE', '254', 9, 9, '0'),
  ('GH', '233', 9, 9, '0'),
  ('IN', '91', 10, 10, '0'),
  ('PK', '92', 9, 10, '0'),
  ('BD', '880', 8, 10, '0'),
  ('LK', '94', 9, 9, '0'),
  ('NP', '977', 8, 10, '0'),
  ('SG', '65', 8, 8, '0'),
  ('MY', '60', 9, 10, '0'),
  ('PH', '63', 8, 10, '0'),
  ('ID', '62', 9, 12, '0'),
  ('TH', '66', 8, 9, '0'),
  ('VN', '84', 9, 10, '0'),
  ('JP', '81', 9, 10, '0'),
  ('AU', '61', 9, 9, '0'),
  ('NZ', '64', 8, 10, '0'),
  ('GB', '44', 9, 10, '0'),
  ('IE', '353', 7, 9, '0'),
  ('DE', '49', 6, 11, '0'),
  ('FR', '33', 9, 9, '0'),
  ('ES', '34', 9, 9, ''),
  ('IT', '39', 6, 11, ''),
  ('NL', '31', 9, 9, '0'),
  ('BE', '32', 8, 9, '0'),
  ('PT', '351', 9, 9, ''),
  ('AT', '43', 6, 13, '0'),
  ('GR', '30', 10, 10, ''),
  ('CH', '41', 9, 9, '0'),
  ('SE', '46', 7, 10, '0'),
  ('NO', '47', 8, 8, ''),
  ('DK', '45', 8, 8, ''),
  ('PL', '48', 9, 9, ''),
  ('US', '1', 10, 10, '1'),
  ('CA', '1', 10, 10, '1'),
  ('MX', '52', 10, 10, '0'),
  ('BR', '55', 10, 11, '0'),
  ('CO', '57', 8, 10, '0'),
  ('CL', '56', 9, 9, '0'),
  ('FI', '358', 6, 11, '0'),
  ('EE', '372', 7, 8, ''),
  ('LV', '371', 8, 8, ''),
  ('LT', '370', 8, 8, '8'),
  ('LU', '352', 6, 11, ''),
  ('MT', '356', 8, 8, ''),
  ('CY', '357', 8, 8, ''),
  ('SK', '421', 9, 9, '0'),
  ('SI', '386', 8, 8, '0'),
  ('HR', '385', 8, 9, '0'),
  ('BG', '359', 8, 9, '0'),
  ('CZ', '420', 9, 9, ''),
  ('HU', '36', 8, 9, '06'),
  ('RO', '40', 9, 9, '0'),
  ('IS', '354', 7, 7, ''),
  ('UA', '380', 9, 9, '0'),
  ('RS', '381', 8, 9, '0'),
  ('AL', '355', 8, 9, '0'),
  ('MK', '389', 8, 8, '0'),
  ('BA', '387', 8, 9, '0'),
  ('ME', '382', 8, 8, '0'),
  ('MD', '373', 8, 8, '0'),
  ('GE', '995', 9, 9, '0'),
  ('AM', '374', 8, 8, '0'),
  ('AZ', '994', 9, 9, '0'),
  ('KZ', '7', 10, 10, '8'),
  ('UZ', '998', 9, 9, ''),
  ('KG', '996', 9, 9, '0'),
  ('TJ', '992', 9, 9, ''),
  ('TM', '993', 8, 8, '8'),
  ('MN', '976', 8, 8, ''),
  ('IQ', '964', 8, 10, '0'),
  ('LB', '961', 7, 8, '0'),
  ('IL', '972', 8, 9, '0'),
  ('PS', '970', 8, 9, '0'),
  ('DZ', '213', 8, 9, '0'),
  ('LY', '218', 8, 9, '0'),
  ('AR', '54', 10, 11, '0'),
  ('PE', '51', 8, 9, '0'),
  ('EC', '593', 8, 9, '0'),
  ('UY', '598', 8, 8, '0'),
  ('PY', '595', 7, 9, '0'),
  ('BO', '591', 8, 8, ''),
  ('VE', '58', 10, 10, '0'),
  ('CR', '506', 8, 8, ''),
  ('PA', '507', 7, 8, ''),
  ('GT', '502', 8, 8, ''),
  ('HN', '504', 8, 8, ''),
  ('SV', '503', 8, 8, ''),
  ('NI', '505', 8, 8, ''),
  ('DO', '1', 10, 10, '1'),
  ('PR', '1', 10, 10, '1'),
  ('JM', '1', 10, 10, '1'),
  ('TT', '1', 10, 10, '1'),
  ('BS', '1', 10, 10, '1'),
  ('BB', '1', 10, 10, '1'),
  ('BZ', '501', 7, 7, '');

-- "55512345" → "5551 2345"; "501234567" → "50 123 4567"; "2025550123" → "202 555 0123"; other lengths as they are.
create function public.phone_group(p text) returns text
language sql immutable set search_path = public as $$
  select case length(p)
    when 7 then substr(p, 1, 3) || ' ' || substr(p, 4)
    when 8 then substr(p, 1, 4) || ' ' || substr(p, 5)
    when 9 then substr(p, 1, 2) || ' ' || substr(p, 3, 3) || ' ' || substr(p, 6)
    when 10 then substr(p, 1, 3) || ' ' || substr(p, 4, 3) || ' ' || substr(p, 7)
    else p
  end
$$;

-- The number as it is saved (null for no number), or invalid_phone. p_country is the salon's; without one, only a
-- number with its country code is taken. Mirrors normalizePhone in src/lib/phone.ts.
create function public.normalize_phone(p_phone text, p_country text) returns text
language plpgsql stable set search_path = public as $$
declare
  v_typed text := btrim(coalesce(p_phone, ''));
  v_digits text;
  v_home phone_rules;
  r phone_rules;
  v_nsn text;
begin
  if v_typed = '' then
    return null;
  end if;
  if v_typed !~ '^\+?[0-9 ().-]+$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  v_digits := regexp_replace(v_typed, '\D', '', 'g');
  select * into v_home from phone_rules where country_code = upper(p_country);
  if left(v_typed, 1) = '+' or left(v_digits, 2) = '00' then
    if left(v_typed, 1) <> '+' then
      v_digits := substr(v_digits, 3);
    end if;
    -- The longest country code it starts with; the salon's own country when codes are shared (+1).
    select * into r from phone_rules where left(v_digits, length(dial)) = dial
    order by length(dial) desc, (country_code = upper(p_country)) desc, country_code limit 1;
    if r.country_code is null then
      if length(v_digits) between 8 and 15 and v_digits !~ '^(\d)\1*$' then
        return '+' || v_digits;
      end if;
      raise exception 'invalid_phone' using errcode = '22023';
    end if;
    v_nsn := substr(v_digits, length(r.dial) + 1);
    -- "+971 050 123 4567": the local 0 typed after the code.
    if r.trunk <> '' and length(v_nsn) not between r.min_len and r.max_len and left(v_nsn, length(r.trunk)) = r.trunk
       and length(v_nsn) - length(r.trunk) between r.min_len and r.max_len then
      v_nsn := substr(v_nsn, length(r.trunk) + 1);
    end if;
  else
    if v_home.country_code is null then
      raise exception 'invalid_phone' using errcode = '22023';
    end if;
    r := v_home;
    v_nsn := v_digits;
    if r.trunk <> '' and left(v_nsn, length(r.trunk)) = r.trunk
       and length(v_nsn) - length(r.trunk) between r.min_len and r.max_len then
      v_nsn := substr(v_nsn, length(r.trunk) + 1);
    elsif length(v_nsn) not between r.min_len and r.max_len and left(v_nsn, length(r.dial)) = r.dial
          and length(v_nsn) - length(r.dial) between r.min_len and r.max_len then
      -- "974 5551 2345": the code typed without the +.
      v_nsn := substr(v_nsn, length(r.dial) + 1);
    end if;
  end if;
  if length(v_nsn) not between r.min_len and r.max_len or v_nsn ~ '^(\d)\1*$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  return '+' || r.dial || ' ' || public.phone_group(v_nsn);
end;
$$;

-- The same, with null for a number that does not pass (for the booking page and the one-time update below).
create function public.phone_or_null(p_phone text, p_country text) returns text
language plpgsql stable set search_path = public as $$
begin
  return public.normalize_phone(p_phone, p_country);
exception when sqlstate '22023' then
  return null;
end;
$$;

-- New and changed numbers, however they are saved. A number saved before this check that is copied from another record
-- of the salon (merging two customers, or two staff records) is kept as it was, like the record it came from.
create function public.tidy_phone() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_copied boolean;
begin
  if tg_op = 'UPDATE' and new.phone is not distinct from old.phone then
    return new;
  end if;
  begin
    new.phone := public.normalize_phone(new.phone, (select country_code from businesses where id = new.business_id));
  exception when sqlstate '22023' then
    execute format('select exists (select 1 from %I.%I where business_id = $1 and phone = $2 and id <> $3)',
                   tg_table_schema, tg_table_name)
      into v_copied using new.business_id, new.phone, new.id;
    if not v_copied then
      raise;
    end if;
  end;
  return new;
end;
$$;
create trigger customers_tidy_phone before insert or update of phone on public.customers
  for each row execute function public.tidy_phone();
create trigger branches_tidy_phone before insert or update of phone on public.branches
  for each row execute function public.tidy_phone();
create trigger employees_tidy_phone before insert or update of phone on public.employees
  for each row execute function public.tidy_phone();
create trigger members_tidy_phone before insert or update of phone on public.members
  for each row execute function public.tidy_phone();
create trigger suppliers_tidy_phone before insert or update of phone on public.suppliers
  for each row execute function public.tidy_phone();

revoke execute on function public.phone_group(text), public.normalize_phone(text, text), public.phone_or_null(text, text),
  public.tidy_phone() from public, anon, authenticated;

-- Search by digits, whatever the spacing: "501234567" finds "+971 50 123 4567".
alter table public.customers
  add column phone_digits text generated always as (regexp_replace(coalesce(phone, ''), '\D', '', 'g')) stored;

-- Customers' valid local numbers get the country code, once (run below); the activity keeps the numbers before and
-- after. Returns how many changed.
create function public.customer_phones_add_country_code() returns int
language plpgsql set search_path = public as $$
declare
  b record;
  c record;
  v_new text;
  v_before jsonb;
  v_after jsonb;
  v_total int := 0;
begin
  for b in select id, country_code from businesses loop
    v_before := '{}';
    v_after := '{}';
    for c in select id, phone from customers
             where business_id = b.id and btrim(coalesce(phone, '')) <> '' and btrim(phone) !~ '^\+'
               and regexp_replace(phone, '\D', '', 'g') !~ '^00' loop
      v_new := public.phone_or_null(c.phone, b.country_code);
      continue when v_new is null;
      update customers set phone = v_new where id = c.id;
      v_before := v_before || jsonb_build_object(c.id, c.phone);
      v_after := v_after || jsonb_build_object(c.id, v_new);
    end loop;
    if v_after <> '{}' then
      v_total := v_total + (select count(*) from jsonb_object_keys(v_after));
      perform public.write_audit(b.id, null, null, 'edit', 'customer', null,
        'Added the country code to ' || (select count(*) from jsonb_object_keys(v_after)) || ' customer phone numbers',
        v_before, v_after);
    end if;
  end loop;
  return v_total;
end;
$$;
revoke execute on function public.customer_phones_add_country_code() from public, anon, authenticated;
select public.customer_phones_add_country_code();

-- The booking page: the same check, and the client found by the tidied number (migration 97 otherwise).
CREATE OR REPLACE FUNCTION public.public_book(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- The same check as everywhere (F1): a number for the salon's country, or one with its own country code; matched
  -- and saved with the country code.
  v_phone := public.phone_or_null(v_phone, (select country_code from businesses where id = b.business_id));
  if v_phone is null then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  v_digits := regexp_replace(v_phone, '\D', '', 'g');
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
  if v_room and public.mode_uses_rooms(b.mode) then
    v_room_id := public.free_room(b.id, v_at, v_len);
  end if;

  select * into c from customers
  where business_id = b.business_id and merged_into is null and deleted_at is null
    and right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 9) = right(v_digits, 9)
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
$function$;
