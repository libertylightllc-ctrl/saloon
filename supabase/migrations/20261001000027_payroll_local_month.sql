-- Payroll's "not a future month" check used the database's clock (UTC) instead of the salon's date: from midnight to
-- 04:00 on the 1st in Dubai the new month counted as the future, so it could not be worked out, while bonuses and
-- advances entered then already belonged to it (found by the proof run at 00:13 on 1 October). Rule 8: the business
-- date is the salon's local date.

CREATE OR REPLACE FUNCTION public.generate_payroll(p_business uuid, p_period text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  m members;
  r payroll_runs;
  e employees;
  v_base bigint;
  v_comm bigint;
  v_bonus bigint;
  v_ded bigint;
  v_outstanding bigint;
  v_adv bigint;
  v_gross bigint;
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
  for e in select * from employees where business_id = p_business order by full_name loop
    v_base := case when e.active then e.base_salary_minor else 0 end;
    v_comm := public.commission_for(e.id, p_period);
    select coalesce(sum(amount_minor) filter (where kind = 'bonus'), 0),
           coalesce(sum(amount_minor) filter (where kind = 'deduction'), 0)
      into v_bonus, v_ded
    from payroll_adjustments where employee_id = e.id and period = p_period and status = 'posted';
    -- Advances not yet recovered by an approved month (this one's included).
    v_outstanding := coalesce((select sum(amount_minor) from payroll_adjustments
                               where employee_id = e.id and kind = 'advance' and status = 'posted' and period <= p_period), 0)
                   - coalesce((select sum(l.advances_minor) from payroll_lines l join payroll_runs x on x.id = l.run_id
                               where l.employee_id = e.id and x.status <> 'generated' and x.period < p_period), 0);
    continue when v_base = 0 and v_comm = 0 and v_bonus = 0 and v_ded = 0 and v_outstanding <= 0;
    v_ded := least(v_ded, v_base + v_comm + v_bonus);
    v_gross := v_base + v_comm + v_bonus - v_ded;
    v_adv := least(greatest(v_outstanding, 0), v_gross);
    insert into payroll_lines (run_id, business_id, branch_id, employee_id, base_minor, commission_minor, bonus_minor,
                               deductions_minor, advances_minor, net_minor, wps_status)
    values (r.id, p_business, e.branch_id, e.id, v_base, v_comm, v_bonus, v_ded, v_adv, v_gross - v_adv,
            case when e.wps_required then 'required' else 'na' end);
  end loop;
  perform public.write_audit(p_business, null, m.id, 'generate', 'payroll_run', r.id,
    'Generated payroll ' || p_period || ': net ' || public.fmt_money(
      coalesce((select sum(net_minor) from payroll_lines where run_id = r.id), 0)::bigint));
  return r.id;
end;
$function$;
