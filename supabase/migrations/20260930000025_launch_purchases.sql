-- Launch items and the purchase-entry format (owner, 2026-09-30):
--  · Account deletion (the app stores require it): a person's login and details go; the salon's records of what
--    they did stay, as UAE tax law requires records to be kept (5 years). An owner deleting their account closes
--    the salon: nobody can sign in to it any more and its plan ends.
--  · Buying in packs: an item has a pack size in its stock unit (a 1 L bottle = 1000 ml, a pack of 10 = 10 pcs).
--    A bill line is packs × price per pack, with its own VAT (5%); stock goes up by packs × pack size.
--  · VAT on a bill is recoverable for a VAT-registered branch; otherwise it is part of the cost of what was bought.
--    A reversal is the bill's own journal entry the other way round.

alter table public.businesses add column closed_at timestamptz;

alter table public.inventory_items add column pack_size numeric(12, 3) not null default 1 check (pack_size > 0);
grant select (pack_size) on public.inventory_items to authenticated;

alter table public.purchase_bill_lines
  add column packs numeric(12, 3),
  add column unit_price_minor bigint check (unit_price_minor >= 0),
  add column vat_minor bigint not null default 0 check (vat_minor >= 0);

-- How a purchase is numbered on screen, on paper and in the books: PUR-00125.
create function public.purchase_no(p_number int) returns text
language sql immutable set search_path = public as $$
  select 'PUR-' || lpad(p_number::text, 5, '0')
$$;

CREATE OR REPLACE FUNCTION public.save_item(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_business uuid := (p ->> 'business_id')::uuid;
  m members;
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_name text := nullif(btrim(p ->> 'name'), '');
  v_kind item_kind := coalesce(nullif(p ->> 'kind', ''), 'consumable')::item_kind;
  v_price bigint := nullif(p ->> 'sell_price_minor', '')::bigint;
  v_reorder numeric := coalesce(nullif(p ->> 'reorder_level', '')::numeric, 0);
  v_pack numeric := coalesce(nullif(p ->> 'pack_size', '')::numeric, 1);
begin
  select * into m from members where business_id = v_business and user_id = auth.uid() and active and role = 'owner';
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_name is null or length(v_name) > 60 then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if v_reorder < 0 or (v_price is not null and v_price < 0) or v_pack <= 0 then
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
                                 next_service_date, assigned_to, montaji_reg_no, pack_size)
    values (v_business, v_name, v_kind, coalesce(nullif(p ->> 'unit', ''), 'pcs'), v_reorder, v_price,
            nullif(btrim(p ->> 'location'), ''),
            case when v_kind = 'tool' then coalesce(nullif(p ->> 'condition', ''), 'good') end,
            case when v_kind = 'tool' then nullif(p ->> 'next_service_date', '')::date end,
            case when v_kind = 'tool' then nullif(btrim(p ->> 'assigned_to'), '') end,
            nullif(btrim(p ->> 'montaji_reg_no'), ''), v_pack)
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
      pack_size = case when p ? 'pack_size' then v_pack else pack_size end,
      active = coalesce((p ->> 'active')::boolean, active)
    where id = v_id and business_id = v_business;
    if not found then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
    perform public.write_audit(v_business, null, m.id, 'update', 'inventory_item', v_id, 'Updated item ' || v_name);
  end if;
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
$function$;

-- A reversed bill: its stock goes back out at the cost it came in at, and its journal entry is posted the other way
-- round (so inventory, supplies, recoverable VAT and the supplier's balance all return exactly).
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
    update stock_levels set qty = qty - l.qty where item_id = l.item_id and branch_id = b.branch_id;
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
  perform public.write_audit(b.business_id, b.branch_id, m.id, 'reverse', 'purchase_bill', p_id,
    'Reversed purchase ' || public.purchase_no(b.number) || ' — ' || btrim(p_reason));
end;
$function$;

-- ── Account deletion (called by the delete-account Edge Function with the service role) ──
create function public.delete_account_data(p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m members;
  v_closed boolean := false;
begin
  for m in select * from members where user_id = p_user loop
    if m.role = 'owner' then
      -- The owner leaving closes the salon: every login is switched off and its plan ends.
      update businesses set closed_at = coalesce(closed_at, now()) where id = m.business_id;
      update members set active = false where business_id = m.business_id and active;
      delete from push_tokens where member_id in (select id from members where business_id = m.business_id);
      delete from member_pins where business_id = m.business_id;
      update subscriptions set paid_until = least(paid_until, public.business_today(m.business_id) - 1), updated_at = now()
      where business_id = m.business_id;
      v_closed := true;
      perform public.write_audit(m.business_id, null, m.id, 'delete', 'business', m.business_id,
        'The owner deleted their account; the salon is closed');
    else
      update members set active = false where id = m.id;
      delete from push_tokens where member_id = m.id;
      delete from member_pins where member_id = m.id;
      perform public.write_audit(m.business_id, null, m.id, 'delete', 'member', m.id, 'Deleted their own login');
    end if;
    -- Their own details go; the salon's records of what they did stay (kept as the law requires).
    update members set display_name = 'Deleted user',
                       username = case when username is null then null else 'deleted-' || left(m.id::text, 8) end
    where id = m.id;
  end loop;
  delete from platform_admins where user_id = p_user;
  -- The logins of a closed salon's staff go too (a staff login belongs to one salon only).
  return jsonb_build_object('business_closed', v_closed, 'staff_users', coalesce((
    select jsonb_agg(distinct s.user_id) from members s
    join members o on o.business_id = s.business_id and o.user_id = p_user and o.role = 'owner'
    where s.user_id <> p_user
      and not exists (select 1 from members x where x.user_id = s.user_id and x.active)), '[]'::jsonb));
end;
$$;
revoke execute on function public.delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.delete_account_data(uuid) to service_role;
