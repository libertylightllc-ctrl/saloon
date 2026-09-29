-- M4 · Performance: row security checked once per query instead of once per row.
-- The policies called has_role(business_id, …), is_member(business_id) and can_use_branch(branch_id) for every
-- row; with 1,200 customers a page of 50 cost 1,200 calls (and timed out under load). Each call is now written as
-- "business_id in (the salons where I have that role)" — a set worked out once per query. Same rules: the sets
-- come from the same members / member_branches rows the old functions read (SQL tests 01–12 prove access).

-- The salons where I am an active member with one of these roles (any role when p_roles is null).
create function public.my_business_ids(p_roles public.member_role[]) returns setof uuid
language sql stable security definer set search_path = public as $$
  select business_id from members
  where user_id = auth.uid() and active and (p_roles is null or role = any (p_roles))
$$;

-- The branches I may use: every branch of a salon I own, and the branches I was given elsewhere.
create function public.my_branch_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select b.id
  from branches b
  join members m on m.business_id = b.business_id and m.user_id = auth.uid() and m.active
  where m.role = 'owner'
     or exists (select 1 from member_branches mb where mb.member_id = m.id and mb.branch_id = b.id)
$$;

revoke execute on function public.my_business_ids(public.member_role[]), public.my_branch_ids() from public, anon;
grant execute on function public.my_business_ids(public.member_role[]), public.my_branch_ids() to authenticated;

do $$
declare
  p record;
  v_using text;
  v_check text;
  -- has_role(x, ARRAY[…]) · is_member(x) · can_use_branch(x), where x is a column (possibly alias.column).
  rewrite constant text[][] := array[
    array['has_role\(([a-z_.]+), (ARRAY\[[^]]*\])\)', '(\1 IN ( SELECT public.my_business_ids(\2)))'],
    array['is_member\(([a-z_.]+)\)', '(\1 IN ( SELECT public.my_business_ids(NULL::member_role[])))'],
    array['can_use_branch\(([a-z_.]+)\)', '(\1 IN ( SELECT public.my_branch_ids()))']];
  i int;
begin
  for p in
    select c.relname as tbl, pol.polname as name,
           pg_get_expr(pol.polqual, pol.polrelid) as qual, pg_get_expr(pol.polwithcheck, pol.polrelid) as chk
    from pg_policy pol join pg_class c on c.oid = pol.polrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
  loop
    v_using := p.qual;
    v_check := p.chk;
    for i in 1 .. array_length(rewrite, 1) loop
      v_using := regexp_replace(v_using, rewrite[i][1], rewrite[i][2], 'g');
      v_check := regexp_replace(v_check, rewrite[i][1], rewrite[i][2], 'g');
    end loop;
    if v_using is distinct from p.qual then
      execute format('alter policy %I on public.%I using (%s)', p.name, p.tbl, v_using);
    end if;
    if v_check is distinct from p.chk then
      execute format('alter policy %I on public.%I with check (%s)', p.name, p.tbl, v_check);
    end if;
  end loop;
end $$;

-- Nothing should still call the per-row helpers from a table policy.
do $$
begin
  if exists (
    select 1 from pg_policy pol join pg_class c on c.oid = pol.polrelid join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and (coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') ~ '(has_role|is_member|can_use_branch)\('
        or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ~ '(has_role|is_member|can_use_branch)\(')
  ) then
    raise exception 'a table policy still checks access row by row';
  end if;
end $$;
