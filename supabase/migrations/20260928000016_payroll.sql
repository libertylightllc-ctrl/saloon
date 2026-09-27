-- M3 · Payroll (01-PRODUCT §3.10, 04-DATA-MODEL §5/§7).
-- Adjustments per month: bonus, deduction, advance (an advance is money out now: Dr Staff advances · Cr cash/bank).
-- A run per month is generated (a draft that can be regenerated), approved (posts the month's pay:
-- Dr Salaries (base + bonus − deductions) + Dr Commission · Cr Salaries payable (net) + Cr Staff advances
-- (recovered)), then paid per person (Dr Salaries payable · Cr cash/bank). WPS evidence proves bank pay.

create table public.payroll_adjustments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  employee_id uuid not null references public.employees (id),
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  kind text not null check (kind in ('bonus', 'deduction', 'advance')),
  amount_minor bigint not null check (amount_minor > 0),
  method public.payment_method check (method in ('cash', 'bank')),
  business_date date not null,
  note text check (note is null or length(note) <= 200),
  status text not null default 'posted' check (status in ('posted', 'reversed')),
  reverse_reason text,
  client_ref text unique,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((kind = 'advance') = (method is not null))
);
create index payroll_adjustments_period_idx on public.payroll_adjustments (business_id, period);

create table public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  status text not null default 'generated' check (status in ('generated', 'approved', 'paid')),
  generated_by uuid references public.members (id) on delete set null,
  generated_at timestamptz not null default now(),
  approved_by uuid references public.members (id) on delete set null,
  approved_at timestamptz,
  unique (business_id, period)
);

create table public.payroll_lines (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.payroll_runs (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  employee_id uuid not null references public.employees (id),
  base_minor bigint not null default 0,
  commission_minor bigint not null default 0,
  bonus_minor bigint not null default 0,
  deductions_minor bigint not null default 0,
  advances_minor bigint not null default 0,
  net_minor bigint not null check (net_minor >= 0),
  paid_method public.payment_method check (paid_method in ('cash', 'bank')),
  paid_at timestamptz,
  paid_by uuid references public.members (id) on delete set null,
  wps_status text not null default 'na' check (wps_status in ('na', 'required', 'proven')),
  wps_evidence_path text,
  unique (run_id, employee_id)
);

alter table public.payroll_adjustments enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_lines enable row level security;
-- Owner and accountant only — a cashier never reads pay. Staff read their own approved payslips.
create policy "owner and accountant read adjustments" on public.payroll_adjustments for select to authenticated
  using (public.has_role(business_id, array['owner', 'accountant']::public.member_role[]));
create policy "staff read their own adjustments" on public.payroll_adjustments for select to authenticated
  using (status = 'posted' and exists (select 1 from employees e join members m on m.id = e.member_id
                                       where e.id = employee_id and m.user_id = auth.uid()));
create policy "owner and accountant read runs" on public.payroll_runs for select to authenticated
  using (public.has_role(business_id, array['owner', 'accountant']::public.member_role[]));
create policy "staff read approved runs" on public.payroll_runs for select to authenticated
  using (status <> 'generated' and public.has_role(business_id, array['staff']::public.member_role[]));
create policy "owner and accountant read payroll lines" on public.payroll_lines for select to authenticated
  using (public.has_role(business_id, array['owner', 'accountant']::public.member_role[]));
create policy "staff read their own payslips" on public.payroll_lines for select to authenticated
  using (exists (select 1 from payroll_runs r where r.id = run_id and r.status <> 'generated')
         and exists (select 1 from employees e join members m on m.id = e.member_id
                     where e.id = employee_id and m.user_id = auth.uid()));
revoke insert, update, delete, truncate, references, trigger
  on public.payroll_adjustments, public.payroll_runs, public.payroll_lines from anon, authenticated;

-- Private bucket for documents: WPS transfer proofs, compliance evidence, hygiene photos.
-- Owner uploads anywhere in the business folder; a cashier only hygiene photos. Owner and accountant read.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;
create policy "owner uploads documents" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] in (
    select m.business_id::text from public.members m
    where m.user_id = auth.uid() and m.active and (m.role = 'owner'
          or (m.role = 'cashier' and (storage.foldername(name))[2] = 'hygiene'))));
create policy "owner and accountant read documents" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] in (
    select m.business_id::text from public.members m
    where m.user_id = auth.uid() and m.active and (m.role in ('owner', 'accountant')
          or (m.role = 'cashier' and (storage.foldername(name))[2] = 'hygiene'))));

-- ── Adjustments ────────────────────────────────────────────────────────────────────────

-- Owner. p: {employee_id, kind, amount_minor, method? (advance), note?, client_ref?}. The period is this month.
create function public.record_adjustment(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e employees;
  m members;
  v_kind text := p ->> 'kind';
  v_amount bigint := (p ->> 'amount_minor')::bigint;
  v_method payment_method := case when p ->> 'kind' = 'advance'
                                  then coalesce(nullif(p ->> 'method', ''), 'cash')::payment_method end;
  v_ref text := nullif(p ->> 'client_ref', '');
  v_today date;
  v_period text;
  v_id uuid;
begin
  if v_ref is not null and exists (select 1 from payroll_adjustments where client_ref = v_ref) then
    return jsonb_build_object('adjustment_id', (select id from payroll_adjustments where client_ref = v_ref), 'repeated', true);
  end if;
  select * into e from employees where id = (p ->> 'employee_id')::uuid;
  if e.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_member(e.branch_id, array['owner']::member_role[]);
  if v_kind not in ('bonus', 'deduction', 'advance') then
    raise exception 'invalid_line' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if v_method is not null and v_method not in ('cash', 'bank') then
    raise exception 'invalid_payment' using errcode = '22023';
  end if;
  v_today := public.branch_today(e.branch_id);
  v_period := to_char(v_today, 'YYYY-MM');
  if exists (select 1 from payroll_runs where business_id = e.business_id and period = v_period and status <> 'generated') then
    raise exception 'payroll_approved' using errcode = '22023';
  end if;
  insert into payroll_adjustments (business_id, branch_id, employee_id, period, kind, amount_minor, method, business_date,
                                   note, client_ref, created_by)
  values (e.business_id, e.branch_id, e.id, v_period, v_kind, v_amount, v_method, v_today,
          nullif(btrim(p ->> 'note'), ''), v_ref, m.id)
  returning id into v_id;
  if v_kind = 'advance' then
    perform public.post_journal(e.business_id, e.branch_id, v_today, 'staff_advance', v_id, 'Advance to ' || e.full_name, m.id,
      jsonb_build_array(jsonb_build_object('account', 'staff_advances', 'debit', v_amount),
                        jsonb_build_object('account', public.paid_from_account(v_method), 'credit', v_amount)));
  end if;
  perform public.write_audit(e.business_id, e.branch_id, m.id, 'create', 'payroll_adjustment', v_id,
    initcap(v_kind) || ' ' || public.fmt_money(v_amount) || ' for ' || e.full_name
    || coalesce(': ' || nullif(btrim(p ->> 'note'), ''), ''));
  return jsonb_build_object('adjustment_id', v_id, 'repeated', false);
end;
$$;

-- Owner: reverse an adjustment with a reason while its month is not approved (an advance's money comes back).
create function public.reverse_adjustment(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a payroll_adjustments;
  m members;
begin
  select * into a from payroll_adjustments where id = p_id for update;
  if a.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_member(a.branch_id, array['owner']::member_role[]);
  if a.status <> 'posted' then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if exists (select 1 from payroll_runs where business_id = a.business_id and period = a.period and status <> 'generated') then
    raise exception 'payroll_approved' using errcode = '22023';
  end if;
  update payroll_adjustments set status = 'reversed', reverse_reason = btrim(p_reason) where id = a.id;
  if a.kind = 'advance' then
    perform public.post_journal(a.business_id, a.branch_id, public.branch_today(a.branch_id), 'staff_advance_reversal', a.id,
      'Advance reversed', m.id,
      jsonb_build_array(jsonb_build_object('account', public.paid_from_account(a.method), 'debit', a.amount_minor),
                        jsonb_build_object('account', 'staff_advances', 'credit', a.amount_minor)));
  end if;
  perform public.write_audit(a.business_id, a.branch_id, m.id, 'reverse', 'payroll_adjustment', a.id,
    'Reversed ' || a.kind || ' ' || public.fmt_money(a.amount_minor) || ': ' || btrim(p_reason));
end;
$$;

-- ── Runs ────────────────────────────────────────────────────────────────────────────────

-- Commission a person earned in a month: sale-line commission, less the refunded share of each sale.
create function public.commission_for(p_employee uuid, p_period text) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(sum(round(sl.commission_minor::numeric * (s.total_minor - s.refunded_minor)
                            / nullif(s.total_minor, 0))), 0)::bigint
  from sale_lines sl join sales s on s.id = sl.sale_id
  where sl.employee_id = p_employee and to_char(s.business_date, 'YYYY-MM') = p_period
$$;

-- Owner: work out (or work out again) a month's pay. Only while the run is still a draft.
create function public.generate_payroll(p_business uuid, p_period text) returns uuid
language plpgsql security definer set search_path = public as $$
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
  if p_period !~ '^\d{4}-\d{2}$' or p_period > to_char(now(), 'YYYY-MM') then
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
$$;

-- Owner: approve a generated month; its pay is posted to the books (dated the month end, or today if earlier).
create function public.approve_payroll(p_run uuid) returns void
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

-- Owner: pay one person's net for an approved month, in cash (from the drawer) or by bank.
create function public.pay_payroll_line(p_line uuid, p_method text) returns void
language plpgsql security definer set search_path = public as $$
declare
  l payroll_lines;
  r payroll_runs;
  e employees;
  m members;
  v_method payment_method := p_method::payment_method;
begin
  select * into l from payroll_lines where id = p_line for update;
  if l.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into r from payroll_runs where id = l.run_id for update;
  select * into e from employees where id = l.employee_id;
  m := public.require_member(l.branch_id, array['owner']::member_role[]);
  if r.status <> 'approved' or l.paid_at is not null then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if v_method not in ('cash', 'bank') then
    raise exception 'invalid_payment' using errcode = '22023';
  end if;
  update payroll_lines set paid_method = v_method, paid_at = now(), paid_by = m.id where id = l.id;
  perform public.post_journal(l.business_id, l.branch_id, public.branch_today(l.branch_id), 'payroll_payment', l.id,
    'Salary ' || r.period || ' — ' || e.full_name, m.id,
    jsonb_build_array(jsonb_build_object('account', 'salaries_payable', 'debit', l.net_minor),
                      jsonb_build_object('account', public.paid_from_account(v_method), 'credit', l.net_minor)));
  if not exists (select 1 from payroll_lines where run_id = r.id and paid_at is null) then
    update payroll_runs set status = 'paid' where id = r.id;
  end if;
  perform public.write_audit(l.business_id, l.branch_id, m.id, 'pay', 'payroll_line', l.id,
    'Paid ' || r.period || ' salary ' || public.fmt_money(l.net_minor) || ' to ' || e.full_name || ' by ' || v_method);
end;
$$;

-- Owner: attach the bank-transfer proof for a WPS payslip (a file in the documents bucket).
create function public.attach_wps_evidence(p_line uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare
  l payroll_lines;
  m members;
begin
  select * into l from payroll_lines where id = p_line for update;
  if l.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  m := public.require_member(l.branch_id, array['owner']::member_role[]);
  if l.paid_at is null or l.wps_status = 'na' then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if split_part(p_path, '/', 1) <> l.business_id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'documents' and o.name = p_path) then
    raise exception 'receipt_missing' using errcode = '22023';
  end if;
  update payroll_lines set wps_status = 'proven', wps_evidence_path = p_path where id = l.id;
  perform public.write_audit(l.business_id, l.branch_id, m.id, 'attach', 'payroll_line', l.id, 'Added WPS transfer proof');
end;
$$;

revoke execute on function public.record_adjustment(jsonb), public.reverse_adjustment(uuid, text),
  public.commission_for(uuid, text), public.generate_payroll(uuid, text), public.approve_payroll(uuid),
  public.pay_payroll_line(uuid, text), public.attach_wps_evidence(uuid, text) from public, anon;
revoke execute on function public.commission_for(uuid, text) from authenticated;
grant execute on function public.record_adjustment(jsonb), public.reverse_adjustment(uuid, text),
  public.generate_payroll(uuid, text), public.approve_payroll(uuid), public.pay_payroll_line(uuid, text),
  public.attach_wps_evidence(uuid, text) to authenticated;

alter publication supabase_realtime add table public.payroll_runs, public.payroll_lines, public.payroll_adjustments;
