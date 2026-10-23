-- Paying by bank transfer or a card link (website brief 5.3, 2026-10-23): the plan page's "we contact you to take the
-- payment" option stays off until the owner confirms there is a company and a bank account for it; the platform owner
-- switches it on in the console (Cards). Card payments through Creem are not affected.
alter table public.platform_settings add column bank_transfer boolean not null default false;
grant select (bank_transfer) on public.platform_settings to authenticated;

create function public.admin_set_bank_transfer(p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update platform_settings set bank_transfer = coalesce(p_on, false) where id;
end;
$$;
revoke execute on function public.admin_set_bank_transfer(boolean) from public, anon;
