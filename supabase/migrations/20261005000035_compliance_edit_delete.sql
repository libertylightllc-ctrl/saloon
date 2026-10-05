-- Every compliance record can be edited and deleted (owner, 2026-10-05: "compliance all items need edit and delete
-- option").
-- Edit corrects the current version in place (a typo in the number, a wrong date); Renew still makes a new version.
-- Delete takes the item off the register: a record's versions stay in the table, marked removed, for the history and
-- the audit trail; a checklist item (trade licence, a staff member's visa…) is hidden for that branch or person, so it
-- no longer counts towards readiness. Each delete is listed under "Removed" and can be put back (with its details).

alter table public.compliance_documents
  add column removed_at timestamptz,
  add column removed_by uuid references public.members (id) on delete set null,
  add column remove_reason text check (remove_reason is null or length(remove_reason) <= 200);

create table public.compliance_removals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid references public.branches (id) on delete cascade,
  employee_id uuid references public.employees (id) on delete cascade,
  doc_type text not null check (length(btrim(doc_type)) between 1 and 60),
  holder_type text not null check (holder_type in ('company', 'premises', 'employee')),
  -- The record that was current when the item was deleted (put back with it on restore); null for an empty item.
  document_id uuid references public.compliance_documents (id) on delete set null,
  reason text check (reason is null or length(reason) <= 200),
  removed_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  check ((holder_type = 'employee') = (employee_id is not null))
);
-- One entry per item.
create unique index compliance_removals_slot_idx on public.compliance_removals
  (business_id, doc_type, coalesce(employee_id, branch_id));
alter table public.compliance_removals enable row level security;
create policy "owner reads compliance removals" on public.compliance_removals for select to authenticated
  using (business_id in (select public.my_business_ids(array['owner']::public.member_role[])));
revoke insert, update, delete, truncate, references, trigger on public.compliance_removals from anon, authenticated;
create trigger compliance_removals_broadcast after insert or update or delete on public.compliance_removals
  for each row execute function public.broadcast_change('owners');
create trigger compliance_removals_plan before insert or update on public.compliance_removals
  for each row execute function public.gate_plan();

-- The checklist an inspector expects (one place; compliance_status and the delete below read it). UAE salons get the
-- UAE documents; elsewhere a business licence and the lease.
create function public.compliance_template(p_business uuid)
returns table (doc_type text, holder_type text)
language sql stable security definer set search_path = public as $$
  select t.doc_type, t.holder_type from (values
    ('trade_licence', 'company', true), ('ejari', 'premises', true), ('pest_control', 'premises', true),
    ('civil_defence', 'premises', true), ('health_card', 'employee', true), ('visa', 'employee', true),
    ('vaccination', 'employee', true), ('business_licence', 'company', false), ('lease', 'premises', false)
  ) t(doc_type, holder_type, uae)
  where t.uae = (coalesce((select country_code from businesses where id = p_business), 'AE') = 'AE')
$$;
revoke execute on function public.compliance_template(uuid) from public, anon, authenticated;

create or replace function public.compliance_status(p_business uuid)
 RETURNS TABLE(slot_key text, doc_type text, holder_type text, branch_id uuid, employee_id uuid, holder_name text, required boolean, document_id uuid, number text, issued_on date, expires_on date, renewal_cost_minor bigint, reminder_days integer, evidence_path text, version integer, status text, days_left integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_today date := (now() at time zone (select timezone from businesses where id = p_business))::date;
begin
  if not public.has_role(p_business, array['owner']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
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
  order by s.holder_type = 'employee', s.holder_name, s.doc_type;
end;
$$;

-- Correct the current version of a record in place. The owner's own records can also be renamed (all their versions).
create function public.update_document(p jsonb)
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
  select * into m from members where business_id = d.business_id and user_id = auth.uid() and active and role = 'owner';
  if m.id is null then
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

-- Delete an item from the register: its current record is marked removed (kept with its versions), a checklist item is
-- hidden for that branch or person, and the delete is listed so it can be put back.
create function public.remove_document_slot(p jsonb)
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
  select * into m from members where business_id = v_business and user_id = auth.uid() and active and role = 'owner';
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
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
  insert into compliance_removals (business_id, branch_id, employee_id, doc_type, holder_type, document_id, reason, removed_by)
  values (v_business, case when v_holder = 'employee' then null else v_branch end, v_employee, v_type, v_holder, d.id,
          v_reason, m.id);
  perform public.write_audit(v_business, v_branch, m.id, 'remove', 'compliance_document', coalesce(d.id, v_employee, v_branch),
    'Deleted ' || public.doc_label(v_type)
    || coalesce(' for ' || (select full_name from employees where id = v_employee), '')
    || ' from the register' || coalesce(': ' || v_reason, ''));
end;
$$;

-- Put a deleted item back, with the record it had (unless a new one was added since).
create function public.restore_document_slot(p_removal uuid)
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
  select * into m from members where business_id = x.business_id and user_id = auth.uid() and active and role = 'owner';
  if m.id is null then
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

-- Adding a record for an item that was deleted puts the item back on the register.
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

-- Signed-in owners only (each function checks the caller's salon and role itself).
revoke execute on function public.update_document(jsonb), public.remove_document_slot(jsonb),
  public.restore_document_slot(uuid) from public, anon;
