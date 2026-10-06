-- Everyone edits their own profile (owner, 2026-10-06: "need to be a feature to edit profile details like name number
-- other settings"): their name and phone; an owner also the salon's name. Email and password change through sign-in
-- itself (the app calls Supabase Auth). A staff member's name and phone are also what the salon sees in Staff.

alter table public.members
  add column phone text check (phone is null or phone ~ '^\+?[0-9 ]{7,20}$');

create function public.update_my_profile(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  m members;
  v_name text := btrim(p ->> 'display_name');
  v_phone text := nullif(btrim(p ->> 'phone'), '');
begin
  select * into m from members where user_id = auth.uid() and active order by created_at limit 1 for update;
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_name is null or length(v_name) < 2 or length(v_name) > 60 then
    raise exception 'name_required' using errcode = '22023';
  end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9 ]{7,20}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  update members set display_name = v_name, phone = v_phone where id = m.id;
  -- The same person in the salon's staff list (one person, one record).
  update employees set full_name = v_name, phone = v_phone where member_id = m.id;
  perform public.write_audit(m.business_id, m.default_branch_id, m.id, 'edit', 'member', m.id,
    'Updated their profile' || case when v_name <> m.display_name then ': name ' || m.display_name || ' → ' || v_name else '' end);
end;
$$;

-- The salon's name (owner).
create function public.rename_business(p_business uuid, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  m members;
  v_name text := btrim(p_name);
  v_old text;
begin
  select * into m from members where business_id = p_business and user_id = auth.uid() and active and role = 'owner';
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_name is null or length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'name_required' using errcode = '22023';
  end if;
  select name into v_old from businesses where id = p_business;
  update businesses set name = v_name where id = p_business;
  perform public.write_audit(p_business, null, m.id, 'edit', 'business', p_business, 'Renamed the salon: ' || v_old || ' → ' || v_name);
end;
$$;

revoke execute on function public.update_my_profile(jsonb), public.rename_business(uuid, text) from public, anon;
grant execute on function public.update_my_profile(jsonb), public.rename_business(uuid, text) to authenticated;
