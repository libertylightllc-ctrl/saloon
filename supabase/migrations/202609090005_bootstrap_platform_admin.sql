insert into public.salon_platform_admins(user_id)
select id from auth.users where email = 'platform.admin@auth.saloncontrol.app'
on conflict (user_id) do nothing;

do $$
begin
  if not exists (select 1 from public.salon_platform_admins) then
    raise exception 'Platform Admin account must exist before bootstrap migration';
  end if;
end $$;
