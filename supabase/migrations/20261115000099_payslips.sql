-- Part C2 (owner's app check, 9 Nov 2026): full payslips, "Tips this month" on My pay, and paying with the date it was
-- paid.
-- * payslip_details: the salon, the person (name, staff ID, job), the month, days employed, days worked and late days,
--   tips kept that month, and "To pay" / "Paid on <date>". The money lines are the payroll line itself.
-- * pay_extras: tips kept, days worked and late days for one person and month (My pay's "Tips this month").
-- * pay_payroll_line takes the day it was paid: by bank any day from the month's first day to today; in cash only today
--   (cash leaves today's drawer). The books record the payment on that day; a closed month refuses it, as before.
-- Who may read: the owner and the accountant (payroll), and each person their own (approved months only). Nothing
-- recorded changes; paid lines get their paid day from the time they were paid.

alter table public.payroll_lines add column paid_on date;

update public.payroll_lines l
set paid_on = (l.paid_at at time zone coalesce(b.timezone, 'Asia/Dubai'))::date
from public.businesses b
where b.id = l.business_id and l.paid_at is not null and l.paid_on is null;

-- May the signed-in person see this person's pay? Payroll readers in the salon, or the person themselves.
create function public.can_see_pay(p_employee uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from employees e join members m on m.id = e.member_id
                 where e.id = p_employee and m.user_id = auth.uid() and m.active)
      or exists (select 1 from employees e join members m on m.business_id = e.business_id
                 where e.id = p_employee and m.user_id = auth.uid() and m.active
                   and public.role_level(m.role, 'viewPayroll') is not null)
$$;
revoke execute on function public.can_see_pay(uuid) from public, anon, authenticated;

-- Tips kept (this month's tips less tips refunded this month), days worked and late days, as Reports → Staff sales.
create function public.pay_extras(p_employee uuid, p_period text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  b record;
begin
  if p_period !~ '^\d{4}-\d{2}$' then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  if not public.can_see_pay(p_employee) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  b := public.month_bounds(p_period);
  return jsonb_build_object(
    'tips_minor',
      coalesce((select sum(s.tip_minor) from sales s where s.tip_employee_id = p_employee
                and s.business_date between b.d_from and b.d_to), 0)
      - coalesce((select sum(r.tip_minor) from refunds r join sales s on s.id = r.sale_id
                  where s.tip_employee_id = p_employee and r.business_date between b.d_from and b.d_to), 0),
    'days_worked', (select count(*) from attendance a where a.employee_id = p_employee
                    and a.business_date between b.d_from and b.d_to),
    'late_days', (select count(*) from attendance a where a.employee_id = p_employee and a.late
                  and a.business_date between b.d_from and b.d_to));
end;
$$;

-- Everything a payslip shows besides its money lines.
create function public.payslip_details(p_line uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  l payroll_lines;
  r payroll_runs;
  e employees;
  v_own boolean;
begin
  select * into l from payroll_lines where id = p_line;
  if l.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into r from payroll_runs where id = l.run_id;
  select * into e from employees where id = l.employee_id;
  if not public.can_see_pay(e.id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_own := exists (select 1 from members m where m.id = e.member_id and m.user_id = auth.uid());
  -- A person sees their payslip once the month is approved, as on My pay.
  if v_own and r.status = 'generated'
     and not exists (select 1 from members m where m.business_id = e.business_id and m.user_id = auth.uid() and m.active
                     and public.role_level(m.role, 'viewPayroll') is not null) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'business_name', (select name from businesses where id = l.business_id),
    'branch_name', (select name from branches where id = l.branch_id),
    'full_name', e.full_name,
    'employee_code', e.employee_code,
    'role_title', e.role_title,
    'period', r.period,
    'status', r.status,
    'paid_on', l.paid_on,
    'paid_method', l.paid_method,
    'days_employed', l.days_employed,
    'days_in_month', l.days_in_month)
    || public.pay_extras(e.id, r.period);
end;
$$;

revoke execute on function public.pay_extras(uuid, text), public.payslip_details(uuid) from public, anon;
grant execute on function public.pay_extras(uuid, text), public.payslip_details(uuid) to authenticated;

drop function public.pay_payroll_line(uuid, text);
create function public.pay_payroll_line(p_line uuid, p_method text, p_paid_on date default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  l payroll_lines;
  r payroll_runs;
  e employees;
  m members;
  v_method payment_method := p_method::payment_method;
  v_today date;
  v_day date;
begin
  select * into l from payroll_lines where id = p_line for update;
  if l.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into r from payroll_runs where id = l.run_id for update;
  select * into e from employees where id = l.employee_id;
  m := public.require_can(l.branch_id, 'payPayroll');
  if r.status <> 'approved' or l.paid_at is not null then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if v_method not in ('cash', 'bank') then
    raise exception 'invalid_payment' using errcode = '22023';
  end if;
  -- Cash comes out of the drawer: only people who work the drawer pay in cash.
  if v_method = 'cash' and public.role_level(m.role, 'countCash') is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_today := public.branch_today(l.branch_id);
  v_day := coalesce(p_paid_on, v_today);
  -- Paid from the month's first day up to today; cash leaves today's drawer, so it is paid today.
  if v_day > v_today or v_day < to_date(r.period, 'YYYY-MM') or (v_method = 'cash' and v_day <> v_today) then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
  update payroll_lines set paid_method = v_method, paid_at = now(), paid_on = v_day, paid_by = m.id where id = l.id;
  perform public.post_journal(l.business_id, l.branch_id, v_day, 'payroll_payment', l.id,
    'Salary ' || r.period || ' — ' || e.full_name, m.id,
    jsonb_build_array(jsonb_build_object('account', 'salaries_payable', 'debit', l.net_minor),
                      jsonb_build_object('account', public.paid_from_account(v_method), 'credit', l.net_minor)));
  if not exists (select 1 from payroll_lines where run_id = r.id and paid_at is null) then
    update payroll_runs set status = 'paid' where id = r.id;
  end if;
  perform public.write_audit(l.business_id, l.branch_id, m.id, 'pay', 'payroll_line', l.id,
    'Paid ' || r.period || ' salary ' || public.fmt_money(l.net_minor) || ' to ' || e.full_name || ' by ' || v_method
    || case when v_day <> v_today then ' on ' || to_char(v_day, 'YYYY-MM-DD') else '' end);
end;
$$;
revoke execute on function public.pay_payroll_line(uuid, text, date) from public, anon;
grant execute on function public.pay_payroll_line(uuid, text, date) to authenticated;
