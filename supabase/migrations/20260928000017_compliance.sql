-- M3 · Compliance, UAE profile (01-PRODUCT §3.11): expiry register with versions and evidence, the daily
-- hygiene log, the inspection binder's data, WPS & Montaji, and the readiness score.
-- What an inspector expects is a template: per branch a trade licence, Ejari, pest control and civil defence
-- certificate; per active staff member (not the owner) a health card, visa and vaccination record.
-- Documents fill those slots; a slot with no document is "missing".

create table public.compliance_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid references public.branches (id) on delete cascade,
  doc_type text not null check (length(btrim(doc_type)) between 1 and 60),
  holder_type text not null check (holder_type in ('company', 'premises', 'employee')),
  employee_id uuid references public.employees (id) on delete cascade,
  number text check (number is null or length(number) <= 60),
  issued_on date,
  expires_on date,
  renewal_cost_minor bigint check (renewal_cost_minor is null or renewal_cost_minor >= 0),
  reminder_days int not null default 30 check (reminder_days between 0 and 365),
  evidence_path text,
  version int not null default 1,
  previous_id uuid references public.compliance_documents (id),
  active boolean not null default true,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((holder_type = 'employee') = (employee_id is not null))
);
-- One current version per slot.
create unique index compliance_documents_current_idx on public.compliance_documents
  (business_id, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), doc_type,
   coalesce(employee_id, '00000000-0000-0000-0000-000000000000'::uuid)) where active;

create table public.hygiene_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  business_date date not null,
  checklist jsonb not null,
  note text check (note is null or length(note) <= 200),
  evidence_path text,
  signed_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (branch_id, business_date)
);

alter table public.compliance_documents enable row level security;
alter table public.hygiene_logs enable row level security;
create policy "owner reads compliance documents" on public.compliance_documents for select to authenticated
  using (public.has_role(business_id, array['owner']::public.member_role[]));
create policy "owner and cashier read hygiene logs" on public.hygiene_logs for select to authenticated
  using (public.has_role(business_id, array['owner', 'cashier']::public.member_role[]) and public.can_use_branch(branch_id));
revoke insert, update, delete, truncate, references, trigger on public.compliance_documents, public.hygiene_logs
  from anon, authenticated;

-- The fixed checklist (keys; the app words them in the salon's language).
create function public.hygiene_items() returns text[]
language sql immutable as $$
  select array['tools_sterilised', 'towels_changed', 'surfaces_cleaned', 'floors_mopped', 'waste_disposed']
$$;

-- ── The register ────────────────────────────────────────────────────────────────────────

-- Every slot the salon must keep, with its current document and status:
-- valid · due_soon (within its reminder days) · expired · missing_date · evidence_missing · missing.
create function public.compliance_status(p_business uuid)
returns table (slot_key text, doc_type text, holder_type text, branch_id uuid, employee_id uuid, holder_name text,
               required boolean, document_id uuid, number text, issued_on date, expires_on date, renewal_cost_minor bigint,
               reminder_days int, evidence_path text, version int, status text, days_left int)
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone (select timezone from businesses where id = p_business))::date;
begin
  if not public.has_role(p_business, array['owner']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  with slots as (
    select t.doc_type, t.holder_type, b.id as branch_id, null::uuid as employee_id, b.name as holder_name, true as required
    from branches b
    cross join (values ('trade_licence', 'company'), ('ejari', 'premises'), ('pest_control', 'premises'),
                       ('civil_defence', 'premises')) t(doc_type, holder_type)
    where b.business_id = p_business
    union all
    select t.doc_type, 'employee', e.branch_id, e.id, e.full_name, true
    from employees e
    cross join (values ('health_card'), ('visa'), ('vaccination')) t(doc_type)
    where e.business_id = p_business and e.active
    union all
    -- The owner's own documents beyond the template.
    select d.doc_type, d.holder_type, d.branch_id, d.employee_id,
           coalesce((select full_name from employees where id = d.employee_id), (select name from branches where id = d.branch_id)),
           false
    from compliance_documents d
    where d.business_id = p_business and d.active
      and d.doc_type not in ('trade_licence', 'ejari', 'pest_control', 'civil_defence', 'health_card', 'visa', 'vaccination')
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
  order by s.holder_type = 'employee', s.holder_name, s.doc_type;
end;
$$;

-- Readiness = records valid (or due soon) with evidence ÷ records required. 0–100.
create function public.compliance_readiness(p_business uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(round(100.0 * count(*) filter (where status in ('valid', 'due_soon')) / nullif(count(*), 0))::int, 100)
  from public.compliance_status(p_business)
$$;

-- Add a document to a slot, or renew it (a new version; the old one is kept). Owner.
-- p: {business_id, branch_id?, doc_type, holder_type, employee_id?, number, issued_on, expires_on, renewal_cost_minor,
--     reminder_days}
create function public.save_document(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
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
  select * into m from members where business_id = v_business and user_id = auth.uid() and active and role = 'owner';
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
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
  insert into compliance_documents (business_id, branch_id, doc_type, holder_type, employee_id, number, issued_on, expires_on,
                                    renewal_cost_minor, reminder_days, version, previous_id, created_by)
  values (v_business, v_branch, v_type, v_holder, v_employee, nullif(btrim(p ->> 'number'), ''),
          nullif(p ->> 'issued_on', '')::date, nullif(p ->> 'expires_on', '')::date,
          nullif(p ->> 'renewal_cost_minor', '')::bigint, coalesce(nullif(p ->> 'reminder_days', '')::int, 30),
          coalesce(prev.version, 0) + 1, prev.id, m.id)
  returning id into v_id;
  perform public.write_audit(v_business, v_branch, m.id, case when prev.id is null then 'create' else 'renew' end,
    'compliance_document', v_id,
    case when prev.id is null then 'Added ' else 'Renewed ' end || v_type
    || coalesce(' for ' || (select full_name from employees where id = v_employee), '')
    || coalesce(', expires ' || to_char(nullif(p ->> 'expires_on', '')::date, 'DD Mon YYYY'), ''));
  return v_id;
end;
$$;

-- Attach the scan/photo to the current version (documents bucket). Owner.
create function public.attach_document_evidence(p_document uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare
  d compliance_documents;
  m members;
begin
  select * into d from compliance_documents where id = p_document for update;
  if d.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into m from members where business_id = d.business_id and user_id = auth.uid() and active and role = 'owner';
  if m.id is null then
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
    'Added evidence for ' || d.doc_type);
end;
$$;

-- ── Hygiene log ────────────────────────────────────────────────────────────────────────

-- Sign today's checklist (owner or cashier). Branch setting require_hygiene_evidence forces a photo.
-- p: {branch_id, checklist: {item: true|false}, note?, evidence_path?}
create function public.sign_hygiene_log(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_member(v_branch, array['owner', 'cashier']::member_role[]);
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

-- ── WPS & Montaji ─────────────────────────────────────────────────────────────────────

-- The latest approved payroll month's WPS: required, proven, % and the day-5 target (setting wps_target_pct, 85).
create function public.wps_status(p_business uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r payroll_runs;
begin
  if not public.has_role(p_business, array['owner', 'accountant']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into r from payroll_runs where business_id = p_business and status <> 'generated' order by period desc limit 1;
  return jsonb_build_object(
    'period', r.period,
    'required', (select count(*) from payroll_lines where run_id = r.id and wps_status <> 'na'),
    'proven', (select count(*) from payroll_lines where run_id = r.id and wps_status = 'proven'),
    'target_pct', 85);
end;
$$;

revoke execute on function public.hygiene_items(), public.compliance_status(uuid), public.compliance_readiness(uuid),
  public.save_document(jsonb), public.attach_document_evidence(uuid, text), public.sign_hygiene_log(jsonb),
  public.wps_status(uuid) from public, anon;
grant execute on function public.hygiene_items(), public.compliance_status(uuid), public.compliance_readiness(uuid),
  public.save_document(jsonb), public.attach_document_evidence(uuid, text), public.sign_hygiene_log(jsonb),
  public.wps_status(uuid) to authenticated;

alter publication supabase_realtime add table public.compliance_documents, public.hygiene_logs;
