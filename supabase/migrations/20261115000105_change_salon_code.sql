-- Owner's app check F3: the salon code was made from the salon's first name, typo included ("rderosem87"). The
-- owner may now change it once, from More → Staff, after a warning that every staff member must sign in with the new
-- code. Staff sign in as username@<code>.staff.internal, so every staff login of the salon moves to the new code in
-- the same step as the salon: one transaction, so if one login cannot move, nothing changes. Staff who are signed in
-- stay signed in; their next sign-in uses the new code. Passwords, usernames and everything else stay as they are.
alter table public.businesses add column code_changed_at timestamptz;

create function public.change_salon_code(p_business uuid, p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare
  m members;
  b businesses;
  v_code text := lower(btrim(coalesce(p_code, '')));
  v_old_domain text;
  v_new_domain text;
  v_moved int;
begin
  select * into m from members where business_id = p_business and user_id = auth.uid() and active and role = 'owner';
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into b from businesses where id = p_business for update;
  if b.code_changed_at is not null then
    raise exception 'code_changed' using errcode = '22023';
  end if;
  if v_code !~ '^[a-z0-9]{4,12}$' then
    raise exception 'invalid_salon_code' using errcode = '22023';
  end if;
  if v_code = b.code then
    raise exception 'code_unchanged' using errcode = '22023';
  end if;
  v_old_domain := '@' || b.code || '.staff.internal';
  v_new_domain := '@' || v_code || '.staff.internal';
  -- Taken by another salon, or still the address of some login (a salon's code from before its own change).
  if exists (select 1 from businesses where code = v_code)
     or exists (select 1 from auth.users u where right(u.email, length(v_new_domain)) = v_new_domain) then
    raise exception 'code_taken' using errcode = '23505';
  end if;

  update auth.users u
     set email = split_part(u.email, '@', 1) || v_new_domain, updated_at = now()
   where right(u.email, length(v_old_domain)) = v_old_domain;
  get diagnostics v_moved = row_count;
  update auth.identities i
     set identity_data = jsonb_set(i.identity_data, '{email}', to_jsonb(split_part(i.identity_data ->> 'email', '@', 1) || v_new_domain)),
         updated_at = now()
   where i.provider = 'email' and right(i.identity_data ->> 'email', length(v_old_domain)) = v_old_domain;
  begin
    update businesses set code = v_code, code_changed_at = now() where id = p_business;
  exception when unique_violation then
    raise exception 'code_taken' using errcode = '23505';
  end;

  perform public.write_audit(p_business, null, m.id, 'edit', 'business', p_business,
    'Changed the salon code: ' || b.code || ' → ' || v_code);
  return v_code;
end;
$$;

revoke execute on function public.change_salon_code(uuid, text) from public, anon;
grant execute on function public.change_salon_code(uuid, text) to authenticated;
