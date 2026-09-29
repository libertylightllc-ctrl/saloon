-- M4 · PIN quick-switch on a shared counter device (01-PRODUCT §2.1).
-- Each person may set a 4-digit PIN. People who signed in on a device and set a PIN can switch back to
-- themselves with it; the PIN is checked here (hashed, never readable), and five wrong tries lock it for
-- five minutes.

create table public.member_pins (
  member_id uuid primary key references public.members (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  pin_hash text not null,
  failed_count int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
-- No policies: only the functions below touch it.
alter table public.member_pins enable row level security;

create function public.set_my_pin(p_business uuid, p_pin text) returns void
language plpgsql security definer set search_path = public as $$
declare
  m members;
begin
  select * into m from members where business_id = p_business and user_id = auth.uid() and active;
  if m.id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  -- Four digits, and not one repeated digit or a straight run (1111, 1234, 4321).
  if p_pin !~ '^[0-9]{4}$' or p_pin ~ '^(.)\1{3}$' or position(p_pin in '0123456789') > 0
     or position(p_pin in '9876543210') > 0 then
    raise exception 'invalid_pin' using errcode = '22023';
  end if;
  insert into member_pins (member_id, business_id, pin_hash)
  values (m.id, m.business_id, extensions.crypt(p_pin, extensions.gen_salt('bf')))
  on conflict (member_id) do update
    set pin_hash = excluded.pin_hash, failed_count = 0, locked_until = null, updated_at = now();
  perform public.write_audit(m.business_id, null, m.id, 'update', 'pin', m.id, 'Set a quick-switch PIN');
end;
$$;

create function public.has_pin(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from member_pins p join members m on m.id = p.member_id
                 where m.business_id = p_business and m.user_id = auth.uid());
$$;

-- Someone signed in on this device (same salon) asks: is this the PIN of that person?
create function public.check_pin(p_member uuid, p_pin text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  target members;
  pin member_pins;
begin
  select * into target from members where id = p_member and active;
  if target.id is null or not exists (select 1 from members where business_id = target.business_id
                                       and user_id = auth.uid() and active) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into pin from member_pins where member_id = p_member for update;
  if pin.member_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if pin.locked_until > now() then
    raise exception 'pin_locked' using errcode = '22023';
  end if;
  if pin.pin_hash = extensions.crypt(p_pin, pin.pin_hash) then
    update member_pins set failed_count = 0, locked_until = null where member_id = p_member;
    return true;
  end if;
  update member_pins
    set failed_count = case when pin.failed_count + 1 >= 5 then 0 else pin.failed_count + 1 end,
        locked_until = case when pin.failed_count + 1 >= 5 then now() + interval '5 minutes' end
  where member_id = p_member;
  return false;
end;
$$;

revoke all on table public.member_pins from anon, authenticated;
revoke execute on function public.set_my_pin(uuid, text), public.has_pin(uuid), public.check_pin(uuid, text) from public, anon;
grant execute on function public.set_my_pin(uuid, text), public.has_pin(uuid), public.check_pin(uuid, text) to authenticated;
