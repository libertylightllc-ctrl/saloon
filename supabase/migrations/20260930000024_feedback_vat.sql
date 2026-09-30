-- Owner feedback 2026-09-30 (docs/DECISIONS.md):
--  1. A service's time is optional (the queue counts a service without one as no extra time; an appointment of only
--     such services still holds 30 minutes, as before).
--  3. Purchase lines are entered as a quantity and what was paid for it (100 ml for AED 45.00); the cost per unit
--     (per ml, g, piece) is worked out to 4 decimals of a fil for the stock value.
--  5. VAT on supplier bills and expenses (input VAT, recoverable) for VAT-registered salons: a new asset account
--     "VAT recoverable" (1400); the goods or cost are recorded without the VAT.
--  6. The VAT report: output VAT (sales less refunds) − input VAT (bills and expenses) = VAT due for the month.

alter table public.services alter column duration_min drop not null;

alter table public.purchase_bill_lines alter column unit_cost_minor type numeric(14, 4);
alter table public.purchase_bills add column vat_minor bigint not null default 0 check (vat_minor >= 0);
alter table public.expenses add column vat_minor bigint not null default 0 check (vat_minor >= 0);
alter table public.expenses add constraint expenses_vat_within check (vat_minor < amount_minor);

-- Every salon gets the input VAT account (new salons get it from seed_system_accounts below).
insert into public.accounts (business_id, code, name, type, system_key)
select b.id, '1400', 'VAT recoverable', 'asset', 'vat_receivable' from public.businesses b
where not exists (select 1 from public.accounts a where a.business_id = b.id and a.system_key = 'vat_receivable');

CREATE OR REPLACE FUNCTION public.create_appointment(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    v_duration := v_duration + coalesce(s.duration_min, 0) + s.buffer_min;
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
  select v_id, s2.id, s2.name, v_employee, coalesce(s2.duration_min, 0), s2.price_minor
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
$function$;

CREATE OR REPLACE FUNCTION public.post_purchase_bill(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_cost numeric;
  v_vat bigint := coalesce(nullif(p ->> 'vat_minor', '')::bigint, 0);
  v_vat_mode vat_mode := (select vat_mode from branches where id = v_branch);
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
  -- Input VAT on a supplier's tax invoice (recoverable) only when the salon is VAT-registered.
  if v_vat < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if v_vat > 0 and v_vat_mode <> 'on' then
    raise exception 'vat_off' using errcode = '22023';
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
    -- A line is its quantity and what was paid for it (100 ml for AED 45.00); the cost per unit follows. Older
    -- callers may still send a unit cost.
    if l ? 'total_minor' then
      v_line := (l ->> 'total_minor')::bigint;
      v_cost := case when v_qty > 0 then round(v_line / v_qty, 4) end;
    else
      v_cost := (l ->> 'unit_cost_minor')::numeric;
      v_line := round(v_qty * v_cost)::bigint;
    end if;
    if v_qty is null or v_qty <= 0 or v_cost is null or v_cost < 0 or v_line is null or v_line < 0 then
      raise exception 'invalid_line' using errcode = '22023';
    end if;
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
  if v_stock + v_other <= 0 or v_vat > v_stock + v_other then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  update purchase_bills set total_minor = v_stock + v_other + v_vat, vat_minor = v_vat where id = v_id;

  perform public.post_journal(m.business_id, v_branch, v_date, 'purchase_bill', v_id,
    'Bill #' || v_number || ' · ' || s.name, m.id,
    jsonb_build_array(jsonb_build_object('account', 'inventory', 'debit', v_stock),
                      jsonb_build_object('account', 'supplies_expense', 'debit', v_other),
                      jsonb_build_object('account', 'vat_receivable', 'debit', v_vat),
                      jsonb_build_object('account', 'supplier_payable', 'credit', v_stock + v_other + v_vat)));
  perform public.write_audit(m.business_id, v_branch, m.id, 'create', 'purchase_bill', v_id,
    'Bill #' || v_number || ' from ' || s.name || ' · ' || public.fmt_money(v_stock + v_other + v_vat));

  if p ? 'paid_now' and coalesce((p #>> '{paid_now,amount_minor}')::bigint, 0) > 0 then
    v_payment := public.pay_supplier(jsonb_build_object(
      'branch_id', v_branch, 'supplier_id', s.id, 'bill_id', v_id, 'business_date', v_date,
      'method', p #>> '{paid_now,method}', 'amount_minor', (p #>> '{paid_now,amount_minor}')::bigint));
  end if;
  return jsonb_build_object('bill_id', v_id, 'number', v_number, 'total_minor', v_stock + v_other + v_vat, 'vat_minor', v_vat,
    'repeated', false);
end;
$function$;

CREATE OR REPLACE FUNCTION public.reverse_purchase_bill(p_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    jsonb_build_array(jsonb_build_object('account', 'supplier_payable', 'debit', v_stock + v_other + b.vat_minor),
                      jsonb_build_object('account', 'inventory', 'credit', v_stock),
                      jsonb_build_object('account', 'supplies_expense', 'credit', v_other),
                      jsonb_build_object('account', 'vat_receivable', 'credit', b.vat_minor)));
  perform public.write_audit(b.business_id, b.branch_id, m.id, 'reverse', 'purchase_bill', p_id,
    'Reversed bill #' || b.number || ' — ' || btrim(p_reason));
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_expense(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_member(v_branch, array['owner', 'cashier']::member_role[]);
  v_today date := public.branch_today(v_branch);
  v_date date := coalesce(nullif(p ->> 'business_date', '')::date, v_today);
  v_amount bigint := (p ->> 'amount_minor')::bigint;
  v_method payment_method := nullif(p ->> 'method', '')::payment_method;
  v_ref text := nullif(p ->> 'client_ref', '');
  v_vat bigint := coalesce(nullif(p ->> 'vat_minor', '')::bigint, 0);
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
  if m.role = 'cashier' and (v_method <> 'cash' or v_date <> v_today) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  insert into expenses (business_id, branch_id, business_date, category_id, amount_minor, vat_minor, method, note,
                        paid_by_member_id, client_ref, created_by)
  values (m.business_id, v_branch, v_date, c.id, v_amount, v_vat, v_method, nullif(btrim(p ->> 'note'), ''),
          coalesce(nullif(p ->> 'paid_by_member_id', '')::uuid, m.id), v_ref, m.id)
  returning id into v_id;

  perform public.post_journal(m.business_id, v_branch, v_date, 'expense', v_id, 'Expense · ' || c.name, m.id,
    jsonb_build_array(
      jsonb_build_object('account', (select system_key from accounts where id = c.account_id), 'debit', v_amount - v_vat),
      jsonb_build_object('account', 'vat_receivable', 'debit', v_vat),
      jsonb_build_object('account', public.paid_from_account(v_method), 'credit', v_amount)));
  perform public.write_audit(m.business_id, v_branch, m.id, 'create', 'expense', v_id,
    'Expense ' || c.name || ' · ' || public.fmt_money(v_amount));
  return jsonb_build_object('expense_id', v_id, 'repeated', false);
end;
$function$;

CREATE OR REPLACE FUNCTION public.reverse_expense(p_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      jsonb_build_object('account', (select system_key from accounts where id = c.account_id), 'credit', e.amount_minor - e.vat_minor),
      jsonb_build_object('account', 'vat_receivable', 'credit', e.vat_minor)));
  perform public.write_audit(e.business_id, e.branch_id, m.id, 'reverse', 'expense', p_id,
    'Reversed expense ' || c.name || ' · ' || public.fmt_money(e.amount_minor) || ' — ' || btrim(p_reason));
end;
$function$;

CREATE OR REPLACE FUNCTION public.seed_system_accounts(p_business uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  a jsonb;
begin
  for a in select * from jsonb_array_elements('[
    ["1000","Cash","asset","cash"],["1010","Card clearing","asset","card_clearing"],
    ["1020","Wallet clearing","asset","wallet_clearing"],["1030","Bank","asset","bank"],
    ["1200","Inventory","asset","inventory"],["1300","Staff advances","asset","staff_advances"],
    ["1400","VAT recoverable","asset","vat_receivable"],
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
$function$;

-- The VAT report for a branch and month, from the books: each kind of entry that carried VAT, its taxable amount
-- (the sale or cost without VAT) and the VAT. Output VAT: sales less refunds. Input VAT: supplier bills and expenses,
-- less their reversals. Always four rows, so the report reads the same every month.
create function public.report_vat(p_branch uuid, p_month text)
returns table (kind text, entries int, taxable_minor bigint, vat_minor bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner', 'accountant']::member_role[]);
  b record := public.month_bounds(p_month);
begin
  return query
    with e as (
      select je.source_type,
             sum(case when a.system_key = 'vat_payable' then l.credit_minor - l.debit_minor else 0 end) as vat_out,
             sum(case when a.system_key = 'vat_receivable' then l.debit_minor - l.credit_minor else 0 end) as vat_in,
             sum(case when a.type = 'income' then l.credit_minor - l.debit_minor else 0 end) as base_out,
             sum(case when a.type = 'expense' or a.system_key = 'inventory' then l.debit_minor - l.credit_minor else 0 end)
               as base_in,
             bool_or(a.system_key in ('vat_payable', 'vat_receivable')) as has_vat
      from journal_entries je
      join journal_lines l on l.entry_id = je.id
      join accounts a on a.id = l.account_id
      where je.business_id = m.business_id and je.branch_id = p_branch
        and je.business_date between b.d_from and b.d_to
      group by je.id, je.source_type
    ),
    k(kind, sort, sources, output) as (values
      ('sales', 1, array['sale'], true), ('refunds', 2, array['refund'], true),
      ('purchases', 3, array['purchase_bill', 'purchase_bill_reversal'], false),
      ('expenses', 4, array['expense', 'expense_reversal'], false))
    select k.kind, count(e.source_type)::int,
           coalesce(sum(case when k.output then e.base_out else e.base_in end), 0)::bigint,
           coalesce(sum(case when k.output then e.vat_out else e.vat_in end), 0)::bigint
    from k left join e on e.source_type = any (k.sources) and e.has_vat
    group by k.kind, k.sort
    order by k.sort;
end;
$$;
revoke execute on function public.report_vat(uuid, text) from public, anon;
grant execute on function public.report_vat(uuid, text) to authenticated;
