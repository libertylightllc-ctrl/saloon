-- Security review, second part (owner's platform audit, 2026-10-04): three reviewers read every privileged function a
-- signed-in person can call. Fixed here:
--  · Quick sale: each line's staff member and the tip's must work at the branch (another salon's employee could be put
--    on a line, read their commission rate and add commission to that salon's payroll); commission and the staff
--    "me" figures count only their own salon's sales.
--  · Staff add walk-ins only (bookings and deposits are for the owner and cashier, 01-PRODUCT §2).
--  · Cashiers see no staff commission on Home (no payroll for cashiers).
--  · Repeat-request checks (client_ref / idempotency_key) look only in the caller's salon; payroll adjustments check
--    the owner first.
--  · An expense's "paid by" is the caller, or for the owner an active member of the salon.
--  · A phone's push token moves only between logins of the same salon.
--  · Removed logins write no access history; "counted by" works at the branch; only the platform marks a salon as
--    a demo. (Opening stock may be saved again on purpose: it adds stock, DECISIONS 2026-09-27.)

create or replace function public.create_sale(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_member(v_branch, array['owner', 'cashier', 'staff']::member_role[]);
  b branches;
  bu businesses;
  v_ref text := nullif(p ->> 'client_ref', '');
  v_existing sales;
  a appointments;
  v_customer customers;
  v_default_employee uuid;
  l jsonb;
  v_idx int := 0;
  v_kind text;
  v_qty numeric;
  v_name text;
  v_price bigint;
  v_service services;
  v_item inventory_items;
  v_subtotal bigint;
  v_discount bigint;
  v_net bigint;
  v_vat bigint;
  v_tip bigint := coalesce((p ->> 'tip_minor')::bigint, 0);
  v_total bigint;
  v_deposit bigint := 0;
  v_deposit_left bigint := 0;
  v_due bigint;
  v_paid bigint := 0;
  pay jsonb;
  v_sale uuid;
  v_number int;
  v_today date;
  v_weights bigint[];
  v_parts bigint[];
  r record;
  v_used numeric;
  v_level numeric;
  v_cost bigint := 0;
  v_cogs bigint := 0;
  v_product bigint;
  v_warnings text[] := '{}';
  v_shortages text[] := '{}';
  v_block boolean;
  v_journal jsonb := '[]';
  v_line_employee uuid;
  v_tip_employee uuid;
begin
  if v_ref is not null then
    select * into v_existing from sales where client_ref = v_ref and business_id = m.business_id;
    if v_existing.id is not null then
      return jsonb_build_object('sale_id', v_existing.id, 'number', v_existing.number,
        'total_minor', v_existing.total_minor, 'vat_minor', v_existing.vat_minor,
        'deposit_applied_minor', v_existing.deposit_applied_minor, 'warnings', '[]'::jsonb, 'repeated', true);
    end if;
  end if;

  select * into b from branches where id = v_branch;
  select * into bu from businesses where id = b.business_id;
  v_today := public.branch_today(v_branch);
  if m.role = 'staff' and not coalesce((b.settings ->> 'staff_can_sell')::boolean, false) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if nullif(p ->> 'appointment_id', '') is not null then
    select * into a from appointments where id = (p ->> 'appointment_id')::uuid and branch_id = v_branch for update;
    if a.id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    if a.status not in ('booked', 'waiting', 'in_progress') then
      raise exception 'invalid_status' using errcode = '22023';
    end if;
  end if;

  if nullif(p ->> 'customer_id', '') is not null or a.customer_id is not null then
    select * into v_customer from customers
    where id = coalesce(nullif(p ->> 'customer_id', '')::uuid, a.customer_id) and business_id = b.business_id;
    if v_customer.id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;

  v_default_employee := coalesce(nullif(p ->> 'employee_id', '')::uuid, a.employee_id,
    (select id from employees where member_id = m.id and active));
  if v_default_employee is not null
     and not exists (select 1 from employees where id = v_default_employee and branch_id = v_branch) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  drop table if exists _sale_lines;
  create temp table _sale_lines (
    idx int, kind sale_line_kind, service_id uuid, item_id uuid, name text, qty numeric, unit_price bigint, gross bigint,
    discount bigint default 0, net bigint default 0, vat bigint default 0, employee_id uuid,
    commission_bps int default 0, commission bigint default 0
  ) on commit drop;

  for l in select * from jsonb_array_elements(coalesce(p -> 'lines', '[]')) loop
    v_idx := v_idx + 1;
    v_kind := coalesce(nullif(l ->> 'kind', ''), 'service');
    v_qty := coalesce((l ->> 'qty')::numeric, 1);
    if v_qty <= 0 then
      raise exception 'invalid_qty' using errcode = '22023';
    end if;
    if v_kind = 'service' then
      select * into v_service from services
      where id = (l ->> 'service_id')::uuid and business_id = b.business_id and status = 'active';
      if v_service.id is null then
        raise exception 'service_unavailable' using errcode = '22023';
      end if;
      v_name := v_service.name;
      v_price := v_service.price_minor;
      v_item := null;
    elsif v_kind = 'retail' then
      select * into v_item from inventory_items
      where id = (l ->> 'item_id')::uuid and business_id = b.business_id and kind = 'retail' and active
        and sell_price_minor is not null;
      if v_item.id is null then
        raise exception 'item_unavailable' using errcode = '22023';
      end if;
      v_name := v_item.name;
      v_price := v_item.sell_price_minor;
      v_service := null;
    elsif v_kind = 'custom' then
      v_name := nullif(btrim(l ->> 'name'), '');
      v_price := (l ->> 'unit_price_minor')::bigint;
      if v_name is null or v_price is null or v_price < 0 then
        raise exception 'invalid_line' using errcode = '22023';
      end if;
      v_service := null;
      v_item := null;
    else
      raise exception 'invalid_line' using errcode = '22023';
    end if;
    -- Whoever did the line works at this branch (their commission and payroll follow the line).
    v_line_employee := coalesce(nullif(l ->> 'employee_id', '')::uuid, v_default_employee);
    if v_line_employee is not null
       and not exists (select 1 from employees where id = v_line_employee and branch_id = v_branch) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    insert into _sale_lines (idx, kind, service_id, item_id, name, qty, unit_price, gross, employee_id)
    values (v_idx, v_kind::sale_line_kind, v_service.id, v_item.id, v_name, v_qty, v_price, round(v_price * v_qty)::bigint,
            v_line_employee);
  end loop;
  if v_idx = 0 then
    raise exception 'lines_required' using errcode = '22023';
  end if;

  select sum(gross) into v_subtotal from _sale_lines;
  if p ? 'discount_bps' and (p ->> 'discount_bps') is not null then
    if (p ->> 'discount_bps')::int not between 0 and 10000 then
      raise exception 'invalid_discount' using errcode = '22023';
    end if;
    v_discount := round(v_subtotal * (p ->> 'discount_bps')::numeric / 10000)::bigint;
  else
    v_discount := coalesce((p ->> 'discount_minor')::bigint, 0);
  end if;
  if v_discount < 0 or v_discount > v_subtotal then
    raise exception 'invalid_discount' using errcode = '22023';
  end if;
  if v_tip < 0 then
    raise exception 'invalid_tip' using errcode = '22023';
  end if;
  v_tip_employee := case when v_tip > 0 then coalesce(nullif(p ->> 'tip_employee_id', '')::uuid, v_default_employee) end;
  if v_tip_employee is not null and not exists (select 1 from employees where id = v_tip_employee and branch_id = v_branch) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  -- Spread the discount over the lines, then the tax over the nets: at the branch's rate, either contained in the
  -- prices (5% VAT: 5/105 of the net) or added on top (8% sales tax: 8% of the net). Added tax then becomes part of
  -- each line's net, exactly like included tax, so totals, the journal, commission (on net less tax) and refunds
  -- work the same way for both.
  select array_agg(gross order by idx) into v_weights from _sale_lines;
  v_parts := public.allocate_minor(v_discount, v_weights);
  update _sale_lines set discount = v_parts[idx], net = gross - v_parts[idx] where true;
  v_net := v_subtotal - v_discount;
  v_vat := case when b.vat_mode <> 'on' or b.tax_rate_bps = 0 then 0
                when b.tax_inclusive then round(v_net * b.tax_rate_bps::numeric / (10000 + b.tax_rate_bps))::bigint
                else round(v_net * b.tax_rate_bps::numeric / 10000)::bigint end;
  select array_agg(net order by idx) into v_weights from _sale_lines;
  v_parts := public.allocate_minor(v_vat, v_weights);
  update _sale_lines set vat = v_parts[idx] where true;
  if b.vat_mode = 'on' and not b.tax_inclusive then
    update _sale_lines set net = net + vat where true;
    v_net := v_net + v_vat;
  end if;
  update _sale_lines sl set
    commission_bps = coalesce(e.commission_bps, 0),
    commission = round((sl.net - sl.vat) * coalesce(e.commission_bps, 0)::numeric / 10000)::bigint
  from employees e where e.id = sl.employee_id and sl.kind <> 'retail';   -- commission is on services only

  v_total := v_net + v_tip;
  if a.id is not null and a.deposit_status = 'held' and coalesce((p ->> 'use_deposit')::boolean, true) then
    v_deposit := least(a.deposit_minor, v_total);
    v_deposit_left := a.deposit_minor - v_deposit;
  end if;
  v_due := v_total - v_deposit;

  for pay in select * from jsonb_array_elements(coalesce(p -> 'payments', '[]')) loop
    if (pay ->> 'method') not in ('cash', 'card', 'wallet') or coalesce((pay ->> 'amount_minor')::bigint, 0) <= 0 then
      raise exception 'invalid_payment' using errcode = '22023';
    end if;
    v_paid := v_paid + (pay ->> 'amount_minor')::bigint;
  end loop;
  if v_paid <> v_due then
    raise exception 'payment_mismatch: due % paid %', v_due, v_paid using errcode = '22023';
  end if;

  update sale_counters set next_number = next_number + 1 where branch_id = v_branch
  returning next_number - 1 into v_number;

  insert into sales (business_id, branch_id, number, business_date, customer_id, customer_name, appointment_id,
                     employee_id, subtotal_minor, discount_minor, vat_minor, tip_minor, tip_employee_id,
                     total_minor, deposit_applied_minor, vat_mode, tax_rate_bps, tax_inclusive, note, client_ref,
                     created_by)
  values (b.business_id, v_branch, v_number, v_today, v_customer.id,
          coalesce(v_customer.name, a.customer_name), a.id, v_default_employee, v_subtotal, v_discount, v_vat, v_tip,
          v_tip_employee,
          v_total, v_deposit, b.vat_mode, b.tax_rate_bps, b.tax_inclusive, nullif(btrim(p ->> 'note'), ''), v_ref, m.id)
  returning id into v_sale;

  insert into sale_lines (sale_id, kind, service_id, item_id, name_snapshot, qty, unit_price_minor, discount_minor,
                          net_minor, vat_minor, employee_id, commission_bps, commission_minor)
  select v_sale, kind, service_id, item_id, name, qty, unit_price, discount, net, vat, employee_id, commission_bps, commission
  from _sale_lines order by idx;

  insert into sale_payments (sale_id, method, amount_minor)
  select v_sale, (x ->> 'method')::payment_method, (x ->> 'amount_minor')::bigint
  from jsonb_array_elements(coalesce(p -> 'payments', '[]')) x;

  -- Stock: recipe use for services, the item itself for retail. Shortage warns, or blocks when the branch
  -- setting says so.
  v_block := coalesce((b.settings ->> 'block_insufficient_stock')::boolean, false);
  for r in
    select x.item_id, i.name, i.avg_unit_cost_minor, x.reason, sum(x.used) as used
    from (select ri.item_id, 'service_use'::stock_reason as reason, ri.qty * sl.qty as used
          from _sale_lines sl join service_recipe_items ri on ri.service_id = sl.service_id
          union all
          select sl.item_id, 'retail_sale'::stock_reason, sl.qty from _sale_lines sl where sl.kind = 'retail') x
    join inventory_items i on i.id = x.item_id
    group by x.item_id, i.name, i.avg_unit_cost_minor, x.reason
  loop
    insert into stock_levels (item_id, branch_id, qty) values (r.item_id, v_branch, 0) on conflict do nothing;
    select qty into v_level from stock_levels where item_id = r.item_id and branch_id = v_branch for update;
    if v_level < r.used then
      v_shortages := v_shortages || r.name;
    end if;
    update stock_levels set qty = qty - r.used where item_id = r.item_id and branch_id = v_branch;
    insert into stock_movements (business_id, branch_id, item_id, qty_delta, reason, unit_cost_minor, ref_type, ref_id,
                                 created_by)
    values (b.business_id, v_branch, r.item_id, -r.used, r.reason, r.avg_unit_cost_minor, 'sale', v_sale, m.id);
    if r.reason = 'retail_sale' then
      v_cogs := v_cogs + round(r.used * r.avg_unit_cost_minor)::bigint;
    else
      v_cost := v_cost + round(r.used * r.avg_unit_cost_minor)::bigint;
    end if;
  end loop;
  if array_length(v_shortages, 1) > 0 then
    if v_block then
      raise exception 'insufficient_stock: %', array_to_string(v_shortages, ', ') using errcode = '22023';
    end if;
    v_warnings := v_warnings || ('low_stock: ' || array_to_string(v_shortages, ', '));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('account', public.method_account((x ->> 'method')::payment_method),
                                               'debit', (x ->> 'amount_minor')::bigint)), '[]')
    into v_journal
  from jsonb_array_elements(coalesce(p -> 'payments', '[]')) x;
  select coalesce(sum(net - vat) filter (where kind = 'retail'), 0) into v_product from _sale_lines;
  v_journal := v_journal
    || jsonb_build_array(
         jsonb_build_object('account', 'deposits_held', 'debit', v_deposit),
         jsonb_build_object('account', 'service_revenue', 'credit', v_net - v_vat - v_product),
         jsonb_build_object('account', 'product_revenue', 'credit', v_product),
         jsonb_build_object('account', 'vat_payable', 'credit', v_vat),
         jsonb_build_object('account', 'tips_payable', 'credit', v_tip),
         jsonb_build_object('account', 'consumables_used', 'debit', v_cost),
         jsonb_build_object('account', 'inventory', 'credit', v_cost),
         jsonb_build_object('account', 'cost_of_goods_sold', 'debit', v_cogs),
         jsonb_build_object('account', 'inventory', 'credit', v_cogs));
  perform public.post_journal(b.business_id, v_branch, v_today, 'sale', v_sale, 'Sale #' || v_number, m.id, v_journal);

  if v_deposit_left > 0 then
    -- Deposit larger than the bill: the rest goes back the way it came.
    perform public.post_journal(b.business_id, v_branch, v_today, 'deposit_refund', a.id, 'Deposit above bill', m.id,
      jsonb_build_array(jsonb_build_object('account', 'deposits_held', 'debit', v_deposit_left),
                        jsonb_build_object('account', public.method_account(a.deposit_method), 'credit', v_deposit_left)));
  end if;

  if v_customer.id is not null then
    update customers set visit_count = visit_count + 1, last_visit_at = now() where id = v_customer.id;
  end if;
  if a.id is not null then
    update appointments set status = 'completed', completed_at = now(), sale_id = v_sale, updated_at = now(),
      started_at = coalesce(started_at, now()),
      deposit_status = case when v_deposit > 0 then 'applied' else deposit_status end
    where id = a.id;
  end if;

  perform public.write_audit(b.business_id, v_branch, m.id, 'create', 'sale', v_sale,
    'Saved sale #' || v_number || ' · ' || public.fmt_money(v_total, bu.currency));

  return jsonb_build_object('sale_id', v_sale, 'number', v_number, 'total_minor', v_total, 'vat_minor', v_vat,
    'deposit_applied_minor', v_deposit, 'due_minor', v_due, 'warnings', to_jsonb(v_warnings), 'repeated', false);
end;
$$;

create or replace function public.commission_for(p_employee uuid, p_period text)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  select coalesce(sum(round(sl.commission_minor::numeric * (s.total_minor - s.refunded_minor)
                            / nullif(s.total_minor, 0))), 0)::bigint
  from sale_lines sl join sales s on s.id = sl.sale_id
  where sl.employee_id = p_employee and to_char(s.business_date, 'YYYY-MM') = p_period
    and s.business_id = (select business_id from employees where id = p_employee)
$$;

create or replace function public.dashboard_today(p_branch uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  m members := public.require_member(p_branch, array['owner', 'cashier', 'staff', 'accountant']::member_role[]);
  b branches;
  v_today date := public.branch_today(p_branch);
  v_front boolean := m.role in ('owner', 'cashier', 'accountant');
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
      -- Stock (…013): items at or below their reorder level; tools that need a service within a week.
      'stock', (select jsonb_build_object(
          'low', count(*) filter (where x.low),
          'low_items', coalesce(jsonb_agg(x.name order by x.qty) filter (where x.low), '[]'),
          'tools_due', count(*) filter (where x.kind = 'tool' and (x.condition = 'needs_service'
                                          or x.next_service_date <= v_today + 7)))
        from (select i.name, i.kind, i.condition, i.next_service_date, coalesce(sl.qty, 0) as qty,
                     i.kind <> 'tool' and i.reorder_level > 0 and coalesce(sl.qty, 0) <= i.reorder_level as low
              from inventory_items i
              left join stock_levels sl on sl.item_id = i.id and sl.branch_id = p_branch
              where i.business_id = b.business_id and i.active) x),
      'expected_cash', public.expected_cash(p_branch, v_today),
      'expected_cash_yesterday', public.expected_cash(p_branch, v_today - 1),
      'sales', (select jsonb_build_object(
          'count', count(*),
          'total_minor', coalesce(sum(total_minor), 0),
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
            (select sum(total_minor) from sales where branch_id = p_branch and business_date = d::date), 0))
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
            'commission_minor', case when m.role = 'cashier' then null else coalesce(x.commission_minor, 0) end,
            'busy', exists (select 1 from appointments ap where ap.employee_id = e.id and ap.status = 'in_progress'))
            order by coalesce(x.sales_minor, 0) desc, e.full_name)
          from employees e
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
          'expired', count(*) filter (where status in ('expired', 'missing'))) from public.compliance_status(b.business_id)) end,
      'hygiene_signed', case when m.role in ('owner', 'cashier')
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

  if m.role in ('owner', 'cashier', 'staff') then
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
      'commission_month_minor', coalesce((select sum(sl.commission_minor) from sale_lines sl
         join sales s on s.id = sl.sale_id
         where sl.employee_id = v_me and s.business_id = m.business_id
           and date_trunc('month', s.business_date) = date_trunc('month', v_today)), 0)));
  end if;

  return out;
end;
$$;

create or replace function public.create_appointment(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
  if m.role = 'staff' and v_kind <> 'walk_in' then
    raise exception 'not_allowed' using errcode = '42501';
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
$$;

create or replace function public.adjust_stock(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_member(v_branch, array['owner']::member_role[]);
  v_delta numeric := (p ->> 'qty_delta')::numeric;
  v_reason text := nullif(btrim(p ->> 'reason'), '');
  v_ref text := nullif(p ->> 'client_ref', '');
  i inventory_items;
  v_value bigint;
  v_movement uuid;
begin
  if v_ref is not null and exists (select 1 from stock_movements where client_ref = v_ref and business_id = m.business_id) then
    return jsonb_build_object('repeated', true);
  end if;
  select * into i from inventory_items where id = (p ->> 'item_id')::uuid and business_id = m.business_id;
  if i.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_delta is null or v_delta = 0 then
    raise exception 'invalid_qty' using errcode = '22023';
  end if;
  if length(coalesce(v_reason, '')) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  select mv.movement_id, mv.value_minor into v_movement, v_value
  from public.move_stock(m.business_id, v_branch, i.id, v_delta, 'adjustment', 'adjustment', null, v_reason,
                         m.id, v_ref) mv;
  perform public.post_stock_change(m.business_id, v_branch, 'stock_adjustment', v_movement,
    'Stock adjustment: ' || i.name, m.id, greatest(-v_value, 0), greatest(v_value, 0));
  perform public.write_audit(m.business_id, v_branch, m.id, 'adjust', 'inventory_item', i.id,
    'Adjusted ' || i.name || ' by ' || trim_scale(v_delta) || ' ' || i.unit || ': ' || v_reason);
  return jsonb_build_object('value_change_minor', v_value, 'repeated', false);
end;
$$;

create or replace function public.pay_supplier(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
  if v_ref is not null and exists (select 1 from supplier_payments where client_ref = v_ref and business_id = m.business_id) then
    return jsonb_build_object('payment_id', (select id from supplier_payments where client_ref = v_ref and business_id = m.business_id), 'repeated', true);
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

create or replace function public.pay_tips(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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

create or replace function public.post_purchase_bill(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_member(v_branch, array['owner', 'cashier']::member_role[]);
  v_today date := public.branch_today(v_branch);
  v_date date := coalesce(nullif(p ->> 'bill_date', '')::date, v_today);
  v_ref text := nullif(p ->> 'client_ref', '');
  v_registered boolean := (select vat_mode = 'on' from branches where id = v_branch);
  v_bill_vat bigint := coalesce(nullif(p ->> 'vat_minor', '')::bigint, 0);
  s suppliers;
  l jsonb;
  v_item inventory_items;
  v_packs numeric;
  v_pack numeric;
  v_price numeric;
  v_qty numeric;
  v_net bigint;
  v_line_vat bigint;
  v_cost numeric;
  v_in bigint;
  v_lines_vat boolean := false;
  v_net_all bigint := 0;
  v_vat bigint := 0;
  v_stock bigint := 0;
  v_other bigint := 0;
  v_recoverable bigint;
  v_total bigint;
  v_level numeric;
  v_number int;
  v_id uuid;
  v_payment jsonb;
begin
  if v_ref is not null and exists (select 1 from purchase_bills where client_ref = v_ref and business_id = m.business_id) then
    return jsonb_build_object('bill_id', (select id from purchase_bills where client_ref = v_ref and business_id = m.business_id), 'repeated', true);
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
  if v_bill_vat < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('bill_number:' || m.business_id::text, 0));
  select coalesce(max(number), 0) + 1 into v_number from purchase_bills where business_id = m.business_id;
  insert into purchase_bills (business_id, branch_id, supplier_id, number, invoice_ref, bill_date, due_date, total_minor,
                              note, client_ref, created_by)
  values (m.business_id, v_branch, s.id, v_number, nullif(btrim(p ->> 'invoice_ref'), ''), v_date,
          v_date + s.terms_days, 1, nullif(btrim(p ->> 'note'), ''), v_ref, m.id)
  returning id into v_id;

  for l in select * from jsonb_array_elements(p -> 'lines') loop
    v_item := null;
    if nullif(l ->> 'item_id', '') is not null then
      select * into v_item from inventory_items where id = (l ->> 'item_id')::uuid and business_id = m.business_id;
      if v_item.id is null then
        raise exception 'not_found' using errcode = 'P0002';
      end if;
    end if;
    if l ? 'unit_price_minor' then
      -- As on the supplier's invoice: packs × price per pack, and the VAT of this line.
      v_lines_vat := true;
      v_packs := coalesce((l ->> 'packs')::numeric, (l ->> 'qty')::numeric);
      v_price := (l ->> 'unit_price_minor')::numeric;
      if v_packs is null or v_packs <= 0 or v_price is null or v_price < 0 then
        raise exception 'invalid_line' using errcode = '22023';
      end if;
      v_net := round(v_packs * v_price)::bigint;
      v_line_vat := coalesce(nullif(l ->> 'vat_minor', '')::bigint, 0);
      -- What one pack holds, in the item's stock unit: as entered on the line, else the item's usual pack.
      v_pack := coalesce(nullif(l ->> 'pack_size', '')::numeric, v_item.pack_size, 1);
      if v_pack <= 0 then
        raise exception 'invalid_line' using errcode = '22023';
      end if;
      v_qty := v_packs * v_pack;
      -- The pack size entered becomes the item's usual one, so the next bill starts from it.
      if v_item.id is not null and v_item.pack_size <> v_pack then
        update inventory_items set pack_size = v_pack where id = v_item.id;
      end if;
    elsif l ? 'total_minor' then
      -- Earlier form: a quantity in stock units and what was paid for the line.
      v_qty := (l ->> 'qty')::numeric;
      v_net := (l ->> 'total_minor')::bigint;
      v_packs := v_qty;
      v_price := null;
      v_line_vat := 0;
    else
      -- Earliest form: a quantity and a cost per unit.
      v_qty := (l ->> 'qty')::numeric;
      v_net := round(v_qty * (l ->> 'unit_cost_minor')::numeric)::bigint;
      v_packs := v_qty;
      v_price := (l ->> 'unit_cost_minor')::numeric;
      v_line_vat := 0;
    end if;
    if v_qty is null or v_qty <= 0 or v_net is null or v_net < 0 or v_line_vat < 0 or v_line_vat > v_net then
      raise exception 'invalid_line' using errcode = '22023';
    end if;
    -- What the goods cost the salon: without the VAT when it can be claimed back, with it otherwise.
    v_in := v_net + case when v_registered then 0 else v_line_vat end;
    v_cost := round(v_in::numeric / v_qty, 4);
    insert into purchase_bill_lines (bill_id, item_id, description, qty, unit_cost_minor, total_minor, update_stock,
                                     packs, unit_price_minor, vat_minor)
    values (v_id, v_item.id, coalesce(nullif(btrim(l ->> 'description'), ''), v_item.name), v_qty, v_cost, v_net,
            v_item.id is not null and coalesce((l ->> 'update_stock')::boolean, true),
            v_packs, coalesce(round(v_price)::bigint, round(v_net / v_packs)::bigint), v_line_vat);
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
      v_stock := v_stock + v_in;
    else
      v_other := v_other + v_in;
    end if;
    v_net_all := v_net_all + v_net;
    v_vat := v_vat + v_line_vat;
  end loop;

  if not v_lines_vat then
    -- Earlier form: one VAT amount for the whole bill, only for a VAT-registered branch.
    if v_bill_vat > 0 and not v_registered then
      raise exception 'vat_off' using errcode = '22023';
    end if;
    v_vat := v_bill_vat;
  end if;
  if v_net_all <= 0 or v_vat > v_net_all then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  v_recoverable := case when v_registered then v_vat else 0 end;
  v_total := v_net_all + v_vat;
  update purchase_bills set total_minor = v_total, vat_minor = v_vat where id = v_id;

  perform public.post_journal(m.business_id, v_branch, v_date, 'purchase_bill', v_id,
    public.purchase_no(v_number) || ' · ' || s.name, m.id,
    jsonb_build_array(jsonb_build_object('account', 'inventory', 'debit', v_stock),
                      jsonb_build_object('account', 'supplies_expense', 'debit', v_other),
                      jsonb_build_object('account', 'vat_receivable', 'debit', v_recoverable),
                      jsonb_build_object('account', 'supplier_payable', 'credit', v_total)));
  perform public.write_audit(m.business_id, v_branch, m.id, 'create', 'purchase_bill', v_id,
    'Purchase ' || public.purchase_no(v_number) || ' from ' || s.name || ' · ' || public.fmt_money(v_total));

  if p ? 'paid_now' and coalesce((p #>> '{paid_now,amount_minor}')::bigint, 0) > 0 then
    v_payment := public.pay_supplier(jsonb_build_object(
      'branch_id', v_branch, 'supplier_id', s.id, 'bill_id', v_id, 'business_date', v_date,
      'method', p #>> '{paid_now,method}', 'amount_minor', (p #>> '{paid_now,amount_minor}')::bigint));
  end if;
  return jsonb_build_object('bill_id', v_id, 'number', v_number, 'total_minor', v_total, 'vat_minor', v_vat,
    'repeated', false);
end;
$$;

create or replace function public.record_stock_count(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_member(v_branch, array['owner']::member_role[]);
  v_ref text := nullif(p ->> 'client_ref', '');
  v_count uuid;
  c jsonb;
  i inventory_items;
  v_counted numeric;
  v_level numeric;
  v_value bigint;
  v_loss bigint := 0;
  v_gain bigint := 0;
  v_items int := 0;
  v_changed int := 0;
begin
  if v_ref is not null and exists (select 1 from stock_counts where client_ref = v_ref and business_id = m.business_id) then
    return (select jsonb_build_object('count_id', id, 'items_changed', items_changed,
                                      'value_change_minor', value_change_minor, 'repeated', true)
            from stock_counts where client_ref = v_ref and business_id = m.business_id);
  end if;
  if jsonb_array_length(coalesce(p -> 'counts', '[]')) = 0 then
    raise exception 'lines_required' using errcode = '22023';
  end if;
  insert into stock_counts (business_id, branch_id, business_date, items_counted, items_changed, value_change_minor,
                            note, client_ref, created_by)
  values (m.business_id, v_branch, public.branch_today(v_branch), 0, 0, 0, nullif(btrim(p ->> 'note'), ''), v_ref, m.id)
  returning id into v_count;
  for c in select * from jsonb_array_elements(p -> 'counts') loop
    select * into i from inventory_items where id = (c ->> 'item_id')::uuid and business_id = m.business_id;
    if i.id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    v_counted := (c ->> 'counted_qty')::numeric;
    if v_counted is null or v_counted < 0 then
      raise exception 'invalid_qty' using errcode = '22023';
    end if;
    v_items := v_items + 1;
    select coalesce((select qty from stock_levels where item_id = i.id and branch_id = v_branch), 0) into v_level;
    if v_counted <> v_level then
      v_changed := v_changed + 1;
      select mv.value_minor into v_value
      from public.move_stock(m.business_id, v_branch, i.id, v_counted - v_level, 'count', 'stock_count', v_count,
                             nullif(btrim(p ->> 'note'), ''), m.id) mv;
      v_loss := v_loss + greatest(-v_value, 0);
      v_gain := v_gain + greatest(v_value, 0);
    end if;
  end loop;
  update stock_counts set items_counted = v_items, items_changed = v_changed, value_change_minor = v_gain - v_loss
  where id = v_count;
  perform public.post_stock_change(m.business_id, v_branch, 'stock_count', v_count, 'Stock count', m.id, v_loss, v_gain);
  perform public.write_audit(m.business_id, v_branch, m.id, 'create', 'stock_count', v_count,
    'Counted ' || v_items || ' items, ' || v_changed || ' changed, value ' || public.fmt_money(v_gain - v_loss));
  return jsonb_build_object('count_id', v_count, 'items_changed', v_changed, 'value_change_minor', v_gain - v_loss,
                            'repeated', false);
end;
$$;

create or replace function public.refund_sale(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  s sales;
  m members;
  bu businesses;
  v_amount bigint := (p ->> 'amount_minor')::bigint;
  v_method payment_method := (p ->> 'method')::payment_method;
  v_key text := nullif(p ->> 'idempotency_key', '');
  v_existing refunds;
  v_parts bigint[];
  v_refund uuid;
  v_today date;
  v_product bigint;
  v_restock boolean := coalesce((p ->> 'restock')::boolean, false);
  v_back bigint := 0;
  r record;
  v_level numeric;
begin
  select * into s from sales where id = (p ->> 'sale_id')::uuid for update;
  if s.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_member(s.branch_id, array['owner']::member_role[]);
  if v_key is not null then
    select * into v_existing from refunds where idempotency_key = v_key and business_id = m.business_id;
    if v_existing.id is not null then
      return jsonb_build_object('refund_id', v_existing.id, 'refunded_minor', s.refunded_minor,
        'status', s.status, 'repeated', true);
    end if;
  end if;
  if length(btrim(coalesce(p ->> 'reason', ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 or v_amount > s.total_minor - s.refunded_minor then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if v_method is null or v_method = 'bank' then
    raise exception 'invalid_payment' using errcode = '22023';
  end if;
  -- Retail items go back to stock only when the whole sale is refunded (a part refund cannot say which items).
  if v_restock and (s.refunded_minor + v_amount < s.total_minor
                    or not exists (select 1 from sale_lines where sale_id = s.id and kind = 'retail')) then
    raise exception 'invalid_restock' using errcode = '22023';
  end if;
  select * into bu from businesses where id = s.business_id;
  v_today := public.branch_today(s.branch_id);

  -- Pro-rata over service revenue and product revenue (ex VAT), VAT and tip.
  select coalesce(sum(net_minor - vat_minor), 0) into v_product from sale_lines where sale_id = s.id and kind = 'retail';
  v_parts := public.allocate_minor(v_amount,
    array[s.total_minor - s.vat_minor - s.tip_minor - v_product, v_product, s.vat_minor, s.tip_minor]::bigint[]);

  insert into refunds (sale_id, business_id, branch_id, business_date, amount_minor, tip_minor, method, reason, restock,
                       idempotency_key, created_by)
  values (s.id, s.business_id, s.branch_id, v_today, v_amount, v_parts[4], v_method, btrim(p ->> 'reason'),
          v_restock, v_key, m.id)
  returning id into v_refund;

  if v_restock then
    -- Back in at the cost they went out at; the average cost takes them in like a purchase.
    for r in
      select sm.item_id, -sum(sm.qty_delta) as qty, max(sm.unit_cost_minor) as cost
      from stock_movements sm
      where sm.ref_type = 'sale' and sm.ref_id = s.id and sm.reason = 'retail_sale'
      group by sm.item_id
    loop
      insert into stock_levels (item_id, branch_id, qty) values (r.item_id, s.branch_id, 0) on conflict do nothing;
      select qty into v_level from stock_levels where item_id = r.item_id and branch_id = s.branch_id for update;
      update inventory_items set avg_unit_cost_minor =
        case when greatest(v_level, 0) + r.qty > 0
             then (greatest(v_level, 0) * avg_unit_cost_minor + r.qty * r.cost) / (greatest(v_level, 0) + r.qty)
             else r.cost end
      where id = r.item_id;
      update stock_levels set qty = qty + r.qty where item_id = r.item_id and branch_id = s.branch_id;
      insert into stock_movements (business_id, branch_id, item_id, qty_delta, reason, unit_cost_minor, ref_type, ref_id,
                                   note, created_by)
      values (s.business_id, s.branch_id, r.item_id, r.qty, 'reversal', r.cost, 'refund', v_refund,
              btrim(p ->> 'reason'), m.id);
      v_back := v_back + round(r.qty * r.cost)::bigint;
    end loop;
  end if;

  perform public.post_journal(s.business_id, s.branch_id, v_today, 'refund', v_refund, 'Refund sale #' || s.number, m.id,
    jsonb_build_array(
      jsonb_build_object('account', 'service_revenue', 'debit', v_parts[1]),
      jsonb_build_object('account', 'product_revenue', 'debit', v_parts[2]),
      jsonb_build_object('account', 'vat_payable', 'debit', v_parts[3]),
      jsonb_build_object('account', 'tips_payable', 'debit', v_parts[4]),
      jsonb_build_object('account', public.method_account(v_method), 'credit', v_amount),
      jsonb_build_object('account', 'inventory', 'debit', v_back),
      jsonb_build_object('account', 'cost_of_goods_sold', 'credit', v_back)));

  update sales set
    refunded_minor = refunded_minor + v_amount,
    status = case when refunded_minor + v_amount >= total_minor then 'refunded' else 'partially_refunded' end::sale_status
  where id = s.id;

  perform public.write_audit(s.business_id, s.branch_id, m.id, 'refund', 'sale', s.id,
    'Refunded ' || public.fmt_money(v_amount, bu.currency) || ' on sale #' || s.number || ': ' || btrim(p ->> 'reason'));

  select * into s from sales where id = s.id;
  return jsonb_build_object('refund_id', v_refund, 'refunded_minor', s.refunded_minor, 'status', s.status,
    'repeated', false);
end;
$$;

create or replace function public.record_expense(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
     and (m.role <> 'owner' or not exists (select 1 from members where id = (p ->> 'paid_by_member_id')::uuid
                                            and business_id = m.business_id and active)) then
    raise exception 'not_allowed' using errcode = '42501';
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
$$;

create or replace function public.record_adjustment(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  e employees;
  m members;
  v_kind text := p ->> 'kind';
  v_amount bigint := (p ->> 'amount_minor')::bigint;
  v_method payment_method := case when p ->> 'kind' = 'advance'
                                  then coalesce(nullif(p ->> 'method', ''), 'cash')::payment_method end;
  v_ref text := nullif(p ->> 'client_ref', '');
  v_today date;
  v_period text;
  v_id uuid;
begin
  select * into e from employees where id = (p ->> 'employee_id')::uuid;
  if e.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_member(e.branch_id, array['owner']::member_role[]);
  if v_ref is not null and exists (select 1 from payroll_adjustments where client_ref = v_ref and business_id = m.business_id) then
    return jsonb_build_object('adjustment_id',
      (select id from payroll_adjustments where client_ref = v_ref and business_id = m.business_id), 'repeated', true);
  end if;
  if v_kind not in ('bonus', 'deduction', 'advance') then
    raise exception 'invalid_line' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if v_method is not null and v_method not in ('cash', 'bank') then
    raise exception 'invalid_payment' using errcode = '22023';
  end if;
  v_today := public.branch_today(e.branch_id);
  v_period := to_char(v_today, 'YYYY-MM');
  if exists (select 1 from payroll_runs where business_id = e.business_id and period = v_period and status <> 'generated') then
    raise exception 'payroll_approved' using errcode = '22023';
  end if;
  insert into payroll_adjustments (business_id, branch_id, employee_id, period, kind, amount_minor, method, business_date,
                                   note, client_ref, created_by)
  values (e.business_id, e.branch_id, e.id, v_period, v_kind, v_amount, v_method, v_today,
          nullif(btrim(p ->> 'note'), ''), v_ref, m.id)
  returning id into v_id;
  if v_kind = 'advance' then
    perform public.post_journal(e.business_id, e.branch_id, v_today, 'staff_advance', v_id, 'Advance to ' || e.full_name, m.id,
      jsonb_build_array(jsonb_build_object('account', 'staff_advances', 'debit', v_amount),
                        jsonb_build_object('account', public.paid_from_account(v_method), 'credit', v_amount)));
  end if;
  perform public.write_audit(e.business_id, e.branch_id, m.id, 'create', 'payroll_adjustment', v_id,
    initcap(v_kind) || ' ' || public.fmt_money(v_amount) || ' for ' || e.full_name
    || coalesce(': ' || nullif(btrim(p ->> 'note'), ''), ''));
  return jsonb_build_object('adjustment_id', v_id, 'repeated', false);
end;
$$;

create or replace function public.register_push_token(p_business uuid, p_token text, p_platform text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
  on conflict (token) do update set member_id = excluded.member_id, platform = excluded.platform, last_seen_at = now()
    where (select business_id from members where id = push_tokens.member_id) = m.business_id;
end;
$$;

create or replace function public.log_access(p_event text, p_device text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  m members;
begin
  select * into m from members where user_id = auth.uid() and active order by created_at limit 1;
  if m.id is null then
    return;
  end if;
  insert into access_history (business_id, member_id, event, device)
  values (m.business_id, m.id, p_event, left(p_device, 120));
end;
$$;


create or replace function public.submit_cash_count(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
  if not exists (select 1 from members mm where mm.id = v_counted_by and mm.business_id = m.business_id and mm.active
                 and (mm.role = 'owner' or exists (select 1 from member_branches mb
                                                   where mb.member_id = mm.id and mb.branch_id = v_branch))) then
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

create or replace function public.create_business(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_user uuid := auth.uid();
  v_business uuid;
  v_branch uuid;
  v_member uuid;
  v_mode salon_mode := (p ->> 'mode')::salon_mode;
  v_vat vat_mode := coalesce(nullif(p ->> 'vat_mode', ''), 'off')::vat_mode;
  v_cash bigint := coalesce((p ->> 'opening_cash_minor')::bigint, 0);
  v_code text;
  v_country text := upper(coalesce(nullif(btrim(p ->> 'country_code'), ''), 'AE'));
  v_currency text := upper(coalesce(nullif(btrim(p ->> 'currency'), ''), case when v_country = 'AE' then 'AED' end));
  v_timezone text := coalesce(nullif(btrim(p ->> 'timezone'), ''), case when v_country = 'AE' then 'Asia/Dubai' end);
  v_tax_rate numeric := coalesce((p ->> 'tax_rate_bps')::numeric, case when v_country = 'AE' then 500 else 0 end);
begin
  if v_user is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  -- One setup at a time per owner: a double tap or a retry after a timeout must not create two
  -- salons (both requests would pass the check below before either had committed).
  perform pg_advisory_xact_lock(hashtextextended('create_business:' || v_user::text, 0));
  if exists (select 1 from members where user_id = v_user) then
    raise exception 'already_has_business' using errcode = '23505';
  end if;
  if v_mode is null then
    raise exception 'mode_required' using errcode = '22023';
  end if;
  if v_cash < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  -- Any country: its currency, time zone and sales tax (rate, name, included in prices or added on top). The UAE
  -- tax number (TRN) is 15 digits; elsewhere a tax number is optional and free-form.
  if v_country !~ '^[A-Z]{2}$' or coalesce(v_currency, '') !~ '^[A-Z]{3}$'
     or not exists (select 1 from pg_timezone_names where name = v_timezone) then
    raise exception 'invalid_country' using errcode = '22023';
  end if;
  if v_tax_rate not between 0 and 3000 or v_tax_rate <> round(v_tax_rate, 1) then
    raise exception 'invalid_tax_rate' using errcode = '22023';
  end if;
  if v_vat = 'on' and v_country = 'AE' and coalesce(btrim(p ->> 'trn'), '') !~ '^[0-9]{15}$' then
    raise exception 'trn_required' using errcode = '22023';
  end if;

  -- Two salons signing up at the same moment can draw the same free code; the second draws again.
  for attempt in 1..5 loop
    v_code := public.unique_business_code(p ->> 'business_name');
    begin
      insert into businesses (name, code, created_by, is_demo, country_code, currency, timezone)
      values (btrim(p ->> 'business_name'), v_code, v_user, coalesce((p ->> 'is_demo')::boolean, false) and coalesce(auth.jwt() ->> 'role', '') = 'service_role',
              v_country, v_currency, v_timezone)
      returning id into v_business;
      exit;
    exception when unique_violation then
      if attempt = 5 then
        raise;
      end if;
    end;
  end loop;

  insert into branches (business_id, name, mode, address, phone, opening_hours, vat_mode, trn, tax_name, tax_rate_bps,
                        tax_inclusive, tax_id_label, settings)
  values (
    v_business,
    coalesce(nullif(btrim(p ->> 'branch_name'), ''), btrim(p ->> 'business_name')),
    v_mode,
    nullif(btrim(p ->> 'address'), ''),
    nullif(btrim(p ->> 'phone'), ''),
    coalesce(p -> 'opening_hours', '{"open":"09:00","close":"22:00","days":[0,1,2,3,4,5,6]}'::jsonb),
    v_vat,
    case when v_vat = 'on' then nullif(btrim(p ->> 'trn'), '') end,
    coalesce(nullif(btrim(p ->> 'tax_name'), ''), 'VAT'),
    v_tax_rate,
    coalesce((p ->> 'tax_inclusive')::boolean, true),
    coalesce(nullif(btrim(p ->> 'tax_id_label'), ''), case when v_country = 'AE' then 'TRN' else 'Tax ID' end),
    jsonb_build_object(
      'waiting_target_min', 10, 'cancel_cutoff_hours', 12, 'default_deposit_minor', 0,
      'staff_can_sell', false, 'block_insufficient_stock', false,
      'tax_confirmed', true, 'opening_cash_set', v_cash > 0
    )
  )
  returning id into v_branch;

  insert into members (business_id, user_id, role, display_name, default_branch_id)
  values (v_business, v_user, 'owner', coalesce(nullif(btrim(p ->> 'owner_name'), ''), 'Owner'), v_branch)
  returning id into v_member;
  insert into member_branches (member_id, branch_id) values (v_member, v_branch);

  perform public.seed_system_accounts(v_business);
  insert into periods (business_id, month) values (v_business, to_char(public.branch_today(v_branch), 'YYYY-MM'));
  perform public.seed_mode_catalogue(v_business, v_branch, v_mode);
  insert into sale_counters (branch_id) values (v_branch);

  if v_cash > 0 then
    perform public.post_journal(v_business, v_branch, public.branch_today(v_branch), 'opening_cash', v_branch,
      'Opening cash', v_member,
      jsonb_build_array(jsonb_build_object('account', 'cash', 'debit', v_cash),
                        jsonb_build_object('account', 'owner_equity', 'credit', v_cash)));
  end if;

  perform public.write_audit(v_business, v_branch, v_member, 'create', 'business', v_business,
    'Set up ' || btrim(p ->> 'business_name'));

  return jsonb_build_object('business_id', v_business, 'branch_id', v_branch, 'member_id', v_member, 'code', v_code);
end;
$$;

-- History lines name compliance documents in words (audit: "Added evidence for ejari").
-- A document type as people say it, for history lines ("Civil defence certificate", not "civil_defence"). Owners'
-- own types keep their name.
create function public.doc_label(p_type text) returns text
language sql immutable set search_path = public as $$
  select case p_type
    when 'trade_licence' then 'Trade licence' when 'ejari' then 'Ejari / tenancy contract'
    when 'pest_control' then 'Pest control certificate' when 'civil_defence' then 'Civil defence certificate'
    when 'health_card' then 'Occupational health card' when 'visa' then 'Visa / residence permit'
    when 'vaccination' then 'Vaccination record' when 'business_licence' then 'Business licence'
    when 'lease' then 'Lease / rental agreement' else p_type end
$$;
revoke execute on function public.doc_label(text) from public, anon, authenticated;

create or replace function public.save_document(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_business uuid := (p ->> 'business_id')::uuid;
  m members;
  v_type text := nullif(btrim(p ->> 'doc_type'), '');
  v_holder text := p ->> 'holder_type';
  v_employee uuid := nullif(p ->> 'employee_id', '')::uuid;
  v_branch uuid := nullif(p ->> 'branch_id', '')::uuid;
  prev compliance_documents;
  v_id uuid;
begin
  select * into m from members where business_id = v_business and user_id = auth.uid() and active and role = 'owner';
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_type is null or v_holder not in ('company', 'premises', 'employee') then
    raise exception 'invalid_line' using errcode = '22023';
  end if;
  if v_holder = 'employee' then
    select branch_id into v_branch from employees where id = v_employee and business_id = v_business;
    if v_branch is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  else
    v_employee := null;
    if v_branch is null or not exists (select 1 from branches where id = v_branch and business_id = v_business) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;
  if (p ->> 'expires_on') is not null and (p ->> 'issued_on') is not null
     and (p ->> 'expires_on')::date < (p ->> 'issued_on')::date then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  select * into prev from compliance_documents
  where business_id = v_business and active and doc_type = v_type and employee_id is not distinct from v_employee
    and (v_holder = 'employee' or branch_id is not distinct from v_branch)
  for update;
  if prev.id is not null then
    update compliance_documents set active = false where id = prev.id;
  end if;
  insert into compliance_documents (business_id, branch_id, doc_type, holder_type, employee_id, number, issued_on, expires_on,
                                    renewal_cost_minor, reminder_days, version, previous_id, created_by)
  values (v_business, v_branch, v_type, v_holder, v_employee, nullif(btrim(p ->> 'number'), ''),
          nullif(p ->> 'issued_on', '')::date, nullif(p ->> 'expires_on', '')::date,
          nullif(p ->> 'renewal_cost_minor', '')::bigint, coalesce(nullif(p ->> 'reminder_days', '')::int, 30),
          coalesce(prev.version, 0) + 1, prev.id, m.id)
  returning id into v_id;
  perform public.write_audit(v_business, v_branch, m.id, case when prev.id is null then 'create' else 'renew' end,
    'compliance_document', v_id,
    case when prev.id is null then 'Added ' else 'Renewed ' end || public.doc_label(v_type)
    || coalesce(' for ' || (select full_name from employees where id = v_employee), '')
    || coalesce(', expires ' || to_char(nullif(p ->> 'expires_on', '')::date, 'DD Mon YYYY'), ''));
  return v_id;
end;
$$;

create or replace function public.attach_document_evidence(p_document uuid, p_path text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  d compliance_documents;
  m members;
begin
  select * into d from compliance_documents where id = p_document for update;
  if d.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into m from members where business_id = d.business_id and user_id = auth.uid() and active and role = 'owner';
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not d.active then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if split_part(p_path, '/', 1) <> d.business_id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'documents' and o.name = p_path) then
    raise exception 'receipt_missing' using errcode = '22023';
  end if;
  update compliance_documents set evidence_path = p_path where id = d.id;
  perform public.write_audit(d.business_id, d.branch_id, m.id, 'attach', 'compliance_document', d.id,
    'Added evidence for ' || public.doc_label(d.doc_type));
end;
$$;
