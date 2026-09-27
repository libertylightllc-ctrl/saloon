-- M2 · Inventory & tools (01-PRODUCT §3.7): items, levels, value, low stock, adjustments with a reason,
-- stock counts, tools (condition, service date, assigned to). Retail sales and restock on refund are in
-- create_sale / refund_sale (…007). Every change is a stock movement plus a balanced journal entry.

alter table public.inventory_items
  add column condition text check (condition in ('good', 'needs_service')),
  add column next_service_date date,
  add column assigned_to text check (assigned_to is null or length(assigned_to) <= 60),
  add column montaji_reg_no text check (montaji_reg_no is null or length(montaji_reg_no) <= 40);

-- One stock count = one header row; its movements point at it (ref_type 'stock_count').
create table public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  business_date date not null,
  items_counted int not null,
  items_changed int not null,
  value_change_minor bigint not null,
  note text check (note is null or length(note) <= 200),
  client_ref text unique,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.stock_counts enable row level security;
create policy "front desk reads stock counts" on public.stock_counts for select to authenticated
  using (public.has_role(business_id, array['owner', 'cashier', 'accountant']::public.member_role[])
         and public.can_use_branch(branch_id));
revoke insert, update, delete, truncate, references, trigger on public.stock_counts from anon, authenticated;

alter table public.stock_movements add column client_ref text unique;

-- Staff see items and levels, not what they cost: costs come through inventory_levels() for the front desk.
revoke select on public.inventory_items from authenticated;
grant select (id, business_id, name, kind, unit, reorder_level, sell_price_minor, location, active, created_at,
              condition, next_service_date, assigned_to, montaji_reg_no)
  on public.inventory_items to authenticated;

-- ── Reads ───────────────────────────────────────────────────────────────────────────────

-- Every item with its level in the branch; cost and value only for owner, cashier and accountant.
create function public.inventory_levels(p_branch uuid)
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
           case when v_costs then round(greatest(coalesce(s.qty, 0), 0) * i.avg_unit_cost_minor)::bigint end,
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

-- ── Items ───────────────────────────────────────────────────────────────────────────────

-- Add or edit an item. Owner only. p: {business_id, id?, name, kind, unit, reorder_level, sell_price_minor,
-- location, condition, next_service_date, assigned_to, montaji_reg_no, active}
create function public.save_item(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := (p ->> 'business_id')::uuid;
  m members;
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_name text := nullif(btrim(p ->> 'name'), '');
  v_kind item_kind := coalesce(nullif(p ->> 'kind', ''), 'consumable')::item_kind;
  v_price bigint := nullif(p ->> 'sell_price_minor', '')::bigint;
  v_reorder numeric := coalesce(nullif(p ->> 'reorder_level', '')::numeric, 0);
begin
  select * into m from members where business_id = v_business and user_id = auth.uid() and active and role = 'owner';
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_name is null or length(v_name) > 60 then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if v_reorder < 0 or (v_price is not null and v_price < 0) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if v_kind = 'retail' and v_price is null then
    raise exception 'price_required' using errcode = '22023';
  end if;
  if exists (select 1 from inventory_items where business_id = v_business and lower(name) = lower(v_name)
             and id is distinct from v_id) then
    raise exception 'item_exists' using errcode = '23505';
  end if;
  if v_id is null then
    insert into inventory_items (business_id, name, kind, unit, reorder_level, sell_price_minor, location, condition,
                                 next_service_date, assigned_to, montaji_reg_no)
    values (v_business, v_name, v_kind, coalesce(nullif(p ->> 'unit', ''), 'pcs'), v_reorder, v_price,
            nullif(btrim(p ->> 'location'), ''),
            case when v_kind = 'tool' then coalesce(nullif(p ->> 'condition', ''), 'good') end,
            case when v_kind = 'tool' then nullif(p ->> 'next_service_date', '')::date end,
            case when v_kind = 'tool' then nullif(btrim(p ->> 'assigned_to'), '') end,
            nullif(btrim(p ->> 'montaji_reg_no'), ''))
    returning id into v_id;
    perform public.write_audit(v_business, null, m.id, 'create', 'inventory_item', v_id, 'Added item ' || v_name);
  else
    update inventory_items set
      name = v_name, kind = v_kind, unit = coalesce(nullif(p ->> 'unit', ''), unit), reorder_level = v_reorder,
      sell_price_minor = v_price, location = nullif(btrim(p ->> 'location'), ''),
      condition = case when v_kind = 'tool' then coalesce(nullif(p ->> 'condition', ''), 'good') end,
      next_service_date = case when v_kind = 'tool' then nullif(p ->> 'next_service_date', '')::date end,
      assigned_to = case when v_kind = 'tool' then nullif(btrim(p ->> 'assigned_to'), '') end,
      montaji_reg_no = nullif(btrim(p ->> 'montaji_reg_no'), ''),
      active = coalesce((p ->> 'active')::boolean, active)
    where id = v_id and business_id = v_business;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    perform public.write_audit(v_business, null, m.id, 'update', 'inventory_item', v_id, 'Updated item ' || v_name);
  end if;
  return v_id;
end;
$$;

-- ── Stock changes ──────────────────────────────────────────────────────────────────────

-- Change a level by delta at average cost: level + movement; gives back the movement and its signed value.
create function public.move_stock(p_business uuid, p_branch uuid, p_item uuid, p_delta numeric,
                                  p_reason public.stock_reason, p_ref_type text, p_ref_id uuid, p_note text,
                                  p_actor uuid, p_client_ref text default null,
                                  out movement_id uuid, out value_minor bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_cost numeric := (select avg_unit_cost_minor from inventory_items where id = p_item);
  v_level numeric;
begin
  insert into stock_levels (item_id, branch_id, qty) values (p_item, p_branch, 0) on conflict do nothing;
  select qty into v_level from stock_levels where item_id = p_item and branch_id = p_branch for update;
  if v_level + p_delta < 0 then
    raise exception 'invalid_qty' using errcode = '22023';
  end if;
  update stock_levels set qty = qty + p_delta where item_id = p_item and branch_id = p_branch;
  insert into stock_movements (business_id, branch_id, item_id, qty_delta, reason, unit_cost_minor, ref_type, ref_id,
                               note, created_by, client_ref)
  values (p_business, p_branch, p_item, p_delta, p_reason, v_cost, p_ref_type, p_ref_id, p_note, p_actor, p_client_ref)
  returning id into movement_id;
  value_minor := round(p_delta * v_cost)::bigint;
end;
$$;

-- Loss: Dr consumables used, Cr inventory. Gain: the mirror. p_loss and p_gain are positive values.
create function public.post_stock_change(p_business uuid, p_branch uuid, p_source text, p_source_id uuid,
                                         p_memo text, p_actor uuid, p_loss bigint, p_gain bigint)
returns void
language sql security definer set search_path = public as $$
  select public.post_journal(p_business, p_branch, public.branch_today(p_branch), p_source, p_source_id, p_memo, p_actor,
    jsonb_build_array(jsonb_build_object('account', 'consumables_used', 'debit', p_loss),
                      jsonb_build_object('account', 'inventory', 'credit', p_loss),
                      jsonb_build_object('account', 'inventory', 'debit', p_gain),
                      jsonb_build_object('account', 'consumables_used', 'credit', p_gain)));
$$;

-- Adjust one item up or down with a reason. Owner only. p: {branch_id, item_id, qty_delta, reason, client_ref}
create function public.adjust_stock(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
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
  if v_ref is not null and exists (select 1 from stock_movements where client_ref = v_ref) then
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

-- A stock count: the counted quantity for many items; differences become movements. Owner only.
-- p: {branch_id, counts: [{item_id, counted_qty}], note, client_ref}
create function public.record_stock_count(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
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
  if v_ref is not null and exists (select 1 from stock_counts where client_ref = v_ref) then
    return (select jsonb_build_object('count_id', id, 'items_changed', items_changed,
                                      'value_change_minor', value_change_minor, 'repeated', true)
            from stock_counts where client_ref = v_ref);
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

revoke execute on function public.inventory_levels(uuid), public.save_item(jsonb),
  public.move_stock(uuid, uuid, uuid, numeric, public.stock_reason, text, uuid, text, uuid, text),
  public.post_stock_change(uuid, uuid, text, uuid, text, uuid, bigint, bigint), public.adjust_stock(jsonb),
  public.record_stock_count(jsonb) from public, anon;
revoke execute on function public.move_stock(uuid, uuid, uuid, numeric, public.stock_reason, text, uuid, text, uuid, text),
  public.post_stock_change(uuid, uuid, text, uuid, text, uuid, bigint, bigint) from authenticated;
grant execute on function public.inventory_levels(uuid), public.save_item(jsonb), public.adjust_stock(jsonb),
  public.record_stock_count(jsonb) to authenticated;

alter publication supabase_realtime add table public.inventory_items, public.stock_counts;
