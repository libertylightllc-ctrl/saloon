-- Help & support chat: a signed-in person and a visitor write; only they and platform owners read; an answer reaches
-- the person as a notification; platform owners are queued an email; limits hold.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(20);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.branch_setting(uuid, text, jsonb) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000033' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'sc-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b0', 'c0']) x;

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- a0 owns a salon; b0 is someone else; c0 is the platform owner.
select pg_temp.as_user('00000000-0000-0000-0000-0000000033a0');
select set_config('t.b', (create_business('{"business_name":"Support Salon","owner_name":"Layla","mode":"ladies","vat_mode":"off"}') ->> 'business_id'), false);
select pg_temp.as_admin();
delete from platform_admins;
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000033c0');

-- The owner writes; the conversation is theirs, tied to their salon, with where it came from.
select pg_temp.as_user('00000000-0000-0000-0000-0000000033a0');
select lives_ok($$ select support_send('{"body":"The receipt does not print","context":{"platform":"web","screen":"/sales","password":"x"}}') $$,
  'a signed-in owner writes to support');
select is((support_mine() -> 'messages' -> 0 ->> 'body'), 'The receipt does not print', 'and sees their message');
select lives_ok($$ select support_send('{"body":"It shows a blank page"}') $$, 'a second message joins the same conversation');
select is(jsonb_array_length(support_mine() -> 'messages'), 2, 'one conversation, two messages');
select throws_ok($$ select support_send('{"body":"   "}') $$, '22023', 'message_required', 'an empty message is refused');

-- Someone else sees nothing of it.
select pg_temp.as_user('00000000-0000-0000-0000-0000000033b0');
select is(jsonb_array_length(support_mine() -> 'messages'), 0, 'another person starts with an empty conversation');
select throws_ok($$ select * from admin_support_threads() $$, '42501', null, 'and cannot open the console inbox');
select throws_ok($$ select count(*) from support_messages $$, '42501', null, 'nor read the messages directly');

-- A visitor writes with the secret kept on their device; another secret reads nothing.
select pg_temp.as_anon();
select throws_ok($$ select support_guest_send('{"token":"tok_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","body":"Hi"}') $$,
  '22023', 'name_required', 'a visitor gives a name to start');
select throws_ok($$ select support_guest_send('{"token":"tok_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","name":"Omar","email":"no","body":"Hi"}') $$,
  '22023', 'invalid_email', 'and an email to be answered at');
select lives_ok($$ select support_guest_send('{"token":"tok_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","name":"Omar","email":"Omar@Example.com","body":"I cannot sign in"}') $$,
  'a visitor writes without signing in');
select is(support_guest_thread('tok_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa') -> 'messages' -> 0 ->> 'body', 'I cannot sign in',
  'and reads their conversation with the secret');
select is(jsonb_array_length(support_guest_thread('tok_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb') -> 'messages'), 0,
  'another secret reads nothing');
select throws_ok($$ select support_guest_thread('short') $$, '22023', 'invalid_token', 'a weak secret is refused');
select throws_ok($$ select support_mine() $$, '42501', null, 'a visitor cannot use the signed-in chat');

-- The platform owner sees both, answers the owner; the owner is notified and sees the answer.
select pg_temp.as_user('00000000-0000-0000-0000-0000000033c0');
select results_eq($$ select who, salon, unread, context ->> 'screen', context ? 'password' from admin_support_threads()
                     where salon = 'Support Salon' $$,
  $$ values ('Layla'::text, 'Support Salon'::text, 2, '/sales'::text, false) $$,
  'the inbox shows who wrote, from which salon and screen (and nothing else from the device)');
select lives_ok(format($$ select admin_support_reply('%s', 'Thanks Layla, fixed now.') $$,
  (select id from admin_support_threads() where salon = 'Support Salon')), 'the platform owner answers');
select pg_temp.as_admin();
select is((select type || ' ' || entity_type from notifications where member_id = (select id from members where user_id = '00000000-0000-0000-0000-0000000033a0')),
  'support_reply support', 'the owner is notified of the answer');
select pg_temp.as_user('00000000-0000-0000-0000-0000000033a0');
select is(support_unread(), 1, 'one unread answer before opening the chat');

-- With the assistant off, platform owners are queued an email for each conversation with a new message.
select pg_temp.as_admin();
update platform_settings set support_assistant = false where true;
select pg_temp.as_service();
select is((select count(*)::int from claim_support_alerts() where who in ('Omar')), 1, 'the visitor''s message is queued for the platform owners');

select * from finish();
rollback;
