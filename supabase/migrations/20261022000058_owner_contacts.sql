-- An owner's mobile / WhatsApp number (website brief 3.3, 2026-10-22): optional at sign-up (or in setup's first step
-- for Google sign-ups), "We'll only use it to help you set up", with a separate, unticked "OK to message me on
-- WhatsApp" whose time is kept. Readable by the owner and by platform owners (console → Accounts); nobody else.

create table public.owner_contacts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone text not null check (phone ~ '^\+[0-9]{7,15}$'),
  whatsapp_ok boolean not null default false,
  whatsapp_ok_at timestamptz,
  source text not null default 'sign_up' check (source in ('sign_up', 'setup')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.owner_contacts enable row level security;
create policy "owners read their own contact" on public.owner_contacts for select to authenticated using (user_id = auth.uid());
create policy "platform admins read contacts" on public.owner_contacts for select to authenticated using (public.is_platform_admin());
revoke all on public.owner_contacts from anon;
revoke insert, update, delete on public.owner_contacts from authenticated;

-- The number given at sign-up (in the account's sign-up details) is kept when the account is created. Anything odd in
-- those details is ignored, never an error: a sign-up must not fail because of the optional number.
create function public.on_user_contact() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_phone text := regexp_replace(coalesce(new.raw_user_meta_data ->> 'phone', ''), '[^0-9+]', '', 'g');
  v_ok boolean := lower(coalesce(new.raw_user_meta_data ->> 'whatsapp_ok', '')) = 'true';
begin
  if v_phone ~ '^\+[0-9]{7,15}$' then
    insert into owner_contacts (user_id, phone, whatsapp_ok, whatsapp_ok_at, source)
    values (new.id, v_phone, v_ok, case when v_ok then now() end, 'sign_up')
    on conflict (user_id) do nothing;
  end if;
  return new;
exception when others then
  return new;
end;
$$;
create trigger auth_users_contact after insert on auth.users for each row execute function public.on_user_contact();
revoke execute on function public.on_user_contact() from public, anon, authenticated;

-- Setup's first step (Google sign-ups, or someone who skipped it): the owner saves or changes their own number; empty
-- removes it. The WhatsApp OK keeps the time it was first given; untick it and it goes.
create function public.save_owner_contact(p_phone text, p_whatsapp_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  if btrim(coalesce(p_phone, '')) = '' then
    delete from owner_contacts where user_id = auth.uid();
    return;
  end if;
  if v_phone !~ '^\+[0-9]{7,15}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  insert into owner_contacts (user_id, phone, whatsapp_ok, whatsapp_ok_at, source)
  values (auth.uid(), v_phone, coalesce(p_whatsapp_ok, false), case when p_whatsapp_ok then now() end, 'setup')
  on conflict (user_id) do update set phone = excluded.phone, whatsapp_ok = excluded.whatsapp_ok,
    whatsapp_ok_at = case when excluded.whatsapp_ok then coalesce(owner_contacts.whatsapp_ok_at, now()) end,
    updated_at = now();
end;
$$;
revoke execute on function public.save_owner_contact(text, boolean) from public, anon;

-- The console's account list shows the number and the WhatsApp OK.
drop function public.admin_accounts();
create function public.admin_accounts()
returns table (user_id uuid, email text, username text, display_name text, role text, business_id uuid, salon text,
               active boolean, created_at timestamptz, last_sign_in_at timestamptz, confirmed boolean, provider text,
               platform_owner boolean, phone text, whatsapp_ok boolean, whatsapp_ok_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select u.id, case when u.email like '%.staff.internal' then null else u.email::text end, m.username,
           m.display_name, m.role::text, m.business_id, b.name, m.active, u.created_at, u.last_sign_in_at,
           u.email_confirmed_at is not null, coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
           exists (select 1 from platform_admins p where p.user_id = u.id),
           c.phone, coalesce(c.whatsapp_ok, false), c.whatsapp_ok_at
    from auth.users u
    left join members m on m.user_id = u.id
    left join businesses b on b.id = m.business_id
    left join owner_contacts c on c.user_id = u.id
    order by u.created_at desc;
end;
$$;
revoke execute on function public.admin_accounts() from public, anon;
