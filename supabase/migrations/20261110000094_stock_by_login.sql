-- Part B, step 6 (brief B2 "Stock and suppliers", owner's answer 2 A): stock, suppliers, bills and expenses by login.
-- * Stock: everyone sees it (stylists without costs, as before); owner and manager count it and adjust it with a reason.
-- * Deliveries: the front desk records what arrived (items, how many, a photo of the delivery note) as a delivery
--   waiting to be priced. The owner, a manager or the accountant adds the prices: it becomes the supplier bill and only
--   then does stock go up. A waiting delivery can be cancelled with a reason (by a pricer, or by whoever recorded it).
-- * Supplier bills: owner, manager and accountant record them; owner and accountant mark them paid, never in cash
--   unless they work the drawer. The front desk no longer records bills.
-- * Expenses (not from the drawer): owner, manager and accountant, in the branches they work in; the front desk sees
--   the petty cash they paid.

-- ── Deliveries ─────────────────────────────────────────────────────────────────────────────────
create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  number int not null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  supplier_name text check (supplier_name is null or length(btrim(supplier_name)) between 1 and 80),
  note text check (note is null or length(note) <= 500),
  note_path text,
  business_date date not null,
  status text not null default 'waiting' check (status in ('waiting', 'priced', 'cancelled')),
  received_by uuid references public.members (id) on delete set null,
  received_name text not null,
  received_at timestamptz not null default now(),
  bill_id uuid references public.purchase_bills (id),
  priced_by uuid references public.members (id) on delete set null,
  priced_at timestamptz,
  cancelled_by uuid references public.members (id) on delete set null,
  cancel_reason text,
  client_ref text,
  unique (business_id, number)
);
create unique index deliveries_client_ref_idx on public.deliveries (business_id, client_ref) where client_ref is not null;
create index deliveries_waiting_idx on public.deliveries (branch_id, status, received_at desc);
create table public.delivery_lines (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id),
  packs numeric not null check (packs > 0),
  pack_size numeric check (pack_size is null or pack_size > 0),
  sort int not null default 0
);
create index delivery_lines_delivery_idx on public.delivery_lines (delivery_id, sort);
alter table public.deliveries enable row level security;
alter table public.delivery_lines enable row level security;
create policy "stock team reads deliveries" on public.deliveries for select to authenticated
  using (business_id in (select x from public.my_business_ids_can('receiveDelivery') x
                         union select x from public.my_business_ids_can('priceDelivery') x)
         and branch_id in (select public.my_branch_ids()));
-- (Lines follow their delivery: their rule reads deliveries, which applies the rule above.)
create policy "delivery lines follow their delivery" on public.delivery_lines for select to authenticated
  using (exists (select 1 from public.deliveries d where d.id = delivery_lines.delivery_id));
revoke insert, update, delete, truncate, references, trigger on public.deliveries, public.delivery_lines
  from anon, authenticated;
revoke select on public.deliveries, public.delivery_lines from anon;

-- The front desk (or anyone who receives stock) records what arrived. Nothing is costed and stock does not move yet.
create function public.receive_delivery(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_can(v_branch, 'receiveDelivery');
  v_ref text := nullif(p ->> 'client_ref', '');
  v_note_path text := nullif(p ->> 'note_path', '');
  v_supplier suppliers;
  v_supplier_name text := nullif(btrim(p ->> 'supplier_name'), '');
  v_id uuid;
  v_number int;
  l jsonb;
  i inventory_items;
  v_sort int := 0;
begin
  if v_ref is not null and exists (select 1 from deliveries where client_ref = v_ref and business_id = m.business_id) then
    return (select jsonb_build_object('delivery_id', id, 'number', number, 'repeated', true)
            from deliveries where client_ref = v_ref and business_id = m.business_id);
  end if;
  if jsonb_typeof(p -> 'lines') <> 'array' or jsonb_array_length(p -> 'lines') = 0 then
    raise exception 'lines_required' using errcode = '22023';
  end if;
  if nullif(p ->> 'supplier_id', '') is not null then
    select * into v_supplier from suppliers where id = (p ->> 'supplier_id')::uuid and business_id = m.business_id and active;
    if v_supplier.id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;
  -- A photo of the delivery note, uploaded first into the business's folder. The front desk always gives one.
  if v_note_path is not null and (split_part(v_note_path, '/', 1) <> m.business_id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'receipts' and o.name = v_note_path)) then
    raise exception 'receipt_missing' using errcode = '22023';
  end if;
  if m.role = 'cashier' and v_note_path is null then
    raise exception 'receipt_required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('delivery_number:' || m.business_id::text, 0));
  select coalesce(max(number), 0) + 1 into v_number from deliveries where business_id = m.business_id;
  insert into deliveries (business_id, branch_id, number, supplier_id, supplier_name, note, note_path, business_date,
                          received_by, received_name, client_ref)
  values (m.business_id, v_branch, v_number, v_supplier.id, case when v_supplier.id is null then left(v_supplier_name, 80) end,
          nullif(left(btrim(p ->> 'note'), 500), ''), v_note_path, public.branch_today(v_branch), m.id, m.display_name, v_ref)
  returning id into v_id;
  for l in select * from jsonb_array_elements(p -> 'lines') loop
    select * into i from inventory_items where id = nullif(l ->> 'item_id', '')::uuid and business_id = m.business_id and active;
    if i.id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    if coalesce(nullif(l ->> 'packs', '')::numeric, 0) <= 0 or coalesce(nullif(l ->> 'pack_size', '')::numeric, 1) <= 0 then
      raise exception 'invalid_line' using errcode = '22023';
    end if;
    v_sort := v_sort + 1;
    insert into delivery_lines (delivery_id, business_id, item_id, packs, pack_size, sort)
    values (v_id, m.business_id, i.id, (l ->> 'packs')::numeric, nullif(l ->> 'pack_size', '')::numeric, v_sort);
  end loop;
  perform public.write_audit(m.business_id, v_branch, m.id, 'create', 'delivery', v_id,
    'Delivery ' || v_number || ' received' || coalesce(' from ' || coalesce(v_supplier.name, v_supplier_name), '')
    || ': ' || v_sort || case when v_sort = 1 then ' item' else ' items' end || ', waiting for prices');
  return jsonb_build_object('delivery_id', v_id, 'number', v_number, 'repeated', false);
end;
$$;
revoke execute on function public.receive_delivery(jsonb) from public, anon;

-- The owner, a manager or the accountant adds the prices from the supplier's invoice: the delivery becomes the
-- supplier bill (post_purchase_bill: stock goes up, the books get the bill) in one step.
create function public.price_delivery(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  d deliveries;
  m members;
  dl delivery_lines;
  l jsonb;
  v_lines jsonb := '[]';
  v_bill jsonb;
begin
  select * into d from deliveries where id = (p ->> 'delivery_id')::uuid for update;
  if d.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_can(d.branch_id, 'priceDelivery');
  if d.status <> 'waiting' then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  -- Every line gets a price per pack (and its VAT, when the invoice shows one); the quantities stay as received.
  for dl in select * from delivery_lines where delivery_id = d.id order by sort loop
    l := null;
    select x into l from jsonb_array_elements(coalesce(p -> 'lines', '[]')) x where x ->> 'line_id' = dl.id::text;
    if l is null or nullif(l ->> 'unit_price_minor', '') is null then
      raise exception 'price_required' using errcode = '22023';
    end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'item_id', dl.item_id, 'packs', dl.packs, 'pack_size', coalesce(nullif(l ->> 'pack_size', '')::numeric, dl.pack_size),
      'unit_price_minor', (l ->> 'unit_price_minor')::numeric, 'vat_minor', coalesce(nullif(l ->> 'vat_minor', '')::bigint, 0)));
  end loop;
  v_bill := public.post_purchase_bill(jsonb_build_object(
    'branch_id', d.branch_id, 'supplier_id', coalesce(nullif(p ->> 'supplier_id', '')::uuid, d.supplier_id),
    'bill_date', coalesce(nullif(p ->> 'bill_date', '')::date, d.business_date), 'invoice_ref', p ->> 'invoice_ref',
    'note', coalesce(nullif(btrim(p ->> 'note'), ''), 'Delivery ' || d.number || ' received by ' || d.received_name),
    'lines', v_lines) || case when p ? 'paid_now' then jsonb_build_object('paid_now', p -> 'paid_now') else '{}' end);
  update purchase_bills set receipt_path = coalesce(receipt_path, d.note_path) where id = (v_bill ->> 'bill_id')::uuid;
  update deliveries set status = 'priced', bill_id = (v_bill ->> 'bill_id')::uuid, priced_by = m.id, priced_at = now(),
    supplier_id = coalesce(nullif(p ->> 'supplier_id', '')::uuid, supplier_id)
  where id = d.id;
  perform public.write_audit(d.business_id, d.branch_id, m.id, 'update', 'delivery', d.id,
    'Delivery ' || d.number || ' priced: ' || public.purchase_no((v_bill ->> 'number')::int) || ' · '
    || public.fmt_money((v_bill ->> 'total_minor')::bigint));
  return v_bill || jsonb_build_object('delivery_id', d.id);
end;
$$;
revoke execute on function public.price_delivery(jsonb) from public, anon;

-- A delivery recorded by mistake (or sent back) is cancelled with a reason, never deleted.
create function public.cancel_delivery(p_delivery uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  d deliveries;
  m members;
begin
  select * into d from deliveries where id = p_delivery for update;
  if d.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_can(d.branch_id, 'receiveDelivery');
  if public.role_level(m.role, 'priceDelivery') is null and d.received_by is distinct from m.id then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if d.status <> 'waiting' then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update deliveries set status = 'cancelled', cancelled_by = m.id, cancel_reason = btrim(p_reason) where id = d.id;
  perform public.write_audit(d.business_id, d.branch_id, m.id, 'cancel', 'delivery', d.id,
    'Delivery ' || d.number || ' cancelled: ' || btrim(p_reason));
end;
$$;
revoke execute on function public.cancel_delivery(uuid, text) from public, anon;

-- ── Who reads stock history, suppliers, bills and expenses ─────────────────────────────────────
drop policy "owners read stock movements" on public.stock_movements;
create policy "stock team reads stock movements" on public.stock_movements for select to authenticated
  using (business_id in (select public.my_business_ids(array['owner', 'manager', 'cashier', 'accountant']::member_role[]))
         and branch_id in (select public.my_branch_ids()));
drop policy "front desk reads stock counts" on public.stock_counts;
create policy "stock team reads stock counts" on public.stock_counts for select to authenticated
  using (business_id in (select public.my_business_ids(array['owner', 'manager', 'cashier', 'accountant']::member_role[]))
         and branch_id in (select public.my_branch_ids()));
drop policy "front desk reads suppliers" on public.suppliers;
create policy "stock team reads suppliers" on public.suppliers for select to authenticated
  using (business_id in (select x from public.my_business_ids_can('receiveDelivery') x
                         union select x from public.my_business_ids_can('viewPurchases') x));
drop policy "owners and accountants read bills; cashiers their own" on public.purchase_bills;
create policy "money out reads bills" on public.purchase_bills for select to authenticated
  using (business_id in (select public.my_business_ids_can('viewPurchases')) and branch_id in (select public.my_branch_ids()));
drop policy "owners and accountants read supplier payments" on public.supplier_payments;
create policy "money out reads supplier payments" on public.supplier_payments for select to authenticated
  using (business_id in (select public.my_business_ids_can('viewPurchases')) and branch_id in (select public.my_branch_ids()));
drop policy "owners and accountants read expenses; cashiers their own" on public.expenses;
create policy "money out reads expenses" on public.expenses for select to authenticated
  using ((business_id in (select public.my_business_ids_at('viewExpenses', 'yes')) and branch_id in (select public.my_branch_ids()))
         or (business_id in (select public.my_business_ids_at('viewExpenses', 'own'))
             and created_by = public.current_member_id(business_id)));

-- Stock levels: managers too.
create or replace function public.inventory_levels(p_branch uuid)
returns table (item_id uuid, name text, kind public.item_kind, unit text, location text, reorder_level numeric,
               qty numeric, low boolean, avg_unit_cost_minor numeric, value_minor bigint, sell_price_minor bigint,
               condition text, next_service_date date, assigned_to text, montaji_reg_no text, active boolean,
               movements_30d int, last_movement_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_can(p_branch, 'viewInventory');
  v_costs boolean := m.role <> 'staff';
begin
  return query
    select i.id, i.name, i.kind, i.unit, i.location, i.reorder_level, coalesce(s.qty, 0),
           public.stock_state(i.kind, i.active, coalesce(s.qty, 0), i.reorder_level) is not null,
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

-- Stock counts and adjustments: owner and manager (adjust_stock).
create or replace function public.adjust_stock(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_can(v_branch, 'countStock');
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

-- Stock counts and adjustments: owner and manager (record_stock_count).
create or replace function public.record_stock_count(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_can(v_branch, 'countStock');
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

-- Supplier bills: owner, manager and accountant record them; paid on the spot only by those who pay bills.
create or replace function public.post_purchase_bill(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_can(v_branch, 'addPurchase');
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
  if p ? 'paid_now' and public.role_level(m.role, 'payBill') is null then
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

-- Paying suppliers: owner and accountant; cash only by those who work the drawer.
create or replace function public.pay_supplier(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_can(v_branch, 'payBill');
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
  -- Cash comes out of the drawer: only people who work the drawer pay in cash.
  if v_method = 'cash' and public.role_level(m.role, 'countCash') is null then
    raise exception 'not_allowed' using errcode = '42501';
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

-- Suppliers: added by whoever receives deliveries or records bills; changed by those who record bills.
create or replace function public.save_supplier(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := (p ->> 'business_id')::uuid;
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_member uuid;
  m members;
  v_role member_role := (select role from members where business_id = v_business and user_id = auth.uid() and active);
  v_name text := btrim(coalesce(p ->> 'name', ''));
begin
  -- A new supplier: anyone who receives deliveries or records bills. Changing one: those who record bills.
  m := public.require_can_business(v_business, case when v_id is null and public.role_level(v_role, 'receiveDelivery') is not null
                                                    then 'receiveDelivery' else 'addPurchase' end);
  v_member := m.id;
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

-- What is owed to suppliers: for those who see bills, in the branches they work in.
create or replace function public.supplier_balances(p_business uuid)
returns table (supplier_id uuid, name text, phone text, terms_days int, balance_minor bigint, overdue_minor bigint,
               open_bills int)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_can_business(p_business, 'viewPurchases');
  return query
    select s.id, s.name, s.phone, s.terms_days,
      (coalesce((select sum(b.total_minor) from purchase_bills b where b.supplier_id = s.id and b.status <> 'reversed'
                     and b.branch_id in (select public.my_branch_ids())), 0)
       - coalesce((select sum(sp.amount_minor) from supplier_payments sp where sp.supplier_id = s.id
                     and sp.branch_id in (select public.my_branch_ids())), 0))::bigint,
      coalesce((select sum(b.total_minor - b.paid_minor) from purchase_bills b
                where b.supplier_id = s.id and b.status in ('unpaid', 'partial')
                  and b.due_date < (select public.branch_today(b.branch_id))
                  and b.branch_id in (select public.my_branch_ids())), 0)::bigint,
      (select count(*)::int from purchase_bills b where b.supplier_id = s.id and b.status in ('unpaid', 'partial')
         and b.branch_id in (select public.my_branch_ids()))
    from suppliers s
    where s.business_id = p_business and s.active
    order by s.name;
end;
$$;

-- A bill's photo: those who record bills.
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
    m := public.require_can(v_branch, 'addPurchase');
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
