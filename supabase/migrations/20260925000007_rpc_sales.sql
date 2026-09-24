-- M1 · Quick sale and refunds (01-PRODUCT §3.4, 04-DATA-MODEL §7).

create function public.fmt_money(p_minor bigint, p_currency text default 'AED') returns text
language sql immutable as $$
  select case when p_minor < 0 then '-' else '' end || p_currency || ' ' ||
         to_char(abs(p_minor) / 100.0, 'FM999,999,999,990.00')
$$;

-- p: {branch_id, client_ref, appointment_id, customer_id, employee_id,
--     lines: [{kind: service|custom, service_id | name + unit_price_minor, qty, employee_id}],
--     discount_minor | discount_bps, tip_minor, tip_employee_id, use_deposit,
--     payments: [{method, amount_minor}], note}
create function public.create_sale(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
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
  v_warnings text[] := '{}';
  v_shortages text[] := '{}';
  v_block boolean;
  v_journal jsonb := '[]';
begin
  if v_ref is not null then
    select * into v_existing from sales where client_ref = v_ref;
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
    idx int, kind sale_line_kind, service_id uuid, name text, qty numeric, unit_price bigint, gross bigint,
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
    elsif v_kind = 'custom' then
      v_name := nullif(btrim(l ->> 'name'), '');
      v_price := (l ->> 'unit_price_minor')::bigint;
      if v_name is null or v_price is null or v_price < 0 then
        raise exception 'invalid_line' using errcode = '22023';
      end if;
      v_service := null;
    else
      raise exception 'invalid_line' using errcode = '22023';
    end if;
    insert into _sale_lines (idx, kind, service_id, name, qty, unit_price, gross, employee_id)
    values (v_idx, v_kind::sale_line_kind, v_service.id, v_name, v_qty, v_price, round(v_price * v_qty)::bigint,
            coalesce(nullif(l ->> 'employee_id', '')::uuid, v_default_employee));
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

  -- Spread the discount over the lines, then VAT (inclusive, 5/105) over the nets.
  select array_agg(gross order by idx) into v_weights from _sale_lines;
  v_parts := public.allocate_minor(v_discount, v_weights);
  update _sale_lines set discount = v_parts[idx], net = gross - v_parts[idx];
  v_net := v_subtotal - v_discount;
  v_vat := case when b.vat_mode = 'on' then round(v_net * 500::numeric / 10500)::bigint else 0 end;
  select array_agg(net order by idx) into v_weights from _sale_lines;
  v_parts := public.allocate_minor(v_vat, v_weights);
  update _sale_lines set vat = v_parts[idx];
  update _sale_lines sl set
    commission_bps = coalesce(e.commission_bps, 0),
    commission = round((sl.net - sl.vat) * coalesce(e.commission_bps, 0)::numeric / 10000)::bigint
  from employees e where e.id = sl.employee_id;

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
                     total_minor, deposit_applied_minor, vat_mode, note, client_ref, created_by)
  values (b.business_id, v_branch, v_number, v_today, v_customer.id,
          coalesce(v_customer.name, a.customer_name), a.id, v_default_employee, v_subtotal, v_discount, v_vat, v_tip,
          case when v_tip > 0 then coalesce(nullif(p ->> 'tip_employee_id', '')::uuid, v_default_employee) end,
          v_total, v_deposit, b.vat_mode, nullif(btrim(p ->> 'note'), ''), v_ref, m.id)
  returning id into v_sale;

  insert into sale_lines (sale_id, kind, service_id, name_snapshot, qty, unit_price_minor, discount_minor,
                          net_minor, vat_minor, employee_id, commission_bps, commission_minor)
  select v_sale, kind, service_id, name, qty, unit_price, discount, net, vat, employee_id, commission_bps, commission
  from _sale_lines order by idx;

  insert into sale_payments (sale_id, method, amount_minor)
  select v_sale, (x ->> 'method')::payment_method, (x ->> 'amount_minor')::bigint
  from jsonb_array_elements(coalesce(p -> 'payments', '[]')) x;

  -- Recipe stock (services only). Shortage warns, or blocks when the branch setting says so.
  v_block := coalesce((b.settings ->> 'block_insufficient_stock')::boolean, false);
  for r in
    select ri.item_id, i.name, i.avg_unit_cost_minor, sum(ri.qty * sl.qty) as used
    from _sale_lines sl
    join service_recipe_items ri on ri.service_id = sl.service_id
    join inventory_items i on i.id = ri.item_id
    group by ri.item_id, i.name, i.avg_unit_cost_minor
  loop
    insert into stock_levels (item_id, branch_id, qty) values (r.item_id, v_branch, 0) on conflict do nothing;
    select qty into v_level from stock_levels where item_id = r.item_id and branch_id = v_branch for update;
    if v_level < r.used then
      v_shortages := v_shortages || r.name;
    end if;
    update stock_levels set qty = qty - r.used where item_id = r.item_id and branch_id = v_branch;
    insert into stock_movements (business_id, branch_id, item_id, qty_delta, reason, unit_cost_minor, ref_type, ref_id,
                                 created_by)
    values (b.business_id, v_branch, r.item_id, -r.used, 'service_use', r.avg_unit_cost_minor, 'sale', v_sale, m.id);
    v_cost := v_cost + round(r.used * r.avg_unit_cost_minor)::bigint;
  end loop;
  if array_length(v_shortages, 1) > 0 then
    if v_block then
      raise exception 'insufficient_stock: %', array_to_string(v_shortages, ', ') using errcode = '22023';
    end if;
    v_warnings := v_warnings || ('Low stock: ' || array_to_string(v_shortages, ', '));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('account', public.method_account((x ->> 'method')::payment_method),
                                               'debit', (x ->> 'amount_minor')::bigint)), '[]')
    into v_journal
  from jsonb_array_elements(coalesce(p -> 'payments', '[]')) x;
  v_journal := v_journal
    || jsonb_build_array(
         jsonb_build_object('account', 'deposits_held', 'debit', v_deposit),
         jsonb_build_object('account', 'service_revenue', 'credit', v_net - v_vat),
         jsonb_build_object('account', 'vat_payable', 'credit', v_vat),
         jsonb_build_object('account', 'tips_payable', 'credit', v_tip),
         jsonb_build_object('account', 'consumables_used', 'debit', v_cost),
         jsonb_build_object('account', 'inventory', 'credit', v_cost));
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

-- p: {sale_id, amount_minor, method, reason, restock, idempotency_key}
create function public.refund_sale(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
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
begin
  select * into s from sales where id = (p ->> 'sale_id')::uuid for update;
  if s.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_member(s.branch_id, array['owner']::member_role[]);
  if v_key is not null then
    select * into v_existing from refunds where idempotency_key = v_key;
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
  select * into bu from businesses where id = s.business_id;
  v_today := public.branch_today(s.branch_id);

  -- Pro-rata over revenue (ex VAT), VAT and tip.
  v_parts := public.allocate_minor(v_amount,
    array[s.total_minor - s.vat_minor - s.tip_minor, s.vat_minor, s.tip_minor]::bigint[]);

  insert into refunds (sale_id, business_id, branch_id, business_date, amount_minor, method, reason, restock,
                       idempotency_key, created_by)
  values (s.id, s.business_id, s.branch_id, v_today, v_amount, v_method, btrim(p ->> 'reason'),
          coalesce((p ->> 'restock')::boolean, false), v_key, m.id)
  returning id into v_refund;

  perform public.post_journal(s.business_id, s.branch_id, v_today, 'refund', v_refund, 'Refund sale #' || s.number, m.id,
    jsonb_build_array(
      jsonb_build_object('account', 'service_revenue', 'debit', v_parts[1]),
      jsonb_build_object('account', 'vat_payable', 'debit', v_parts[2]),
      jsonb_build_object('account', 'tips_payable', 'debit', v_parts[3]),
      jsonb_build_object('account', public.method_account(v_method), 'credit', v_amount)));

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
