-- M1 · Read helpers for Home, column-level grants, realtime.

-- Expected cash = the cash account's balance at the end of the business date. Opening cash, cash sales,
-- deposits in/out and cash refunds all post to it; M2 adds expenses, supplier payments and closings.
create function public.expected_cash(p_branch uuid, p_date date default null) returns bigint
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := public.branch_business(p_branch);
begin
  if not public.can_use_branch(p_branch)
     or not public.has_role(v_business, array['owner', 'cashier', 'accountant']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return coalesce((
    select sum(l.debit_minor - l.credit_minor)
    from journal_lines l
    join journal_entries e on e.id = l.entry_id
    where e.branch_id = p_branch
      and e.business_date <= coalesce(p_date, public.branch_today(p_branch))
      and l.account_id = public.acct(v_business, 'cash')
  ), 0);
end;
$$;

create function public.dashboard_today(p_branch uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
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
            'commission_minor', coalesce(x.commission_minor, 0),
            'busy', exists (select 1 from appointments ap where ap.employee_id = e.id and ap.status = 'in_progress'))
            order by coalesce(x.sales_minor, 0) desc, e.full_name)
          from employees e
          left join lateral (
            select sum(sl.qty) filter (where sl.kind = 'service') as services, sum(sl.net_minor) as sales_minor,
                   sum(sl.commission_minor) as commission_minor
            from sale_lines sl join sales s on s.id = sl.sale_id
            where sl.employee_id = e.id and s.business_date = v_today and s.branch_id = p_branch) x on true
          where e.branch_id = p_branch and e.active and e.role_title <> 'cashier'), '[]'),
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
      'opening_cash', coalesce((b.settings ->> 'opening_cash_set')::boolean, false)));
  end if;

  if m.role = 'staff' then
    select id into v_me from employees where member_id = m.id;
    out := out || jsonb_build_object('me', jsonb_build_object(
      'services_today', coalesce((select sum(sl.qty) from sale_lines sl join sales s on s.id = sl.sale_id
         where sl.employee_id = v_me and s.business_date = v_today and sl.kind = 'service'), 0),
      'sales_today_minor', coalesce((select sum(sl.net_minor) from sale_lines sl join sales s on s.id = sl.sale_id
         where sl.employee_id = v_me and s.business_date = v_today), 0),
      'commission_month_minor', coalesce((select sum(sl.commission_minor) from sale_lines sl
         join sales s on s.id = sl.sale_id
         where sl.employee_id = v_me and date_trunc('month', s.business_date) = date_trunc('month', v_today)), 0)));
  end if;

  return out;
end;
$$;

-- ── Column-level write grants (RLS decides rows; these decide columns) ───────────────────
revoke insert, update on public.customers from authenticated;
grant insert (business_id, name, phone, notes, preferences, risk_flags, preferred_employee_id, marketing_opt_in)
  on public.customers to authenticated;
grant update (name, phone, notes, preferences, risk_flags, preferred_employee_id, marketing_opt_in)
  on public.customers to authenticated;

revoke insert, update on public.service_categories from authenticated;
grant insert (business_id, name, icon, sort, translations) on public.service_categories to authenticated;
grant update (name, icon, sort, archived, translations) on public.service_categories to authenticated;

-- Everything else is written only through security-definer RPCs.
revoke insert, update, delete on all tables in schema public from anon;
revoke delete on all tables in schema public from authenticated;
revoke insert, update on public.businesses, public.branches, public.members, public.member_branches,
  public.employees, public.access_history, public.accounts, public.periods, public.journal_entries,
  public.journal_lines, public.audit_log, public.services, public.inventory_items, public.service_recipe_items,
  public.stock_levels, public.stock_movements, public.rooms, public.expense_categories, public.appointments,
  public.appointment_services, public.sale_counters, public.sales, public.sale_lines, public.sale_payments,
  public.refunds from authenticated;

-- ── Function execute rights ─────────────────────────────────────────────────────────────
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.create_business(jsonb), public.set_branch_mode(uuid, public.salon_mode), public.update_branch(uuid, jsonb),
  public.set_opening_cash(uuid, bigint), public.save_service(jsonb), public.log_access(text, text),
  public.create_appointment(jsonb), public.check_in(uuid), public.start_service(uuid), public.mark_no_show(uuid),
  public.cancel_appointment(uuid, text), public.available_slots(uuid, date, int, uuid),
  public.create_sale(jsonb), public.refund_sale(jsonb), public.expected_cash(uuid, date),
  public.dashboard_today(uuid),
  -- used inside RLS policies
  public.is_member(uuid), public.has_role(uuid, public.member_role[]), public.can_use_branch(uuid),
  public.current_member_id(uuid), public.branch_business(uuid)
  to authenticated;
grant execute on function public.register_staff_member(jsonb) to service_role;

-- ── Realtime: two phones stay in sync ───────────────────────────────────────────────────
alter publication supabase_realtime add table
  public.appointments, public.sales, public.branches, public.members, public.services,
  public.service_categories, public.customers, public.stock_levels, public.employees, public.refunds;
