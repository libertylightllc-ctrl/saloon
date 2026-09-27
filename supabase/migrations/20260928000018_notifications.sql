-- M3 · Notifications (01-PRODUCT §3.16): in-app list per person, push to their phones, a daily digest at 08:00
-- branch time, and the cashier's "request refund". Events are caught by triggers, so the money RPCs stay as
-- they are. Push goes out through the send-push Edge Function, called every minute by pg_cron (pg_net) with the
-- project URL and the public anon key kept in Vault (set per environment, never in the repo).

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid references public.branches (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  type text not null,
  -- English words for the push message; the app words it from type + data in the phone's language.
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  entity_type text,
  entity_id uuid,
  dedupe_key text,
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (member_id, dedupe_key)
);
create index notifications_member_idx on public.notifications (member_id, created_at desc);
create index notifications_unpushed_idx on public.notifications (created_at) where pushed_at is null;

create table public.push_tokens (
  token text primary key check (length(token) between 10 and 300),
  member_id uuid not null references public.members (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- What the push service answered for each phone (written by send-push).
create table public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  token text not null,
  status text not null,
  ticket text,
  detail text,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  sale_id uuid not null references public.sales (id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  reason text not null check (length(btrim(reason)) between 3 and 200),
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  requested_by uuid references public.members (id) on delete set null,
  handled_by uuid references public.members (id) on delete set null,
  handled_note text,
  created_at timestamptz not null default now()
);
create unique index refund_requests_open_idx on public.refund_requests (sale_id) where status = 'open';

alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.push_deliveries enable row level security;
alter table public.refund_requests enable row level security;
create policy "people read their own notifications" on public.notifications for select to authenticated
  using (exists (select 1 from members m where m.id = member_id and m.user_id = auth.uid()));
create policy "front desk reads refund requests" on public.refund_requests for select to authenticated
  using (public.has_role(business_id, array['owner', 'cashier']::public.member_role[]) and public.can_use_branch(branch_id));
revoke insert, update, delete, truncate, references, trigger
  on public.notifications, public.push_tokens, public.push_deliveries, public.refund_requests from anon, authenticated;
revoke select on public.push_tokens, public.push_deliveries from anon, authenticated;

alter table public.appointments add column wait_notified_at timestamptz;

-- ── Sending ────────────────────────────────────────────────────────────────────────────

-- One notification per active member with one of p_roles who can use the branch (owners always).
create function public.notify(p_business uuid, p_branch uuid, p_roles public.member_role[], p_type text, p_title text,
                              p_body text, p_entity_type text default null, p_entity_id uuid default null,
                              p_data jsonb default '{}', p_dedupe text default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  insert into notifications (business_id, branch_id, member_id, type, title, body, data, entity_type, entity_id, dedupe_key)
  select p_business, p_branch, m.id, p_type, p_title, p_body, p_data, p_entity_type, p_entity_id, p_dedupe
  from members m
  where m.business_id = p_business and m.active and m.role = any (p_roles)
    and (p_branch is null or m.role = 'owner'
         or exists (select 1 from member_branches mb where mb.member_id = m.id and mb.branch_id = p_branch))
  on conflict (member_id, dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ── Events ─────────────────────────────────────────────────────────────────────────────

create function public.on_booking_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tz text := public.branch_tz(new.branch_id);
begin
  if new.status = 'booked' then
    perform public.notify(new.business_id, new.branch_id, array['owner', 'cashier']::member_role[], 'new_booking',
      'New booking', coalesce(new.customer_name, 'A guest') || ' · ' || to_char(new.scheduled_at at time zone tz, 'Dy DD Mon HH24:MI'),
      'appointment', new.id,
      jsonb_build_object('customer', new.customer_name, 'at', new.scheduled_at, 'source', new.source));
  end if;
  return new;
end;
$$;
create trigger appointments_notify_booking after insert on public.appointments
  for each row execute function public.on_booking_created();

create function public.on_close_submitted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending_approval' and old.status is distinct from 'pending_approval' then
    perform public.notify(new.business_id, new.branch_id, array['owner']::member_role[], 'close_submitted',
      'Cash close waiting for approval',
      to_char(new.business_date, 'Dy DD Mon') || ' · difference ' || public.fmt_money(coalesce(new.variance_minor, 0)),
      'cash_closing', new.id,
      jsonb_build_object('date', new.business_date, 'variance_minor', new.variance_minor),
      'close:' || new.id || ':' || coalesce(new.submitted_at::text, ''));
  end if;
  return new;
end;
$$;
create trigger cash_closings_notify_submit after update on public.cash_closings
  for each row execute function public.on_close_submitted();

create function public.on_stock_level_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  i inventory_items;
begin
  select * into i from inventory_items where id = new.item_id;
  if i.kind <> 'tool' and i.active and i.reorder_level > 0 and new.qty <= i.reorder_level and old.qty > i.reorder_level then
    perform public.notify(i.business_id, new.branch_id, array['owner', 'cashier']::member_role[], 'low_stock',
      'Low on stock', i.name || ' · ' || trim_scale(new.qty) || ' ' || i.unit || ' left',
      'inventory_item', i.id, jsonb_build_object('item', i.name, 'qty', new.qty, 'unit', i.unit),
      'low:' || i.id || ':' || public.branch_today(new.branch_id));
  end if;
  return new;
end;
$$;
create trigger stock_levels_notify_low after update of qty on public.stock_levels
  for each row execute function public.on_stock_level_changed();

create function public.on_payroll_generated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'generated' then
    perform public.notify(new.business_id, null, array['owner', 'accountant']::member_role[], 'payroll_generated',
      'Payroll worked out', 'Payroll ' || new.period || ' is ready to check and approve', 'payroll_run', new.id,
      jsonb_build_object('period', new.period), 'payroll:' || new.id || ':' || new.generated_at);
  end if;
  return new;
end;
$$;
create trigger payroll_runs_notify after insert or update of generated_at on public.payroll_runs
  for each row execute function public.on_payroll_generated();

create function public.on_refund_requested() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s sales;
begin
  select * into s from sales where id = new.sale_id;
  perform public.notify(new.business_id, new.branch_id, array['owner']::member_role[], 'refund_requested',
    'Refund requested', 'Sale #' || s.number || ' · ' || public.fmt_money(new.amount_minor) || ' · ' || new.reason,
    'sale', new.sale_id, jsonb_build_object('number', s.number, 'amount_minor', new.amount_minor, 'reason', new.reason,
    'by', (select display_name from members where id = new.requested_by)));
  return new;
end;
$$;
create trigger refund_requests_notify after insert on public.refund_requests
  for each row execute function public.on_refund_requested();

-- A refund settles the sale's open request.
create function public.on_refund_done() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update refund_requests set status = 'done', handled_by = new.created_by where sale_id = new.sale_id and status = 'open';
  return new;
end;
$$;
create trigger refunds_settle_requests after insert on public.refunds
  for each row execute function public.on_refund_done();

-- ── Refund requests ────────────────────────────────────────────────────────────────────

-- A cashier asks the owner to refund a sale. p: {sale_id, amount_minor, reason}
create function public.request_refund(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s sales;
  m members;
  v_amount bigint := (p ->> 'amount_minor')::bigint;
  v_id uuid;
begin
  select * into s from sales where id = (p ->> 'sale_id')::uuid;
  if s.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_member(s.branch_id, array['cashier']::member_role[]);
  if v_amount is null or v_amount <= 0 or v_amount > s.total_minor - s.refunded_minor then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p ->> 'reason', ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if exists (select 1 from refund_requests where sale_id = s.id and status = 'open') then
    raise exception 'already_requested' using errcode = '22023';
  end if;
  insert into refund_requests (business_id, branch_id, sale_id, amount_minor, reason, requested_by)
  values (s.business_id, s.branch_id, s.id, v_amount, btrim(p ->> 'reason'), m.id)
  returning id into v_id;
  perform public.write_audit(s.business_id, s.branch_id, m.id, 'request', 'refund', s.id,
    'Asked for a refund of ' || public.fmt_money(v_amount) || ' on sale #' || s.number || ': ' || btrim(p ->> 'reason'));
  return v_id;
end;
$$;

-- The owner declines a request, with a note.
create function public.dismiss_refund_request(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  r refund_requests;
  m members;
begin
  select * into r from refund_requests where id = p_id for update;
  if r.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_member(r.branch_id, array['owner']::member_role[]);
  if r.status <> 'open' then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  update refund_requests set status = 'dismissed', handled_by = m.id, handled_note = nullif(btrim(p_note), '') where id = r.id;
  perform public.write_audit(r.business_id, r.branch_id, m.id, 'dismiss', 'refund', r.sale_id,
    'Declined a refund request' || coalesce(': ' || nullif(btrim(p_note), ''), ''));
end;
$$;

-- ── Reading, phones ────────────────────────────────────────────────────────────────────

create function public.mark_notifications_read(p_ids uuid[] default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  update notifications n set read_at = now()
  where n.read_at is null and (p_ids is null or n.id = any (p_ids))
    and exists (select 1 from members m where m.id = n.member_id and m.user_id = auth.uid());
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- A phone signs up for push for the member signed in on it (one token belongs to one member at a time).
create function public.register_push_token(p_business uuid, p_token text, p_platform text) returns void
language plpgsql security definer set search_path = public as $$
declare
  m members;
begin
  select * into m from members where business_id = p_business and user_id = auth.uid() and active;
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_token !~ '^(ExponentPushToken|ExpoPushToken)\[.+\]$' then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  insert into push_tokens (token, member_id, platform) values (p_token, m.id, p_platform)
  on conflict (token) do update set member_id = excluded.member_id, platform = excluded.platform, last_seen_at = now();
end;
$$;

-- Signing out stops pushes to that phone.
create function public.unregister_push_token(p_token text) returns void
language sql security definer set search_path = public as $$
  delete from push_tokens t using members m where t.token = p_token and m.id = t.member_id and m.user_id = auth.uid()
$$;

-- ── Scheduled jobs ─────────────────────────────────────────────────────────────────────

-- Walk-ins waiting longer than the branch target (setting waiting_target_min, default 10).
create function public.notify_long_waits(p_now timestamptz default now()) returns int
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
    perform public.notify(a.business_id, a.branch_id, array['owner', 'cashier']::member_role[], 'long_wait',
      'Walk-in waiting', coalesce(a.customer_name, 'A guest') || ' has waited '
      || floor(extract(epoch from p_now - a.checked_in_at) / 60) || ' min', 'appointment', a.id,
      jsonb_build_object('customer', a.customer_name, 'minutes', floor(extract(epoch from p_now - a.checked_in_at) / 60)),
      'wait:' || a.id);
    update appointments set wait_notified_at = p_now where id = a.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Documents due in 30, 7 and 0 days (and each record's own reminder day), once each.
create function public.notify_documents_due(p_today date default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  d record;
  n int := 0;
begin
  for d in
    select c.*, (c.expires_on - coalesce(p_today, (now() at time zone bu.timezone)::date))::int as days_left,
           coalesce((select full_name from employees where id = c.employee_id), (select name from branches where id = c.branch_id)) as holder
    from compliance_documents c join businesses bu on bu.id = c.business_id
    where c.active and c.expires_on is not null
  loop
    continue when d.days_left not in (30, 7, 0) and d.days_left <> d.reminder_days;
    perform public.notify(d.business_id, null, array['owner']::member_role[], 'document_due',
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

-- The owner's morning summary, once a day between 08:00 and 08:59 branch time.
create function public.send_daily_digests(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  b record;
  v_local timestamp;
  v_yesterday date;
  v_sales bigint;
  v_count int;
  v_pending int;
  v_low int;
  n int := 0;
begin
  for b in select br.*, bu.timezone from branches br join businesses bu on bu.id = br.business_id loop
    v_local := p_now at time zone b.timezone;
    continue when extract(hour from v_local) <> 8;
    v_yesterday := v_local::date - 1;
    select coalesce(sum(total_minor), 0), count(*) into v_sales, v_count from sales
    where branch_id = b.id and business_date = v_yesterday;
    select count(*) into v_pending from cash_closings where branch_id = b.id and status = 'pending_approval';
    select count(*) into v_low from inventory_items i left join stock_levels s on s.item_id = i.id and s.branch_id = b.id
    where i.business_id = b.business_id and i.active and i.kind <> 'tool' and i.reorder_level > 0
      and coalesce(s.qty, 0) <= i.reorder_level;
    n := n + public.notify(b.business_id, b.id, array['owner']::member_role[], 'daily_digest',
      'Good morning — ' || b.name,
      'Yesterday: ' || public.fmt_money(v_sales) || ' from ' || v_count || ' sales'
      || case when v_pending > 0 then ' · ' || v_pending || ' close(s) to approve' else '' end
      || case when v_low > 0 then ' · ' || v_low || ' item(s) low on stock' else '' end,
      null, null,
      jsonb_build_object('branch', b.name, 'sales_minor', v_sales, 'sales', v_count, 'pending_closes', v_pending, 'low_stock', v_low,
                         'date', v_yesterday),
      'digest:' || b.id || ':' || v_local::date);
  end loop;
  return n;
end;
$$;

-- Ask send-push to deliver what is waiting. Needs Vault secrets project_url and anon_key (set per environment).
create function public.dispatch_push() returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key');
begin
  if v_url is null or v_key is null
     or not exists (select 1 from notifications where pushed_at is null and created_at > now() - interval '1 day') then
    return null;
  end if;
  return net.http_post(url := v_url || '/functions/v1/send-push', body := '{}'::jsonb,
                       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key));
end;
$$;

-- Service role only: store where send-push lives and the public anon key, for dispatch_push (Vault).
-- Run once per environment (the e2e setup does it locally; the hosted project gets its own values).
create function public.configure_push(p_project_url text, p_anon_key text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  delete from vault.secrets where name in ('project_url', 'anon_key');
  perform vault.create_secret(p_project_url, 'project_url');
  perform vault.create_secret(p_anon_key, 'anon_key');
end;
$$;
revoke execute on function public.configure_push(text, text) from public, anon, authenticated;
grant execute on function public.configure_push(text, text) to service_role;

revoke execute on function public.notify(uuid, uuid, public.member_role[], text, text, text, text, uuid, jsonb, text),
  public.on_booking_created(), public.on_close_submitted(), public.on_stock_level_changed(), public.on_payroll_generated(),
  public.on_refund_requested(), public.on_refund_done(), public.notify_long_waits(timestamptz),
  public.notify_documents_due(date), public.send_daily_digests(timestamptz), public.dispatch_push(),
  public.request_refund(jsonb), public.dismiss_refund_request(uuid, text), public.mark_notifications_read(uuid[]),
  public.register_push_token(uuid, text, text), public.unregister_push_token(text) from public, anon;
revoke execute on function public.notify(uuid, uuid, public.member_role[], text, text, text, text, uuid, jsonb, text),
  public.notify_long_waits(timestamptz), public.notify_documents_due(date), public.send_daily_digests(timestamptz),
  public.dispatch_push() from authenticated;
grant execute on function public.request_refund(jsonb), public.dismiss_refund_request(uuid, text),
  public.mark_notifications_read(uuid[]), public.register_push_token(uuid, text, text), public.unregister_push_token(text)
  to authenticated;

select cron.schedule('push-dispatch', '* * * * *', $$select public.dispatch_push()$$);
select cron.schedule('long-waits', '*/5 * * * *', $$select public.notify_long_waits()$$);
select cron.schedule('documents-due', '15 * * * *', $$select public.notify_documents_due()$$);
select cron.schedule('daily-digest', '*/15 * * * *', $$select public.send_daily_digests()$$);

alter publication supabase_realtime add table public.notifications, public.refund_requests;
