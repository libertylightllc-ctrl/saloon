-- Two sales taxes on one sale (owner, 2026-10-19: "GST and HST together or different?" then "go for both"): Canadian
-- provinces charge either one HST, or the 5% GST plus their own tax on a separate line (British Columbia and Manitoba
-- PST/RST 7%, Saskatchewan PST 6%, Quebec QST 9.975%). A branch may have a second tax: a name and a rate. A sale
-- charges both together at the combined rate (added at the till or included), splits the tax in proportion to the
-- rates, keeps the second tax's share (tax2_minor, with its name and rate) and posts it to its own account,
-- "Second sales tax payable", since each tax goes to a different government. Refunds split the same way; the tax
-- report shows the second tax apart. vat_minor stays the whole tax of the sale.

alter table public.branches
  add column tax2_name text check (tax2_name is null or char_length(tax2_name) between 1 and 20),
  add column tax2_rate_bps numeric(6, 1) not null default 0 check (tax2_rate_bps between 0 and 3000);
alter table public.sales
  add column tax2_name text,
  add column tax2_rate_bps numeric(6, 1) not null default 0,
  add column tax2_minor bigint not null default 0 check (tax2_minor >= 0);

-- The second tax's own liability account, for every salon and every new one.
insert into public.accounts (business_id, code, name, type, system_key)
select b.id, '2410', 'Second sales tax payable', 'liability', 'tax2_payable' from public.businesses b
where not exists (select 1 from public.accounts a where a.business_id = b.id and (a.system_key = 'tax2_payable' or a.code = '2410'));

create function public.on_business_tax2_account() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into accounts (business_id, code, name, type, system_key)
  values (new.id, '2410', 'Second sales tax payable', 'liability', 'tax2_payable')
  on conflict do nothing;
  return new;
end;
$$;
create trigger businesses_tax2_account after insert on public.businesses
  for each row execute function public.on_business_tax2_account();
revoke execute on function public.on_business_tax2_account() from public, anon, authenticated;

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
  v_tax2 bigint;
  v_rate numeric;
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
  -- A staff member's sale is always their own: the sale, every line and the tip (owner, 2026-10-19: "who is logged
  -- in, he has to only make the bill [in his name]"), whatever the app sends.
  if m.role = 'staff' then
    v_default_employee := (select id from employees where member_id = m.id and active);
    if v_default_employee is null then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  end if;
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
    v_line_employee := case when m.role = 'staff' then v_default_employee
                            else coalesce(nullif(l ->> 'employee_id', '')::uuid, v_default_employee) end;
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
  v_tip_employee := case when v_tip = 0 then null
                         when m.role = 'staff' then v_default_employee
                         else coalesce(nullif(p ->> 'tip_employee_id', '')::uuid, v_default_employee) end;
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
  -- Two taxes (Canada: GST + PST or QST, 2026-10-19) are charged together at their combined rate, then split in
  -- proportion to their rates; the second tax's share is kept on the sale and posted to its own account.
  v_rate := b.tax_rate_bps + coalesce(b.tax2_rate_bps, 0);
  v_vat := case when b.vat_mode <> 'on' or v_rate = 0 then 0
                when b.tax_inclusive then round(v_net * v_rate::numeric / (10000 + v_rate))::bigint
                else round(v_net * v_rate::numeric / 10000)::bigint end;
  v_tax2 := case when v_vat = 0 or coalesce(b.tax2_rate_bps, 0) = 0 then 0
                 else round(v_vat * b.tax2_rate_bps::numeric / v_rate)::bigint end;
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
                     total_minor, deposit_applied_minor, vat_mode, tax_rate_bps, tax_inclusive, tax2_name, tax2_rate_bps,
                     tax2_minor, note, client_ref,
                     created_by)
  values (b.business_id, v_branch, v_number, v_today, v_customer.id,
          coalesce(v_customer.name, a.customer_name), a.id, v_default_employee, v_subtotal, v_discount, v_vat, v_tip,
          v_tip_employee,
          v_total, v_deposit, b.vat_mode, b.tax_rate_bps, b.tax_inclusive,
          case when v_tax2 > 0 or coalesce(b.tax2_rate_bps, 0) > 0 then b.tax2_name end, coalesce(b.tax2_rate_bps, 0), v_tax2,
          nullif(btrim(p ->> 'note'), ''), v_ref, m.id)
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
         jsonb_build_object('account', 'vat_payable', 'credit', v_vat - v_tax2),
         jsonb_build_object('account', 'tax2_payable', 'credit', v_tax2),
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

create or replace function public.refund_sale(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_tax2 bigint;
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

  -- The second tax's share of the refunded tax, as it was charged (in proportion).
  v_tax2 := case when s.vat_minor = 0 then 0 else round(v_parts[3] * s.tax2_minor::numeric / s.vat_minor)::bigint end;

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
      jsonb_build_object('account', 'vat_payable', 'debit', v_parts[3] - v_tax2),
      jsonb_build_object('account', 'tax2_payable', 'debit', v_tax2),
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

create or replace function public.update_branch(p_branch uuid, p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  m members := public.require_member(p_branch, array['owner']::member_role[]);
  v_settings jsonb := coalesce(p -> 'settings', '{}'::jsonb);
  v_allowed text[] := array['waiting_target_min', 'cancel_cutoff_hours', 'default_deposit_minor',
                            'staff_can_sell', 'block_insufficient_stock', 'late_grace_min', 'require_hygiene_evidence',
                            'receipt_mode', 'tax_region'];
  k text;
  v_days jsonb;
begin
  for k in select jsonb_object_keys(v_settings) loop
    if not (k = any (v_allowed)) then
      raise exception 'unknown_setting: %', k using errcode = '22023';
    end if;
  end loop;
  -- Customer receipt after a sale: none, a simple printed/shared receipt, or sent on WhatsApp.
  if v_settings ? 'receipt_mode' and not (v_settings ->> 'receipt_mode' = any (array['off', 'simple', 'whatsapp'])) then
    raise exception 'unknown_setting: receipt_mode' using errcode = '22023';
  end if;
  if p ? 'vat_mode' and p ->> 'vat_mode' = 'on'
     and (select country_code from businesses where id = m.business_id) = 'AE'
     and coalesce(btrim(p ->> 'trn'), (select trn from branches where id = p_branch), '') !~ '^[0-9]{15}$' then
    raise exception 'trn_required' using errcode = '22023';
  end if;
  if p ? 'tax_rate_bps' and (coalesce((p ->> 'tax_rate_bps')::numeric, -1) not between 0 and 3000
                             or (p ->> 'tax_rate_bps')::numeric <> round((p ->> 'tax_rate_bps')::numeric, 1)) then
    raise exception 'invalid_tax_rate' using errcode = '22023';
  end if;
  -- The licence / commercial registration number on receipts: letters, digits and . / - (as on the certificate).
  if p ? 'licence_number' and nullif(btrim(p ->> 'licence_number'), '') is not null
     and btrim(p ->> 'licence_number') !~ '^[A-Za-z0-9]([A-Za-z0-9 ./-]{0,38}[A-Za-z0-9])?$' then
    raise exception 'invalid_licence' using errcode = '22023';
  end if;
  if (p ? 'legal_name' and char_length(btrim(p ->> 'legal_name')) > 120)
     or (p ? 'licence_label' and char_length(btrim(p ->> 'licence_label')) > 30) then
    raise exception 'too_long' using errcode = '22023';
  end if;
  -- The province whose tax the owner picked (Canada: ON, BC…), so Branch settings shows it again; '' for none.
  if v_settings ? 'tax_region' and coalesce(v_settings ->> 'tax_region', '-') !~ '^([A-Z]{2})?$' then
    raise exception 'unknown_setting: tax_region' using errcode = '22023';
  end if;
  -- A second tax (Canada's PST, RST or QST beside the GST): a name and a rate, or none (rate 0).
  if p ? 'tax2_rate_bps' and (coalesce((p ->> 'tax2_rate_bps')::numeric, -1) not between 0 and 3000
                              or (p ->> 'tax2_rate_bps')::numeric <> round((p ->> 'tax2_rate_bps')::numeric, 1)) then
    raise exception 'invalid_tax_rate' using errcode = '22023';
  end if;
  if coalesce((p ->> 'tax2_rate_bps')::numeric, 0) > 0 and nullif(btrim(p ->> 'tax2_name'), '') is null then
    raise exception 'tax2_name_required' using errcode = '22023';
  end if;
  -- Open days: weekday numbers, 0 = Sunday; at least one.
  if p ? 'open_days' then
    if jsonb_typeof(p -> 'open_days') <> 'array' or jsonb_array_length(p -> 'open_days') = 0
       or exists (select 1 from jsonb_array_elements(p -> 'open_days') d
                  where jsonb_typeof(d) <> 'number' or d::text !~ '^[0-6]$') then
      raise exception 'days_required' using errcode = '22023';
    end if;
    select jsonb_agg(distinct d::int order by d::int) into v_days from jsonb_array_elements_text(p -> 'open_days') d;
  end if;
  update branches set
    name = coalesce(nullif(btrim(p ->> 'name'), ''), name),
    address = case when p ? 'address' then nullif(btrim(p ->> 'address'), '') else address end,
    phone = case when p ? 'phone' then nullif(btrim(p ->> 'phone'), '') else phone end,
    vat_mode = coalesce((p ->> 'vat_mode')::vat_mode, vat_mode),
    trn = case when p ? 'trn' then nullif(btrim(p ->> 'trn'), '') else trn end,
    tax_name = coalesce(nullif(btrim(p ->> 'tax_name'), ''), tax_name),
    tax_rate_bps = coalesce((p ->> 'tax_rate_bps')::numeric, tax_rate_bps),
    tax_inclusive = coalesce((p ->> 'tax_inclusive')::boolean, tax_inclusive),
    tax_id_label = coalesce(nullif(btrim(p ->> 'tax_id_label'), ''), tax_id_label),
    tax2_rate_bps = coalesce((p ->> 'tax2_rate_bps')::numeric, tax2_rate_bps),
    tax2_name = case when p ? 'tax2_rate_bps' and coalesce((p ->> 'tax2_rate_bps')::numeric, 0) = 0 then null
                     when p ? 'tax2_name' then left(nullif(btrim(p ->> 'tax2_name'), ''), 20) else tax2_name end,
    legal_name = case when p ? 'legal_name' then nullif(btrim(p ->> 'legal_name'), '') else legal_name end,
    licence_label = case when p ? 'licence_label' then nullif(btrim(p ->> 'licence_label'), '') else licence_label end,
    licence_number = case when p ? 'licence_number' then nullif(btrim(p ->> 'licence_number'), '') else licence_number end,
    opening_hours = case when v_days is null then opening_hours else jsonb_set(opening_hours, '{days}', v_days) end,
    settings = settings || v_settings || jsonb_build_object('tax_confirmed', true)
  where id = p_branch;
  perform public.write_audit(m.business_id, p_branch, m.id, 'update', 'branch', p_branch, 'Updated branch settings');
end;
$$;

create or replace function public.public_receipt(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s sales;
  b branches;
  bu businesses;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{24}$' then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  select * into s from sales where receipt_token = p_token;
  if s.id is null then
    return null;
  end if;
  select * into b from branches where id = s.branch_id;
  select * into bu from businesses where id = s.business_id;
  return jsonb_build_object(
    'sale', jsonb_build_object(
      'number', s.number, 'created_at', s.created_at, 'customer_name', s.customer_name,
      'subtotal_minor', s.subtotal_minor, 'discount_minor', s.discount_minor, 'vat_mode', s.vat_mode,
      'vat_minor', s.vat_minor, 'tax_rate_bps', s.tax_rate_bps, 'tax_inclusive', s.tax_inclusive,
      'tax2_name', s.tax2_name, 'tax2_rate_bps', s.tax2_rate_bps, 'tax2_minor', s.tax2_minor,
      'tip_minor', s.tip_minor, 'total_minor', s.total_minor, 'deposit_applied_minor', s.deposit_applied_minor,
      'refunded_minor', s.refunded_minor,
      'employees', (select jsonb_build_object('full_name', e.full_name) from employees e where e.id = s.employee_id),
      'sale_lines', coalesce((select jsonb_agg(jsonb_build_object(
          'qty', l.qty, 'name_snapshot', l.name_snapshot, 'unit_price_minor', l.unit_price_minor,
          'employees', (select jsonb_build_object('full_name', e.full_name) from employees e where e.id = l.employee_id)))
          from sale_lines l where l.sale_id = s.id), '[]'),
      'sale_payments', coalesce((select jsonb_agg(jsonb_build_object('method', p.method, 'amount_minor', p.amount_minor))
          from sale_payments p where p.sale_id = s.id), '[]')),
    'seller', jsonb_build_object(
      'business_name', bu.name, 'country_code', bu.country_code, 'currency', bu.currency, 'timezone', bu.timezone,
      'branch_name', b.name, 'address', b.address, 'phone', b.phone,
      'trn', case when s.vat_mode = 'on' then b.trn end, 'tax_name', b.tax_name, 'tax_id_label', b.tax_id_label,
      'legal_name', b.legal_name, 'licence_label', b.licence_label, 'licence_number', b.licence_number));
end;
$$;

drop function public.report_vat(uuid, text);
create function public.report_vat(p_branch uuid, p_month text)
returns table (kind text, entries int, taxable_minor bigint, vat_minor bigint, tax2_minor bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner', 'accountant']::member_role[]);
  b record := public.month_bounds(p_month);
begin
  return query
    with e as (
      select je.source_type,
             sum(case when a.system_key in ('vat_payable', 'tax2_payable') then l.credit_minor - l.debit_minor else 0 end)
               as vat_out,
             sum(case when a.system_key = 'tax2_payable' then l.credit_minor - l.debit_minor else 0 end) as tax2_out,
             sum(case when a.system_key = 'vat_receivable' then l.debit_minor - l.credit_minor else 0 end) as vat_in,
             sum(case when a.type = 'income' then l.credit_minor - l.debit_minor else 0 end) as base_out,
             sum(case when a.type = 'expense' or a.system_key = 'inventory' then l.debit_minor - l.credit_minor else 0 end)
               as base_in,
             bool_or(a.system_key in ('vat_payable', 'tax2_payable', 'vat_receivable')) as has_vat
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
           coalesce(sum(case when k.output then e.vat_out else e.vat_in end), 0)::bigint,
           coalesce(sum(case when k.output then e.tax2_out else 0 end), 0)::bigint
    from k left join e on e.source_type = any (k.sources) and e.has_vat
    group by k.kind, k.sort
    order by k.sort;
end;
$$;
revoke execute on function public.report_vat(uuid, text) from public, anon;
grant execute on function public.report_vat(uuid, text) to authenticated;

-- A new country brings its own tax: the second tax and the picked province go (change_country sets the first).
create function public.on_business_country_tax2() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update branches set tax2_name = null, tax2_rate_bps = 0, settings = settings - 'tax_region' where business_id = new.id;
  return new;
end;
$$;
create trigger businesses_country_tax2 after update of country_code on public.businesses
  for each row when (old.country_code is distinct from new.country_code)
  execute function public.on_business_country_tax2();
revoke execute on function public.on_business_country_tax2() from public, anon, authenticated;

-- Setup takes the second tax and the province too (one step: no salon left without its PST if a second call failed).
create or replace function public.create_business(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
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
  v_tax2_rate numeric := coalesce((p ->> 'tax2_rate_bps')::numeric, 0);
  v_region text := coalesce(btrim(p ->> 'tax_region'), '');
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
  -- A second tax beside the first (Canada's PST, RST or QST) needs a name; the province picked, a two-letter code.
  if v_tax2_rate not between 0 and 3000 or v_tax2_rate <> round(v_tax2_rate, 1) then
    raise exception 'invalid_tax_rate' using errcode = '22023';
  end if;
  if v_tax2_rate > 0 and nullif(btrim(p ->> 'tax2_name'), '') is null then
    raise exception 'tax2_name_required' using errcode = '22023';
  end if;
  if v_region !~ '^([A-Z]{2})?$' then
    raise exception 'unknown_setting: tax_region' using errcode = '22023';
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
                        tax_inclusive, tax_id_label, tax2_name, tax2_rate_bps, settings)
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
    case when v_tax2_rate > 0 then left(btrim(p ->> 'tax2_name'), 20) end,
    v_tax2_rate,
    jsonb_strip_nulls(jsonb_build_object('tax_region', nullif(v_region, ''))) || jsonb_build_object(
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
