-- A1 (owner's app check, 9 Nov 2026): payroll was approved without being worked out again, so a sale saved after it was
-- worked out was left out of the commission.
--  * payroll_figures: what each person's line comes to now (the work-out's own rules, moved out of generate_payroll).
--  * generate_payroll writes those figures; approve_payroll refuses ('payroll_changed') while the stored lines differ
--    from them, so a sale, refund, bonus, deduction, advance or salary change since the work-out needs it worked out again.
--  * payroll_changes (owner and accountant): whether the month changed since it was worked out and how many sales,
--    refunds and pay changes came after; for an approved month, the commission on sales saved after the work-out that
--    it did not include, by person (nothing recorded changes: the owner can pay it as a bonus).

create function public.payroll_figures(p_business uuid, p_period text)
returns table (employee_id uuid, branch_id uuid, base_minor bigint, commission_minor bigint, bonus_minor bigint,
               deductions_minor bigint, advances_minor bigint, net_minor bigint, wps_status text)
language plpgsql stable security definer set search_path = public as $$
declare
  e employees;
  v_base bigint;
  v_comm bigint;
  v_bonus bigint;
  v_ded bigint;
  v_outstanding bigint;
  v_adv bigint;
  v_gross bigint;
begin
  for e in select * from employees where business_id = p_business order by full_name loop
    v_base := case when e.active then e.base_salary_minor else 0 end;
    v_comm := public.commission_for(e.id, p_period);
    select coalesce(sum(a.amount_minor) filter (where a.kind = 'bonus'), 0),
           coalesce(sum(a.amount_minor) filter (where a.kind = 'deduction'), 0)
      into v_bonus, v_ded
    from payroll_adjustments a where a.employee_id = e.id and a.period = p_period and a.status = 'posted';
    -- Advances not yet recovered by an approved month (this one's included).
    v_outstanding := coalesce((select sum(a.amount_minor) from payroll_adjustments a
                               where a.employee_id = e.id and a.kind = 'advance' and a.status = 'posted'
                                 and a.period <= p_period), 0)
                   - coalesce((select sum(l.advances_minor) from payroll_lines l join payroll_runs x on x.id = l.run_id
                               where l.employee_id = e.id and x.status <> 'generated' and x.period < p_period), 0);
    continue when v_base = 0 and v_comm = 0 and v_bonus = 0 and v_ded = 0 and v_outstanding <= 0;
    v_ded := least(v_ded, v_base + v_comm + v_bonus);
    v_gross := v_base + v_comm + v_bonus - v_ded;
    v_adv := least(greatest(v_outstanding, 0), v_gross);
    employee_id := e.id; branch_id := e.branch_id; base_minor := v_base; commission_minor := v_comm;
    bonus_minor := v_bonus; deductions_minor := v_ded; advances_minor := v_adv; net_minor := v_gross - v_adv;
    wps_status := case when e.wps_required then 'required' else 'na' end;
    return next;
  end loop;
end;
$$;

create or replace function public.generate_payroll(p_business uuid, p_period text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m members;
  r payroll_runs;
begin
  select * into m from members where business_id = p_business and user_id = auth.uid() and active and role = 'owner';
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_period !~ '^\d{4}-\d{2}$' or p_period > to_char(public.business_today(p_business), 'YYYY-MM') then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  select * into r from payroll_runs where business_id = p_business and period = p_period for update;
  if r.status in ('approved', 'paid') then
    raise exception 'payroll_approved' using errcode = '22023';
  end if;
  if r.id is null then
    insert into payroll_runs (business_id, period, generated_by) values (p_business, p_period, m.id) returning * into r;
  else
    -- A draft is only figures: replace them.
    delete from payroll_lines where run_id = r.id;
    update payroll_runs set generated_by = m.id, generated_at = now() where id = r.id;
  end if;
  insert into payroll_lines (run_id, business_id, branch_id, employee_id, base_minor, commission_minor, bonus_minor,
                             deductions_minor, advances_minor, net_minor, wps_status)
  select r.id, p_business, f.branch_id, f.employee_id, f.base_minor, f.commission_minor, f.bonus_minor,
         f.deductions_minor, f.advances_minor, f.net_minor, f.wps_status
  from public.payroll_figures(p_business, p_period) f;
  perform public.write_audit(p_business, null, m.id, 'generate', 'payroll_run', r.id,
    'Generated payroll ' || p_period || ': net ' || public.fmt_money(
      coalesce((select sum(net_minor) from payroll_lines where run_id = r.id), 0)::bigint));
  return r.id;
end;
$function$;

-- The stored lines no longer match what the month comes to now.
create function public.payroll_stale(p_run uuid) returns boolean
language sql stable security definer set search_path = public as $$
  with r as (select * from payroll_runs where id = p_run),
  now_ as (select f.employee_id, f.base_minor, f.commission_minor, f.bonus_minor, f.deductions_minor, f.advances_minor,
                  f.net_minor
           from r, public.payroll_figures(r.business_id, r.period) f),
  saved as (select l.employee_id, l.base_minor, l.commission_minor, l.bonus_minor, l.deductions_minor, l.advances_minor,
                   l.net_minor
            from payroll_lines l where l.run_id = p_run)
  select exists (select * from now_ except select * from saved) or exists (select * from saved except select * from now_)
$$;

create function public.payroll_changes(p_run uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r payroll_runs;
  v_changes int;
  v_missed jsonb;
begin
  select * into r from payroll_runs where id = p_run;
  if r.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not public.has_role(r.business_id, array['owner', 'accountant']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- What came in after the work-out: the month's sales and refunds, and its pay changes.
  v_changes := (select count(*) from sales s where s.business_id = r.business_id and s.created_at > r.generated_at
                  and to_char(s.business_date, 'YYYY-MM') = r.period)
             + (select count(*) from refunds f where f.business_id = r.business_id and f.created_at > r.generated_at
                  and to_char(f.business_date, 'YYYY-MM') = r.period)
             + (select count(*) from payroll_adjustments a where a.business_id = r.business_id
                  and a.created_at > r.generated_at and a.period <= r.period);
  -- An approved month: the commission on its sales saved after the work-out, by person.
  select coalesce(jsonb_agg(jsonb_build_object('employee_id', x.employee_id, 'full_name', x.full_name,
                                               'commission_minor', x.missed) order by x.full_name), '[]')
    into v_missed
  from (select e.id as employee_id, e.full_name, sum(sl.commission_minor)::bigint as missed
        from sale_lines sl join sales s on s.id = sl.sale_id join employees e on e.id = sl.employee_id
        where r.status <> 'generated' and s.business_id = r.business_id and s.created_at > r.generated_at
          and to_char(s.business_date, 'YYYY-MM') = r.period
        group by e.id, e.full_name having sum(sl.commission_minor) > 0) x;
  return jsonb_build_object(
    'generated_at', r.generated_at,
    'stale', r.status = 'generated' and public.payroll_stale(r.id),
    'changes', v_changes,
    'missed', v_missed,
    'missed_minor', (select coalesce(sum((m ->> 'commission_minor')::bigint), 0) from jsonb_array_elements(v_missed) m));
end;
$$;

revoke execute on function public.payroll_figures(uuid, text), public.payroll_stale(uuid) from public, anon, authenticated;
revoke execute on function public.payroll_changes(uuid) from public, anon;
grant execute on function public.payroll_changes(uuid) to authenticated;

create or replace function public.approve_payroll(p_run uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r payroll_runs;
  m members;
  v_date date;
  t record;
begin
  select * into r from payroll_runs where id = p_run for update;
  if r.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into m from members where business_id = r.business_id and user_id = auth.uid() and active and role = 'owner';
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if r.status <> 'generated' then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if not exists (select 1 from payroll_lines where run_id = r.id) then
    raise exception 'lines_required' using errcode = '22023';
  end if;
  -- Approve only what the month adds up to now (owner's app check A1): a sale, refund, bonus or salary change since it
  -- was worked out means working it out again first.
  if public.payroll_stale(r.id) then
    raise exception 'payroll_changed' using errcode = '22023';
  end if;
  v_date := least((to_date(r.period || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date,
                  (now() at time zone (select timezone from businesses where id = r.business_id))::date);
  select sum(base_minor + bonus_minor - deductions_minor)::bigint as salaries, sum(commission_minor)::bigint as commission,
         sum(net_minor)::bigint as net, sum(advances_minor)::bigint as advances
    into t from payroll_lines where run_id = r.id;
  perform public.post_journal(r.business_id, null, v_date, 'payroll', r.id, 'Payroll ' || r.period, m.id,
    jsonb_build_array(jsonb_build_object('account', 'salaries_expense', 'debit', t.salaries),
                      jsonb_build_object('account', 'commission_expense', 'debit', t.commission),
                      jsonb_build_object('account', 'salaries_payable', 'credit', t.net),
                      jsonb_build_object('account', 'staff_advances', 'credit', t.advances)));
  update payroll_runs set status = case when t.net = 0 then 'paid' else 'approved' end,
    approved_by = m.id, approved_at = now() where id = r.id;
  update payroll_lines set paid_at = now(), paid_by = m.id where run_id = r.id and net_minor = 0;
  perform public.write_audit(r.business_id, null, m.id, 'approve', 'payroll_run', r.id,
    'Approved payroll ' || r.period || ': net ' || public.fmt_money(t.net));
end;
$$;

