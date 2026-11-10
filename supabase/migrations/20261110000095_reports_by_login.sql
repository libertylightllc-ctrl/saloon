-- Part B, step 7 (brief B2 "Reports and books", "Setup"): reports, books, the audit trail, compliance and hygiene by
-- login type.
-- * Reports: owner and accountant all of them; a manager, in their branches, sales (without the books' revenue, costs
--   and result), staff sales and commission (never salaries), daily closing, cash differences, stock and no-shows;
--   a stylist only their own line of staff sales. Customers and VAT stay with owner and accountant.
-- * Books: owner and accountant close a month; only the owner reopens one.
-- * Audit trail and sign-ins: owner and accountant everything; a manager their branches, without pay, books or plan.
-- * Compliance: owner and manager keep the records (licences, papers), in the manager's branches; the accountant views.
-- * Daily hygiene log: owner, manager, front desk and stylists sign it.

-- A report a login type may open for a branch: owner and accountant any; a manager in their branches. (A stylist's own
-- line of staff sales is handled in report_staff.)
create function public.require_report(p_branch uuid) returns public.members
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_can(p_branch, 'viewReports');
begin
  if public.role_level(m.role, 'viewReports') not in ('yes', 'branch') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return m;
end;
$$;
revoke execute on function public.require_report(uuid) from public, anon, authenticated;

-- For row rules: a branch the signed-in person works in (no branch = the whole salon, allowed).
create function public.in_my_branches(p_branch uuid) returns boolean
language sql stable set search_path = public as $$
  select p_branch is null or p_branch in (select public.my_branch_ids())
$$;
revoke execute on function public.in_my_branches(uuid) from public, anon;

-- For row rules: the logins that work in my branches, not the owner or the accountant (a manager reads their sign-ins).
create function public.my_branch_member_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct mb.member_id from member_branches mb join members m on m.id = mb.member_id
  where mb.branch_id in (select public.my_branch_ids()) and m.role not in ('owner', 'accountant')
$$;
revoke execute on function public.my_branch_member_ids() from public, anon;

-- ── Audit trail and sign-ins ──────────────────────────────────────────────────────────────────
drop policy "owners and accountants read activity" on public.audit_log;
create policy "activity by login type" on public.audit_log for select to authenticated
  using ((business_id in (select public.my_business_ids_at('viewActivity', 'yes'))
          and (branch_id is null or branch_id in (select public.my_branch_ids())))
         or (business_id in (select public.my_business_ids_at('viewActivity', 'branch'))
             and branch_id in (select public.my_branch_ids())
             -- No pay, books or plan for a manager (staff records carry salary changes).
             and entity_type not in ('employee', 'payroll_adjustment', 'payroll_line', 'payroll_run', 'period', 'plan',
                                     'stock_difference')));
drop policy "owners read access history" on public.access_history;
create policy "sign-ins by login type" on public.access_history for select to authenticated
  using (business_id in (select public.my_business_ids_at('viewActivity', 'yes'))
         or (business_id in (select public.my_business_ids_at('viewActivity', 'branch'))
             and member_id in (select public.my_branch_member_ids())));

-- ── Compliance records and the hygiene log ───────────────────────────────────────────────────
drop policy "owner reads compliance documents" on public.compliance_documents;
create policy "compliance reads documents" on public.compliance_documents for select to authenticated
  using (business_id in (select public.my_business_ids_can('viewCompliance'))
         and (branch_id is null or branch_id in (select public.my_branch_ids())));
drop policy "owner reads compliance removals" on public.compliance_removals;
create policy "compliance reads removals" on public.compliance_removals for select to authenticated
  using (business_id in (select public.my_business_ids_can('viewCompliance'))
         and (branch_id is null or branch_id in (select public.my_branch_ids())));
drop policy "owner and cashier read hygiene logs" on public.hygiene_logs;
create policy "hygiene team reads hygiene logs" on public.hygiene_logs for select to authenticated
  using (business_id in (select public.my_business_ids_can('signHygiene')) and branch_id in (select public.my_branch_ids()));

-- Files in the documents bucket: <business>/compliance/…, <business>/hygiene/…, <business>/wps/… .
drop policy "owner and accountant read documents" on storage.objects;
drop policy "owner uploads documents" on storage.objects;
create policy "documents by login type: read" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (
    (storage.foldername(name))[1] in (select x::text from public.my_business_ids(array['owner', 'accountant']::member_role[]) x)
    or ((storage.foldername(name))[2] = 'compliance'
        and (storage.foldername(name))[1] in (select x::text from public.my_business_ids_can('viewCompliance') x))
    or ((storage.foldername(name))[2] = 'hygiene'
        and (storage.foldername(name))[1] in (select x::text from public.my_business_ids_can('signHygiene') x))));
create policy "documents by login type: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (
    (storage.foldername(name))[1] in (select x::text from public.my_business_ids(array['owner']::member_role[]) x)
    or ((storage.foldername(name))[2] = 'compliance'
        and (storage.foldername(name))[1] in (select x::text from public.my_business_ids_can('manageCompliance') x))
    or ((storage.foldername(name))[2] = 'hygiene'
        and (storage.foldername(name))[1] in (select x::text from public.my_business_ids_can('signHygiene') x))
    or ((storage.foldername(name))[2] = 'wps'
        and (storage.foldername(name))[1] in (select x::text from public.my_business_ids_can('payPayroll') x))));

-- Sales by month: managers too, without the books' figures.
create or replace function public.report_monthly(p_branch uuid, p_month text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_report(p_branch);
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
        -- Sales never include the tip (owner's app check A7): the tip is the stylist's, shown apart.
        'sales_minor', coalesce((select sum(total_minor - tip_minor) from sales where branch_id = p_branch and business_date = d::date), 0),
        'tips_minor', coalesce((select sum(tip_minor) from sales where branch_id = p_branch and business_date = d::date), 0),
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
  -- A manager sees sales, not the books: no revenue, costs or result.
  if m.role = 'manager' then
    v_result := v_result || '{"revenue_minor": null, "costs_minor": null, "prev_revenue_minor": null, "prev_costs_minor": null}';
  end if;
  return v_result;
end;
$$;

-- Managers too, in their branches (report_closing).
create or replace function public.report_closing(p_branch uuid, p_month text)
returns table (business_date date, status text, expected_minor bigint, counted_minor bigint, variance_minor bigint,
               taken_out_minor bigint, reason text, counted_by text, approved_by text)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_report(p_branch);
  b record := public.month_bounds(p_month);
begin
  return query
    select d::date, coalesce(c.status, 'open'),
           coalesce(c.expected_cash_minor, case when public.cash_visible(p_branch, d::date, m.role)
                                                then public.drawer_cash_on(p_branch, d::date) end),
           c.counted_cash_minor, c.variance_minor, coalesce(c.taken_out_minor, 0), c.reason,
           (select display_name from members where id = c.counted_by),
           (select display_name from members where id = c.approved_by)
    from generate_series(b.d_from, least(b.d_to, public.branch_today(p_branch)), interval '1 day') d
    left join cash_closings c on c.branch_id = p_branch and c.business_date = d::date
    order by d;
end;
$$;

-- Managers too, in their branches (report_stock).
create or replace function public.report_stock(p_branch uuid, p_month text)
returns table (item_id uuid, name text, kind public.item_kind, unit text, opening numeric, qty_in numeric,
               qty_out numeric, closing numeric, value_minor bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_report(p_branch);
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

-- Managers too, in their branches (report_shortages).
create or replace function public.report_shortages(p_branch uuid, p_month text)
returns table (business_date date, status text, variance_minor bigint, reason text, counted_by text, approved_by text)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_report(p_branch);
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

-- Staff sales and commission: managers too; a stylist their own line.
create or replace function public.report_staff(p_branch uuid, p_month text)
returns table (employee_id uuid, full_name text, services numeric, sales_minor bigint, revenue_minor bigint,
               commission_minor bigint, tips_minor bigint, days_worked int, late_days int)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_can(p_branch, 'viewReports');
  v_own boolean := public.role_level(m.role, 'viewReports') = 'own';
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
    where e.branch_id = p_branch and public.takes_clients(e.role_title)
      -- A stylist sees their own line only.
      and (not v_own or e.member_id = m.id)
      and (e.active or exists (select 1 from sale_lines sl join sales s on s.id = sl.sale_id
                               where sl.employee_id = e.id and s.business_date between b.d_from and b.d_to))
    order by 4 desc, e.full_name, e.id;
end;
$$;

-- No-shows in a month (owner, manager in their branches, accountant).
create function public.report_no_shows(p_branch uuid, p_month text)
returns table (appointment_id uuid, business_date date, scheduled_at timestamptz, customer_name text, staff_name text,
               services text, deposit_minor bigint, deposit_status text)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_report(p_branch);
  b record := public.month_bounds(p_month);
begin
  return query
    select a.id, a.business_date, a.scheduled_at, coalesce(c.name, a.customer_name),
           (select e.full_name from employees e where e.id = a.employee_id),
           (select string_agg(x.name_snapshot, ', ' order by x.name_snapshot) from appointment_services x
            where x.appointment_id = a.id),
           coalesce(a.deposit_minor, 0)::bigint, a.deposit_status::text
    from appointments a
    left join customers c on c.id = a.customer_id
    where a.branch_id = p_branch and a.status = 'no_show' and a.business_date between b.d_from and b.d_to
    order by a.scheduled_at, a.id;
end;
$$;
revoke execute on function public.report_no_shows(uuid, text) from public, anon;

-- Closing a month: owner and accountant.
create or replace function public.close_period(p_business uuid, p_month text) returns void
language plpgsql security definer set search_path = public as $$
declare
  m members;
  v_now text := to_char(now() at time zone (select timezone from businesses where id = p_business), 'YYYY-MM');
  v_debits bigint;
  v_credits bigint;
begin
  m := public.require_can_business(p_business, 'closePeriod');
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

-- Compliance list: owner, manager (their branches) and accountant.
create or replace function public.compliance_status(p_business uuid)
 RETURNS TABLE(slot_key text, doc_type text, holder_type text, branch_id uuid, employee_id uuid, holder_name text, required boolean, document_id uuid, number text, issued_on date, expires_on date, renewal_cost_minor bigint, reminder_days integer, evidence_path text, version integer, status text, days_left integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_today date := (now() at time zone (select timezone from businesses where id = p_business))::date;
begin
  perform public.require_can_business(p_business, 'viewCompliance');
  return query
  with tmpl as (
    select * from public.compliance_template(p_business)
  ), slots as (
    select t.doc_type, t.holder_type, b.id as branch_id, null::uuid as employee_id, b.name as holder_name, true as required
    from branches b
    cross join tmpl t
    where b.business_id = p_business and t.holder_type <> 'employee'
      and not exists (select 1 from compliance_removals x
                      where x.business_id = p_business and x.doc_type = t.doc_type and x.branch_id = b.id)
    union all
    select t.doc_type, 'employee', e.branch_id, e.id, e.full_name, true
    from employees e
    cross join tmpl t
    where e.business_id = p_business and e.active and t.holder_type = 'employee'
      and not exists (select 1 from compliance_removals x
                      where x.business_id = p_business and x.doc_type = t.doc_type and x.employee_id = e.id)
    union all
    -- The owner's own documents beyond the template.
    select d.doc_type, d.holder_type, d.branch_id, d.employee_id,
           coalesce((select full_name from employees where id = d.employee_id), (select name from branches where id = d.branch_id)),
           false
    from compliance_documents d
    where d.business_id = p_business and d.active
      and d.doc_type not in (select t.doc_type from tmpl t)
  )
  select s.doc_type || ':' || coalesce(s.employee_id, s.branch_id)::text, s.doc_type, s.holder_type, s.branch_id, s.employee_id,
         s.holder_name, s.required, d.id, d.number, d.issued_on, d.expires_on, d.renewal_cost_minor, d.reminder_days,
         d.evidence_path, d.version,
         case when d.id is null then 'missing'
              when d.expires_on is null then 'missing_date'
              when d.expires_on < v_today then 'expired'
              when d.evidence_path is null then 'evidence_missing'
              when d.expires_on <= v_today + d.reminder_days then 'due_soon'
              else 'valid' end,
         (d.expires_on - v_today)::int
  from slots s
  left join compliance_documents d on d.business_id = p_business and d.active and d.doc_type = s.doc_type
    and d.employee_id is not distinct from s.employee_id
    and (s.holder_type = 'employee' or d.branch_id is not distinct from s.branch_id)
  -- A manager sees their branches' records.
  where public.in_my_branches(s.branch_id)
  order by s.holder_type = 'employee', s.holder_name, s.doc_type;
end;
$$;

-- Compliance records: owner and manager, in the manager's branches (save_document).
create or replace function public.save_document(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_business uuid := (p ->> 'business_id')::uuid;
  m members;
  v_type text := nullif(btrim(p ->> 'doc_type'), '');
  v_holder text := p ->> 'holder_type';
  v_employee uuid := nullif(p ->> 'employee_id', '')::uuid;
  v_branch uuid := nullif(p ->> 'branch_id', '')::uuid;
  prev compliance_documents;
  v_id uuid;
begin
  m := public.require_can_business(v_business, 'manageCompliance');
  if v_type is null or v_holder not in ('company', 'premises', 'employee') then
    raise exception 'invalid_line' using errcode = '22023';
  end if;
  if v_holder = 'employee' then
    select branch_id into v_branch from employees where id = v_employee and business_id = v_business;
    if v_branch is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  else
    v_employee := null;
    if v_branch is null or not exists (select 1 from branches where id = v_branch and business_id = v_business) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;
  if (p ->> 'expires_on') is not null and (p ->> 'issued_on') is not null
     and (p ->> 'expires_on')::date < (p ->> 'issued_on')::date then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  select * into prev from compliance_documents
  where business_id = v_business and active and doc_type = v_type and employee_id is not distinct from v_employee
    and (v_holder = 'employee' or branch_id is not distinct from v_branch)
  for update;
  if prev.id is not null then
    update compliance_documents set active = false where id = prev.id;
  end if;
  if not public.in_my_branches(v_branch) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  insert into compliance_documents (business_id, branch_id, doc_type, holder_type, employee_id, number, issued_on, expires_on,
                                    renewal_cost_minor, reminder_days, version, previous_id, created_by)
  values (v_business, v_branch, v_type, v_holder, v_employee, nullif(btrim(p ->> 'number'), ''),
          nullif(p ->> 'issued_on', '')::date, nullif(p ->> 'expires_on', '')::date,
          nullif(p ->> 'renewal_cost_minor', '')::bigint, coalesce(nullif(p ->> 'reminder_days', '')::int, 30),
          coalesce(prev.version, 0) + 1, prev.id, m.id)
  returning id into v_id;
  delete from compliance_removals x
  where x.business_id = v_business and x.doc_type = v_type and coalesce(x.employee_id, x.branch_id) = coalesce(v_employee, v_branch);
  perform public.write_audit(v_business, v_branch, m.id, case when prev.id is null then 'create' else 'renew' end,
    'compliance_document', v_id,
    case when prev.id is null then 'Added ' else 'Renewed ' end || public.doc_label(v_type)
    || coalesce(' for ' || (select full_name from employees where id = v_employee), '')
    || coalesce(', expires ' || to_char(nullif(p ->> 'expires_on', '')::date, 'DD Mon YYYY'), ''));
  return v_id;
end;
$$;

-- Compliance records: owner and manager, in the manager's branches (update_document).
create or replace function public.update_document(p jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  d compliance_documents;
  m members;
  v_name text := nullif(btrim(p ->> 'doc_type'), '');
  v_issued date := nullif(p ->> 'issued_on', '')::date;
  v_expires date := nullif(p ->> 'expires_on', '')::date;
  v_reminder int := coalesce(nullif(p ->> 'reminder_days', '')::int, 30);
  v_cost bigint := nullif(p ->> 'renewal_cost_minor', '')::bigint;
begin
  select * into d from compliance_documents where id = (p ->> 'id')::uuid for update;
  if d.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_can_business(d.business_id, 'manageCompliance');
  if not public.in_my_branches(d.branch_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not d.active then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if v_expires < v_issued then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  if v_reminder not between 0 and 365 or v_cost < 0 or length(btrim(p ->> 'number')) > 60 then
    raise exception 'invalid_line' using errcode = '22023';
  end if;
  if v_name is not null and v_name <> d.doc_type then
    -- Checklist items keep their names; another current record with the new name is a clash.
    if exists (select 1 from public.compliance_template(d.business_id) t where t.doc_type in (d.doc_type, v_name))
       or length(v_name) > 60 then
      raise exception 'invalid_line' using errcode = '22023';
    end if;
    if exists (select 1 from compliance_documents o where o.business_id = d.business_id and o.active and o.id <> d.id
               and o.doc_type = v_name and o.employee_id is not distinct from d.employee_id
               and (d.holder_type = 'employee' or o.branch_id is not distinct from d.branch_id)) then
      raise exception 'document_exists' using errcode = '23505';
    end if;
    update compliance_documents set doc_type = v_name
    where business_id = d.business_id and doc_type = d.doc_type and employee_id is not distinct from d.employee_id
      and (d.holder_type = 'employee' or branch_id is not distinct from d.branch_id);
  end if;
  update compliance_documents
  set number = nullif(btrim(p ->> 'number'), ''), issued_on = v_issued, expires_on = v_expires,
      renewal_cost_minor = v_cost, reminder_days = v_reminder
  where id = d.id;
  perform public.write_audit(d.business_id, d.branch_id, m.id, 'edit', 'compliance_document', d.id,
    'Edited ' || public.doc_label(coalesce(v_name, d.doc_type))
    || coalesce(' for ' || (select full_name from employees where id = d.employee_id), '')
    || case when d.expires_on is distinct from v_expires
            then ': expires ' || coalesce(to_char(d.expires_on, 'DD Mon YYYY'), '—') || ' → '
                 || coalesce(to_char(v_expires, 'DD Mon YYYY'), '—')
            else '' end);
end;
$$;

-- Compliance records: owner and manager, in the manager's branches (attach_document_evidence).
create or replace function public.attach_document_evidence(p_document uuid, p_path text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  d compliance_documents;
  m members;
begin
  select * into d from compliance_documents where id = p_document for update;
  if d.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_can_business(d.business_id, 'manageCompliance');
  if not public.in_my_branches(d.branch_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not d.active then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if split_part(p_path, '/', 1) <> d.business_id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'documents' and o.name = p_path) then
    raise exception 'receipt_missing' using errcode = '22023';
  end if;
  update compliance_documents set evidence_path = p_path where id = d.id;
  perform public.write_audit(d.business_id, d.branch_id, m.id, 'attach', 'compliance_document', d.id,
    'Added evidence for ' || public.doc_label(d.doc_type));
end;
$$;

-- Compliance records: owner and manager, in the manager's branches (remove_document_slot).
create or replace function public.remove_document_slot(p jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid := (p ->> 'business_id')::uuid;
  v_type text := nullif(btrim(p ->> 'doc_type'), '');
  v_holder text := p ->> 'holder_type';
  v_employee uuid := nullif(p ->> 'employee_id', '')::uuid;
  v_branch uuid := nullif(p ->> 'branch_id', '')::uuid;
  v_reason text := nullif(btrim(p ->> 'reason'), '');
  m members;
  d compliance_documents;
  v_template boolean;
begin
  m := public.require_can_business(v_business, 'manageCompliance');
  if v_type is null or v_holder not in ('company', 'premises', 'employee') or length(v_reason) > 200 then
    raise exception 'invalid_line' using errcode = '22023';
  end if;
  if v_holder = 'employee' then
    select branch_id into v_branch from employees where id = v_employee and business_id = v_business;
    if v_branch is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  else
    v_employee := null;
    if v_branch is null or not exists (select 1 from branches where id = v_branch and business_id = v_business) then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;
  v_template := exists (select 1 from public.compliance_template(v_business) t
                        where t.doc_type = v_type and (t.holder_type = 'employee') = (v_holder = 'employee'));
  select * into d from compliance_documents
  where business_id = v_business and active and doc_type = v_type and employee_id is not distinct from v_employee
    and (v_holder = 'employee' or branch_id is not distinct from v_branch)
  for update;
  if d.id is null and not v_template then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from compliance_removals x where x.business_id = v_business and x.doc_type = v_type
             and coalesce(x.employee_id, x.branch_id) = coalesce(v_employee, v_branch)) then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if d.id is not null then
    update compliance_documents set active = false, removed_at = now(), removed_by = m.id, remove_reason = v_reason
    where id = d.id;
  end if;
  if not public.in_my_branches(v_branch) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  insert into compliance_removals (business_id, branch_id, employee_id, doc_type, holder_type, document_id, reason, removed_by)
  values (v_business, case when v_holder = 'employee' then null else v_branch end, v_employee, v_type, v_holder, d.id,
          v_reason, m.id);
  perform public.write_audit(v_business, v_branch, m.id, 'remove', 'compliance_document', coalesce(d.id, v_employee, v_branch),
    'Deleted ' || public.doc_label(v_type)
    || coalesce(' for ' || (select full_name from employees where id = v_employee), '')
    || ' from the register' || coalesce(': ' || v_reason, ''));
end;
$$;

-- Compliance records: owner and manager, in the manager's branches (restore_document_slot).
create or replace function public.restore_document_slot(p_removal uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  x compliance_removals;
  m members;
begin
  select * into x from compliance_removals where id = p_removal for update;
  if x.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_can_business(x.business_id, 'manageCompliance');
  if not public.in_my_branches(coalesce(x.branch_id, (select branch_id from employees where id = x.employee_id))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if x.document_id is not null and not exists (
      select 1 from compliance_documents d where d.business_id = x.business_id and d.active and d.doc_type = x.doc_type
        and d.employee_id is not distinct from x.employee_id
        and (x.holder_type = 'employee' or d.branch_id is not distinct from x.branch_id)) then
    update compliance_documents set active = true, removed_at = null, removed_by = null, remove_reason = null
    where id = x.document_id;
  end if;
  delete from compliance_removals where id = x.id;
  perform public.write_audit(x.business_id, coalesce(x.branch_id, (select branch_id from employees where id = x.employee_id)),
    m.id, 'restore', 'compliance_document', coalesce(x.document_id, x.employee_id, x.branch_id),
    'Put back ' || public.doc_label(x.doc_type)
    || coalesce(' for ' || (select full_name from employees where id = x.employee_id), ''));
end;
$$;

-- The daily hygiene log: owner, manager, front desk and stylists.
create or replace function public.sign_hygiene_log(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_can(v_branch, 'signHygiene');
  v_today date := public.branch_today(v_branch);
  v_path text := nullif(p ->> 'evidence_path', '');
  v_list jsonb := '{}';
  k text;
  v_id uuid;
begin
  foreach k in array public.hygiene_items() loop
    v_list := v_list || jsonb_build_object(k, coalesce((p -> 'checklist' ->> k)::boolean, false));
  end loop;
  if coalesce((public.branch_setting(v_branch, 'require_hygiene_evidence', 'false'))::text::boolean, false)
     and v_path is null then
    raise exception 'evidence_required' using errcode = '22023';
  end if;
  if v_path is not null and (split_part(v_path, '/', 1) <> m.business_id::text or split_part(v_path, '/', 2) <> 'hygiene'
     or not exists (select 1 from storage.objects o where o.bucket_id = 'documents' and o.name = v_path)) then
    raise exception 'receipt_missing' using errcode = '22023';
  end if;
  if exists (select 1 from hygiene_logs where branch_id = v_branch and business_date = v_today) then
    raise exception 'already_signed' using errcode = '22023';
  end if;
  insert into hygiene_logs (business_id, branch_id, business_date, checklist, note, evidence_path, signed_by)
  values (m.business_id, v_branch, v_today, v_list, nullif(btrim(p ->> 'note'), ''), v_path, m.id)
  returning id into v_id;
  perform public.write_audit(m.business_id, v_branch, m.id, 'sign', 'hygiene_log', v_id,
    'Signed the hygiene log: ' || (select count(*) from jsonb_each_text(v_list) where value = 'true') || ' of '
    || array_length(public.hygiene_items(), 1) || ' done');
  return v_id;
end;
$$;
