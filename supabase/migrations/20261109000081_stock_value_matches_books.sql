-- A3 (owner's app check, 9 Nov 2026): Inventory's stock value and the books' 1200 Stock came apart (QAR 63.14 vs 63.64
-- on one salon): a glove used before any stock was entered went out at a cost of 0, and when 50 came in the books took
-- all 50 while 49 were left. Kept equal from now on:
--  * stock_in: every way stock comes in (supplier bill, opening stock, refund back to stock) takes the units used while
--    the level was below zero at the new cost, and post_stock_recost books the difference to stock used.
--  * reverse_purchase_bill works the average cost out again for what is left (it kept the old one) and books what the
--    average cannot carry.
--  * inventory_levels values stock below zero below zero, as the books carry it.
--  * stock_books_check (owner, accountant): the stock's value across every branch and item, archived ones too, against
--    1200 Stock; fix_stock_difference adds one "Stock difference" entry for what is left (nothing recorded changes).

create function public.stock_in(p_item uuid, p_branch uuid, p_qty numeric, p_cost numeric) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_level numeric;
  v_avg numeric;
begin
  insert into stock_levels (item_id, branch_id, qty) values (p_item, p_branch, 0) on conflict do nothing;
  select qty into v_level from stock_levels where item_id = p_item and branch_id = p_branch for update;
  select avg_unit_cost_minor into v_avg from inventory_items where id = p_item for update;
  update stock_levels set qty = qty + p_qty where item_id = p_item and branch_id = p_branch;
  update inventory_items set avg_unit_cost_minor =
    case when greatest(v_level, 0) + p_qty > 0
         then (greatest(v_level, 0) * v_avg + p_qty * p_cost) / (greatest(v_level, 0) + p_qty)
         else p_cost end
  where id = p_item;
  -- Units used while the level was below zero went out at the old average; costed again at this cost, the books keep
  -- matching the stock's value. More than the books hold: the extra is stock used (returned as a positive amount).
  return case when v_level < 0 then round(-v_level * (p_cost - v_avg))::bigint else 0 end;
end;
$$;

-- Positive: the books hold more than the stock is worth, so the extra goes to stock used; negative: the other way.
create function public.post_stock_recost(p_business uuid, p_branch uuid, p_source text, p_source_id uuid, p_actor uuid,
                                         p_amount bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_amount, 0) <> 0 then
    perform public.post_stock_change(p_business, p_branch, 'stock_recost', p_source_id,
      'Stock used below zero, costed again', p_actor, greatest(p_amount, 0), greatest(-p_amount, 0));
  end if;
end;
$$;

create function public.stock_books_check(p_business uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_stock bigint;
  v_books bigint;
begin
  if not public.has_role(p_business, array['owner', 'accountant']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select coalesce(sum(round(sl.qty * i.avg_unit_cost_minor)), 0)::bigint into v_stock
  from stock_levels sl join inventory_items i on i.id = sl.item_id where i.business_id = p_business;
  select coalesce(sum(l.debit_minor - l.credit_minor), 0)::bigint into v_books
  from journal_lines l join accounts a on a.id = l.account_id
  where a.business_id = p_business and a.system_key = 'inventory';
  return jsonb_build_object('stock_minor', v_stock, 'books_minor', v_books, 'difference_minor', v_books - v_stock);
end;
$$;

create function public.fix_stock_difference(p_business uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  m members;
  v_diff bigint;
  bu businesses;
begin
  select * into m from members where business_id = p_business and user_id = auth.uid() and active
    and role in ('owner', 'accountant');
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtext('stock_difference:' || p_business));
  v_diff := (public.stock_books_check(p_business) ->> 'difference_minor')::bigint;
  if v_diff = 0 then
    return 0;
  end if;
  select * into bu from businesses where id = p_business;
  perform public.post_journal(p_business, null, public.business_today(p_business), 'stock_difference', null,
    'Stock difference', m.id,
    jsonb_build_array(jsonb_build_object('account', 'consumables_used', 'debit', greatest(v_diff, 0)),
                      jsonb_build_object('account', 'inventory', 'credit', greatest(v_diff, 0)),
                      jsonb_build_object('account', 'inventory', 'debit', greatest(-v_diff, 0)),
                      jsonb_build_object('account', 'consumables_used', 'credit', greatest(-v_diff, 0))));
  perform public.write_audit(p_business, null, m.id, 'create', 'stock_difference', null,
    'Fixed the stock difference: ' || public.fmt_money(v_diff, bu.currency));
  return v_diff;
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
  v_recost bigint := 0;
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
      v_recost := v_recost + public.stock_in(v_item.id, v_branch, v_qty, v_cost);
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
  perform public.post_stock_recost(m.business_id, v_branch, 'purchase_bill', v_id, m.id, v_recost);
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


create or replace function public.set_opening_stock(p_branch uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner']::member_role[]);
  it jsonb;
  v_item inventory_items;
  v_qty numeric;
  v_cost numeric;
  v_level numeric;
  v_value bigint := 0;
  v_recost bigint := 0;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    select * into v_item from inventory_items where id = (it ->> 'item_id')::uuid and business_id = m.business_id;
    if v_item.id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    v_qty := (it ->> 'qty')::numeric;
    v_cost := coalesce((it ->> 'unit_cost_minor')::numeric, 0);
    if v_qty <= 0 or v_cost < 0 then
      raise exception 'invalid_amount' using errcode = '22023';
    end if;
    -- Weighted average cost over what is on hand.
    v_recost := v_recost + public.stock_in(v_item.id, p_branch, v_qty, v_cost);
    insert into stock_movements (business_id, branch_id, item_id, qty_delta, reason, unit_cost_minor, ref_type, created_by)
    values (m.business_id, p_branch, v_item.id, v_qty, 'opening', v_cost, 'opening_stock', m.id);
    v_value := v_value + round(v_qty * v_cost)::bigint;
  end loop;
  perform public.post_journal(m.business_id, p_branch, public.branch_today(p_branch), 'opening_stock', p_branch,
    'Opening stock', m.id,
    jsonb_build_array(jsonb_build_object('account', 'inventory', 'debit', v_value),
                      jsonb_build_object('account', 'owner_equity', 'credit', v_value)));
  perform public.post_stock_recost(m.business_id, p_branch, 'opening_stock', p_branch, m.id, v_recost);
  update branches set settings = settings || '{"opening_stock_set": true}' where id = p_branch;
  perform public.write_audit(m.business_id, p_branch, m.id, 'create', 'opening_stock', p_branch, 'Counted opening stock');
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
  v_recost bigint := 0;
  v_refund_tip boolean := coalesce((p ->> 'refund_tip')::boolean, false);
  v_rest bigint;      -- what is left of the sale without the tip
  v_tip_part bigint;  -- the tip in this refund: only what goes past the rest, and only when asked
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
  -- The tip is the stylist's (owner, 9 Nov 2026): a refund comes out of the services and products first, and out of the
  -- tip only past them, when the person refunding chose to refund the tip too.
  v_rest := s.total_minor - s.tip_minor
            - (s.refunded_minor - (select coalesce(sum(tip_minor), 0) from refunds where sale_id = s.id));
  v_tip_part := greatest(v_amount - v_rest, 0);
  if v_tip_part > 0 and not v_refund_tip then
    raise exception 'tip_not_refunded' using errcode = '22023';
  end if;
  if v_method is null or v_method = 'bank' then
    raise exception 'invalid_payment' using errcode = '22023';
  end if;
  -- Retail items go back to stock only when the whole sale is refunded (a part refund cannot say which items).
  if v_restock and (v_amount - v_tip_part < v_rest
                    or not exists (select 1 from sale_lines where sale_id = s.id and kind = 'retail')) then
    raise exception 'invalid_restock' using errcode = '22023';
  end if;
  select * into bu from businesses where id = s.business_id;
  v_today := public.branch_today(s.branch_id);

  -- The part without the tip pro-rata over service revenue and product revenue (ex VAT) and VAT; the tip on its own.
  select coalesce(sum(net_minor - vat_minor), 0) into v_product from sale_lines where sale_id = s.id and kind = 'retail';
  v_parts := public.allocate_minor(v_amount - v_tip_part,
    array[s.total_minor - s.vat_minor - s.tip_minor - v_product, v_product, s.vat_minor]::bigint[]) || v_tip_part;

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
      v_recost := v_recost + public.stock_in(r.item_id, s.branch_id, r.qty, r.cost);
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

  perform public.post_stock_recost(s.business_id, s.branch_id, 'refund', v_refund, m.id, v_recost);

  update sales set
    refunded_minor = refunded_minor + v_amount,
    -- Refunded once nothing but a kept tip is left.
    status = case when refunded_minor + v_amount >= total_minor or v_amount - v_tip_part >= v_rest
                  then 'refunded' else 'partially_refunded' end::sale_status
  where id = s.id;

  perform public.write_audit(s.business_id, s.branch_id, m.id, 'refund', 'sale', s.id,
    'Refunded ' || public.fmt_money(v_amount, bu.currency) || ' on sale #' || s.number || ': ' || btrim(p ->> 'reason'));

  select * into s from sales where id = s.id;
  return jsonb_build_object('refund_id', v_refund, 'refunded_minor', s.refunded_minor, 'status', s.status,
    'repeated', false);
end;
$$;


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
  v_lines jsonb;
  v_level numeric;
  v_avg numeric;
  v_after numeric;
  v_recost bigint := 0;
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
  for l in select * from purchase_bill_lines where bill_id = p_id and update_stock loop
    -- The goods go back at what the bill paid for them; the average cost of what is left is worked out again, and any
    -- part the average cannot carry (more went back than is left) is costed again, so the books keep matching the
    -- stock's value (owner's app check A3).
    select qty into v_level from stock_levels where item_id = l.item_id and branch_id = b.branch_id for update;
    select avg_unit_cost_minor into v_avg from inventory_items where id = l.item_id for update;
    v_level := coalesce(v_level, 0);
    v_after := case when v_level - l.qty > 0 and v_level * v_avg - l.qty * l.unit_cost_minor >= 0
                    then (v_level * v_avg - l.qty * l.unit_cost_minor) / (v_level - l.qty) else v_avg end;
    update inventory_items set avg_unit_cost_minor = v_after where id = l.item_id;
    update stock_levels set qty = qty - l.qty where item_id = l.item_id and branch_id = b.branch_id;
    v_recost := v_recost + round(v_level * v_avg)::bigint - round(l.qty * l.unit_cost_minor)::bigint
                - round((v_level - l.qty) * v_after)::bigint;
    insert into stock_movements (business_id, branch_id, item_id, qty_delta, reason, unit_cost_minor, ref_type, ref_id,
                                 created_by)
    values (b.business_id, b.branch_id, l.item_id, -l.qty, 'reversal', l.unit_cost_minor, 'purchase_bill', p_id, m.id);
  end loop;
  select jsonb_agg(jsonb_build_object('account', a.system_key, 'debit', jl.credit_minor, 'credit', jl.debit_minor))
    into v_lines
  from journal_lines jl
  join journal_entries je on je.id = jl.entry_id
  join accounts a on a.id = jl.account_id
  where je.source_type = 'purchase_bill' and je.source_id = p_id;
  update purchase_bills set status = 'reversed', reverse_reason = btrim(p_reason), reversed_by = m.id, reversed_at = now()
  where id = p_id;
  perform public.post_journal(b.business_id, b.branch_id, public.branch_today(b.branch_id), 'purchase_bill_reversal', p_id,
    'Reversed ' || public.purchase_no(b.number), m.id, v_lines);
  perform public.post_stock_recost(b.business_id, b.branch_id, 'purchase_bill_reversal', p_id, m.id, v_recost);
  perform public.write_audit(b.business_id, b.branch_id, m.id, 'reverse', 'purchase_bill', p_id,
    'Reversed purchase ' || public.purchase_no(b.number) || ' — ' || btrim(p_reason));
end;
$function$;


create or replace function public.inventory_levels(p_branch uuid)
returns table (item_id uuid, name text, kind public.item_kind, unit text, location text, reorder_level numeric,
               qty numeric, low boolean, avg_unit_cost_minor numeric, value_minor bigint, sell_price_minor bigint,
               condition text, next_service_date date, assigned_to text, montaji_reg_no text, active boolean,
               movements_30d int, last_movement_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner', 'cashier', 'staff', 'accountant']::member_role[]);
  v_costs boolean := m.role <> 'staff';
begin
  return query
    select i.id, i.name, i.kind, i.unit, i.location, i.reorder_level, coalesce(s.qty, 0),
           i.kind <> 'tool' and i.active and coalesce(s.qty, 0) <= i.reorder_level and i.reorder_level > 0,
           case when v_costs then i.avg_unit_cost_minor end,
           -- Below zero counts below zero, as the books carry it (owner's app check A3).
           case when v_costs then round(coalesce(s.qty, 0) * i.avg_unit_cost_minor)::bigint end,
           i.sell_price_minor, i.condition, i.next_service_date, i.assigned_to, i.montaji_reg_no, i.active,
           (select count(*)::int from stock_movements sm where sm.item_id = i.id and sm.branch_id = p_branch
              and sm.created_at > now() - interval '30 days'),
           (select max(sm.created_at) from stock_movements sm where sm.item_id = i.id and sm.branch_id = p_branch)
    from inventory_items i
    left join stock_levels s on s.item_id = i.id and s.branch_id = p_branch
    where i.business_id = m.business_id
    order by i.active desc, i.name;
end;
$$;


revoke execute on function public.stock_in(uuid, uuid, numeric, numeric),
  public.post_stock_recost(uuid, uuid, text, uuid, uuid, bigint) from public, anon, authenticated;
revoke execute on function public.stock_books_check(uuid), public.fix_stock_difference(uuid) from public, anon;
grant execute on function public.stock_books_check(uuid), public.fix_stock_difference(uuid) to authenticated;
