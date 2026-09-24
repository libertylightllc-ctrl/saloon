-- Opening stock (the M2 inventory screens use it too). p_items: [{item_id, qty, unit_cost_minor}]
create function public.set_opening_stock(p_branch uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner']::member_role[]);
  it jsonb;
  v_item inventory_items;
  v_qty numeric;
  v_cost numeric;
  v_level numeric;
  v_value bigint := 0;
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
    insert into stock_levels (item_id, branch_id, qty) values (v_item.id, p_branch, 0) on conflict do nothing;
    select qty into v_level from stock_levels where item_id = v_item.id and branch_id = p_branch for update;
    update stock_levels set qty = qty + v_qty where item_id = v_item.id and branch_id = p_branch;
    -- Weighted average cost over what is on hand.
    update inventory_items set avg_unit_cost_minor =
      case when greatest(v_level, 0) + v_qty > 0
           then (greatest(v_level, 0) * avg_unit_cost_minor + v_qty * v_cost) / (greatest(v_level, 0) + v_qty)
           else v_cost end
    where id = v_item.id;
    insert into stock_movements (business_id, branch_id, item_id, qty_delta, reason, unit_cost_minor, ref_type, created_by)
    values (m.business_id, p_branch, v_item.id, v_qty, 'opening', v_cost, 'opening_stock', m.id);
    v_value := v_value + round(v_qty * v_cost)::bigint;
  end loop;
  perform public.post_journal(m.business_id, p_branch, public.branch_today(p_branch), 'opening_stock', p_branch,
    'Opening stock', m.id,
    jsonb_build_array(jsonb_build_object('account', 'inventory', 'debit', v_value),
                      jsonb_build_object('account', 'owner_equity', 'credit', v_value)));
  perform public.write_audit(m.business_id, p_branch, m.id, 'create', 'opening_stock', p_branch, 'Counted opening stock');
end;
$$;

revoke execute on function public.set_opening_stock(uuid, jsonb) from public, anon;
grant execute on function public.set_opening_stock(uuid, jsonb) to authenticated;
