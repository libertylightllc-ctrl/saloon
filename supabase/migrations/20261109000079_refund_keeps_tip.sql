-- A2 (owner's app check, 9 Nov 2026): a part refund no longer takes money from the stylist's tip.
--  * refund_sale: the refund comes out of the services and products first; only an amount past them comes out of the
--    tip, and only when the person refunding chose "Also refund the tip" (p.refund_tip). Otherwise: tip_not_refunded.
--    A sale with only a kept tip left counts as refunded. Refunds already saved stay as they are.
--  * commission_for: commission on the month's sales less what the month's refunds take back (their part without the
--    tip), in the month of the refund, so a paid month never changes. Home's "Commission this month" uses it too.
--  * report_staff: revenue after the month's refunds; tips less the tips refunded.

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


create or replace function public.commission_for(p_employee uuid, p_period text)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  -- Commission on the month's sales, less what this month's refunds take back. A refund takes back the commission on
  -- its part without the tip (the tip never earns commission), in the month it is made: a month already paid stays as
  -- it was, and a refund after it comes off the next one. Never below zero.
  with e as (select business_id from employees where id = p_employee),
  earned as (
    select coalesce(sum(sl.commission_minor), 0) as v
    from sale_lines sl join sales s on s.id = sl.sale_id, e
    where sl.employee_id = p_employee and s.business_id = e.business_id and to_char(s.business_date, 'YYYY-MM') = p_period),
  back as (
    select coalesce(sum(round(c.comm::numeric * (r.amount_minor - r.tip_minor) / nullif(s.total_minor - s.tip_minor, 0))), 0) as v
    from refunds r join sales s on s.id = r.sale_id, e,
      lateral (select sum(sl.commission_minor) as comm from sale_lines sl
               where sl.sale_id = s.id and sl.employee_id = p_employee) c
    where r.business_id = e.business_id and c.comm is not null and to_char(r.business_date, 'YYYY-MM') = p_period)
  select greatest(earned.v - back.v, 0)::bigint from earned, back
$$;

create or replace function public.report_staff(p_branch uuid, p_month text)
returns table (employee_id uuid, full_name text, services numeric, sales_minor bigint, revenue_minor bigint,
               commission_minor bigint, tips_minor bigint, days_worked int, late_days int)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner', 'accountant']::member_role[]);
  b record := public.month_bounds(p_month);
begin
  return query
    select e.id, e.full_name,
      coalesce((select sum(sl.qty) from sale_lines sl join sales s on s.id = sl.sale_id
                where sl.employee_id = e.id and s.business_date between b.d_from and b.d_to and sl.kind = 'service'), 0),
      coalesce((select sum(sl.net_minor) from sale_lines sl join sales s on s.id = sl.sale_id
                where sl.employee_id = e.id and s.business_date between b.d_from and b.d_to), 0)::bigint,
      -- Revenue after the refunds made this month (their share without the tip), as the books have it.
      (coalesce((select sum(sl.net_minor - sl.vat_minor) from sale_lines sl join sales s on s.id = sl.sale_id
                 where sl.employee_id = e.id and s.business_date between b.d_from and b.d_to), 0)
       - coalesce((select sum(round(x.rev::numeric * (r.amount_minor - r.tip_minor) / nullif(s.total_minor - s.tip_minor, 0)))
                   from refunds r join sales s on s.id = r.sale_id,
                     lateral (select sum(sl.net_minor - sl.vat_minor) as rev from sale_lines sl
                              where sl.sale_id = s.id and sl.employee_id = e.id) x
                   where r.branch_id = p_branch and x.rev is not null
                     and r.business_date between b.d_from and b.d_to), 0))::bigint,
      public.commission_for(e.id, p_month),
      -- Tips they keep: this month's tips less any tip refunded this month.
      (coalesce((select sum(s.tip_minor) from sales s where s.tip_employee_id = e.id
                 and s.business_date between b.d_from and b.d_to), 0)
       - coalesce((select sum(r.tip_minor) from refunds r join sales s on s.id = r.sale_id
                   where s.tip_employee_id = e.id and r.business_date between b.d_from and b.d_to), 0))::bigint,
      (select count(*)::int from attendance a where a.employee_id = e.id and a.business_date between b.d_from and b.d_to),
      (select count(*)::int from attendance a where a.employee_id = e.id and a.late and a.business_date between b.d_from and b.d_to)
    from employees e
    where e.branch_id = p_branch and e.role_title <> 'cashier'
      and (e.active or exists (select 1 from sale_lines sl join sales s on s.id = sl.sale_id
                               where sl.employee_id = e.id and s.business_date between b.d_from and b.d_to))
    order by 4 desc, e.full_name, e.id;
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
      -- The same figure payroll uses (after refunds, never on the tip).
      'commission_month_minor', public.commission_for(v_me, to_char(v_today, 'YYYY-MM'))));
  end if;

  return out;
end;
$$;

