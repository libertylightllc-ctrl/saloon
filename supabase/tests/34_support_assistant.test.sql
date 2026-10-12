-- The support assistant: it answers waiting conversations once each, hands over to a person, stays out once a person
-- has it, starts afresh after a close, and can be switched off; only the server can use it.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(19);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.branch_setting(uuid, text, jsonb) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000034' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'sa-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'c0']) x;

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
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
create function pg_temp.owner_writes(p_body text) returns void language plpgsql as $$
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000034a0');
  perform support_send(jsonb_build_object('body', p_body, 'context', jsonb_build_object('language', 'en', 'screen', '/queue')));
end $$;
create function pg_temp.waiting() returns int language plpgsql as $$
declare n int;
begin
  perform pg_temp.as_service();
  select count(*) into n from claim_support_assistant() where salon = 'Assistant Salon';
  return n;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000034a0');
select set_config('t.b', (create_business('{"business_name":"Assistant Salon","owner_name":"Huda","mode":"ladies","vat_mode":"off"}') ->> 'business_id'), false);
select pg_temp.as_admin();
delete from platform_admins;
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000034c0');
update platform_settings set support_assistant = true where true;

-- A question waits for the assistant, with who is asking.
select pg_temp.owner_writes('How do I give my cashier a new password?');
select pg_temp.as_service();
select results_eq($$ select signed_in, role, salon, who, context ->> 'screen', jsonb_array_length(messages)
                     from claim_support_assistant() where salon = 'Assistant Salon' $$,
  $$ values (true, 'owner'::text, 'Assistant Salon'::text, 'Huda'::text, '/queue'::text, 1) $$,
  'the assistant gets the question with who is asking and from where');
select is(pg_temp.waiting(), 0, 'a conversation being answered is not handed out twice');
select set_config('t.th', (select id::text from support_threads where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select is(support_assistant_reply(current_setting('t.th')::uuid, 'More → Staff → the cashier → Password & sign-in.', false),
  true, 'it answers');
select pg_temp.as_user('00000000-0000-0000-0000-0000000034a0');
select is(support_unread(), 1, 'the owner has one unread answer');
select is((support_mine() -> 'messages' -> 1 ->> 'author'), 'assistant', 'marked as the assistant''s');
select pg_temp.as_admin();
select is((select count(*)::int from notifications where type = 'support_reply'
           and member_id = (select id from members where user_id = '00000000-0000-0000-0000-0000000034a0')), 1,
  'the owner is notified');
select is(pg_temp.waiting(), 0, 'an answered conversation does not wait');
select pg_temp.as_service();
select is(support_assistant_reply(current_setting('t.th')::uuid, 'again', false), false,
  'and is not answered twice');

-- A follow-up after its answer wakes it straight away (it once waited for the 2-minute retry).
select pg_temp.as_admin();
select vault.create_secret('http://kong:8000', 'project_url') where not exists (select 1 from vault.secrets where name = 'project_url');
select vault.create_secret('test-anon-key', 'anon_key') where not exists (select 1 from vault.secrets where name = 'anon_key');
select set_config('t.calls', (select count(*)::text from net.http_request_queue where url like '%/functions/v1/support-assistant'), false);

-- A refund question: handed over to a person, who is emailed; the assistant then stays out.
select pg_temp.owner_writes('I paid but the plan is still off, can I get a refund?');
select pg_temp.as_admin();
select is((select count(*)::int from net.http_request_queue where url like '%/functions/v1/support-assistant'),
  current_setting('t.calls')::int + 1, 'the follow-up wakes the assistant at once');
select is(pg_temp.waiting(), 1, 'the next question waits again');
select pg_temp.as_service();
select lives_ok(format($$ select support_assistant_reply('%s', 'A person from the Saloqo team will follow up here.', true) $$,
  current_setting('t.th')), 'it hands over');
select is((select count(*)::int from claim_support_alerts() where salon = 'Assistant Salon'), 1,
  'platform owners are emailed about it');
select pg_temp.owner_writes('Hello?');
select is(pg_temp.waiting(), 0, 'a conversation with a person is not answered by the assistant');
select pg_temp.as_user('00000000-0000-0000-0000-0000000034c0');
select is((select handover from admin_support_threads() where salon = 'Assistant Salon'), true, 'the console shows it needs a person');

-- Closed, then written to again: the assistant answers afresh.
select admin_support_close(current_setting('t.th')::uuid);
select pg_temp.owner_writes('New question: how do I add a service?');
select is(pg_temp.waiting(), 1, 'after a close the assistant answers again');

-- Switched off by a platform owner: nothing waits for it, and platform owners are emailed instead.
select pg_temp.as_user('00000000-0000-0000-0000-0000000034c0');
select lives_ok($$ select admin_set_support_assistant(false) $$, 'a platform owner switches the assistant off');
select pg_temp.as_admin();
update support_threads set assistant_claimed_at = null where id = current_setting('t.th')::uuid;
select is(pg_temp.waiting(), 0, 'switched off, it answers nothing');

-- Only the server uses the assistant; only platform owners switch it.
select pg_temp.as_user('00000000-0000-0000-0000-0000000034a0');
select throws_ok($$ select * from claim_support_assistant() $$, '42501', null, 'the app cannot claim conversations');
select throws_ok($$ select admin_set_support_assistant(true) $$, '42501', null, 'a salon owner cannot switch it');

select * from finish();
rollback;
