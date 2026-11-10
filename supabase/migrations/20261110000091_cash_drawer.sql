-- Part B, step 3 (brief B2 "Cash drawer", B3, B4): the cash drawer by login type.
-- * "Counted by" is always the person signed in.
-- * Blind count (Controls, on by default): the front desk counts first and sees the expected cash, the opening cash and
--   the cash taken today only once their count is submitted. The accountant sees them once the day's count is in
--   ("view after close"). Owners and managers see them at any time.
-- * A cash difference needs a reason at or above the branch's reason limit (was: any difference), and at or above the
--   notify limit the owner and the accountant get "Cash short …" / "Cash over …".
-- * Managers approve or send back closes, but not a count they made themselves (the owner can).
-- * Cash taken out at the close: owner and manager. The accountant records when it reached the bank.
-- * Petty cash from the drawer: owner and manager; the front desk up to the petty-cash limit with a receipt photo,
--   above it with a manager's PIN. The accountant records expenses paid by card or bank, never from the drawer.
-- * Tips paid out and cash added to the drawer: owner, manager, front desk.
-- Nothing already recorded changes.

-- The drawer's cash at the end of a day, for the database's own use (callers check the person first).
create function public.drawer_cash_on(p_branch uuid, p_date date) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(sum(l.debit_minor - l.credit_minor), 0)::bigint
  from journal_lines l
  join journal_entries e on e.id = l.entry_id
  where e.branch_id = p_branch
    and e.business_date <= p_date
    and l.account_id = public.acct(public.branch_business(p_branch), 'cash')
$$;
revoke execute on function public.drawer_cash_on(uuid, date) from public, anon, authenticated;

-- May this login see the expected cash of that day? Owner and manager: yes. Front desk: when blind count is off, or
-- once the day's count is submitted. Accountant: once the count is submitted. Stylists: no.
create function public.cash_visible(p_branch uuid, p_date date, p_role public.member_role) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_role in ('owner', 'manager') then true
    when p_role not in ('cashier', 'accountant') then false
    when exists (select 1 from cash_closings where branch_id = p_branch and business_date = p_date
                 and status in ('pending_approval', 'approved')) then true
    when p_role = 'cashier' then not coalesce((public.branch_control(p_branch, 'blind_count'))::boolean, true)
    else false
  end
$$;
revoke execute on function public.cash_visible(uuid, date, public.member_role) from public, anon, authenticated;

-- The expected cash, for those who may see it (null while it is hidden).
create or replace function public.expected_cash(p_branch uuid, p_date date default null) returns bigint
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_can(p_branch, 'viewClosing');
  v_date date := coalesce(p_date, public.branch_today(p_branch));
begin
  if not public.cash_visible(p_branch, v_date, m.role) then
    return null;
  end if;
  return public.drawer_cash_on(p_branch, v_date);
end;
$$;

-- Alerts reach the accountant in every branch, like the owner (the accountant works across branches).
create or replace function public.notify(p_business uuid, p_branch uuid, p_roles public.member_role[], p_type text,
                                         p_title text, p_body text, p_entity_type text default null,
                                         p_entity_id uuid default null, p_data jsonb default '{}',
                                         p_dedupe text default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  insert into notifications (business_id, branch_id, member_id, type, title, body, data, entity_type, entity_id, dedupe_key)
  select p_business, p_branch, m.id, p_type, p_title, p_body, p_data, p_entity_type, p_entity_id, p_dedupe
  from members m
  where m.business_id = p_business and m.active and m.role = any (p_roles)
    and (p_branch is null or m.role in ('owner', 'accountant')
         or exists (select 1 from member_branches mb where mb.member_id = m.id and mb.branch_id = p_branch))
  on conflict (member_id, dedupe_key) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- When the accountant recorded that cash taken out to the bank reached it (no money moves: the close already did that).
alter table public.cash_closings
  add column banked_on date,
  add column bank_ref text check (bank_ref is null or length(bank_ref) <= 60),
  add column banked_by uuid references public.members (id) on delete set null;

-- Who reads closes and tip payouts: everyone who may see the closing screen (owner, manager, front desk, accountant).
drop policy "front desk reads tip payouts" on public.tip_payouts;
drop policy "front desk reads cash closings" on public.cash_closings;
create policy "closing screen reads tip payouts" on public.tip_payouts for select to authenticated
  using (business_id in (select public.my_business_ids_can('viewClosing')) 
         and branch_id in (select public.my_branch_ids()));
create policy "closing screen reads cash closings" on public.cash_closings for select to authenticated
  using (business_id in (select public.my_business_ids_can('viewClosing')) 
         and branch_id in (select public.my_branch_ids()));

-- Receipt photos: whoever records petty cash, expenses or supplier bills uploads them; those who see expenses or bills
-- read them (the front desk: its own).
drop policy "front desk uploads receipts" on storage.objects;
drop policy "front desk reads receipts" on storage.objects;
create policy "money out uploads receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] in (
    select x::text from public.my_business_ids_can('pettyCash') x
    union select x::text from public.my_business_ids_can('addExpense') x
    union select x::text from public.my_business_ids_can('addPurchase') x));
create policy "money out reads receipts" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] in (
    select x::text from public.my_business_ids_can('viewExpenses') x
    union select x::text from public.my_business_ids_can('viewPurchases') x));


-- The count: always by the person signed in; reason limit; cash taken out only by owner and manager.
create or replace function public.submit_cash_count(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_can(v_branch, 'countCash');
  v_today date := public.branch_today(v_branch);
  v_date date := coalesce(nullif(p ->> 'business_date', '')::date, v_today);
  v_approve boolean := coalesce((p ->> 'approve')::boolean, false);
  v_submit boolean := coalesce((p ->> 'submit')::boolean, false) or v_approve;
  v_counted bigint := nullif(p ->> 'counted_cash_minor', '')::bigint;
  v_taken bigint := coalesce(nullif(p ->> 'taken_out_minor', '')::bigint, 0);
  v_to text := nullif(p ->> 'taken_out_to', '');
  v_reason text := nullif(btrim(p ->> 'reason'), '');
  v_confirmed boolean := coalesce((p ->> 'drawer_closed_confirmed')::boolean, false);
  v_expected bigint;
  v_reason_limit bigint := (public.branch_control(v_branch, 'cash_reason_minor'))::bigint;
  c cash_closings;
begin
  if v_approve and m.role <> 'owner' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_date > v_today then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  -- Cash taken out of the drawer at the close: owner and manager.
  if v_taken > 0 and public.role_level(m.role, 'cashOut') is null then
    raise exception 'not_allowed' using errcode = '42501';
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
    v_expected := public.drawer_cash_on(v_branch, v_date);
    if v_counted is null then
      raise exception 'count_required' using errcode = '22023';
    end if;
    if not v_confirmed then
      raise exception 'confirm_required' using errcode = '22023';
    end if;
    if v_counted <> v_expected and abs(v_counted - v_expected) >= v_reason_limit
       and length(coalesce(v_reason, '')) < 3 then
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
    counted_by = m.id,
    drawer_closed_confirmed = v_confirmed,
    reason = v_reason,
    taken_out_minor = v_taken,
    taken_out_to = case when v_taken > 0 then v_to end,
    status = case when v_submit then 'pending_approval' else 'draft' end,
    opening_cash_minor = case when v_submit then public.drawer_cash_on(v_branch, v_date - 1) end,
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

-- The closing screen, with blind count.
create or replace function public.closing_preview(p_branch uuid, p_date date default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_can(p_branch, 'viewClosing');
  v_today date := public.branch_today(p_branch);
  v_date date := coalesce(p_date, v_today);
  v_cash uuid := public.acct(m.business_id, 'cash');
  c cash_closings;
  v_show boolean;
begin
  select * into c from cash_closings where branch_id = p_branch and business_date = v_date;
  v_show := public.cash_visible(p_branch, v_date, m.role);
  return jsonb_build_object(
    'business_date', v_date,
    'is_today', v_date = v_today,
    -- Blind count: nothing that adds up to the expected cash until the count is in.
    'blind', not v_show,
    'opening_cash_minor', case when v_show then coalesce(c.opening_cash_minor, public.drawer_cash_on(p_branch, v_date - 1)) end,
    'expected_cash_minor', case when v_show then coalesce(c.expected_cash_minor, public.drawer_cash_on(p_branch, v_date)) end,
    'lines', case when not v_show then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object('kind', x.kind, 'entries', x.n, 'amount_minor', x.amount)
                                        order by x.amount desc)
       from (select e.source_type as kind, count(distinct e.id)::int as n, sum(l.debit_minor - l.credit_minor)::bigint as amount
             from journal_lines l join journal_entries e on e.id = l.entry_id
             where e.branch_id = p_branch and e.business_date = v_date and l.account_id = v_cash
               and e.source_type <> 'cash_close'
             group by e.source_type) x), '[]') end,
    'tips_owed', coalesce((select jsonb_agg(to_jsonb(t)) from public.tips_owed(p_branch) t where t.owed_minor > 0), '[]'),
    'closing', case when c.id is null then null else to_jsonb(c) end);
end;
$$;

create or replace function public.closing_history(p_branch uuid, p_days int default 30)
returns table (business_date date, status text, closing_id uuid, expected_cash_minor bigint,
               counted_cash_minor bigint, variance_minor bigint, reason text)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_can(p_branch, 'viewClosing');
  v_today date := public.branch_today(p_branch);
  v_cash uuid := public.acct(m.business_id, 'cash');
begin
  return query
    select d.day, coalesce(c.status, 'open'), c.id,
           coalesce(c.expected_cash_minor,
                    case when public.cash_visible(p_branch, d.day, m.role) then public.drawer_cash_on(p_branch, d.day) end),
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

create or replace function public.report_closing(p_branch uuid, p_month text)
returns table (business_date date, status text, expected_minor bigint, counted_minor bigint, variance_minor bigint,
               taken_out_minor bigint, reason text, counted_by text, approved_by text)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner', 'accountant']::member_role[]);
  b record := public.month_bounds(p_month);
begin
  return query
    select d::date, coalesce(c.status, 'open'),
           coalesce(c.expected_cash_minor, case when public.cash_visible(p_branch, d::date, m.role)
                                                then public.drawer_cash_on(p_branch, d::date) end),
           c.counted_cash_minor, c.variance_minor, coalesce(c.taken_out_minor, 0), c.reason,
           (select display_name from members where id = c.counted_by),
           (select display_name from members where id = c.approved_by)
    from generate_series(b.d_from, least(b.d_to, public.branch_today(p_branch)), interval '1 day') d
    left join cash_closings c on c.branch_id = p_branch and c.business_date = d::date
    order by d;
end;
$$;

-- Managers approve closes, not their own count.
create or replace function public.approve_cash_closing(p_id uuid) returns jsonb
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
  m := public.require_can(c.branch_id, 'approveClosing');
  -- Separate duties: a manager does not approve a count they made or sent in (the owner may).
  if m.role <> 'owner' and (c.counted_by = m.id or c.submitted_by = m.id) then
    raise exception 'own_count' using errcode = '42501';
  end if;
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

create or replace function public.return_cash_closing(p_id uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c cash_closings;
  m members;
begin
  select * into c from cash_closings where id = p_id for update;
  if c.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_can(c.branch_id, 'approveClosing');
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

-- A close waiting: the owner and the branch's managers. A difference at or above the notify limit: the owner and the
-- accountant, "Cash short QAR 25.00 on 8 Nov · counted by Mary · reason".
create or replace function public.on_close_submitted() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_limit bigint;
  v_by text;
begin
  if new.status = 'pending_approval' and old.status is distinct from 'pending_approval' then
    perform public.notify(new.business_id, new.branch_id, array['owner', 'manager']::member_role[], 'close_submitted',
      'Cash close waiting for approval',
      to_char(new.business_date, 'Dy DD Mon') || ' · difference ' || public.fmt_money(coalesce(new.variance_minor, 0)),
      'cash_closing', new.id,
      jsonb_build_object('date', new.business_date, 'variance_minor', new.variance_minor),
      'close:' || new.id || ':' || coalesce(new.submitted_at::text, ''));
    v_limit := (public.branch_control(new.branch_id, 'cash_notify_minor'))::bigint;
    if coalesce(new.variance_minor, 0) <> 0 and abs(new.variance_minor) >= v_limit then
      select display_name into v_by from members where id = new.counted_by;
      perform public.notify(new.business_id, new.branch_id, array['owner', 'accountant']::member_role[],
        'cash_difference',
        case when new.variance_minor < 0 then 'Cash short ' else 'Cash over ' end
          || public.fmt_money(abs(new.variance_minor), (select currency from businesses where id = new.business_id))
          || ' on ' || to_char(new.business_date, 'FMDD Mon'),
        'Counted by ' || coalesce(v_by, '?') || coalesce(' · ' || new.reason, ''),
        'cash_closing', new.id,
        jsonb_build_object('date', new.business_date, 'variance_minor', new.variance_minor, 'counted_by', v_by,
                           'reason', new.reason),
        'cashdiff:' || new.id || ':' || coalesce(new.submitted_at::text, ''));
    end if;
  end if;
  return new;
end;
$$;

-- Petty cash and other expenses.
create or replace function public.record_expense(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  -- Cash is paid from the drawer (petty cash); card and bank are other expenses.
  m members := public.require_can(v_branch, case when p ->> 'method' = 'cash' then 'pettyCash' else 'addExpense' end);
  v_today date := public.branch_today(v_branch);
  v_date date := coalesce(nullif(p ->> 'business_date', '')::date, v_today);
  v_amount bigint := (p ->> 'amount_minor')::bigint;
  v_method payment_method := nullif(p ->> 'method', '')::payment_method;
  v_ref text := nullif(p ->> 'client_ref', '');
  v_vat bigint := coalesce(nullif(p ->> 'vat_minor', '')::bigint, 0);
  v_receipt text := nullif(p ->> 'receipt_path', '');
  v_limit bigint := (public.branch_control(v_branch, 'petty_cash_limit_minor'))::bigint;
  c expense_categories;
  v_existing expenses;
  v_id uuid;
begin
  if v_ref is not null then
    select * into v_existing from expenses where client_ref = v_ref and business_id = m.business_id;
    if v_existing.id is not null then
      return jsonb_build_object('expense_id', v_existing.id, 'repeated', true);
    end if;
  end if;
  select * into c from expense_categories where id = (p ->> 'category_id')::uuid and business_id = m.business_id;
  if c.id is null or c.archived then
    raise exception 'category_required' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  -- The VAT inside what was paid, from the supplier's tax invoice (recoverable when the salon is VAT-registered).
  if v_vat < 0 or v_vat >= v_amount then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if v_vat > 0 and (select vat_mode from branches where id = v_branch) <> 'on' then
    raise exception 'vat_off' using errcode = '22023';
  end if;
  if v_method is null or v_method not in ('cash', 'card', 'bank') then
    raise exception 'invalid_payment' using errcode = '22023';
  end if;
  if v_date > v_today then
    raise exception 'future_date' using errcode = '22023';
  end if;
  if nullif(p ->> 'paid_by_member_id', '') is not null and (p ->> 'paid_by_member_id')::uuid <> m.id
     and (m.role not in ('owner', 'manager', 'accountant') or not exists (select 1 from members where id = (p ->> 'paid_by_member_id')::uuid
                                            and business_id = m.business_id and active)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if m.role = 'cashier' and (v_method <> 'cash' or v_date <> v_today) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- A receipt photo, uploaded first into the business's folder. The front desk always gives one.
  if v_receipt is not null and (split_part(v_receipt, '/', 1) <> m.business_id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'receipts' and o.name = v_receipt)) then
    raise exception 'receipt_missing' using errcode = '22023';
  end if;
  if m.role = 'cashier' and v_receipt is null then
    raise exception 'receipt_required' using errcode = '22023';
  end if;

  insert into expenses (business_id, branch_id, business_date, category_id, amount_minor, vat_minor, method, note,
                        paid_by_member_id, client_ref, created_by, receipt_path)
  values (m.business_id, v_branch, v_date, c.id, v_amount, v_vat, v_method, nullif(btrim(p ->> 'note'), ''),
          coalesce(nullif(p ->> 'paid_by_member_id', '')::uuid, m.id), v_ref, m.id, v_receipt)
  returning id into v_id;

  perform public.post_journal(m.business_id, v_branch, v_date, 'expense', v_id, 'Expense · ' || c.name, m.id,
    jsonb_build_array(
      jsonb_build_object('account', (select system_key from accounts where id = c.account_id), 'debit', v_amount - v_vat),
      jsonb_build_object('account', 'vat_receivable', 'debit', v_vat),
      jsonb_build_object('account', public.paid_from_account(v_method), 'credit', v_amount)));
  -- Petty cash above the limit: the front desk needs a manager's or the owner's PIN (asked after the drawer check, so
  -- a PIN is not used up on cash that is not there).
  if public.role_level(m.role, 'pettyCash') = 'limit' and v_amount > v_limit then
    perform public.use_approval(nullif(p ->> 'approval_id', '')::uuid, m.id, v_branch, 'petty_cash', v_amount, v_limit,
                                'expense', v_id);
  end if;
  perform public.write_audit(m.business_id, v_branch, m.id, 'create', 'expense', v_id,
    'Expense ' || c.name || ' · ' || public.fmt_money(v_amount));
  return jsonb_build_object('expense_id', v_id, 'repeated', false);
end;
$$;

create or replace function public.attach_receipt(p_kind text, p_id uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid;
  v_branch uuid;
  v_creator uuid;
  v_current text;
  m members;
begin
  if p_kind = 'expense' then
    select business_id, branch_id, created_by, receipt_path into v_business, v_branch, v_creator, v_current
    from expenses where id = p_id;
  elsif p_kind = 'bill' then
    select business_id, branch_id, created_by, receipt_path into v_business, v_branch, v_creator, v_current
    from purchase_bills where id = p_id;
  else
    raise exception 'invalid_line' using errcode = '22023';
  end if;
  if v_business is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_kind = 'expense' then
    m := public.require_can(v_branch, 'viewExpenses');
    if public.role_level(m.role, 'viewExpenses') = 'own' and v_creator is distinct from m.id then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  else
    m := public.require_member(v_branch, array['owner', 'cashier']::member_role[]);
    if m.role = 'cashier' and v_creator is distinct from m.id then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  end if;
  if v_current is not null then
    raise exception 'receipt_exists' using errcode = '22023';
  end if;
  if p_path is null or split_part(p_path, '/', 1) <> v_business::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'receipts' and o.name = p_path) then
    raise exception 'receipt_missing' using errcode = '22023';
  end if;
  if p_kind = 'expense' then
    update expenses set receipt_path = p_path where id = p_id;
  else
    update purchase_bills set receipt_path = p_path where id = p_id;
  end if;
  perform public.write_audit(v_business, v_branch, m.id, 'attach', p_kind, p_id, 'Added a receipt photo');
end;
$$;

create or replace function public.add_drawer_cash(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_can(v_branch, 'countCash');
  v_amount bigint := (p ->> 'amount_minor')::bigint;
  v_from text := coalesce(p ->> 'from', 'owner');
  v_note text := nullif(btrim(coalesce(p ->> 'note', '')), '');
  v_id uuid := gen_random_uuid();
begin
  if v_amount is null or v_amount <= 0 or v_from not in ('owner', 'bank') then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  perform public.post_journal(m.business_id, v_branch, public.branch_today(v_branch), 'cash_added', v_id,
    'Cash added · ' || case v_from when 'bank' then 'from the bank' else 'from the owner' end
      || coalesce(' · ' || v_note, ''),
    m.id,
    jsonb_build_array(jsonb_build_object('account', 'cash', 'debit', v_amount),
                      jsonb_build_object('account', case v_from when 'bank' then 'bank' else 'owner_equity' end,
                                         'credit', v_amount)));
  perform public.write_audit(m.business_id, v_branch, m.id, 'create', 'cash_added', v_id,
    'Added ' || to_char(v_amount / 100.0, 'FM999999990.00') || ' cash to the drawer '
      || case v_from when 'bank' then 'from the bank' else 'from the owner' end,
    null, jsonb_build_object('amount_minor', v_amount, 'from', v_from, 'note', v_note));
  return jsonb_build_object('id', v_id, 'expected_cash_minor',
    case when public.cash_visible(v_branch, public.branch_today(v_branch), m.role) then public.drawer_cash(v_branch) end);
end;
$$;

create or replace function public.pay_tips(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_can(v_branch, 'payTips');
  v_amount bigint := (p ->> 'amount_minor')::bigint;
  v_ref text := nullif(p ->> 'client_ref', '');
  v_today date := public.branch_today(v_branch);
  v_owed bigint;
  e employees;
  v_id uuid;
begin
  if v_ref is not null and exists (select 1 from tip_payouts where client_ref = v_ref and business_id = m.business_id) then
    return jsonb_build_object('payout_id', (select id from tip_payouts where client_ref = v_ref and business_id = m.business_id), 'repeated', true);
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

create or replace function public.tips_owed(p_branch uuid)
returns table (employee_id uuid, full_name text, owed_minor bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_can(p_branch, 'viewClosing');
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

-- The accountant (or the owner or a manager) records that cash taken out to the bank at a close reached the bank.
create function public.record_bank_deposit(p_closing uuid, p_banked_on date, p_ref text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c cash_closings;
  m members;
begin
  select * into c from cash_closings where id = p_closing for update;
  if c.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_can(c.branch_id, 'bankDeposit');
  if c.status <> 'approved' or c.taken_out_to is distinct from 'bank' or c.taken_out_minor <= 0 then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if c.banked_on is not null then
    raise exception 'already_recorded' using errcode = '22023';
  end if;
  if p_banked_on is null or p_banked_on < c.business_date or p_banked_on > public.branch_today(c.branch_id) then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  update cash_closings set banked_on = p_banked_on, bank_ref = nullif(btrim(p_ref), ''), banked_by = m.id,
    updated_at = now()
  where id = c.id returning * into c;
  perform public.write_audit(c.business_id, c.branch_id, m.id, 'update', 'cash_closing', c.id,
    'Bank deposit ' || public.fmt_money(c.taken_out_minor) || ' from the ' || to_char(c.business_date, 'FMDD Mon')
    || ' close reached the bank on ' || to_char(p_banked_on, 'FMDD Mon') || coalesce(' · ' || c.bank_ref, ''));
  return to_jsonb(c);
end;
$$;
revoke execute on function public.record_bank_deposit(uuid, date, text) from public, anon;

-- Blind count also covers the "not enough cash" message.
create or replace function public.post_journal(
  p_business uuid, p_branch uuid, p_date date, p_source_type text, p_source_id uuid,
  p_memo text, p_actor uuid, p_lines jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_entry uuid;
  l jsonb;
  v_debit bigint;
  v_credit bigint;
  v_cash_out bigint;
  v_drawer bigint;
begin
  if not exists (
    select 1 from jsonb_array_elements(p_lines) x
    where coalesce((x ->> 'debit')::bigint, 0) > 0 or coalesce((x ->> 'credit')::bigint, 0) > 0
  ) then
    return null;
  end if;
  -- Cash this entry takes out of the drawer. Two payments at the same moment wait here for each other, so the second
  -- sees the first.
  select coalesce(sum(coalesce((x ->> 'credit')::bigint, 0) - coalesce((x ->> 'debit')::bigint, 0)), 0)
    into v_cash_out
    from jsonb_array_elements(p_lines) x where x ->> 'account' = 'cash';
  if v_cash_out > 0 and p_branch is not null and p_source_type <> 'cash_close' then
    perform pg_advisory_xact_lock(hashtext('drawer:' || p_branch::text));
    v_drawer := public.drawer_cash(p_branch);
    if v_drawer < v_cash_out then
      -- Blind count: the front desk is told there isn't enough, not how much there is.
      if exists (select 1 from members mm where mm.business_id = p_business and mm.user_id = auth.uid() and mm.active
                 and not public.cash_visible(p_branch, public.branch_today(p_branch), mm.role)) then
        raise exception 'not_enough_cash' using errcode = '22023';
      end if;
      raise exception 'not_enough_cash: %', greatest(v_drawer, 0) using errcode = '22023';
    end if;
  end if;
  insert into journal_entries (business_id, branch_id, business_date, source_type, source_id, memo, created_by)
  values (p_business, p_branch, p_date, p_source_type, p_source_id, p_memo, p_actor)
  returning id into v_entry;
  for l in select * from jsonb_array_elements(p_lines) loop
    v_debit := coalesce((l ->> 'debit')::bigint, 0);
    v_credit := coalesce((l ->> 'credit')::bigint, 0);
    if v_debit < 0 or v_credit < 0 then
      raise exception 'negative_journal_amount';
    end if;
    if v_debit > 0 or v_credit > 0 then
      insert into journal_lines (entry_id, account_id, debit_minor, credit_minor)
      values (v_entry, public.acct(p_business, l ->> 'account'), v_debit, v_credit);
    end if;
  end loop;
  return v_entry;
end;
$$;

-- Who is in today, for the manager's Home too.
create or replace function public.attendance_day(p_branch uuid, p_date date default null)
returns table (employee_id uuid, full_name text, role_title text, colour text, shift_start text, shift_end text,
               status text, clock_in timestamptz, clock_out timestamptz, late boolean, late_minutes int,
               break_started_at timestamptz, break_minutes int)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner', 'manager', 'cashier', 'staff', 'accountant']::member_role[]);
  v_today date := public.branch_today(p_branch);
  v_date date := coalesce(p_date, v_today);
  -- Today: the shift running now (it may have started yesterday). Other days: that day's shift.
  v_at timestamp := case when v_date = v_today then (now() at time zone public.branch_tz(p_branch))
                         else v_date + time '12:00' end;
  v_grace int := coalesce((public.branch_setting(p_branch, 'late_grace_min', '10'))::text::int, 10);
begin
  return query
    select e.id, e.full_name, e.role_title, e.colour, to_char(sh.shift_start, 'HH24:MI'), to_char(sh.shift_end, 'HH24:MI'),
           case when a.clock_out is not null then 'done'
                when br.open_since is not null then 'on_break'
                when a.id is not null then 'on_shift'
                when exists (select 1 from rosters x where x.employee_id = e.id) and sh.shift_start is null then 'off'
                -- A shift with no clock-in (owner's app check D3): absent once it has ended (or on an earlier day), late
                -- once it has started by more than the grace minutes, otherwise not in yet.
                when sh.shift_start is not null and (v_date < v_today or v_at >= sh.shift_end) then 'absent'
                when sh.shift_start is not null and v_date = v_today
                     and v_at > sh.shift_start + make_interval(mins => v_grace) then 'late_not_in'
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

-- Home: expected cash follows blind count; managers open Home (no pay figures, bills or payroll).
create or replace function public.dashboard_today(p_branch uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  m members := public.require_member(p_branch, array['owner', 'manager', 'cashier', 'staff', 'accountant']::member_role[]);
  b branches;
  v_today date := public.branch_today(p_branch);
  v_front boolean := m.role in ('owner', 'manager', 'cashier', 'accountant');
  v_me uuid;
  out jsonb := '{}';
begin
  select * into b from branches where id = p_branch;
  out := jsonb_build_object('business_date', v_today, 'role', m.role);

  if v_front then
    out := out || jsonb_build_object(
      -- Money out today: expenses (not reversed) and supplier payments (tables from migration …011).
      'money_out', jsonb_build_object(
          'expenses_minor', coalesce((select sum(amount_minor) from expenses
                                      where branch_id = p_branch and business_date = v_today and status = 'posted'), 0),
          'supplier_payments_minor', coalesce((select sum(amount_minor) from supplier_payments
                                               where branch_id = p_branch and business_date = v_today), 0)),
      -- Cash closing (tables from migration …012): today's status, closes waiting for the owner, and
      -- earlier days in the last week that had cash but were never submitted.
      'closing', jsonb_build_object(
          'today_status', coalesce((select status from cash_closings
                                    where branch_id = p_branch and business_date = v_today), 'open'),
          'pending_approval', (select count(*) from cash_closings
                               where branch_id = p_branch and status = 'pending_approval'),
          'pending', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'business_date', c.business_date,
                                 'variance_minor', c.variance_minor) order by c.business_date)
                               from cash_closings c where c.branch_id = p_branch and c.status = 'pending_approval'), '[]'),
          'unclosed_days', coalesce((select jsonb_agg(d.day order by d.day) from (
                               select distinct e.business_date as day from journal_entries e
                               join journal_lines l on l.entry_id = e.id and l.account_id = public.acct(b.business_id, 'cash')
                               where e.branch_id = p_branch and e.business_date between v_today - 7 and v_today - 1
                                 -- a day before the latest close can no longer be closed on its own
                                 and e.business_date > coalesce((select max(c.business_date) from cash_closings c
                                                                 where c.branch_id = p_branch and c.status <> 'draft'),
                                                                v_today - 8)) d), '[]')),
      -- Stock (owner's app check A6): low is above zero and at or below the reorder level; out of stock is zero or
      -- below, counted here only for items that had stock at this branch (a new item not stocked yet is not news).
      -- Tools that need a service within a week.
      'stock', (select jsonb_build_object(
          'low', count(*) filter (where x.state = 'low'),
          'low_items', coalesce(jsonb_agg(x.name order by x.qty) filter (where x.state = 'low'), '[]'),
          'out', count(*) filter (where x.state = 'out' and x.had_stock),
          'out_items', coalesce(jsonb_agg(x.name order by x.qty) filter (where x.state = 'out' and x.had_stock), '[]'),
          'tools_due', count(*) filter (where x.kind = 'tool' and (x.condition = 'needs_service'
                                          or x.next_service_date <= v_today + 7)))
        from (select i.name, i.kind, i.condition, i.next_service_date, coalesce(sl.qty, 0) as qty,
                     public.stock_state(i.kind, i.active, coalesce(sl.qty, 0), i.reorder_level) as state,
                     public.had_stock(i.id, p_branch) as had_stock
              from inventory_items i
              left join stock_levels sl on sl.item_id = i.id and sl.branch_id = p_branch
              where i.business_id = b.business_id and i.active) x),
      -- Blind count: hidden from the front desk until today's count is in (null = hidden).
      'expected_cash', case when public.cash_visible(p_branch, v_today, m.role)
                            then public.drawer_cash_on(p_branch, v_today) end,
      'expected_cash_yesterday', case when public.cash_visible(p_branch, v_today - 1, m.role)
                                      then public.drawer_cash_on(p_branch, v_today - 1) end,
      'sales', (select jsonb_build_object(
          'count', count(*),
          -- Sales never include the tip (owner's app check A7); the day's tips are given apart.
          'total_minor', coalesce(sum(total_minor - tip_minor), 0),
          'tips_minor', coalesce(sum(tip_minor), 0),
          'refunded_minor', coalesce((select sum(amount_minor) from refunds r
                                      where r.branch_id = p_branch and r.business_date = v_today), 0),
          'services', coalesce((select sum(sl.qty) from sale_lines sl join sales s2 on s2.id = sl.sale_id
                                where s2.branch_id = p_branch and s2.business_date = v_today and sl.kind = 'service'), 0))
        from sales where branch_id = p_branch and business_date = v_today),
      'payment_mix', (select jsonb_build_object(
          'cash', coalesce(sum(sp.amount_minor) filter (where sp.method = 'cash'), 0),
          'card', coalesce(sum(sp.amount_minor) filter (where sp.method = 'card'), 0),
          'wallet', coalesce(sum(sp.amount_minor) filter (where sp.method = 'wallet'), 0),
          'deposits', coalesce((select sum(deposit_applied_minor) from sales
                                where branch_id = p_branch and business_date = v_today), 0))
        from sale_payments sp join sales s on s.id = sp.sale_id
        where s.branch_id = p_branch and s.business_date = v_today),
      'revenue_7d', (select jsonb_agg(jsonb_build_object('date', d::date, 'total_minor', coalesce(
            (select sum(total_minor - tip_minor) from sales where branch_id = p_branch and business_date = d::date), 0))
            order by d)
        from generate_series(v_today - 6, v_today, interval '1 day') d),
      'top_services', coalesce((select jsonb_agg(t order by t.revenue_minor desc) from (
          select sl.name_snapshot as name, sum(sl.qty) as count, sum(sl.net_minor) as revenue_minor
          from sale_lines sl join sales s on s.id = sl.sale_id
          where s.branch_id = p_branch and s.business_date > v_today - 7 and sl.kind = 'service'
          group by sl.name_snapshot order by sum(sl.net_minor) desc limit 5) t), '[]'),
      'staff_today', coalesce((select jsonb_agg(jsonb_build_object(
            'employee_id', e.id, 'name', e.full_name, 'colour', e.colour,
            'services', coalesce(x.services, 0), 'sales_minor', coalesce(x.sales_minor, 0),
            'commission_minor', case when m.role in ('cashier', 'manager') then null else coalesce(x.commission_minor, 0) end,
            'busy', exists (select 1 from appointments ap where ap.employee_id = e.id and ap.status = 'in_progress'
                            and ap.business_date = v_today and ap.branch_id = p_branch),
            -- Today from the roster and the clock (owner's app check A5): on shift, on a break, done, day off, not in
            -- yet, late and not in, absent; "available" only for someone with no roster at all who has not clocked in.
            'status', case when ad.status = 'not_in' and not exists (select 1 from rosters r where r.employee_id = e.id)
                           then 'available' else coalesce(ad.status, 'available') end,
            'late_minutes', case when ad.late then ad.late_minutes end,
            'shift_start', ad.shift_start, 'shift_end', ad.shift_end)
            order by coalesce(x.sales_minor, 0) desc, e.full_name)
          from employees e
          left join (select * from public.attendance_day(p_branch)) ad on ad.employee_id = e.id
          left join lateral (
            select sum(sl.qty) filter (where sl.kind = 'service') as services, sum(sl.net_minor) as sales_minor,
                   sum(sl.commission_minor) as commission_minor
            from sale_lines sl join sales s on s.id = sl.sale_id
            where sl.employee_id = e.id and s.business_date = v_today and s.branch_id = p_branch) x on true
          where e.branch_id = p_branch and e.active and e.role_title <> 'cashier'), '[]'),
      -- Supplier bills due within a week or overdue (owner and accountant; cashiers see no balances).
      'bills', case when m.role in ('owner', 'accountant') then (select jsonb_build_object(
          'overdue_count', count(*) filter (where due_date < v_today),
          'overdue_minor', coalesce(sum(total_minor - paid_minor) filter (where due_date < v_today), 0),
          'due_soon_count', count(*) filter (where due_date between v_today and v_today + 7),
          'due_soon_minor', coalesce(sum(total_minor - paid_minor) filter (where due_date between v_today and v_today + 7), 0))
        from purchase_bills where business_id = b.business_id and status in ('unpaid', 'partial')) end,
      -- Payroll (…016): a month waiting for approval, and paid WPS payslips still without the transfer proof.
      'payroll', case when m.role in ('owner', 'accountant') then jsonb_build_object(
          'pending_period', (select period from payroll_runs where business_id = b.business_id and status = 'generated'
                             order by period desc limit 1),
          'wps_missing', (select count(*) from payroll_lines l join payroll_runs r on r.id = l.run_id
                          where r.business_id = b.business_id and l.wps_status = 'required' and l.paid_at is not null)) end,
      -- Compliance (…017): readiness and records needing attention (owner); today's hygiene log (owner, cashier).
      'compliance', case when m.role = 'owner' then (select jsonb_build_object(
          'readiness', public.compliance_readiness(b.business_id),
          'attention', count(*) filter (where status <> 'valid'),
          -- One count per real status (owner's app check A4): "expired" only once the date has passed, and the days
          -- to the nearest expiry inside its reminder window.
          'expired', count(*) filter (where status = 'expired'),
          'missing', count(*) filter (where status = 'missing'),
          'missing_date', count(*) filter (where status = 'missing_date'),
          'evidence_missing', count(*) filter (where status = 'evidence_missing'),
          'due_soon', count(*) filter (where status = 'due_soon'),
          'soonest_days', min(days_left) filter (where status in ('due_soon', 'evidence_missing')
                                                   and days_left between 0 and reminder_days))
        from public.compliance_status(b.business_id)) end,
      'hygiene_signed', case when m.role in ('owner', 'manager', 'cashier')
          then exists (select 1 from hygiene_logs where branch_id = p_branch and business_date = v_today) end,
      -- History is for the owner (and the read-only accountant), not the front desk.
      'activity', case when m.role in ('owner', 'accountant') then coalesce((select jsonb_agg(jsonb_build_object(
            'summary', al.summary, 'at', al.created_at, 'actor', mem.display_name) order by al.created_at desc)
          from (select * from audit_log
                where business_id = b.business_id and (branch_id = p_branch or branch_id is null)
                order by created_at desc limit 6) al
          left join members mem on mem.id = al.actor_member_id), '[]') end
    );
  end if;

  if m.role in ('owner', 'manager', 'cashier', 'staff') then
    out := out || jsonb_build_object('appointments', (select jsonb_build_object(
        'completed', count(*) filter (where status = 'completed'),
        'waiting', count(*) filter (where status = 'waiting'),
        'in_progress', count(*) filter (where status = 'in_progress'),
        'booked', count(*) filter (where status = 'booked'),
        'no_show', count(*) filter (where status = 'no_show'))
      from appointments where branch_id = p_branch and business_date = v_today));
  end if;

  if m.role = 'owner' then
    out := out || jsonb_build_object('setup', jsonb_build_object(
      'services', exists (select 1 from services where business_id = b.business_id and status = 'active'),
      'staff', exists (select 1 from members where business_id = b.business_id and role <> 'owner'),
      'tax', coalesce((b.settings ->> 'tax_confirmed')::boolean, false),
      'opening_cash', coalesce((b.settings ->> 'opening_cash_set')::boolean, false),
      -- M2 steps (01-PRODUCT §3.1): opening stock counted, suppliers added.
      'opening_stock', coalesce((b.settings ->> 'opening_stock_set')::boolean, false),
      'suppliers', exists (select 1 from suppliers where business_id = b.business_id)));
  end if;

  if m.role = 'staff' then
    select id into v_me from employees where member_id = m.id;
    out := out || jsonb_build_object('me', jsonb_build_object(
      'services_today', coalesce((select sum(sl.qty) from sale_lines sl join sales s on s.id = sl.sale_id
         where sl.employee_id = v_me and s.business_id = m.business_id and s.business_date = v_today and sl.kind = 'service'), 0),
      'sales_today_minor', coalesce((select sum(sl.net_minor) from sale_lines sl join sales s on s.id = sl.sale_id
         where sl.employee_id = v_me and s.business_id = m.business_id and s.business_date = v_today), 0),
      -- The same figure payroll uses (after refunds, never on the tip).
      'commission_month_minor', public.commission_for(v_me, to_char(v_today, 'YYYY-MM'))));
  end if;

  return out;
end;
$$;
