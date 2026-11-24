-- Platform console, Part A (owner's brief, 24 Nov 2026).
--
-- A10. A salon approved November's payroll on 16 November: sales, attendance and leave after that day were never in
-- it. Working a month out early is still allowed (the app warns that later days won't be in it), but approving waits
-- for the month's last day. The owner may approve early by giving a reason, which is kept on the run and in the
-- salon's Activity ("Approved payroll 2026-11 before the month ended (staff travelling): net QAR 4,900.00").

alter table public.payroll_runs add column approved_early_reason text;

drop function public.approve_payroll(uuid);
create function public.approve_payroll(p_run uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  r payroll_runs;
  m members;
  v_date date;
  v_today date;
  v_last date;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
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
  v_today := (now() at time zone (select timezone from businesses where id = r.business_id))::date;
  v_last := (to_date(r.period || '-01', 'YYYY-MM-DD') + interval '1 month - 1 day')::date;
  -- Not before the month's last day, unless the owner says why (A10).
  if v_today < v_last then
    if v_reason is null then
      raise exception 'month_not_over' using errcode = '22023';
    end if;
    if length(v_reason) < 3 then
      raise exception 'reason_required' using errcode = '22023';
    end if;
  else
    v_reason := null;
  end if;
  v_date := least(v_last, v_today);
  select sum(base_minor + bonus_minor - deductions_minor)::bigint as salaries, sum(commission_minor)::bigint as commission,
         sum(net_minor)::bigint as net, sum(advances_minor)::bigint as advances
    into t from payroll_lines where run_id = r.id;
  perform public.post_journal(r.business_id, null, v_date, 'payroll', r.id, 'Payroll ' || r.period, m.id,
    jsonb_build_array(jsonb_build_object('account', 'salaries_expense', 'debit', t.salaries),
                      jsonb_build_object('account', 'commission_expense', 'debit', t.commission),
                      jsonb_build_object('account', 'salaries_payable', 'credit', t.net),
                      jsonb_build_object('account', 'staff_advances', 'credit', t.advances)));
  update payroll_runs set status = case when t.net = 0 then 'paid' else 'approved' end,
    approved_by = m.id, approved_at = now(), approved_early_reason = left(v_reason, 200) where id = r.id;
  update payroll_lines set paid_at = now(), paid_by = m.id where run_id = r.id and net_minor = 0;
  perform public.write_audit(r.business_id, null, m.id, 'approve', 'payroll_run', r.id,
    'Approved payroll ' || r.period
      || case when v_reason is not null then ' before the month ended (' || left(v_reason, 200) || ')' else '' end
      || ': net ' || public.fmt_money(t.net));
end;
$$;
revoke execute on function public.approve_payroll(uuid, text) from public, anon;
grant execute on function public.approve_payroll(uuid, text) to authenticated, service_role;
