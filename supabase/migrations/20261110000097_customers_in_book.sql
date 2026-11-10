-- Part B, step 9 (brief B2 "Customers"): merged and deleted customers stay out of new records, and the customers
-- report follows "contact details only for those who need them".
-- * A customer merged into another stays in the database pointing at the one kept; a new sale or booking that names
--   it (a screen opened before the merge) goes to the customer kept. A deleted customer can't be picked again.
-- * The online booking page finds a returning client by phone among customers still in the book, so a merged
--   duplicate's number books the customer kept, and a deleted customer's booking starts a new record.
-- * Reports → Customers: merged and deleted customers are left out (their sales are with the customer kept, or
--   anonymous), and the accountant sees no phone numbers (B2: contact details only for owner, manager and front desk).

-- The customer a record should use now: the one a merged customer was merged into (followed to the end), or null when
-- the customer was deleted or is not in this salon.
create function public.customer_now(p_business uuid, p_customer uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  c customers;
begin
  select * into c from customers where id = p_customer and business_id = p_business;
  for i in 1..20 loop
    exit when c.id is null or c.merged_into is null;
    select * into c from customers where id = c.merged_into and business_id = p_business;
  end loop;
  if c.id is null or c.deleted_at is not null or c.merged_into is not null then
    return null;
  end if;
  return c.id;
end;
$$;
revoke execute on function public.customer_now(uuid, uuid) from public, anon, authenticated;

-- Sales: a merged customer's sale goes to the customer kept; a deleted customer is not found.
create or replace function public.create_sale(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_can(v_branch, 'sell');
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
  v_catalog bigint;
  v_price_change bigint := 0;   -- how far prices were changed at checkout, all lines together
  v_limit int;                  -- the branch's discount limit (Controls)
  v_discount_bps int;
  v_over boolean;
  v_cap text;
  v_approvals jsonb := coalesce(p -> 'approvals', '{}');
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
    -- A merged customer's sale goes to the customer kept; a deleted one is not found.
    select * into v_customer from customers
    where id = public.customer_now(b.business_id, coalesce(nullif(p ->> 'customer_id', '')::uuid, a.customer_id));
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
      v_catalog := v_service.price_minor;
      v_price := coalesce((l ->> 'price_minor')::bigint, v_catalog);
      v_item := null;
    elsif v_kind = 'retail' then
      select * into v_item from inventory_items
      where id = (l ->> 'item_id')::uuid and business_id = b.business_id and kind = 'retail' and active
        and sell_price_minor is not null;
      if v_item.id is null then
        raise exception 'item_unavailable' using errcode = '22023';
      end if;
      v_name := v_item.name;
      v_catalog := v_item.sell_price_minor;
      v_price := coalesce((l ->> 'price_minor')::bigint, v_catalog);
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
    if v_kind <> 'custom' then
      if v_price < 0 then
        raise exception 'invalid_line' using errcode = '22023';
      end if;
      v_price_change := v_price_change + abs(round((v_price - v_catalog) * v_qty))::bigint;
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
  -- Discounts above the branch's limit (brief B2, B3): the owner any; a manager with a reason; the front desk and
  -- stylists with a manager's or the owner's PIN. A price changed at checkout: the owner; a manager with a reason; the
  -- front desk with a PIN; stylists never. Both are listed in Reports → Approvals.
  v_limit := (public.branch_control(v_branch, 'discount_limit_bps') #>> '{}')::int;
  v_over := v_discount > 0 and v_discount * 10000 > v_limit::bigint * v_subtotal;
  v_discount_bps := case when v_subtotal > 0 then ceil(v_discount * 10000.0 / v_subtotal)::int else 0 end;
  if v_over and public.role_level(m.role, 'discount') = 'reason' and length(btrim(coalesce(p ->> 'discount_reason', ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if v_price_change > 0 then
    v_cap := public.role_level(m.role, 'changePrice');
    if v_cap is null then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    if v_cap = 'reason' and length(btrim(coalesce(p ->> 'price_reason', ''))) < 3 then
      raise exception 'reason_required' using errcode = '22023';
    end if;
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

  if v_over then
    if public.role_level(m.role, 'discount') = 'limit' then
      perform public.use_approval(nullif(v_approvals ->> 'discount', '')::uuid, m.id, v_branch, 'discount', v_discount_bps,
                                  v_limit, 'sale', v_sale);
    else
      perform public.log_approval(m.id, v_branch, 'discount', v_discount_bps, v_limit, p ->> 'discount_reason', 'sale',
                                  v_sale);
    end if;
  end if;
  if v_price_change > 0 then
    if v_cap = 'pin' then
      perform public.use_approval(nullif(v_approvals ->> 'price_change', '')::uuid, m.id, v_branch, 'price_change',
                                  v_price_change, null, 'sale', v_sale);
    else
      perform public.log_approval(m.id, v_branch, 'price_change', v_price_change, null, p ->> 'price_reason', 'sale',
                                  v_sale);
    end if;
  end if;

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

-- Bookings and walk-ins: the same.
CREATE OR REPLACE FUNCTION public.create_appointment(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_can(v_branch, case when p ->> 'kind' = 'booking' then 'book' else 'addToQueue' end);
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
  -- A stylist's own (brief B2, B3): bookings for themselves while "Stylists can add bookings for themselves" is on,
  -- walk-ins for themselves or for whoever is free; no deposits.
  if m.role = 'staff' then
    if (v_kind = 'booking' and not (public.branch_control(v_branch, 'staff_book_self') #>> '{}')::boolean)
       or v_deposit > 0 then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    if v_kind = 'booking' or v_employee is not null then
      v_employee := (select id from employees where member_id = m.id and active);
      if v_employee is null then
        raise exception 'not_allowed' using errcode = '42501';
      end if;
    end if;
  end if;

  if nullif(p ->> 'customer_id', '') is not null then
    -- A merged customer's booking goes to the customer kept; a deleted one is not found.
    select * into v_customer from customers
    where id = public.customer_now(b.business_id, (p ->> 'customer_id')::uuid);
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
  if public.mode_uses_rooms(b.mode) and v_needs_room and v_room is null then
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

-- The online booking page: a returning client is found among customers still in the book.
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
  if v_phone !~ '^\+?[0-9 ()-]{7,24}$' or char_length(v_digits) not between 7 and 15 then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
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

-- Reports → Customers: customers still in the book; phone numbers for the owner.
create or replace function public.report_customers(p_business uuid, p_month text)
returns table (customer_id uuid, name text, phone text, visits int, last_visit_at timestamptz, spent_minor bigint,
               month_visits int, month_spent_minor bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  b record := public.month_bounds(p_month);
  -- Phone numbers for the owner only here: the accountant has no customer contact details (B2).
  v_phones boolean := public.has_role(p_business, array['owner']::member_role[]);
begin
  if not public.has_role(p_business, array['owner', 'accountant']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select c.id, c.name, case when v_phones then c.phone end, c.visit_count, c.last_visit_at,
           coalesce((select sum(s.total_minor - s.refunded_minor) from sales s where s.customer_id = c.id), 0)::bigint,
           (select count(*)::int from sales s where s.customer_id = c.id and s.business_date between b.d_from and b.d_to),
           coalesce((select sum(s.total_minor - s.refunded_minor) from sales s where s.customer_id = c.id
                     and s.business_date between b.d_from and b.d_to), 0)::bigint,
           c.created_at
    from customers c
    where c.business_id = p_business and c.merged_into is null and c.deleted_at is null
    order by 6 desc, c.name, c.id;
end;
$$;
