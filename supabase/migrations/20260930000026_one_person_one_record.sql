-- One person, one staff record (owner, 2026-09-30). Someone added in Staff & payroll and later given a login in
-- Team & logins ended up twice: the login always made a second, empty staff record, so the salary, WPS and roster
-- sat on one and the sales, commission and clock-ins on the other.
--  · A login now joins the person's existing staff record: the one picked on screen (`employee_id`), or else the
--    only active staff record without a login that has the same name. Only a new person gets a new record.
--  · Existing pairs are merged once, when one of the two has no history (sales, visits, attendance, pay, tips):
--    the empty one goes and its details, roster and documents join the other. Pairs where both have history are
--    left as they are.

CREATE OR REPLACE FUNCTION public.register_staff_member(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_member uuid;
  v_employee uuid;
  v_matches int;
  v_business uuid := (p ->> 'business_id')::uuid;
  v_name text := btrim(p ->> 'display_name');
  v_role member_role := (p ->> 'role')::member_role;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_role = 'owner' then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  insert into members (business_id, user_id, role, display_name, username, default_branch_id)
  values (v_business, (p ->> 'user_id')::uuid, v_role, v_name, p ->> 'username', (p ->> 'branch_id')::uuid)
  returning id into v_member;
  insert into member_branches (member_id, branch_id) values (v_member, (p ->> 'branch_id')::uuid);

  -- The person may already be on the staff list: their login joins that record.
  if nullif(p ->> 'employee_id', '') is not null then
    select id into v_employee from employees
    where id = (p ->> 'employee_id')::uuid and business_id = v_business and member_id is null
    for update;
    if v_employee is null then
      raise exception 'employee_has_login' using errcode = '22023';
    end if;
  elsif v_role in ('staff', 'cashier') then
    select (array_agg(id))[1], count(*) into v_employee, v_matches from employees
    where business_id = v_business and member_id is null and active and lower(btrim(full_name)) = lower(v_name);
    if v_matches <> 1 then
      v_employee := null;
    end if;
  end if;

  if v_employee is not null then
    update employees
    set member_id = v_member,
        commission_bps = case when commission_bps = 0 then coalesce((p ->> 'commission_bps')::int, 0) else commission_bps end,
        colour = coalesce(colour, p ->> 'colour')
    where id = v_employee;
  elsif v_role in ('staff', 'cashier') then
    insert into employees (business_id, branch_id, member_id, full_name, role_title, commission_bps, colour)
    values (v_business, (p ->> 'branch_id')::uuid, v_member, v_name, v_role::text,
            coalesce((p ->> 'commission_bps')::int, 0), p ->> 'colour')
    returning id into v_employee;
  end if;
  perform public.write_audit(v_business, (p ->> 'branch_id')::uuid, (p ->> 'actor_member_id')::uuid, 'create', 'member',
    v_member, 'Created login ' || (p ->> 'username') || ' (' || v_role::text || ') for ' || v_name);
  return jsonb_build_object('member_id', v_member, 'employee_id', v_employee);
end;
$function$;

-- Whether anything the salon keeps (sales, visits, attendance, pay, tips) points at this staff record.
create function public.employee_has_history(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from appointments where employee_id = p_id)
      or exists (select 1 from appointment_services where employee_id = p_id)
      or exists (select 1 from attendance where employee_id = p_id)
      or exists (select 1 from sales where employee_id = p_id or tip_employee_id = p_id)
      or exists (select 1 from sale_lines where employee_id = p_id)
      or exists (select 1 from payroll_lines where employee_id = p_id)
      or exists (select 1 from payroll_adjustments where employee_id = p_id)
      or exists (select 1 from tip_payouts where employee_id = p_id)
$$;

-- Merges each person recorded twice (once in Staff & payroll without a login, once by Team & logins) when one of the
-- two has no history. Returns how many people were merged.
create function public.merge_duplicate_employees() returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_keep uuid;
  v_drop uuid;
  v_merged int := 0;
begin
  for r in
    select u.id as u_id, l.id as l_id, u.business_id, u.branch_id, l.member_id, u.full_name
    from employees u
    join employees l on l.business_id = u.business_id and lower(btrim(l.full_name)) = lower(btrim(u.full_name))
    where u.member_id is null and l.member_id is not null and u.active and l.active
      and (select count(*) from employees x
           where x.business_id = u.business_id and lower(btrim(x.full_name)) = lower(btrim(u.full_name))) = 2
  loop
    begin
      if not public.employee_has_history(r.l_id) then
        -- The login's record is empty: the login moves onto the Staff & payroll record (salary, WPS, code …).
        v_keep := r.u_id;
        v_drop := r.l_id;
        update employees d set member_id = null where d.id = v_drop;
        update employees k
        set member_id = r.member_id,
            commission_bps = case when k.commission_bps = 0 then d.commission_bps else k.commission_bps end,
            colour = coalesce(k.colour, d.colour)
        from employees d
        where k.id = v_keep and d.id = v_drop;
      elsif not public.employee_has_history(r.u_id) then
        -- Work was already done under the login: the Staff & payroll details join the login's record.
        v_keep := r.l_id;
        v_drop := r.u_id;
        update employees k
        set employee_code = coalesce(k.employee_code, d.employee_code),
            base_salary_minor = case when k.base_salary_minor = 0 then d.base_salary_minor else k.base_salary_minor end,
            commission_bps = case when k.commission_bps = 0 then d.commission_bps else k.commission_bps end,
            wps_required = k.wps_required or d.wps_required,
            phone = coalesce(k.phone, d.phone),
            colour = coalesce(k.colour, d.colour),
            role_title = d.role_title
        from employees d
        where k.id = v_keep and d.id = v_drop;
      else
        continue;
      end if;
      if not exists (select 1 from rosters where employee_id = v_keep) then
        update rosters set employee_id = v_keep where employee_id = v_drop;
      end if;
      update compliance_documents set employee_id = v_keep where employee_id = v_drop;
      update customers set preferred_employee_id = v_keep where preferred_employee_id = v_drop;
      delete from employees where id = v_drop;
      perform public.write_audit(r.business_id, r.branch_id, null, 'update', 'employee', v_keep,
        'Merged the two records of ' || r.full_name || ' (Staff & payroll and Team & logins) into one');
      v_merged := v_merged + 1;
    exception when others then
      -- Leave a pair that cannot be merged cleanly exactly as it was.
      raise notice 'not merged: % (%)', r.full_name, sqlerrm;
    end;
  end loop;
  return v_merged;
end;
$$;
revoke execute on function public.employee_has_history(uuid) from public, anon, authenticated;
revoke execute on function public.merge_duplicate_employees() from public, anon, authenticated;

select public.merge_duplicate_employees();
