do $$
declare
  platform_user uuid;
begin
  select id into platform_user
  from auth.users
  where lower(email) = 'platform.admin@auth.saloncontrol.app';

  if platform_user is null then
    raise exception 'Platform administrator account was not found';
  end if;

  update auth.users
  set encrypted_password = '$2a$12$rf6Im9D0X0wtfR8uykkbcu5Pa3Ym1Xh4yNryy0N6UimjXQniw95hm',
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('must_change_password', true),
    updated_at = now()
  where id = platform_user;

  delete from auth.sessions where user_id = platform_user;
end
$$;
