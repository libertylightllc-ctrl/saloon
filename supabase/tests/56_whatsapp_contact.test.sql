-- The WhatsApp number and message as a platform setting (owner's fix list, final brief A4): empty at first with the
-- brief's message; a platform owner saves a number as typed (kept as +E.164) and the message, logged in Changes;
-- nonsense is refused; anyone (visitors too) reads them; nobody else may change them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000056' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'wa-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b0']) x;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000056' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_visitor() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('role', 'anon', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

delete from platform_admins;
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000056a0');
update platform_settings set whatsapp_number = '', whatsapp_message = default where true;

-- 1. Empty at first, with the brief's message; visitors can read it.
select pg_temp.as_visitor();
select is(public.site_contact(),
  '{"whatsapp_number": "", "whatsapp_message": "Hi Saloqo, I''d like to know more about the pilot for my salon."}'::jsonb,
  'no number yet; the brief''s message');

-- 2–4. The platform owner saves a number typed with spaces; it is kept as +971…, and the change is logged.
select pg_temp.as_user('a0');
select is(public.admin_set_contact('+971 50 123 4567', 'Hi Saloqo, tell me about the app.') ->> 'whatsapp_number',
  '+971501234567', 'kept as +971501234567');
select pg_temp.as_admin();
select is((select after ->> 'whatsapp_number' from platform_audit where action = 'settings:contact' order by created_at desc limit 1),
  '+971501234567', 'the change is in Changes');
select is((select before ->> 'whatsapp_number' from platform_audit where action = 'settings:contact' order by created_at desc limit 1),
  '', 'with the old value');

-- 5. "00971…" works too; saving the same again logs nothing new.
select pg_temp.as_user('a0');
select is(public.admin_set_contact('00971 50 123 4567', 'Hi Saloqo, tell me about the app.') ->> 'whatsapp_number',
  '+971501234567', '00 becomes +, and nothing changed');
select pg_temp.as_admin();
select is((select count(*)::int from platform_audit where action = 'settings:contact'), 1, 'an unchanged save is not logged');

-- 6–7. Nonsense is refused; an empty message goes back to the default.
select pg_temp.as_user('a0');
select throws_ok($$ select public.admin_set_contact('050 123', 'x') $$, '22023', 'invalid_phone', 'a short number is refused');
select is(public.admin_set_contact('+971501234567', '  ') ->> 'whatsapp_message',
  'Hi Saloqo, I''d like to know more about the pilot for my salon.', 'an empty message goes back to the default');

-- 8–9. An owner who is not a platform owner, and a visitor, cannot change it.
select pg_temp.as_user('b0');
select throws_ok($$ select public.admin_set_contact('+971500000000', 'x') $$, '42501', 'not_allowed', 'a salon owner cannot');
select pg_temp.as_visitor();
select throws_ok($$ select public.admin_set_contact('+971500000000', 'x') $$, '42501', null, 'a visitor cannot');

-- 10. An empty box takes the number away (the buttons hide again).
select pg_temp.as_user('a0');
select is(public.admin_set_contact('', 'Hi') ->> 'whatsapp_number', '', 'an empty box removes the number');

select * from finish();
rollback;
