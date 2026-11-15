-- Owner's app check F4: each staff member's page says "Last signed in: 12 Nov · 9:14 AM" or "Never signed in", so the
-- owner can see who uses their login. The time is kept by the sign-in service (auth.users), which the app cannot
-- read, so this gives it for one login to the people who look after that login: the owner for any login in the
-- salon, a manager for front-desk and stylist logins in a branch they share (the same rule as resetting a password,
-- migration 93). It reads one time and changes nothing.
create function public.login_last_sign_in(p_member uuid) returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare
  t members;
  me members;
begin
  select * into t from members where id = p_member;
  if t.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into me from members where business_id = t.business_id and user_id = auth.uid() and active;
  if me.id is null
     or public.role_level(me.role, 'resetLogin') is null
     or (public.role_level(me.role, 'resetLogin') = 'branch'
         and (t.role not in ('cashier', 'staff')
              or not exists (select 1 from member_branches a join member_branches b on b.branch_id = a.branch_id
                             where a.member_id = me.id and b.member_id = t.id))) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return (select u.last_sign_in_at from auth.users u where u.id = t.user_id);
end;
$$;

revoke execute on function public.login_last_sign_in(uuid) from public, anon;
grant execute on function public.login_last_sign_in(uuid) to authenticated;
