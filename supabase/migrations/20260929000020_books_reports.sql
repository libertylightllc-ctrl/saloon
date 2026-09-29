-- M4 · Books and reports (01-PRODUCT §3.13, §3.14).
-- Close period: the owner locks a finished month (nothing can be posted into it; check_period_open), and can
-- reopen it with a reason. Reports: monthly business, staff sales, daily closing, stock movement, cash
-- shortages, customer list, and the owner control summary. Owner and accountant (01-PRODUCT §2).

alter table public.periods
  add column closed_by uuid references public.members (id) on delete set null,
  add column closed_at timestamptz,
  add column reopened_reason text;

-- The owner and the accountant see a month close or reopen at once on every phone.
create trigger periods_broadcast after insert or update or delete on public.periods
  for each row execute function public.broadcast_change('owners');

-- ── Close period ───────────────────────────────────────────────────────────────────────

create function public.close_period(p_business uuid, p_month text) returns void
language plpgsql security definer set search_path = public as $$
declare
  m members;
  v_now text := to_char(now() at time zone (select timezone from businesses where id = p_business), 'YYYY-MM');
  v_debits bigint;
  v_credits bigint;
begin
  select * into m from members where business_id = p_business and user_id = auth.uid() and active and role = 'owner';
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- Only a finished month closes.
  if p_month !~ '^\d{4}-\d{2}$' or p_month >= v_now then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  select coalesce(sum(l.debit_minor), 0), coalesce(sum(l.credit_minor), 0) into v_debits, v_credits
  from journal_lines l join journal_entries e on e.id = l.entry_id
  where e.business_id = p_business and to_char(e.business_date, 'YYYY-MM') = p_month;
  if v_debits <> v_credits then
    raise exception 'not_balanced' using errcode = '22023';
  end if;
  insert into periods (business_id, month, status, closed_by, closed_at)
  values (p_business, p_month, 'closed', m.id, now())
  on conflict (business_id, month) do update set status = 'closed', closed_by = m.id, closed_at = now()
  where periods.status = 'open';
  perform public.write_audit(p_business, null, m.id, 'close', 'period', null, 'Closed the books for ' || p_month);
end;
$$;

create function public.reopen_period(p_business uuid, p_month text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  m members;
begin
  select * into m from members where business_id = p_business and user_id = auth.uid() and active and role = 'owner';
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update periods set status = 'open', reopened_reason = btrim(p_reason)
  where business_id = p_business and month = p_month and status = 'closed';
  if not found then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  perform public.write_audit(p_business, null, m.id, 'reopen', 'period', null,
    'Reopened the books for ' || p_month || ': ' || btrim(p_reason));
end;
$$;

-- Every month with postings, and whether it is closed (owner and accountant).
create function public.period_list(p_business uuid)
returns table (month text, status text, entries int, closed_at timestamptz, closed_by text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(p_business, array['owner', 'accountant']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select x.m, coalesce(p.status, 'open'), x.n, p.closed_at, mem.display_name
    from (select to_char(e.business_date, 'YYYY-MM') as m, count(*)::int as n
          from journal_entries e where e.business_id = p_business group by 1) x
    left join periods p on p.business_id = p_business and p.month = x.m
    left join members mem on mem.id = p.closed_by
    order by x.m desc;
end;
$$;

-- ── Reports ────────────────────────────────────────────────────────────────────────────

create function public.month_bounds(p_month text, out d_from date, out d_to date)
language sql immutable as $$
  select (p_month || '-01')::date, ((p_month || '-01')::date + interval '1 month - 1 day')::date
$$;

-- Monthly business: day by day sales and money out, and the month's result from the books, vs last month.
create function public.report_monthly(p_branch uuid, p_month text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner', 'accountant']::member_role[]);
  b record := public.month_bounds(p_month);
  prev record := public.month_bounds(to_char((p_month || '-01')::date - interval '1 month', 'YYYY-MM'));
  v_result jsonb;
begin
  with totals as (
    select a.type, sum(l.debit_minor - l.credit_minor)::bigint as bal, e.business_date
    from journal_lines l join journal_entries e on e.id = l.entry_id join accounts a on a.id = l.account_id
    where e.business_id = m.business_id and (e.branch_id = p_branch or e.branch_id is null)
      and e.business_date between prev.d_from and b.d_to and a.type in ('income', 'expense')
    group by a.type, e.business_date
  )
  select jsonb_build_object(
    'month', p_month,
    'days', (select jsonb_agg(jsonb_build_object(
        'date', d::date,
        'sales_minor', coalesce((select sum(total_minor) from sales where branch_id = p_branch and business_date = d::date), 0),
        'sales', (select count(*) from sales where branch_id = p_branch and business_date = d::date),
        'services', coalesce((select sum(sl.qty) from sale_lines sl join sales s on s.id = sl.sale_id
                              where s.branch_id = p_branch and s.business_date = d::date and sl.kind = 'service'), 0),
        'refunds_minor', coalesce((select sum(amount_minor) from refunds where branch_id = p_branch and business_date = d::date), 0),
        'expenses_minor', coalesce((select sum(amount_minor) from expenses where branch_id = p_branch
                                    and business_date = d::date and status = 'posted'), 0)) order by d)
      from generate_series(b.d_from, b.d_to, interval '1 day') d),
    'revenue_minor', coalesce((select -sum(bal) from totals where type = 'income' and business_date >= b.d_from), 0),
    'costs_minor', coalesce((select sum(bal) from totals where type = 'expense' and business_date >= b.d_from), 0),
    'prev_revenue_minor', coalesce((select -sum(bal) from totals where type = 'income' and business_date <= prev.d_to), 0),
    'prev_costs_minor', coalesce((select sum(bal) from totals where type = 'expense' and business_date <= prev.d_to), 0)
  ) into v_result;
  return v_result;
end;
$$;

-- Staff sales: per person the services, sales (after discount), revenue without VAT, commission (less refunds),
-- tips and attendance.
create function public.report_staff(p_branch uuid, p_month text)
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
      coalesce((select sum(sl.net_minor - sl.vat_minor) from sale_lines sl join sales s on s.id = sl.sale_id
                where sl.employee_id = e.id and s.business_date between b.d_from and b.d_to), 0)::bigint,
      public.commission_for(e.id, p_month),
      coalesce((select sum(s.tip_minor) from sales s where s.tip_employee_id = e.id
                and s.business_date between b.d_from and b.d_to), 0)::bigint,
      (select count(*)::int from attendance a where a.employee_id = e.id and a.business_date between b.d_from and b.d_to),
      (select count(*)::int from attendance a where a.employee_id = e.id and a.late and a.business_date between b.d_from and b.d_to)
    from employees e
    where e.branch_id = p_branch and e.role_title <> 'cashier'
      and (e.active or exists (select 1 from sale_lines sl join sales s on s.id = sl.sale_id
                               where sl.employee_id = e.id and s.business_date between b.d_from and b.d_to))
    order by 4 desc, e.full_name, e.id;
end;
$$;

-- Daily closing: each day of the month with its close (or none), expected, counted, difference, who.
create function public.report_closing(p_branch uuid, p_month text)
returns table (business_date date, status text, expected_minor bigint, counted_minor bigint, variance_minor bigint,
               taken_out_minor bigint, reason text, counted_by text, approved_by text)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner', 'accountant']::member_role[]);
  b record := public.month_bounds(p_month);
begin
  return query
    select d::date, coalesce(c.status, 'open'), coalesce(c.expected_cash_minor, public.expected_cash(p_branch, d::date)),
           c.counted_cash_minor, c.variance_minor, coalesce(c.taken_out_minor, 0), c.reason,
           (select display_name from members where id = c.counted_by),
           (select display_name from members where id = c.approved_by)
    from generate_series(b.d_from, least(b.d_to, public.branch_today(p_branch)), interval '1 day') d
    left join cash_closings c on c.branch_id = p_branch and c.business_date = d::date
    order by d;
end;
$$;

-- Stock movement: per item the quantity at the start, in, out and at the end of the month, and its value now.
create function public.report_stock(p_branch uuid, p_month text)
returns table (item_id uuid, name text, kind public.item_kind, unit text, opening numeric, qty_in numeric,
               qty_out numeric, closing numeric, value_minor bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner', 'accountant']::member_role[]);
  b record := public.month_bounds(p_month);
  tz text := public.branch_tz(p_branch);
begin
  return query
    select i.id, i.name, i.kind, i.unit, x.opening, x.qty_in, x.qty_out, x.opening + x.qty_in + x.qty_out,
           round(greatest(x.opening + x.qty_in + x.qty_out, 0) * i.avg_unit_cost_minor)::bigint
    from inventory_items i
    cross join lateral (
      select coalesce(sum(sm.qty_delta) filter (where (sm.created_at at time zone tz)::date < b.d_from), 0) as opening,
             coalesce(sum(sm.qty_delta) filter (where sm.qty_delta > 0 and (sm.created_at at time zone tz)::date between b.d_from and b.d_to), 0) as qty_in,
             coalesce(sum(sm.qty_delta) filter (where sm.qty_delta < 0 and (sm.created_at at time zone tz)::date between b.d_from and b.d_to), 0) as qty_out
      from stock_movements sm where sm.item_id = i.id and sm.branch_id = p_branch
    ) x
    where i.business_id = m.business_id and (i.active or x.qty_in <> 0 or x.qty_out <> 0)
    order by i.name, i.id;
end;
$$;

-- Cash shortages: closes of the month with a difference, and the reason given.
create function public.report_shortages(p_branch uuid, p_month text)
returns table (business_date date, status text, variance_minor bigint, reason text, counted_by text, approved_by text)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner', 'accountant']::member_role[]);
  b record := public.month_bounds(p_month);
begin
  return query
    select c.business_date, c.status, c.variance_minor, c.reason,
           (select display_name from members where id = c.counted_by),
           (select display_name from members where id = c.approved_by)
    from cash_closings c
    where c.branch_id = p_branch and c.business_date between b.d_from and b.d_to
      and c.status <> 'draft' and c.variance_minor <> 0
    order by c.business_date;
end;
$$;

-- Customer list: visits and spend, all time and in the month. (Ordered to the row, so it can be read in pages.)
create function public.report_customers(p_business uuid, p_month text)
returns table (customer_id uuid, name text, phone text, visits int, last_visit_at timestamptz, spent_minor bigint,
               month_visits int, month_spent_minor bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  b record := public.month_bounds(p_month);
begin
  if not public.has_role(p_business, array['owner', 'accountant']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select c.id, c.name, c.phone, c.visit_count, c.last_visit_at,
           coalesce((select sum(s.total_minor - s.refunded_minor) from sales s where s.customer_id = c.id), 0)::bigint,
           (select count(*)::int from sales s where s.customer_id = c.id and s.business_date between b.d_from and b.d_to),
           coalesce((select sum(s.total_minor - s.refunded_minor) from sales s where s.customer_id = c.id
                     and s.business_date between b.d_from and b.d_to), 0)::bigint,
           c.created_at
    from customers c
    where c.business_id = p_business
    order by 6 desc, c.name, c.id;
end;
$$;

-- The owner control summary line on every report.
create function public.owner_control(p_branch uuid) returns jsonb
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
    'low_items', (select count(*) from inventory_items i left join stock_levels s on s.item_id = i.id and s.branch_id = p_branch
                  where i.business_id = m.business_id and i.active and i.kind <> 'tool' and i.reorder_level > 0
                    and coalesce(s.qty, 0) <= i.reorder_level),
    'compliance_issues', case when m.role = 'owner'
      then (select count(*) from public.compliance_status(m.business_id) where status <> 'valid') end);
end;
$$;

revoke execute on function public.close_period(uuid, text), public.reopen_period(uuid, text, text), public.period_list(uuid),
  public.month_bounds(text), public.report_monthly(uuid, text), public.report_staff(uuid, text),
  public.report_closing(uuid, text), public.report_stock(uuid, text), public.report_shortages(uuid, text),
  public.report_customers(uuid, text), public.owner_control(uuid) from public, anon;
grant execute on function public.close_period(uuid, text), public.reopen_period(uuid, text, text), public.period_list(uuid),
  public.month_bounds(text), public.report_monthly(uuid, text), public.report_staff(uuid, text),
  public.report_closing(uuid, text), public.report_stock(uuid, text), public.report_shortages(uuid, text),
  public.report_customers(uuid, text), public.owner_control(uuid) to authenticated;
