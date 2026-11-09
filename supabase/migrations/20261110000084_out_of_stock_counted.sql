-- Out-of-stock items are counted (owner's app check A6, 9 Nov 2026): "Low stock 0" showed while 10 of 12 items were
-- at 0, because only items with a reorder level above 0 were ever counted. One rule now, everywhere stock is counted:
-- out of stock is 0 or below; low is above 0 and at or below the reorder level; tools and archived items are neither.
-- Inventory counts every item; Home, the morning summary and the Reports check count an out-of-stock item only if it
-- had stock at that branch before (the owner's choice: an item added but never stocked is not news). Reaching 0 sends
-- "Out of stock". Nothing recorded changes.

create or replace function public.stock_state(p_kind public.item_kind, p_active boolean, p_qty numeric, p_reorder numeric)
returns text language sql immutable set search_path = public as $$
  select case when p_kind = 'tool' or not p_active then null
              when p_qty <= 0 then 'out'
              when p_reorder > 0 and p_qty <= p_reorder then 'low' end
$$;

-- Has this item ever come in at this branch (opening stock, a supplier bill, a count up, a restock)?
create or replace function public.had_stock(p_item uuid, p_branch uuid) returns boolean
language sql stable set search_path = public as $$
  select exists (select 1 from stock_movements where item_id = p_item and branch_id = p_branch and qty_delta > 0)
$$;

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

create or replace function public.on_stock_level_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  i inventory_items;
begin
  select * into i from inventory_items where id = new.item_id;
  if i.kind <> 'tool' and i.active and new.qty <= 0 and old.qty > 0 then
    perform public.notify(i.business_id, new.branch_id, array['owner', 'cashier']::member_role[], 'low_stock',
      'Out of stock', i.name || ' · none left',
      'inventory_item', i.id, jsonb_build_object('item', i.name, 'qty', new.qty, 'unit', i.unit, 'out', true),
      'out:' || i.id || ':' || public.branch_today(new.branch_id));
  elsif i.kind <> 'tool' and i.active and i.reorder_level > 0 and new.qty <= i.reorder_level and old.qty > i.reorder_level then
    perform public.notify(i.business_id, new.branch_id, array['owner', 'cashier']::member_role[], 'low_stock',
      'Low on stock', i.name || ' · ' || trim_scale(new.qty) || ' ' || i.unit || ' left',
      'inventory_item', i.id, jsonb_build_object('item', i.name, 'qty', new.qty, 'unit', i.unit),
      'low:' || i.id || ':' || public.branch_today(new.branch_id));
  end if;
  return new;
end;
$$;

create or replace function public.send_daily_digests(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = public as $$
declare
  b record;
  v_local timestamp;
  v_yesterday date;
  v_sales bigint;
  v_count int;
  v_pending int;
  v_low int;
  v_out int;
  n int := 0;
begin
  for b in select br.*, bu.timezone, bu.currency from branches br join businesses bu on bu.id = br.business_id loop
    v_local := p_now at time zone b.timezone;
    continue when extract(hour from v_local) <> 8;
    v_yesterday := v_local::date - 1;
    select coalesce(sum(total_minor), 0), count(*) into v_sales, v_count from sales
    where branch_id = b.id and business_date = v_yesterday;
    select count(*) into v_pending from cash_closings where branch_id = b.id and status = 'pending_approval';
    select count(*) filter (where x.state = 'low'), count(*) filter (where x.state = 'out' and x.had_stock)
    into v_low, v_out
    from (select public.stock_state(i.kind, i.active, coalesce(s.qty, 0), i.reorder_level) as state,
                 public.had_stock(i.id, b.id) as had_stock
          from inventory_items i left join stock_levels s on s.item_id = i.id and s.branch_id = b.id
          where i.business_id = b.business_id) x;
    n := n + public.notify(b.business_id, b.id, array['owner']::member_role[], 'daily_digest',
      'Good morning — ' || b.name,
      'Yesterday: ' || public.fmt_money(v_sales, b.currency) || ' · Sales: ' || v_count
      || case when v_pending > 0 then ' · Closes to approve: ' || v_pending else '' end
      || case when v_out > 0 then ' · Out of stock: ' || v_out else '' end
      || case when v_low > 0 then ' · Low stock: ' || v_low else '' end,
      null, null,
      jsonb_build_object('branch', b.name, 'sales_minor', v_sales, 'sales', v_count, 'pending_closes', v_pending, 'low_stock', v_low,
                         'out_of_stock', v_out,
                         'date', v_yesterday),
      'digest:' || b.id || ':' || v_local::date);
  end loop;
  return n;
end;
$$;

create or replace function public.owner_control(p_branch uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner', 'accountant']::member_role[]);
  c cash_closings;
begin
  select * into c from cash_closings where branch_id = p_branch and status <> 'draft' order by business_date desc limit 1;
  return jsonb_build_object(
    'last_close_date', c.business_date,
    'last_close_variance_minor', c.variance_minor,
    'supplier_owed_minor', coalesce((select sum(total_minor - paid_minor) from purchase_bills
                                     where business_id = m.business_id and status in ('unpaid', 'partial')), 0),
    -- Low, and out of stock after having had stock here, as Home counts them (owner's app check A6).
    'low_items', (select count(*) from inventory_items i left join stock_levels s on s.item_id = i.id and s.branch_id = p_branch
                  where i.business_id = m.business_id
                    and case public.stock_state(i.kind, i.active, coalesce(s.qty, 0), i.reorder_level)
                          when 'low' then true when 'out' then public.had_stock(i.id, p_branch) else false end),
    'compliance_issues', case when m.role = 'owner'
      then (select count(*) from public.compliance_status(m.business_id) where status <> 'valid') end);
end;
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
      -- Stock (owner's app check A6): low is above zero and at or below the reorder level; out of stock is zero or
      -- below, counted here only for items that had stock at this branch (a new item not stocked yet is not news).
      -- Tools that need a service within a week.
      'stock', (select jsonb_build_object(
          'low', count(*) filter (where x.state = 'low'),
          'low_items', coalesce(jsonb_agg(x.name order by x.qty) filter (where x.state = 'low'), '[]'),
          'out', count(*) filter (where x.state = 'out' and x.had_stock),
          'out_items', coalesce(jsonb_agg(x.name order by x.qty) filter (where x.state = 'out' and x.had_stock), '[]'),
          'tools_due', count(*) filter (where x.kind = 'tool' and (x.condition = 'needs_service'
                                          or x.next_service_date <= v_today + 7)))
        from (select i.name, i.kind, i.condition, i.next_service_date, coalesce(sl.qty, 0) as qty,
                     public.stock_state(i.kind, i.active, coalesce(sl.qty, 0), i.reorder_level) as state,
                     public.had_stock(i.id, p_branch) as had_stock
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
            'busy', exists (select 1 from appointments ap where ap.employee_id = e.id and ap.status = 'in_progress'
                            and ap.business_date = v_today and ap.branch_id = p_branch),
            -- Today from the roster and the clock (owner's app check A5): on shift, on a break, done, day off, not in
            -- yet, late and not in, absent; "available" only for someone with no roster at all who has not clocked in.
            'status', case when ad.status = 'not_in' and not exists (select 1 from rosters r where r.employee_id = e.id)
                           then 'available' else coalesce(ad.status, 'available') end,
            'late_minutes', case when ad.late then ad.late_minutes end,
            'shift_start', ad.shift_start, 'shift_end', ad.shift_end)
            order by coalesce(x.sales_minor, 0) desc, e.full_name)
          from employees e
          left join (select * from public.attendance_day(p_branch)) ad on ad.employee_id = e.id
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
          -- One count per real status (owner's app check A4): "expired" only once the date has passed, and the days
          -- to the nearest expiry inside its reminder window.
          'expired', count(*) filter (where status = 'expired'),
          'missing', count(*) filter (where status = 'missing'),
          'missing_date', count(*) filter (where status = 'missing_date'),
          'evidence_missing', count(*) filter (where status = 'evidence_missing'),
          'due_soon', count(*) filter (where status = 'due_soon'),
          'soonest_days', min(days_left) filter (where status in ('due_soon', 'evidence_missing')
                                                   and days_left between 0 and reminder_days))
        from public.compliance_status(b.business_id)) end,
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
      -- The same figure payroll uses (after refunds, never on the tip).
      'commission_month_minor', public.commission_for(v_me, to_char(v_today, 'YYYY-MM'))));
  end if;

  return out;
end;
$$;
