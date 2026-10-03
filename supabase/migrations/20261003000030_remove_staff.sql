-- Removing someone from the staff (owner, 2026-10-03), through the remove-staff Edge Function (service role):
--  · Nothing on record (no sales, visits, attendance, pay, tips, documents, and their login never did anything): the
--    person is removed completely — staff record, roster and login.
--  · Anything on record: archived instead, as UAE law requires records to be kept — hidden from the lists, the queue
--    and attendance, their login switched off; they can be brought back.

-- Whether this person has anything the salon must keep: their own work (employee_has_history), documents about them,
-- or anything their login did (every action writes the audit log).
create function public.staff_has_records(p_employee uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.employee_has_history(p_employee)
      or exists (select 1 from compliance_documents where employee_id = p_employee)
      or exists (select 1 from employees e join audit_log l on l.actor_member_id = e.member_id
                 where e.id = p_employee and e.member_id is not null)
$$;

-- p_actor: the owner's member id. Returns {mode: 'removed' | 'archived', user_id: their login's user, or null}.
create function public.remove_staff(p_employee uuid, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e employees;
  m members;
  v_user uuid;
begin
  select * into e from employees where id = p_employee for update;
  if e.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from members o where o.id = p_actor and o.business_id = e.business_id and o.role = 'owner' and o.active) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if e.member_id is not null then
    select * into m from members where id = e.member_id for update;
    v_user := m.user_id;
  end if;

  if not public.staff_has_records(e.id) then
    delete from employees where id = e.id;
    if m.id is not null then
      delete from members where id = m.id;
    end if;
    perform public.write_audit(e.business_id, e.branch_id, p_actor, 'delete', 'employee', e.id,
      'Removed ' || e.full_name || ' from the staff (no records)');
    return jsonb_build_object('mode', 'removed', 'user_id', v_user);
  end if;

  update employees set active = false where id = e.id;
  if m.id is not null then
    update members set active = false where id = m.id;
    delete from push_tokens where member_id = m.id;
    delete from member_pins where member_id = m.id;
  end if;
  perform public.write_audit(e.business_id, e.branch_id, p_actor, 'update', 'employee', e.id,
    'Archived ' || e.full_name || ' (records kept; login off)');
  return jsonb_build_object('mode', 'archived', 'user_id', v_user);
end;
$$;

-- Bringing an archived person back: on the staff again, their login (if any) on again.
create function public.restore_staff(p_employee uuid, p_actor uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e employees;
  v_user uuid;
begin
  select * into e from employees where id = p_employee for update;
  if e.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from members o where o.id = p_actor and o.business_id = e.business_id and o.role = 'owner' and o.active) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update employees set active = true where id = e.id;
  if e.member_id is not null then
    update members set active = true where id = e.member_id returning user_id into v_user;
  end if;
  perform public.write_audit(e.business_id, e.branch_id, p_actor, 'update', 'employee', e.id,
    'Brought ' || e.full_name || ' back to the staff');
  return jsonb_build_object('mode', 'restored', 'user_id', v_user);
end;
$$;

revoke execute on function public.staff_has_records(uuid) from public, anon, authenticated;
revoke execute on function public.remove_staff(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.restore_staff(uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_staff(uuid, uuid) to service_role;
grant execute on function public.restore_staff(uuid, uuid) to service_role;
grant execute on function public.staff_has_records(uuid) to service_role;
