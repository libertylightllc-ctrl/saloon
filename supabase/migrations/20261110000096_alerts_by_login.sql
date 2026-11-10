-- Part B, step 8 (brief B6, E1): each login gets only its own alerts, and time-sensitive alerts expire.
-- * Owner: refunds and discounts above the limit approved by others, cash differences, closes waiting, payroll to
--   approve, licences expiring, plan.
-- * Manager: closes waiting, missed clock-outs, no-shows, low or out of stock, licences expiring, deliveries to price.
-- * Front desk: walk-ins waiting, new online bookings, clients arrived, cancellations.
-- * Stylist: their own new, moved or cancelled bookings, and their client arriving.
-- * Accountant: bills due, payroll worked out, a month ready to close, cash differences, deliveries to price.
-- An alert meant for the front desk or a manager goes to the owner when the branch has no such login. Nobody is alerted
-- about what they did themselves. Walk-in and arrival alerts end with the visit or the day; booking alerts once the
-- booking time has passed or the booking changes.

alter table public.notifications add column expires_at timestamptz;
drop policy "people read their own notifications" on public.notifications;
create policy "people read their own current notifications" on public.notifications for select to authenticated
  using (exists (select 1 from public.members m where m.id = notifications.member_id and m.user_id = auth.uid())
         and (expires_at is null or expires_at > now()));

-- The end of today in a branch (when the day's walk-in alerts end).
create function public.branch_day_end(p_branch uuid, p_at timestamptz default now()) returns timestamptz
language sql stable set search_path = public as $$
  select (((p_at at time zone public.branch_tz(p_branch))::date + 1)::timestamp) at time zone public.branch_tz(p_branch)
$$;
revoke execute on function public.branch_day_end(uuid, timestamptz) from public, anon, authenticated;

-- Alerts already sent: booking alerts end at the booking time, walk-in alerts at the end of their day.
update public.notifications set expires_at = (data ->> 'at')::timestamptz
where type in ('new_booking', 'online_booking', 'online_cancelled') and data ? 'at' and expires_at is null;
update public.notifications set expires_at = public.branch_day_end(branch_id, created_at)
where type = 'long_wait' and branch_id is not null and expires_at is null;

-- notify(): who gets it by login type; p_or_owner sends it to the owner when nobody of those login types works in the
-- branch; p_expires ends it; the person who caused it is not alerted (p_skip_actor), except about a state they should
-- know of even when they caused it (stock running out).
drop function public.notify(uuid, uuid, public.member_role[], text, text, text, text, uuid, jsonb, text);
create function public.notify(p_business uuid, p_branch uuid, p_roles public.member_role[], p_type text,
                              p_title text, p_body text, p_entity_type text default null,
                              p_entity_id uuid default null, p_data jsonb default '{}',
                              p_dedupe text default null, p_expires timestamptz default null,
                              p_or_owner boolean default false, p_skip_actor boolean default true) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_roles member_role[] := p_roles;
  v_count int;
begin
  if p_expires is not null and p_expires <= now() then
    return 0;
  end if;
  if p_or_owner and not exists (
       select 1 from members m
       where m.business_id = p_business and m.active and m.role = any (p_roles) and m.role <> 'owner'
         and (p_branch is null or m.role = 'accountant'
              or exists (select 1 from member_branches mb where mb.member_id = m.id and mb.branch_id = p_branch))) then
    v_roles := v_roles || 'owner'::member_role;
  end if;
  insert into notifications (business_id, branch_id, member_id, type, title, body, data, entity_type, entity_id, dedupe_key,
                             expires_at)
  select p_business, p_branch, m.id, p_type, p_title, p_body, p_data, p_entity_type, p_entity_id, p_dedupe, p_expires
  from members m
  where m.business_id = p_business and m.active and m.role = any (v_roles)
    and (not p_skip_actor or m.user_id is distinct from auth.uid())
    and (p_branch is null or m.role in ('owner', 'accountant')
         or exists (select 1 from member_branches mb where mb.member_id = m.id and mb.branch_id = p_branch))
  on conflict (member_id, dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.notify(uuid, uuid, public.member_role[], text, text, text, text, uuid, jsonb, text,
  timestamptz, boolean, boolean) from public, anon, authenticated;

-- One person: the stylist of a booking (never the person who caused it).
create function public.notify_member(p_member uuid, p_branch uuid, p_type text, p_title text, p_body text,
                                     p_entity_type text, p_entity_id uuid, p_data jsonb, p_dedupe text,
                                     p_expires timestamptz) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if p_member is null or (p_expires is not null and p_expires <= now()) then
    return 0;
  end if;
  insert into notifications (business_id, branch_id, member_id, type, title, body, data, entity_type, entity_id, dedupe_key,
                             expires_at)
  select m.business_id, p_branch, m.id, p_type, p_title, p_body, coalesce(p_data, '{}'), p_entity_type, p_entity_id,
         p_dedupe, p_expires
  from members m
  where m.id = p_member and m.active and m.user_id is distinct from auth.uid()
  on conflict (member_id, dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.notify_member(uuid, uuid, text, text, text, text, uuid, jsonb, text, timestamptz)
  from public, anon, authenticated;

-- Alerts about something that is over (a visit started, a bill paid) end now.
create function public.end_alerts(p_entity_type text, p_entity_id uuid, p_types text[]) returns void
language sql security definer set search_path = public as $$
  update notifications set expires_at = now()
  where entity_type = p_entity_type and entity_id = p_entity_id and type = any (p_types)
    and (expires_at is null or expires_at > now())
$$;
revoke execute on function public.end_alerts(text, uuid, text[]) from public, anon, authenticated;

-- ── Bookings and visits ───────────────────────────────────────────────────────────────────────
create or replace function public.on_booking_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tz text := public.branch_tz(new.branch_id);
  v_stylist uuid := (select member_id from employees where id = new.employee_id);
  v_who text := coalesce(new.customer_name, (select name from customers where id = new.customer_id), 'A guest');
  v_data jsonb := jsonb_build_object('customer', v_who, 'at', new.scheduled_at, 'source', new.source);
begin
  if new.status = 'booked' then
    if new.source = 'app' then
      perform public.notify(new.business_id, new.branch_id, array['cashier']::member_role[], 'online_booking',
        'New online booking', v_who || ' · ' || to_char(new.scheduled_at at time zone tz, 'Dy DD Mon HH24:MI'),
        'appointment', new.id, v_data, 'booking:' || new.id, new.scheduled_at, true);
    end if;
    perform public.notify_member(v_stylist, new.branch_id, 'new_booking', 'New booking',
      v_who || ' · ' || to_char(new.scheduled_at at time zone tz, 'Dy DD Mon HH24:MI'),
      'appointment', new.id, v_data, 'booking:' || new.id, new.scheduled_at);
  elsif new.status = 'waiting' then
    perform public.notify_member(v_stylist, new.branch_id, 'client_arrived', 'Client arrived', v_who || ' is here',
      'appointment', new.id, v_data, 'arrived:' || new.id, public.branch_day_end(new.branch_id));
  end if;
  return new;
end;
$$;

create function public.on_appointment_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tz text := public.branch_tz(new.branch_id);
  v_stylist uuid := (select member_id from employees where id = new.employee_id);
  v_old_stylist uuid := (select member_id from employees where id = old.employee_id);
  v_who text := coalesce(new.customer_name, (select name from customers where id = new.customer_id), 'A guest');
  v_when text := to_char(new.scheduled_at at time zone tz, 'Dy DD Mon HH24:MI');
  v_data jsonb := jsonb_build_object('customer', v_who, 'at', new.scheduled_at, 'source', new.source);
  v_online boolean := auth.uid() is null;
begin
  -- Moved to another time or stylist.
  if new.status = 'booked' and old.status = 'booked'
     and (new.scheduled_at is distinct from old.scheduled_at or new.employee_id is distinct from old.employee_id) then
    perform public.end_alerts('appointment', new.id, array['new_booking', 'online_booking', 'booking_moved']);
    if v_old_stylist is distinct from v_stylist then
      perform public.notify_member(v_old_stylist, new.branch_id, 'booking_moved', 'Booking moved',
        v_who || ' · ' || to_char(old.scheduled_at at time zone tz, 'Dy DD Mon HH24:MI') || ' · now with someone else',
        'appointment', new.id, v_data || '{"reassigned": true}', 'moved:' || new.id || ':' || now(), old.scheduled_at);
      perform public.notify_member(v_stylist, new.branch_id, 'new_booking', 'New booking', v_who || ' · ' || v_when,
        'appointment', new.id, v_data, 'booking:' || new.id || ':' || now(), new.scheduled_at);
    else
      perform public.notify_member(v_stylist, new.branch_id, 'booking_moved', 'Booking moved',
        v_who || ' · now ' || v_when, 'appointment', new.id, v_data || jsonb_build_object('was', old.scheduled_at),
        'moved:' || new.id || ':' || now(), new.scheduled_at);
    end if;
  end if;

  if new.status is distinct from old.status then
    -- Whatever the booking became, its booking alerts are over; leaving the waiting list ends the walk-in alerts.
    if old.status = 'booked' then
      perform public.end_alerts('appointment', new.id, array['new_booking', 'online_booking', 'booking_moved']);
    end if;
    if old.status = 'waiting' then
      perform public.end_alerts('appointment', new.id, array['long_wait', 'client_arrived']);
    end if;

    if new.status = 'cancelled' then
      perform public.notify(new.business_id, new.branch_id, array['cashier']::member_role[],
        case when v_online then 'online_cancelled' else 'booking_cancelled' end,
        case when v_online then 'Online booking cancelled' else 'Booking cancelled' end,
        v_who || ' · ' || to_char(old.scheduled_at at time zone tz, 'Dy DD Mon HH24:MI'),
        'appointment', new.id, v_data, 'cancelled:' || new.id, greatest(old.scheduled_at, now() + interval '2 hours'), true);
      perform public.notify_member(v_stylist, new.branch_id, 'booking_cancelled', 'Booking cancelled',
        v_who || ' · ' || to_char(old.scheduled_at at time zone tz, 'Dy DD Mon HH24:MI'),
        'appointment', new.id, v_data, 'cancelled:' || new.id, greatest(old.scheduled_at, now() + interval '2 hours'));
    elsif new.status = 'waiting' and old.status = 'booked' then
      perform public.notify(new.business_id, new.branch_id, array['cashier']::member_role[], 'client_arrived',
        'Client arrived', v_who || ' is here' || coalesce(' for ' || (select full_name from employees where id = new.employee_id), ''),
        'appointment', new.id, v_data, 'arrived:' || new.id, public.branch_day_end(new.branch_id), true);
      perform public.notify_member(v_stylist, new.branch_id, 'client_arrived', 'Client arrived', v_who || ' is here',
        'appointment', new.id, v_data, 'arrived:' || new.id, public.branch_day_end(new.branch_id));
    elsif new.status = 'no_show' then
      perform public.notify(new.business_id, new.branch_id, array['manager']::member_role[], 'no_show', 'No-show',
        v_who || ' · ' || v_when || coalesce(' · ' || (select full_name from employees where id = new.employee_id), ''),
        'appointment', new.id, v_data, 'noshow:' || new.id, public.branch_day_end(new.branch_id, new.scheduled_at)
        + interval '1 day', true);
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.on_appointment_changed() from public, anon, authenticated;
create trigger appointments_notify_change after update on public.appointments
  for each row execute function public.on_appointment_changed();

-- ── Team, stock, bills, books ─────────────────────────────────────────────────────────────────
-- A clock-out missed on an earlier day: managers (or the owner); the alert ends once it is fixed.
create function public.notify_missed_clock_outs(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  a record;
  n int := 0;
begin
  for a in
    select at.*, e.full_name from attendance at join employees e on e.id = at.employee_id
    where at.clock_out is null and at.business_date < public.branch_today(at.branch_id)
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
create function public.on_attendance_fixed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.clock_out is null and new.clock_out is not null then
    perform public.end_alerts('attendance', new.id, array['missed_clock_out']);
  end if;
  return new;
end;
$$;
create trigger attendance_end_alerts after update of clock_out on public.attendance
  for each row execute function public.on_attendance_fixed();

-- Supplier bills due in the next three days (or today): the accountant (or the owner); ends when paid or reversed.
create function public.notify_bills_due(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  b record;
  n int := 0;
begin
  for b in
    select pb.*, s.name as supplier, bu.currency from purchase_bills pb
    join suppliers s on s.id = pb.supplier_id join businesses bu on bu.id = pb.business_id
    where pb.status in ('unpaid', 'partial')
      and pb.due_date between public.branch_today(pb.branch_id) and public.branch_today(pb.branch_id) + 3
  loop
    n := n + public.notify(b.business_id, b.branch_id, array['accountant']::member_role[], 'bill_due',
      case when b.due_date = public.branch_today(b.branch_id) then 'Bill due today' else 'Bill due ' || to_char(b.due_date, 'Dy DD Mon') end,
      public.purchase_no(b.number) || ' · ' || b.supplier || ' · ' || public.fmt_money(b.total_minor - b.paid_minor, b.currency),
      'purchase_bill', b.id, jsonb_build_object('supplier', b.supplier, 'due', b.due_date, 'left_minor', b.total_minor - b.paid_minor),
      'bill:' || b.id || ':' || b.due_date, null, true);
  end loop;
  return n;
end;
$$;
create function public.on_bill_settled() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('paid', 'reversed') and old.status is distinct from new.status then
    perform public.end_alerts('purchase_bill', new.id, array['bill_due']);
  end if;
  return new;
end;
$$;
create trigger purchase_bills_end_alerts after update of status on public.purchase_bills
  for each row execute function public.on_bill_settled();

-- Last month is over and not closed: the accountant (or the owner); ends when it is closed.
create function public.notify_month_ready(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  bu record;
  n int := 0;
begin
  for bu in
    select b.id, to_char((p_now at time zone b.timezone)::date - interval '1 month', 'YYYY-MM') as month
    from businesses b
  loop
    continue when exists (select 1 from periods p where p.business_id = bu.id and p.month = bu.month and p.status = 'closed')
               or not exists (select 1 from journal_entries e where e.business_id = bu.id
                              and to_char(e.business_date, 'YYYY-MM') = bu.month);
    n := n + public.notify(bu.id, null, array['accountant']::member_role[], 'month_ready', 'Month ready to close',
      to_char((bu.month || '-01')::date, 'FMMonth YYYY') || ' is over: check it and close it',
      'period', null, jsonb_build_object('month', bu.month), 'month:' || bu.month, null, true);
  end loop;
  return n;
end;
$$;
create function public.on_period_closed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'closed' then
    update notifications set expires_at = now()
    where business_id = new.business_id and type = 'month_ready' and data ->> 'month' = new.month
      and (expires_at is null or expires_at > now());
  end if;
  return new;
end;
$$;
create trigger periods_end_alerts after insert or update of status on public.periods
  for each row execute function public.on_period_closed();

-- A delivery waits for prices: managers of the branch and the accountant (or the owner); ends when priced or cancelled.
create function public.on_delivery_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status = 'waiting' then
    perform public.notify(new.business_id, new.branch_id, array['manager', 'accountant']::member_role[],
      'delivery_waiting', 'Delivery to price',
      'Delivery ' || new.number || coalesce(' · ' || coalesce((select name from suppliers where id = new.supplier_id),
                                                             new.supplier_name), '')
      || ' · received by ' || new.received_name,
      'delivery', new.id, jsonb_build_object('number', new.number), 'delivery:' || new.id, null, true);
  elsif tg_op = 'UPDATE' and new.status <> 'waiting' then
    perform public.end_alerts('delivery', new.id, array['delivery_waiting']);
  end if;
  return new;
end;
$$;
create trigger deliveries_notify after insert or update of status on public.deliveries
  for each row execute function public.on_delivery_changed();

-- Refunds and discounts above the limit that someone else approved: the owner.
create function public.on_approval_used() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_currency text := (select currency from businesses where id = new.business_id);
begin
  if new.used_at is null or (tg_op = 'UPDATE' and old.used_at is not null)
     or new.action not in ('discount', 'refund', 'deposit_refund')
     or (select role from members where id = new.approved_by) = 'owner' then
    return new;
  end if;
  perform public.notify(new.business_id, new.branch_id, array['owner']::member_role[],
    case when new.action = 'discount' then 'discount_over_limit' else 'refund_made' end,
    case new.action
      when 'discount' then 'Discount ' || trim_scale(round(new.amount / 100.0, 2)) || '%'
                           || coalesce(' (limit ' || trim_scale(round(new.limit_amount / 100.0, 2)) || '%)', '')
      when 'refund' then 'Refund ' || public.fmt_money(new.amount, v_currency)
      else 'Deposit refunded ' || public.fmt_money(new.amount, v_currency) end,
    new.requested_name || case when new.approved_by is distinct from new.requested_by
                               then ' · approved by ' || new.approved_name else '' end
    || coalesce(' · ' || new.reason, ''),
    coalesce(new.ref_type, 'approval'), coalesce(new.ref_id, new.id),
    jsonb_build_object('action', new.action, 'amount', new.amount, 'limit', new.limit_amount,
                       'by', new.requested_name, 'approved_by', new.approved_name, 'reason', new.reason),
    'approval:' || new.id);
  return new;
end;
$$;
create trigger approvals_notify after insert or update of used_at on public.approvals
  for each row execute function public.on_approval_used();

revoke execute on function public.notify_missed_clock_outs(timestamptz), public.on_attendance_fixed(),
  public.notify_bills_due(timestamptz), public.on_bill_settled(), public.notify_month_ready(timestamptz),
  public.on_period_closed(), public.on_delivery_changed(), public.on_approval_used()
  from public, anon, authenticated;

-- Every hour: missed clock-outs, bills due, a month ready to close (each alert is sent once).
create function public.role_alerts() returns int
language sql security definer set search_path = public as $$
  select public.notify_missed_clock_outs() + public.notify_bills_due() + public.notify_month_ready()
$$;
revoke execute on function public.role_alerts() from public, anon, authenticated;
select cron.schedule('role-alerts', '20 * * * *', $$select public.role_alerts()$$);

-- An online cancellation: alerted by the appointment trigger, like every cancellation.
create or replace function public.public_booking_cancel(p_token text) returns void
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
end;
$$;

-- Walk-ins waiting: the front desk (or the owner); the alert ends with the visit or the day.
create or replace function public.notify_long_waits(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  a appointments;
  n int := 0;
begin
  for a in
    select * from appointments ap
    where ap.status = 'waiting' and ap.wait_notified_at is null and ap.checked_in_at is not null
      and ap.checked_in_at < p_now - make_interval(mins => coalesce((public.branch_setting(ap.branch_id, 'waiting_target_min', '10'))::text::int, 10))
  loop
    perform public.notify(a.business_id, a.branch_id, array['cashier']::member_role[], 'long_wait',
      'Walk-in waiting', coalesce(a.customer_name, 'A guest') || ' has waited '
      || floor(extract(epoch from p_now - a.checked_in_at) / 60) || ' min', 'appointment', a.id,
      jsonb_build_object('customer', a.customer_name, 'minutes', floor(extract(epoch from p_now - a.checked_in_at) / 60)),
      'wait:' || a.id, public.branch_day_end(a.branch_id, p_now), true);
    update appointments set wait_notified_at = p_now where id = a.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Low or out of stock: managers (or the owner), even the one whose sale emptied the shelf.
create or replace function public.on_stock_level_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  i inventory_items;
begin
  select * into i from inventory_items where id = new.item_id;
  if i.kind <> 'tool' and i.active and new.qty <= 0 and old.qty > 0 then
    perform public.notify(i.business_id, new.branch_id, array['manager']::member_role[], 'low_stock',
      'Out of stock', i.name || ' · none left',
      'inventory_item', i.id, jsonb_build_object('item', i.name, 'qty', new.qty, 'unit', i.unit, 'out', true),
      'out:' || i.id || ':' || public.branch_today(new.branch_id), null, true, false);
  elsif i.kind <> 'tool' and i.active and i.reorder_level > 0 and new.qty <= i.reorder_level and old.qty > i.reorder_level then
    perform public.notify(i.business_id, new.branch_id, array['manager']::member_role[], 'low_stock',
      'Low on stock', i.name || ' · ' || trim_scale(new.qty) || ' ' || i.unit || ' left',
      'inventory_item', i.id, jsonb_build_object('item', i.name, 'qty', new.qty, 'unit', i.unit),
      'low:' || i.id || ':' || public.branch_today(new.branch_id), null, true, false);
  end if;
  return new;
end;
$$;

-- Licences and papers expiring: the owner and the managers of that branch.
create or replace function public.notify_documents_due(p_today date default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  d record;
  n int := 0;
begin
  for d in
    select c.*, (c.expires_on - coalesce(p_today, (now() at time zone bu.timezone)::date))::int as days_left,
           coalesce((select full_name from employees where id = c.employee_id), (select name from branches where id = c.branch_id)) as holder,
           coalesce(c.branch_id, (select branch_id from employees where id = c.employee_id)) as doc_branch
    from compliance_documents c join businesses bu on bu.id = c.business_id
    where c.active and c.expires_on is not null
  loop
    continue when d.days_left not in (30, 7, 0) and d.days_left <> d.reminder_days;
    perform public.notify(d.business_id, d.doc_branch, array['owner', 'manager']::member_role[], 'document_due',
      case when d.days_left = 0 then 'Document expires today' else 'Document due in ' || d.days_left || ' days' end,
      initcap(replace(d.doc_type, '_', ' ')) || ' · ' || d.holder || ' · ' || to_char(d.expires_on, 'DD Mon YYYY'),
      'compliance_document', d.id,
      jsonb_build_object('doc_type', d.doc_type, 'holder', d.holder, 'days', d.days_left, 'expires_on', d.expires_on),
      'doc:' || d.id || ':' || d.days_left);
    n := n + 1;
  end loop;
  return n;
end;
$$;
