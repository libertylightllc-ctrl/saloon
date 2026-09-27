-- M2 · Daily cash closing (01-PRODUCT §3.12) and tip payouts.
-- Expected cash is the branch's cash account balance through the business date (expected_cash), i.e.
--   opening + cash sales & deposits − cash refunds & deposit refunds − cash expenses
--   − supplier cash payments − tip payouts (− payroll & advances, M3).
-- The cashier counts and submits; the owner approves (locks the day, posts the difference to
-- Cash over/short and any cash taken out) or sends it back. A submitted day takes no more cash.

create table public.tip_payouts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  employee_id uuid not null references public.employees (id),
  business_date date not null,
  amount_minor bigint not null check (amount_minor > 0),
  client_ref text unique,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index tip_payouts_employee_idx on public.tip_payouts (employee_id, created_at desc);

create table public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  business_date date not null,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved')),
  -- Opening and expected are fixed when the count is submitted; while a draft they are computed live.
  opening_cash_minor bigint,
  expected_cash_minor bigint,
  counted_cash_minor bigint check (counted_cash_minor >= 0),
  variance_minor bigint,
  reason text check (reason is null or length(reason) <= 200),
  denominations jsonb not null default '{}',
  counted_by uuid references public.members (id) on delete set null,
  drawer_closed_confirmed boolean not null default false,
  taken_out_minor bigint not null default 0 check (taken_out_minor >= 0),
  taken_out_to text check (taken_out_to in ('bank', 'owner')),
  submitted_by uuid references public.members (id) on delete set null,
  submitted_at timestamptz,
  approved_by uuid references public.members (id) on delete set null,
  approved_at timestamptz,
  returned_reason text,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch_id, business_date)
);

alter table public.tip_payouts enable row level security;
alter table public.cash_closings enable row level security;
create policy "front desk reads tip payouts" on public.tip_payouts for select to authenticated
  using (public.has_role(business_id, array['owner', 'cashier', 'accountant']::public.member_role[])
         and public.can_use_branch(branch_id));
create policy "front desk reads cash closings" on public.cash_closings for select to authenticated
  using (public.has_role(business_id, array['owner', 'cashier', 'accountant']::public.member_role[])
         and public.can_use_branch(branch_id));
revoke insert, update, delete, truncate, references, trigger on public.tip_payouts, public.cash_closings
  from anon, authenticated;

-- ── The lock: once a day is submitted, no more cash moves on that date in that branch ──────
-- (the close's own entry is the exception). Card, wallet and bank movements are unaffected.
create function public.check_cash_day_open() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  e journal_entries;
begin
  if not exists (select 1 from accounts a where a.id = new.account_id and a.system_key = 'cash') then
    return new;
  end if;
  select * into e from journal_entries where id = new.entry_id;
  if e.source_type <> 'cash_close' and e.branch_id is not null and exists (
       select 1 from cash_closings c
       where c.branch_id = e.branch_id and c.business_date = e.business_date and c.status <> 'draft') then
    raise exception 'day_closed' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger journal_lines_cash_day_open before insert on public.journal_lines
  for each row execute function public.check_cash_day_open();

-- ── Tips ────────────────────────────────────────────────────────────────────────────────

-- What each person is owed: tips on their sales − the tip share of refunds − what was paid out.
create function public.tips_owed(p_branch uuid)
returns table (employee_id uuid, full_name text, owed_minor bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_member(p_branch, array['owner', 'cashier', 'accountant']::member_role[]);
  return query
    select x.id, x.full_name, x.owed from (
      select e.id, e.full_name, e.active,
        (coalesce((select sum(s.tip_minor) from sales s where s.tip_employee_id = e.id and s.branch_id = p_branch), 0)
         - coalesce((select sum(r.tip_minor) from refunds r join sales s on s.id = r.sale_id
                     where s.tip_employee_id = e.id and s.branch_id = p_branch), 0)
         - coalesce((select sum(t.amount_minor) from tip_payouts t
                     where t.employee_id = e.id and t.branch_id = p_branch), 0))::bigint as owed
      from employees e
      where e.branch_id = p_branch) x
    where x.owed <> 0 or x.active
    order by x.owed desc, x.full_name;
end;
$$;

-- Pay tips out of the drawer. p: {branch_id, employee_id, amount_minor, client_ref?}. Owner or cashier.
create function public.pay_tips(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_member(v_branch, array['owner', 'cashier']::member_role[]);
  v_amount bigint := (p ->> 'amount_minor')::bigint;
  v_ref text := nullif(p ->> 'client_ref', '');
  v_today date := public.branch_today(v_branch);
  v_owed bigint;
  e employees;
  v_id uuid;
begin
  if v_ref is not null and exists (select 1 from tip_payouts where client_ref = v_ref) then
    return jsonb_build_object('payout_id', (select id from tip_payouts where client_ref = v_ref), 'repeated', true);
  end if;
  select * into e from employees where id = (p ->> 'employee_id')::uuid and branch_id = v_branch;
  if e.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  -- One payout at a time per person, so two phones cannot both pay the same tips.
  perform pg_advisory_xact_lock(hashtext('tips:' || e.id::text));
  select t.owed_minor into v_owed from public.tips_owed(v_branch) t where t.employee_id = e.id;
  if v_amount is null or v_amount <= 0 or v_amount > coalesce(v_owed, 0) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  insert into tip_payouts (business_id, branch_id, employee_id, business_date, amount_minor, client_ref, created_by)
  values (m.business_id, v_branch, e.id, v_today, v_amount, v_ref, m.id)
  returning id into v_id;
  perform public.post_journal(m.business_id, v_branch, v_today, 'tip_payout', v_id,
    'Tips paid to ' || e.full_name, m.id,
    jsonb_build_array(jsonb_build_object('account', 'tips_payable', 'debit', v_amount),
                      jsonb_build_object('account', 'cash', 'credit', v_amount)));
  perform public.write_audit(m.business_id, v_branch, m.id, 'create', 'tip_payout', v_id,
    'Paid tips ' || public.fmt_money(v_amount) || ' to ' || e.full_name);
  return jsonb_build_object('payout_id', v_id, 'repeated', false);
end;
$$;

-- ── Closing ─────────────────────────────────────────────────────────────────────────────

-- The closing screen: opening, each kind of cash movement that day, expected, tips owed and the close itself.
create function public.closing_preview(p_branch uuid, p_date date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner', 'cashier', 'accountant']::member_role[]);
  v_today date := public.branch_today(p_branch);
  v_date date := coalesce(p_date, v_today);
  v_cash uuid := public.acct(m.business_id, 'cash');
  c cash_closings;
begin
  select * into c from cash_closings where branch_id = p_branch and business_date = v_date;
  return jsonb_build_object(
    'business_date', v_date,
    'is_today', v_date = v_today,
    'opening_cash_minor', coalesce(c.opening_cash_minor, public.expected_cash(p_branch, v_date - 1)),
    'expected_cash_minor', coalesce(c.expected_cash_minor, public.expected_cash(p_branch, v_date)),
    'lines', coalesce((select jsonb_agg(jsonb_build_object('kind', x.kind, 'entries', x.n, 'amount_minor', x.amount)
                                        order by x.amount desc)
       from (select e.source_type as kind, count(distinct e.id)::int as n, sum(l.debit_minor - l.credit_minor)::bigint as amount
             from journal_lines l join journal_entries e on e.id = l.entry_id
             where e.branch_id = p_branch and e.business_date = v_date and l.account_id = v_cash
               and e.source_type <> 'cash_close'
             group by e.source_type) x), '[]'),
    'tips_owed', coalesce((select jsonb_agg(to_jsonb(t)) from public.tips_owed(p_branch) t where t.owed_minor > 0), '[]'),
    'closing', case when c.id is null then null else to_jsonb(c) end);
end;
$$;

-- Last N days: every day with a close or with cash movement. Open days show the live expected cash.
create function public.closing_history(p_branch uuid, p_days int default 30)
returns table (business_date date, status text, closing_id uuid, expected_cash_minor bigint,
               counted_cash_minor bigint, variance_minor bigint, reason text)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner', 'cashier', 'accountant']::member_role[]);
  v_today date := public.branch_today(p_branch);
  v_cash uuid := public.acct(m.business_id, 'cash');
begin
  return query
    select d.day, coalesce(c.status, 'open'), c.id,
           coalesce(c.expected_cash_minor, public.expected_cash(p_branch, d.day)),
           c.counted_cash_minor, c.variance_minor, c.reason
    from (select distinct e.business_date as day from journal_entries e
          join journal_lines l on l.entry_id = e.id and l.account_id = v_cash
          where e.branch_id = p_branch and e.business_date > v_today - greatest(p_days, 1)
          union
          select cc.business_date from cash_closings cc
          where cc.branch_id = p_branch and cc.business_date > v_today - greatest(p_days, 1)) d
    left join cash_closings c on c.branch_id = p_branch and c.business_date = d.day
    order by d.day desc;
end;
$$;

-- Approve a submitted close: post the difference and any cash taken out, lock the record. Owner only.
create function public.approve_cash_closing(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c cash_closings;
  m members;
  v_lines jsonb := '[]';
begin
  select * into c from cash_closings where id = p_id for update;
  if c.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_member(c.branch_id, array['owner']::member_role[]);
  if c.status <> 'pending_approval' then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if c.variance_minor < 0 then          -- short: the missing cash becomes a cost
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('account', 'cash_over_short', 'debit', -c.variance_minor),
                                            jsonb_build_object('account', 'cash', 'credit', -c.variance_minor));
  elsif c.variance_minor > 0 then       -- over: the extra cash reduces that cost
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('account', 'cash', 'debit', c.variance_minor),
                                            jsonb_build_object('account', 'cash_over_short', 'credit', c.variance_minor));
  end if;
  if c.taken_out_minor > 0 then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account', case c.taken_out_to when 'owner' then 'owner_drawings' else 'bank' end,
                         'debit', c.taken_out_minor),
      jsonb_build_object('account', 'cash', 'credit', c.taken_out_minor));
  end if;
  perform public.post_journal(c.business_id, c.branch_id, c.business_date, 'cash_close', c.id,
    'Cash close ' || c.business_date, m.id, v_lines);
  update cash_closings set status = 'approved', approved_by = m.id, approved_at = now(), updated_at = now()
  where id = p_id returning * into c;
  perform public.write_audit(c.business_id, c.branch_id, m.id, 'approve', 'cash_closing', c.id,
    'Approved cash close ' || to_char(c.business_date, 'DD Mon') || ' · difference ' || public.fmt_money(c.variance_minor));
  return to_jsonb(c);
end;
$$;

-- Save a draft or submit the count; the owner may approve in the same step.
-- p: {branch_id, business_date?, counted_cash_minor, denominations?, counted_by?, drawer_closed_confirmed?,
--     reason?, taken_out_minor?, taken_out_to?, submit?, approve?}
create function public.submit_cash_count(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_member(v_branch, array['owner', 'cashier']::member_role[]);
  v_today date := public.branch_today(v_branch);
  v_date date := coalesce(nullif(p ->> 'business_date', '')::date, v_today);
  v_approve boolean := coalesce((p ->> 'approve')::boolean, false);
  v_submit boolean := coalesce((p ->> 'submit')::boolean, false) or v_approve;
  v_counted bigint := nullif(p ->> 'counted_cash_minor', '')::bigint;
  v_taken bigint := coalesce(nullif(p ->> 'taken_out_minor', '')::bigint, 0);
  v_to text := nullif(p ->> 'taken_out_to', '');
  v_reason text := nullif(btrim(p ->> 'reason'), '');
  v_counted_by uuid := coalesce(nullif(p ->> 'counted_by', '')::uuid, m.id);
  v_confirmed boolean := coalesce((p ->> 'drawer_closed_confirmed')::boolean, false);
  v_expected bigint;
  c cash_closings;
begin
  if v_approve and m.role <> 'owner' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_date > v_today then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  if not exists (select 1 from members where id = v_counted_by and business_id = m.business_id and active) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if (v_counted is not null and v_counted < 0) or v_taken < 0 or (v_to is not null and v_to not in ('bank', 'owner')) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  -- One close at a time per branch (two phones submitting together).
  perform pg_advisory_xact_lock(hashtext('close:' || v_branch::text));
  select * into c from cash_closings where branch_id = v_branch and business_date = v_date for update;
  if c.status in ('pending_approval', 'approved') then
    raise exception 'day_closed' using errcode = '22023';
  end if;

  if v_submit then
    -- Days close in order: once a later day is closed, this one can no longer change its books; and an
    -- earlier close waiting for approval would still move this day's opening cash when approved.
    if exists (select 1 from cash_closings where branch_id = v_branch and business_date > v_date and status <> 'draft') then
      raise exception 'invalid_date' using errcode = '22023';
    end if;
    if exists (select 1 from cash_closings where branch_id = v_branch and business_date < v_date
               and status = 'pending_approval') then
      raise exception 'previous_close_pending' using errcode = '22023';
    end if;
    v_expected := public.expected_cash(v_branch, v_date);
    if v_counted is null then
      raise exception 'count_required' using errcode = '22023';
    end if;
    if not v_confirmed then
      raise exception 'confirm_required' using errcode = '22023';
    end if;
    if v_counted <> v_expected and length(coalesce(v_reason, '')) < 3 then
      raise exception 'reason_required' using errcode = '22023';
    end if;
    if v_taken > v_counted or (v_taken > 0 and v_to is null) then
      raise exception 'invalid_amount' using errcode = '22023';
    end if;
  end if;

  if c.id is null then
    insert into cash_closings (business_id, branch_id, business_date, created_by)
    values (m.business_id, v_branch, v_date, m.id) returning * into c;
  end if;
  update cash_closings set
    counted_cash_minor = v_counted,
    denominations = coalesce(p -> 'denominations', '{}'),
    counted_by = v_counted_by,
    drawer_closed_confirmed = v_confirmed,
    reason = v_reason,
    taken_out_minor = v_taken,
    taken_out_to = case when v_taken > 0 then v_to end,
    status = case when v_submit then 'pending_approval' else 'draft' end,
    opening_cash_minor = case when v_submit then public.expected_cash(v_branch, v_date - 1) end,
    expected_cash_minor = case when v_submit then v_expected end,
    variance_minor = case when v_submit then v_counted - v_expected end,
    submitted_by = case when v_submit then m.id end,
    submitted_at = case when v_submit then now() end,
    updated_at = now()
  where id = c.id
  returning * into c;

  if v_submit then
    perform public.write_audit(m.business_id, v_branch, m.id, 'submit', 'cash_closing', c.id,
      'Submitted cash close ' || to_char(v_date, 'DD Mon') || ': counted ' || public.fmt_money(v_counted)
      || ', expected ' || public.fmt_money(v_expected) || ', difference ' || public.fmt_money(v_counted - v_expected));
    if v_approve then
      return public.approve_cash_closing(c.id);
    end if;
  end if;
  return to_jsonb(c);
end;
$$;

-- Send a submitted close back for a recount (the day opens again for cash). Owner only.
create function public.return_cash_closing(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c cash_closings;
  m members;
begin
  select * into c from cash_closings where id = p_id for update;
  if c.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_member(c.branch_id, array['owner']::member_role[]);
  if c.status <> 'pending_approval' then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update cash_closings set status = 'draft', returned_reason = btrim(p_reason), submitted_by = null,
    submitted_at = null, opening_cash_minor = null, expected_cash_minor = null, variance_minor = null,
    drawer_closed_confirmed = false, updated_at = now()
  where id = p_id returning * into c;
  perform public.write_audit(c.business_id, c.branch_id, m.id, 'return', 'cash_closing', c.id,
    'Sent cash close ' || to_char(c.business_date, 'DD Mon') || ' back: ' || btrim(p_reason));
  return to_jsonb(c);
end;
$$;

revoke execute on function public.check_cash_day_open(), public.tips_owed(uuid), public.pay_tips(jsonb),
  public.closing_preview(uuid, date), public.closing_history(uuid, int), public.approve_cash_closing(uuid),
  public.submit_cash_count(jsonb), public.return_cash_closing(uuid, text) from public, anon;
grant execute on function public.tips_owed(uuid), public.pay_tips(jsonb), public.closing_preview(uuid, date),
  public.closing_history(uuid, int), public.approve_cash_closing(uuid), public.submit_cash_count(jsonb),
  public.return_cash_closing(uuid, text) to authenticated;

alter publication supabase_realtime add table public.cash_closings, public.tip_payouts;
