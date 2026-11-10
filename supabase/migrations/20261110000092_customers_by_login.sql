-- Part B, step 4 (brief B2 "Customers" and "Bookings and queue"): customers by login type.
-- * Owner, manager and front desk: the customer book (list, visits, notes, contact details), adding and editing.
-- * Stylists: their own clients only (customers they served or are booked with, at any time; owner's answer 3,
--   10 Nov), through my_clients / client_card, with phone numbers only when the owner's control is on; they add
--   service notes for those clients. In the queue they see their own and unassigned visits; everyone else's time shows
--   as busy (busy_times), without the client.
-- * The accountant: no customer book and no queue (reports keep their totals).
-- * Merge duplicates: owner and manager. Delete a customer (personal details removed; sales stay): owner only.
-- * Managers read the branch's sales and refunds (they sell and refund since step 2).

-- ── Helpers for row rules ──────────────────────────────────────────────────────────────────────
-- The salons where my login type has this capability at this level (row rules that treat "own" apart).
create function public.my_business_ids_at(p_capability text, p_level text) returns setof uuid
language sql stable security definer set search_path = public as $$
  select m.business_id from members m
  join role_capabilities c on c.role = m.role and c.capability = p_capability and c.level = p_level
  where m.user_id = auth.uid() and m.active
$$;
-- My own places on the staff list (one per branch I work in).
create function public.my_employee_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select e.id from employees e join members m on m.id = e.member_id where m.user_id = auth.uid() and m.active
$$;
revoke execute on function public.my_business_ids_at(text, text), public.my_employee_ids() from public, anon;

-- ── Customers: merged and deleted ones stay (sales point at them) but leave the book ─────────────
alter table public.customers
  add column merged_into uuid references public.customers (id) on delete set null,
  add column deleted_at timestamptz,
  add column deleted_by uuid references public.members (id) on delete set null;

drop policy "front desk reads customers" on public.customers;
drop policy "front desk adds customers" on public.customers;
drop policy "front desk edits customers" on public.customers;
create policy "customer book reads customers" on public.customers for select to authenticated
  using (business_id in (select public.my_business_ids_can('manageCustomers'))
         and merged_into is null and deleted_at is null);
create policy "customer book adds customers" on public.customers for insert to authenticated
  with check (business_id in (select public.my_business_ids_can('manageCustomers')));
create policy "customer book edits customers" on public.customers for update to authenticated
  using (business_id in (select public.my_business_ids_can('manageCustomers'))
         and merged_into is null and deleted_at is null)
  with check (business_id in (select public.my_business_ids_can('manageCustomers')));

-- Service notes: short notes on a client's visits (colour formula, what was done), with who wrote them.
create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  note text not null check (length(btrim(note)) between 1 and 500),
  author_id uuid references public.members (id) on delete set null,
  author_name text not null,
  created_at timestamptz not null default now()
);
create index customer_notes_customer_idx on public.customer_notes (customer_id, created_at desc);
alter table public.customer_notes enable row level security;
create policy "customer book reads service notes" on public.customer_notes for select to authenticated
  using (business_id in (select public.my_business_ids_can('manageCustomers')));
revoke insert, update, delete, truncate, references, trigger on public.customer_notes from anon, authenticated;
revoke select on public.customer_notes from anon;

-- ── The queue: stylists see their own and unassigned visits; the accountant none ───────────────────
-- (Visit services follow their visit: their rule reads appointments, which applies this rule.)
drop policy "members read appointments" on public.appointments;
create policy "queue reads appointments" on public.appointments for select to authenticated
  using (branch_id in (select public.my_branch_ids())
         and (business_id in (select public.my_business_ids_at('viewQueue', 'yes'))
              or (business_id in (select public.my_business_ids_at('viewQueue', 'own'))
                  and (employee_id is null or employee_id in (select public.my_employee_ids())))));

-- ── Sales and refunds: managers too ─────────────────────────────────────────────────────────────
drop policy "members read sales" on public.sales;
create policy "members read sales" on public.sales for select to authenticated
  using (branch_id in (select public.my_branch_ids())
         and (business_id in (select public.my_business_ids_at('viewSales', 'yes'))
              or employee_id in (select public.my_employee_ids())));
drop policy "front desk reads refunds" on public.refunds;
create policy "sales screens read refunds" on public.refunds for select to authenticated
  using (business_id in (select public.my_business_ids_at('viewSales', 'yes'))
         and branch_id in (select public.my_branch_ids()));

-- ── A stylist's own clients ─────────────────────────────────────────────────────────────────────
-- Customers this member served (a sale or a sale line) or is booked with (any visit not cancelled), at any time.
create function public.my_client_ids(p_member uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select a.customer_id from appointments a join employees e on e.id = a.employee_id
  where e.member_id = p_member and a.customer_id is not null and a.status <> 'cancelled'
  union
  select s.customer_id from sales s join employees e on e.id = s.employee_id
  where e.member_id = p_member and s.customer_id is not null
  union
  select s.customer_id from sale_lines sl join sales s on s.id = sl.sale_id join employees e on e.id = sl.employee_id
  where e.member_id = p_member and s.customer_id is not null
$$;
revoke execute on function public.my_client_ids(uuid) from public, anon, authenticated;

-- May this person see the client's phone? The book's users yes; stylists when the owner's control is on.
create function public.sees_phones(m public.members, p_branch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case public.role_level(m.role, 'customerContacts')
    when 'yes' then true
    when 'own' then coalesce((public.branch_control(p_branch, 'staff_see_phones'))::boolean, false)
    else false end
$$;
revoke execute on function public.sees_phones(public.members, uuid) from public, anon, authenticated;

-- The client list: the whole book for owner, manager and front desk; a stylist's own clients for a stylist.
create function public.my_clients(p_branch uuid, p_search text default null)
returns table (id uuid, name text, phone text, visit_count int, last_visit_at timestamptz, preferences text,
               risk_flags text[])
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_can(p_branch, 'viewCustomers');
  v_all boolean := public.role_level(m.role, 'viewCustomers') = 'yes';
  v_phones boolean := public.sees_phones(m, p_branch);
  v_q text := nullif(btrim(coalesce(p_search, '')), '');
begin
  return query
    select c.id, c.name, case when v_phones then c.phone end, c.visit_count, c.last_visit_at, c.preferences,
           c.risk_flags
    from customers c
    where c.business_id = m.business_id and c.merged_into is null and c.deleted_at is null
      and (v_all or c.id in (select public.my_client_ids(m.id)))
      and (v_q is null or c.name ilike '%' || v_q || '%'
           or (v_phones and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g')
                            like '%' || nullif(regexp_replace(v_q, '\D', '', 'g'), '') || '%'))
    order by c.last_visit_at desc nulls last, c.name
    limit 100;
end;
$$;

-- One client's card. A stylist sees their own clients only: name, phone (when allowed), preferences and warnings,
-- service notes, their own visits with the client and their bookings with them.
create function public.client_card(p_branch uuid, p_customer uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_can(p_branch, 'viewCustomers');
  v_all boolean := public.role_level(m.role, 'viewCustomers') = 'yes';
  c customers;
begin
  select * into c from customers where id = p_customer and business_id = m.business_id
    and merged_into is null and deleted_at is null;
  if c.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not v_all and c.id not in (select public.my_client_ids(m.id)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'customer', jsonb_build_object('id', c.id, 'name', c.name,
      'phone', case when public.sees_phones(m, p_branch) then c.phone end,
      'preferences', c.preferences, 'risk_flags', c.risk_flags, 'visit_count', c.visit_count,
      'last_visit_at', c.last_visit_at, 'notes', case when v_all then c.notes end),
    'service_notes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'note', n.note,
        'author_name', n.author_name, 'created_at', n.created_at) order by n.created_at desc)
      from customer_notes n where n.customer_id = c.id), '[]'),
    -- Visits: a stylist's own lines with this client; the book's users every sale.
    'visits', coalesce((select jsonb_agg(v order by v.created_at desc) from (
        select s.id, s.number, s.business_date, s.created_at, s.status,
               (select jsonb_agg(sl.name_snapshot order by sl.name_snapshot) from sale_lines sl
                where sl.sale_id = s.id and (v_all or sl.employee_id in (select e.id from employees e
                                                                        where e.member_id = m.id))) as services
        from sales s
        where s.customer_id = c.id
          and (v_all or s.employee_id in (select e.id from employees e where e.member_id = m.id)
               or exists (select 1 from sale_lines sl join employees e on e.id = sl.employee_id
                          where sl.sale_id = s.id and e.member_id = m.id))
        order by s.created_at desc limit 30) v), '[]'),
    'upcoming', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'scheduled_at', a.scheduled_at,
        'status', a.status) order by a.scheduled_at)
      from appointments a
      where a.customer_id = c.id and a.status in ('booked', 'waiting', 'in_progress')
        and (v_all or a.employee_id in (select e.id from employees e where e.member_id = m.id))), '[]'));
end;
$$;

-- A service note: anyone on the customer book for any customer; a stylist for their own clients.
create function public.add_service_note(p_branch uuid, p_customer uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m members := public.require_can(p_branch, 'serviceNotes');
  c customers;
  n customer_notes;
begin
  select * into c from customers where id = p_customer and business_id = m.business_id
    and merged_into is null and deleted_at is null;
  if c.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if public.role_level(m.role, 'serviceNotes') = 'own' and c.id not in (select public.my_client_ids(m.id)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_note, ''))) not between 1 and 500 then
    raise exception 'invalid_note' using errcode = '22023';
  end if;
  insert into customer_notes (business_id, customer_id, note, author_id, author_name)
  values (m.business_id, c.id, btrim(p_note), m.id, m.display_name) returning * into n;
  return to_jsonb(n);
end;
$$;

-- Merge a duplicate into the customer to keep: visits, sales and notes move over, the counts add up, details the kept
-- one lacks are filled in, and the duplicate leaves the book (kept, pointing at the one it was merged into).
create function public.merge_customers(p_branch uuid, p_keep uuid, p_drop uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m members := public.require_can(p_branch, 'mergeCustomers');
  k customers;
  d customers;
  v_sales int;
  v_visits int;
begin
  if p_keep = p_drop then
    raise exception 'same_customer' using errcode = '22023';
  end if;
  select * into k from customers where id = p_keep and business_id = m.business_id
    and merged_into is null and deleted_at is null for update;
  select * into d from customers where id = p_drop and business_id = m.business_id
    and merged_into is null and deleted_at is null for update;
  if k.id is null or d.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update sales set customer_id = k.id where customer_id = d.id;
  get diagnostics v_sales = row_count;
  update appointments set customer_id = k.id where customer_id = d.id;
  get diagnostics v_visits = row_count;
  update customer_notes set customer_id = k.id where customer_id = d.id;
  update customers set
    phone = coalesce(k.phone, d.phone),
    notes = case when d.notes is null or d.notes = k.notes then k.notes
                 else concat_ws(E'\n', k.notes, d.notes) end,
    preferences = case when d.preferences is null or d.preferences = k.preferences then k.preferences
                       else concat_ws(E'\n', k.preferences, d.preferences) end,
    risk_flags = array(select distinct x from unnest(k.risk_flags || d.risk_flags) x order by x),
    visit_count = k.visit_count + d.visit_count,
    no_show_count = k.no_show_count + d.no_show_count,
    last_visit_at = greatest(k.last_visit_at, d.last_visit_at),
    preferred_employee_id = coalesce(k.preferred_employee_id, d.preferred_employee_id),
    marketing_opt_in = k.marketing_opt_in or d.marketing_opt_in,
    created_at = least(k.created_at, d.created_at)
  where id = k.id;
  update customers set merged_into = k.id where id = d.id;
  perform public.write_audit(m.business_id, p_branch, m.id, 'merge', 'customer', k.id,
    'Merged customer ' || d.name || coalesce(' (' || d.phone || ')', '') || ' into ' || k.name,
    to_jsonb(d), jsonb_build_object('kept', k.id, 'sales_moved', v_sales, 'visits_moved', v_visits));
  return jsonb_build_object('customer_id', k.id, 'sales_moved', v_sales, 'visits_moved', v_visits);
end;
$$;

-- The owner deletes a customer: their personal details and service notes are removed and they leave the book. Sales
-- and visits stay (with "Deleted customer" as the name), so the books do not change.
create function public.delete_customer(p_branch uuid, p_customer uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  m members := public.require_can(p_branch, 'deleteCustomers');
  c customers;
begin
  select * into c from customers where id = p_customer and business_id = m.business_id
    and merged_into is null and deleted_at is null for update;
  if c.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  update customers set name = 'Deleted customer', phone = null, notes = null, preferences = null, risk_flags = '{}',
    marketing_opt_in = false, preferred_employee_id = null, deleted_at = now(), deleted_by = m.id
  where id = c.id;
  update appointments set customer_name = 'Deleted customer' where customer_id = c.id;
  delete from customer_notes where customer_id = c.id;
  -- The audit line does not repeat the details that were removed.
  perform public.write_audit(m.business_id, p_branch, m.id, 'delete', 'customer', c.id,
    'Deleted a customer''s personal details: ' || btrim(p_reason));
end;
$$;

-- Everyone's booked time in the branch on a day, without the client: what a stylist sees of the others' visits.
create function public.busy_times(p_branch uuid, p_date date default null)
returns table (appointment_id uuid, employee_id uuid, scheduled_at timestamptz, duration_min int,
               status public.appointment_status)
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_can(p_branch, 'viewQueue');
  v_date date := coalesce(p_date, public.branch_today(p_branch));
begin
  return query
    select a.id, a.employee_id, a.scheduled_at, a.duration_min, a.status
    from appointments a
    where a.branch_id = p_branch and a.business_date = v_date
      and a.status in ('booked', 'waiting', 'in_progress', 'completed')
    order by a.scheduled_at;
end;
$$;

revoke execute on function public.my_clients(uuid, text), public.client_card(uuid, uuid),
  public.add_service_note(uuid, uuid, text), public.merge_customers(uuid, uuid, uuid),
  public.delete_customer(uuid, uuid, text), public.busy_times(uuid, date) from public, anon;
