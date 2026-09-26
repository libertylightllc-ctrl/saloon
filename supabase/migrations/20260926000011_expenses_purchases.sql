-- Money out: daily expenses (tea & food, electricity, water, internet, rent, uniforms, dry cleaning…),
-- suppliers, purchase bills and supplier payments (01-PRODUCT §3.8–3.9, 04-DATA-MODEL §4).
-- Every write goes through one function that posts the balanced journal entry and the audit row.
-- Nothing is deleted: expenses and bills are reversed with a reason.

-- ── Expense categories: stable key (for translation), icon, order, archive ────────────────
alter table public.expense_categories
  add column key text,
  add column icon text not null default 'receipt',
  add column sort int not null default 0,
  add column archived boolean not null default false;
create unique index expense_categories_name_idx on public.expense_categories (business_id, lower(name)) where not archived;

-- The salon's usual running costs. Each category has its own expense account (6000…), keyed
-- exp_<key> so journal lines can name it.
create or replace function public.seed_expense_categories(p_business uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  c jsonb;
  i int := 0;
  v_account uuid;
begin
  for c in select * from jsonb_array_elements('[
    ["tea_food","Tea & Food","coffee"],["electricity","Electricity","zap"],["water","Water","droplets"],
    ["internet_phone","Internet & Phone","wifi"],["rent","Rent","building"],["uniforms","Uniforms","shirt"],
    ["dry_cleaning","Dry Cleaning & Laundry","laundry"],["cleaning","Cleaning Supplies","spray"],
    ["repairs","Repairs & Maintenance","wrench"],["transport","Transport & Fuel","fuel"],
    ["marketing","Marketing & Ads","megaphone"],["licences","Licences, Visas & Gov. Fees","landmark"],
    ["bank_fees","Bank & Card Fees","banknote"],["staff_accommodation","Staff Accommodation","bed"],
    ["staff_welfare","Staff Welfare","heart"],["other","Other","ellipsis"]
  ]'::jsonb) loop
    insert into accounts (business_id, code, name, type, system_key)
    values (p_business, (6000 + i * 10)::text, c ->> 1, 'expense', 'exp_' || (c ->> 0))
    returning id into v_account;
    insert into expense_categories (business_id, name, account_id, key, icon, sort)
    values (p_business, c ->> 1, v_account, c ->> 0, c ->> 2, i);
    i := i + 1;
  end loop;
end;
$$;

-- Same system accounts as before; expense categories now come from seed_expense_categories.
create or replace function public.seed_system_accounts(p_business uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a jsonb;
begin
  for a in select * from jsonb_array_elements('[
    ["1000","Cash","asset","cash"],["1010","Card clearing","asset","card_clearing"],
    ["1020","Wallet clearing","asset","wallet_clearing"],["1030","Bank","asset","bank"],
    ["1200","Inventory","asset","inventory"],["1300","Staff advances","asset","staff_advances"],
    ["2000","Supplier payable","liability","supplier_payable"],["2100","Deposits held","liability","deposits_held"],
    ["2200","Tips payable","liability","tips_payable"],["2300","Salaries payable","liability","salaries_payable"],
    ["2400","VAT payable","liability","vat_payable"],
    ["3000","Owner equity","equity","owner_equity"],["3100","Owner drawings","equity","owner_drawings"],
    ["4000","Service revenue","income","service_revenue"],["4100","Product revenue","income","product_revenue"],
    ["4200","Other income","income","other_income"],
    ["5000","Consumables used","expense","consumables_used"],["5100","Cost of goods sold","expense","cost_of_goods_sold"],
    ["5200","Salaries","expense","salaries_expense"],["5300","Commission","expense","commission_expense"],
    ["5400","Cash over/short","expense","cash_over_short"],["5500","Supplies","expense","supplies_expense"]
  ]'::jsonb) loop
    insert into accounts (business_id, code, name, type, system_key)
    values (p_business, a ->> 0, a ->> 1, (a ->> 2)::account_type, a ->> 3);
  end loop;
  perform public.seed_expense_categories(p_business);
end;
$$;

-- Owner: add, rename, re-icon or archive a category. A new category gets its own expense account.
create function public.save_expense_category(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := (p ->> 'business_id')::uuid;
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_name text := btrim(coalesce(p ->> 'name', ''));
  v_member uuid;
  v_account uuid;
  v_code int;
begin
  if not public.has_role(v_business, array['owner']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_member := public.current_member_id(v_business);
  if length(v_name) not between 1 and 40 then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if exists (select 1 from expense_categories where business_id = v_business and lower(name) = lower(v_name)
             and not archived and id is distinct from v_id) then
    raise exception 'category_exists' using errcode = '23505';
  end if;
  if v_id is null then
    select coalesce(max(code::int), 5990) + 10 into v_code from accounts
    where business_id = v_business and code ~ '^6[0-9]{3}$';
    insert into accounts (business_id, code, name, type, system_key)
    values (v_business, v_code::text, v_name, 'expense', 'exp_' || replace(gen_random_uuid()::text, '-', ''))
    returning id into v_account;
    insert into expense_categories (business_id, name, account_id, icon, sort)
    values (v_business, v_name, v_account, coalesce(nullif(p ->> 'icon', ''), 'receipt'), 100)
    returning id into v_id;
  else
    update expense_categories set
      name = v_name,
      icon = coalesce(nullif(p ->> 'icon', ''), icon),
      archived = coalesce((p ->> 'archived')::boolean, archived)
    where id = v_id and business_id = v_business
    returning account_id into v_account;
    if v_account is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    update accounts set name = v_name where id = v_account;
  end if;
  perform public.write_audit(v_business, null, v_member, 'update', 'expense_category', v_id, 'Expense category ' || v_name);
  return v_id;
end;
$$;

-- ── Tables ─────────────────────────────────────────────────────────────────────────────────
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  business_date date not null,
  category_id uuid not null references public.expense_categories (id),
  amount_minor bigint not null check (amount_minor > 0),
  method public.payment_method not null check (method in ('cash', 'card', 'bank')),
  note text check (note is null or length(note) <= 200),
  paid_by_member_id uuid references public.members (id) on delete set null,
  status text not null default 'posted' check (status in ('posted', 'reversed')),
  reverse_reason text,
  reversed_by uuid references public.members (id) on delete set null,
  reversed_at timestamptz,
  client_ref text unique,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index expenses_branch_date_idx on public.expenses (branch_id, business_date desc, created_at desc);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{7,20}$'),
  trn text check (trn is null or trn ~ '^[0-9]{15}$'),
  terms_days int not null default 0 check (terms_days between 0 and 365),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index suppliers_name_idx on public.suppliers (business_id, lower(name)) where active;

create table public.purchase_bills (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id),
  number int not null,
  invoice_ref text check (invoice_ref is null or length(invoice_ref) <= 40),
  bill_date date not null,
  due_date date not null,
  total_minor bigint not null check (total_minor > 0),
  paid_minor bigint not null default 0 check (paid_minor >= 0),
  status text not null default 'unpaid' check (status in ('unpaid', 'partial', 'paid', 'reversed')),
  note text check (note is null or length(note) <= 200),
  reverse_reason text,
  reversed_by uuid references public.members (id) on delete set null,
  reversed_at timestamptz,
  client_ref text unique,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (business_id, number),
  check (paid_minor <= total_minor)
);
create index purchase_bills_supplier_idx on public.purchase_bills (supplier_id, bill_date desc);

create table public.purchase_bill_lines (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.purchase_bills (id) on delete cascade,
  item_id uuid references public.inventory_items (id),
  description text not null check (length(btrim(description)) between 1 and 80),
  qty numeric(12, 3) not null check (qty > 0),
  unit_cost_minor bigint not null check (unit_cost_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  update_stock boolean not null default false,
  check (not update_stock or item_id is not null)
);

create table public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id),
  bill_id uuid references public.purchase_bills (id),
  business_date date not null,
  method public.payment_method not null check (method in ('cash', 'card', 'bank')),
  amount_minor bigint not null check (amount_minor > 0),
  note text check (note is null or length(note) <= 200),
  client_ref text unique,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index supplier_payments_supplier_idx on public.supplier_payments (supplier_id, created_at desc);

-- ── Who reads what (writes only through the functions below) ────────────────────────────
alter table public.expenses enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_bills enable row level security;
alter table public.purchase_bill_lines enable row level security;
alter table public.supplier_payments enable row level security;

create policy "owners and accountants read expenses; cashiers their own" on public.expenses
  for select to authenticated using (
    public.has_role(business_id, array['owner', 'accountant']::public.member_role[])
    or (public.has_role(business_id, array['cashier']::public.member_role[])
        and created_by = public.current_member_id(business_id)));
create policy "front desk reads suppliers" on public.suppliers
  for select to authenticated
  using (public.has_role(business_id, array['owner', 'cashier', 'accountant']::public.member_role[]));
create policy "owners and accountants read bills; cashiers their own" on public.purchase_bills
  for select to authenticated using (
    public.has_role(business_id, array['owner', 'accountant']::public.member_role[])
    or (public.has_role(business_id, array['cashier']::public.member_role[])
        and created_by = public.current_member_id(business_id)));
create policy "bill lines follow their bill" on public.purchase_bill_lines
  for select to authenticated using (exists (select 1 from public.purchase_bills b where b.id = bill_id));
create policy "owners and accountants read supplier payments" on public.supplier_payments
  for select to authenticated
  using (public.has_role(business_id, array['owner', 'accountant']::public.member_role[]));

revoke insert, update, delete, truncate, references, trigger on public.expenses, public.suppliers,
  public.purchase_bills, public.purchase_bill_lines, public.supplier_payments from anon, authenticated;
revoke insert, update, delete on public.expense_categories from anon, authenticated;

-- Money leaving the business: cash from the drawer, card and bank transfers from the bank.
create function public.paid_from_account(p_method public.payment_method) returns text
language sql immutable as $$
  select case p_method when 'cash' then 'cash' else 'bank' end
$$;

-- ── Expenses ───────────────────────────────────────────────────────────────────────────────
-- p: {branch_id, category_id, amount_minor, method, business_date?, note?, paid_by_member_id?, client_ref?}
-- Owner: any method and date in an open period. Cashier: cash, today only (01-PRODUCT §2).
create function public.record_expense(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_member(v_branch, array['owner', 'cashier']::member_role[]);
  v_today date := public.branch_today(v_branch);
  v_date date := coalesce(nullif(p ->> 'business_date', '')::date, v_today);
  v_amount bigint := (p ->> 'amount_minor')::bigint;
  v_method payment_method := nullif(p ->> 'method', '')::payment_method;
  v_ref text := nullif(p ->> 'client_ref', '');
  c expense_categories;
  v_existing expenses;
  v_id uuid;
begin
  if v_ref is not null then
    select * into v_existing from expenses where client_ref = v_ref;
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
  if v_method is null or v_method not in ('cash', 'card', 'bank') then
    raise exception 'invalid_payment' using errcode = '22023';
  end if;
  if v_date > v_today then
    raise exception 'future_date' using errcode = '22023';
  end if;
  if m.role = 'cashier' and (v_method <> 'cash' or v_date <> v_today) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  insert into expenses (business_id, branch_id, business_date, category_id, amount_minor, method, note,
                        paid_by_member_id, client_ref, created_by)
  values (m.business_id, v_branch, v_date, c.id, v_amount, v_method, nullif(btrim(p ->> 'note'), ''),
          coalesce(nullif(p ->> 'paid_by_member_id', '')::uuid, m.id), v_ref, m.id)
  returning id into v_id;

  perform public.post_journal(m.business_id, v_branch, v_date, 'expense', v_id, 'Expense · ' || c.name, m.id,
    jsonb_build_array(
      jsonb_build_object('account', (select system_key from accounts where id = c.account_id), 'debit', v_amount),
      jsonb_build_object('account', public.paid_from_account(v_method), 'credit', v_amount)));
  perform public.write_audit(m.business_id, v_branch, m.id, 'create', 'expense', v_id,
    'Expense ' || c.name || ' · ' || public.fmt_money(v_amount));
  return jsonb_build_object('expense_id', v_id, 'repeated', false);
end;
$$;

-- Owner only. The expense stays; a mirror entry dated today takes it back out of the books.
create function public.reverse_expense(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  e expenses;
  m members;
  c expense_categories;
begin
  select * into e from expenses where id = p_id for update;
  if e.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_member(e.branch_id, array['owner']::member_role[]);
  if e.status <> 'posted' then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  select * into c from expense_categories where id = e.category_id;
  update expenses set status = 'reversed', reverse_reason = btrim(p_reason), reversed_by = m.id, reversed_at = now()
  where id = p_id;
  perform public.post_journal(e.business_id, e.branch_id, public.branch_today(e.branch_id), 'expense_reversal', p_id,
    'Reversed expense · ' || c.name, m.id,
    jsonb_build_array(
      jsonb_build_object('account', public.paid_from_account(e.method), 'debit', e.amount_minor),
      jsonb_build_object('account', (select system_key from accounts where id = c.account_id), 'credit', e.amount_minor)));
  perform public.write_audit(e.business_id, e.branch_id, m.id, 'reverse', 'expense', p_id,
    'Reversed expense ' || c.name || ' · ' || public.fmt_money(e.amount_minor) || ' — ' || btrim(p_reason));
end;
$$;

-- ── Suppliers ──────────────────────────────────────────────────────────────────────────────
-- p: {business_id, id?, name, phone?, trn?, terms_days?, active?}. Owner and cashier add; owner edits.
create function public.save_supplier(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := (p ->> 'business_id')::uuid;
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_member uuid;
  v_name text := btrim(coalesce(p ->> 'name', ''));
begin
  if not public.has_role(v_business, array['owner', 'cashier']::member_role[])
     or (v_id is not null and not public.has_role(v_business, array['owner']::member_role[])) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_member := public.current_member_id(v_business);
  if length(v_name) = 0 then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if exists (select 1 from suppliers where business_id = v_business and active and lower(name) = lower(v_name)
             and id is distinct from v_id) then
    raise exception 'supplier_exists' using errcode = '23505';
  end if;
  if v_id is null then
    insert into suppliers (business_id, name, phone, trn, terms_days)
    values (v_business, v_name, nullif(btrim(p ->> 'phone'), ''), nullif(btrim(p ->> 'trn'), ''),
            coalesce((p ->> 'terms_days')::int, 0))
    returning id into v_id;
  else
    update suppliers set name = v_name, phone = nullif(btrim(p ->> 'phone'), ''), trn = nullif(btrim(p ->> 'trn'), ''),
      terms_days = coalesce((p ->> 'terms_days')::int, terms_days), active = coalesce((p ->> 'active')::boolean, active)
    where id = v_id and business_id = v_business;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;
  perform public.write_audit(v_business, null, v_member, 'update', 'supplier', v_id, 'Supplier ' || v_name);
  return v_id;
end;
$$;

-- ── Supplier payments (owner) ──────────────────────────────────────────────────────────────
-- p: {branch_id, supplier_id, bill_id?, method, amount_minor, business_date?, note?, client_ref?}
create function public.pay_supplier(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_member(v_branch, array['owner']::member_role[]);
  v_today date := public.branch_today(v_branch);
  v_date date := coalesce(nullif(p ->> 'business_date', '')::date, v_today);
  v_amount bigint := (p ->> 'amount_minor')::bigint;
  v_method payment_method := nullif(p ->> 'method', '')::payment_method;
  v_ref text := nullif(p ->> 'client_ref', '');
  s suppliers;
  b purchase_bills;
  v_balance bigint;
  v_id uuid;
begin
  if v_ref is not null and exists (select 1 from supplier_payments where client_ref = v_ref) then
    return jsonb_build_object('payment_id', (select id from supplier_payments where client_ref = v_ref), 'repeated', true);
  end if;
  select * into s from suppliers where id = (p ->> 'supplier_id')::uuid and business_id = m.business_id;
  if s.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if v_method is null or v_method not in ('cash', 'card', 'bank') then
    raise exception 'invalid_payment' using errcode = '22023';
  end if;
  if v_date > v_today then
    raise exception 'future_date' using errcode = '22023';
  end if;
  if nullif(p ->> 'bill_id', '') is not null then
    select * into b from purchase_bills where id = (p ->> 'bill_id')::uuid and supplier_id = s.id for update;
    if b.id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    if b.status = 'reversed' or v_amount > b.total_minor - b.paid_minor then
      raise exception 'invalid_amount' using errcode = '22023';
    end if;
  else
    select coalesce(sum(total_minor) filter (where status <> 'reversed'), 0)
           - coalesce((select sum(amount_minor) from supplier_payments where supplier_id = s.id), 0)
      into v_balance from purchase_bills where supplier_id = s.id;
    if v_amount > v_balance then
      raise exception 'invalid_amount' using errcode = '22023';
    end if;
  end if;

  insert into supplier_payments (business_id, branch_id, supplier_id, bill_id, business_date, method, amount_minor,
                                 note, client_ref, created_by)
  values (m.business_id, v_branch, s.id, b.id, v_date, v_method, v_amount, nullif(btrim(p ->> 'note'), ''), v_ref, m.id)
  returning id into v_id;
  if b.id is not null then
    update purchase_bills set paid_minor = paid_minor + v_amount,
      status = case when paid_minor + v_amount >= total_minor then 'paid' else 'partial' end
    where id = b.id;
  end if;
  perform public.post_journal(m.business_id, v_branch, v_date, 'supplier_payment', v_id,
    'Paid ' || s.name || coalesce(' · bill #' || b.number, ''), m.id,
    jsonb_build_array(jsonb_build_object('account', 'supplier_payable', 'debit', v_amount),
                      jsonb_build_object('account', public.paid_from_account(v_method), 'credit', v_amount)));
  perform public.write_audit(m.business_id, v_branch, m.id, 'create', 'supplier_payment', v_id,
    'Paid ' || s.name || ' ' || public.fmt_money(v_amount));
  return jsonb_build_object('payment_id', v_id, 'repeated', false);
end;
$$;

-- ── Purchase bills ─────────────────────────────────────────────────────────────────────────
-- p: {branch_id, supplier_id, invoice_ref?, bill_date?, note?, client_ref?,
--     lines: [{item_id?, description, qty, unit_cost_minor, update_stock?}],
--     paid_now?: {method, amount_minor}}                                  (paid_now: owner only)
-- Stock lines add stock at their unit cost (weighted average); other lines are supplies.
create function public.post_purchase_bill(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_member(v_branch, array['owner', 'cashier']::member_role[]);
  v_today date := public.branch_today(v_branch);
  v_date date := coalesce(nullif(p ->> 'bill_date', '')::date, v_today);
  v_ref text := nullif(p ->> 'client_ref', '');
  s suppliers;
  l jsonb;
  v_item inventory_items;
  v_qty numeric;
  v_cost bigint;
  v_line bigint;
  v_stock bigint := 0;
  v_other bigint := 0;
  v_level numeric;
  v_number int;
  v_id uuid;
  v_payment jsonb;
begin
  if v_ref is not null and exists (select 1 from purchase_bills where client_ref = v_ref) then
    return jsonb_build_object('bill_id', (select id from purchase_bills where client_ref = v_ref), 'repeated', true);
  end if;
  select * into s from suppliers where id = (p ->> 'supplier_id')::uuid and business_id = m.business_id and active;
  if s.id is null then
    raise exception 'supplier_required' using errcode = '22023';
  end if;
  if jsonb_typeof(p -> 'lines') <> 'array' or jsonb_array_length(p -> 'lines') = 0 then
    raise exception 'lines_required' using errcode = '22023';
  end if;
  if v_date > v_today then
    raise exception 'future_date' using errcode = '22023';
  end if;
  if p ? 'paid_now' and m.role <> 'owner' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('bill_number:' || m.business_id::text, 0));
  select coalesce(max(number), 0) + 1 into v_number from purchase_bills where business_id = m.business_id;
  insert into purchase_bills (business_id, branch_id, supplier_id, number, invoice_ref, bill_date, due_date, total_minor,
                              note, client_ref, created_by)
  values (m.business_id, v_branch, s.id, v_number, nullif(btrim(p ->> 'invoice_ref'), ''), v_date,
          v_date + s.terms_days, 1, nullif(btrim(p ->> 'note'), ''), v_ref, m.id)
  returning id into v_id;

  for l in select * from jsonb_array_elements(p -> 'lines') loop
    v_qty := (l ->> 'qty')::numeric;
    v_cost := (l ->> 'unit_cost_minor')::bigint;
    if v_qty is null or v_qty <= 0 or v_cost is null or v_cost < 0 then
      raise exception 'invalid_line' using errcode = '22023';
    end if;
    v_line := round(v_qty * v_cost)::bigint;
    v_item := null;
    if nullif(l ->> 'item_id', '') is not null then
      select * into v_item from inventory_items where id = (l ->> 'item_id')::uuid and business_id = m.business_id;
      if v_item.id is null then
        raise exception 'not_found' using errcode = 'P0002';
      end if;
    end if;
    insert into purchase_bill_lines (bill_id, item_id, description, qty, unit_cost_minor, total_minor, update_stock)
    values (v_id, v_item.id, coalesce(nullif(btrim(l ->> 'description'), ''), v_item.name), v_qty, v_cost, v_line,
            v_item.id is not null and coalesce((l ->> 'update_stock')::boolean, true));
    if v_item.id is not null and coalesce((l ->> 'update_stock')::boolean, true) then
      insert into stock_levels (item_id, branch_id, qty) values (v_item.id, v_branch, 0) on conflict do nothing;
      select qty into v_level from stock_levels where item_id = v_item.id and branch_id = v_branch for update;
      update stock_levels set qty = qty + v_qty where item_id = v_item.id and branch_id = v_branch;
      update inventory_items set avg_unit_cost_minor =
        case when greatest(v_level, 0) + v_qty > 0
             then (greatest(v_level, 0) * avg_unit_cost_minor + v_qty * v_cost) / (greatest(v_level, 0) + v_qty)
             else v_cost end
      where id = v_item.id;
      insert into stock_movements (business_id, branch_id, item_id, qty_delta, reason, unit_cost_minor, ref_type, ref_id,
                                   created_by)
      values (m.business_id, v_branch, v_item.id, v_qty, 'purchase', v_cost, 'purchase_bill', v_id, m.id);
      v_stock := v_stock + v_line;
    else
      v_other := v_other + v_line;
    end if;
  end loop;
  if v_stock + v_other <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  update purchase_bills set total_minor = v_stock + v_other where id = v_id;

  perform public.post_journal(m.business_id, v_branch, v_date, 'purchase_bill', v_id,
    'Bill #' || v_number || ' · ' || s.name, m.id,
    jsonb_build_array(jsonb_build_object('account', 'inventory', 'debit', v_stock),
                      jsonb_build_object('account', 'supplies_expense', 'debit', v_other),
                      jsonb_build_object('account', 'supplier_payable', 'credit', v_stock + v_other)));
  perform public.write_audit(m.business_id, v_branch, m.id, 'create', 'purchase_bill', v_id,
    'Bill #' || v_number || ' from ' || s.name || ' · ' || public.fmt_money(v_stock + v_other));

  if p ? 'paid_now' and coalesce((p #>> '{paid_now,amount_minor}')::bigint, 0) > 0 then
    v_payment := public.pay_supplier(jsonb_build_object(
      'branch_id', v_branch, 'supplier_id', s.id, 'bill_id', v_id, 'business_date', v_date,
      'method', p #>> '{paid_now,method}', 'amount_minor', (p #>> '{paid_now,amount_minor}')::bigint));
  end if;
  return jsonb_build_object('bill_id', v_id, 'number', v_number, 'total_minor', v_stock + v_other, 'repeated', false);
end;
$$;

-- Owner only, and only for a bill with nothing paid: the mirror entry takes it out of the books and
-- the stock it added back out of stock. The bill stays, marked reversed with the reason.
create function public.reverse_purchase_bill(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  b purchase_bills;
  m members;
  l purchase_bill_lines;
  v_stock bigint := 0;
  v_other bigint := 0;
begin
  select * into b from purchase_bills where id = p_id for update;
  if b.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_member(b.branch_id, array['owner']::member_role[]);
  if b.status = 'reversed' then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if b.paid_minor > 0 then
    raise exception 'bill_has_payments' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  for l in select * from purchase_bill_lines where bill_id = p_id loop
    if l.update_stock then
      update stock_levels set qty = qty - l.qty where item_id = l.item_id and branch_id = b.branch_id;
      insert into stock_movements (business_id, branch_id, item_id, qty_delta, reason, unit_cost_minor, ref_type, ref_id,
                                   created_by)
      values (b.business_id, b.branch_id, l.item_id, -l.qty, 'reversal', l.unit_cost_minor, 'purchase_bill', p_id, m.id);
      v_stock := v_stock + l.total_minor;
    else
      v_other := v_other + l.total_minor;
    end if;
  end loop;
  update purchase_bills set status = 'reversed', reverse_reason = btrim(p_reason), reversed_by = m.id, reversed_at = now()
  where id = p_id;
  perform public.post_journal(b.business_id, b.branch_id, public.branch_today(b.branch_id), 'purchase_bill_reversal', p_id,
    'Reversed bill #' || b.number, m.id,
    jsonb_build_array(jsonb_build_object('account', 'supplier_payable', 'debit', v_stock + v_other),
                      jsonb_build_object('account', 'inventory', 'credit', v_stock),
                      jsonb_build_object('account', 'supplies_expense', 'credit', v_other)));
  perform public.write_audit(b.business_id, b.branch_id, m.id, 'reverse', 'purchase_bill', p_id,
    'Reversed bill #' || b.number || ' — ' || btrim(p_reason));
end;
$$;

-- Supplier list with what is owed (bills not reversed − payments) and how much is overdue.
create function public.supplier_balances(p_business uuid)
returns table (supplier_id uuid, name text, phone text, terms_days int, balance_minor bigint, overdue_minor bigint,
               open_bills int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(p_business, array['owner', 'accountant']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select s.id, s.name, s.phone, s.terms_days,
      (coalesce((select sum(b.total_minor) from purchase_bills b where b.supplier_id = s.id and b.status <> 'reversed'), 0)
       - coalesce((select sum(sp.amount_minor) from supplier_payments sp where sp.supplier_id = s.id), 0))::bigint,
      coalesce((select sum(b.total_minor - b.paid_minor) from purchase_bills b
                where b.supplier_id = s.id and b.status in ('unpaid', 'partial')
                  and b.due_date < (select public.branch_today(b.branch_id))), 0)::bigint,
      (select count(*)::int from purchase_bills b where b.supplier_id = s.id and b.status in ('unpaid', 'partial'))
    from suppliers s
    where s.business_id = p_business and s.active
    order by s.name;
end;
$$;

revoke execute on function public.seed_expense_categories(uuid), public.save_expense_category(jsonb),
  public.record_expense(jsonb), public.reverse_expense(uuid, text), public.save_supplier(jsonb),
  public.pay_supplier(jsonb), public.post_purchase_bill(jsonb), public.reverse_purchase_bill(uuid, text),
  public.supplier_balances(uuid), public.paid_from_account(public.payment_method) from public, anon;
grant execute on function public.save_expense_category(jsonb), public.record_expense(jsonb),
  public.reverse_expense(uuid, text), public.save_supplier(jsonb), public.pay_supplier(jsonb),
  public.post_purchase_bill(jsonb), public.reverse_purchase_bill(uuid, text), public.supplier_balances(uuid)
  to authenticated;

alter publication supabase_realtime add table public.expenses, public.purchase_bills, public.supplier_payments,
  public.suppliers, public.expense_categories;
