-- Platform console, Part E (owner's brief, 24 Nov 2026; migration 123). E1 a conversation's five statuses: New while
-- the assistant answers; Waiting for you once it hands over (or is off, or 5 minutes pass) until a person replies;
-- Waiting for salon after an answer; Solved and Closed set by a person (with a reason while nobody has answered the
-- last message), each in Changes; Solved goes back to Waiting for you when the salon writes, and closes after 7 quiet
-- days. E2 a platform owner with a salon login gets a notice that opens Console → Support, and the email is queued.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(31);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000097' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'stage-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'a1', 'b1', 'b2']) x;
create function pg_temp.u(p text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000097' || p)::uuid $$;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(p), 'role', 'authenticated')::text, true);
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
create function pg_temp.writes(p text, p_body text) returns void language plpgsql as $$
begin
  perform pg_temp.as_user(p);
  perform support_send(jsonb_build_object('body', p_body));
  perform pg_temp.as_admin();
end $$;
create function pg_temp.stage(p text) returns text language sql as $$
  select stage from support_threads where user_id = pg_temp.u(p) order by last_message_at desc limit 1
$$;
create function pg_temp.th(p text) returns uuid language sql security definer as $$
  select id from support_threads where user_id = pg_temp.u(p) order by last_message_at desc limit 1
$$;

-- a0 and a1: platform owners; a0 has a salon login (for the notice), a1 has none. b1, b2: salon owners.
select pg_temp.as_user('a0');
select create_business('{"business_name":"Admin Salon","owner_name":"Sara","mode":"gents","vat_mode":"off"}');
select pg_temp.as_user('b1');
select create_business('{"business_name":"Palm Salon","owner_name":"Layla","mode":"ladies","vat_mode":"off"}');
select pg_temp.as_user('b2');
select create_business('{"business_name":"Cedar Cuts","owner_name":"Omar","mode":"gents","vat_mode":"off"}');
select pg_temp.as_admin();
delete from platform_admins;
insert into platform_admins (user_id) values (pg_temp.u('a0')), (pg_temp.u('a1'));
update platform_settings set support_assistant = true where true;

-- New, then the assistant answers.
select pg_temp.writes('b1', 'How do I add a service?');
select is(pg_temp.stage('b1'), 'new', 'a first message is New while the assistant answers');
select pg_temp.as_service();
select support_assistant_reply(pg_temp.th('b1'), 'More → Services → Add.', false);
select pg_temp.as_admin();
select is(pg_temp.stage('b1'), 'waiting_salon', 'answered by the assistant: Waiting for salon');

-- Asking for a person: handed over, Waiting for you; platform owners are told.
select pg_temp.writes('b1', 'Please arrange me a call from a team member');
select is(pg_temp.stage('b1'), 'new', 'the follow-up is New again');
select pg_temp.as_service();
select support_assistant_reply(pg_temp.th('b1'), 'A person from the Saloqo team will follow up here.', true);
select pg_temp.as_admin();
select is(pg_temp.stage('b1'), 'waiting_team', 'handed over: Waiting for you');
select is((select array[n.type, n.entity_type, n.data ->> 'who', n.data ->> 'salon'] from notifications n
           join members m on m.id = n.member_id where m.user_id = pg_temp.u('a0') and n.type = 'support_waiting'),
  array['support_waiting', 'support_console', 'Layla', 'Palm Salon'],
  'the platform owner with a salon login gets a notice there, which opens Console → Support');
select is((select count(*)::int from notifications n where n.type = 'support_waiting' and n.entity_id = pg_temp.th('b1')), 1,
  'one notice (the platform owner without a salon login is emailed only)');
select pg_temp.as_service();
select is((select count(*)::int from claim_support_alerts() where salon = 'Palm Salon'), 1, 'and the email is queued');
select pg_temp.as_admin();

-- It stays waiting until a person replies: another message, and Solved or Closed need a reason.
select pg_temp.writes('b1', 'Hello?');
select is(pg_temp.stage('b1'), 'waiting_team', 'another message: still Waiting for you');
select is((select count(*)::int from notifications n where n.type = 'support_waiting' and n.entity_id = pg_temp.th('b1')), 1,
  'without a second notice');
select pg_temp.as_service();
select is((select count(*)::int from claim_support_assistant() where salon = 'Palm Salon'), 0, 'the assistant stays out');
select pg_temp.as_user('a0');
select throws_ok(format($$ select admin_support_set_stage(%L, 'solved') $$, pg_temp.th('b1')), '22023', 'reason_required',
  'not Solved without a reason while nobody has answered');
select throws_ok(format($$ select admin_support_set_stage(%L, 'closed', 'ok') $$, pg_temp.th('b1')), '22023', 'reason_required',
  'a reason is a few words');
select throws_ok(format($$ select admin_support_close(%L) $$, pg_temp.th('b1')), '22023', 'reason_required',
  'the old Close button follows the same rule');
select is((select stage from admin_support_threads() where id = pg_temp.th('b1')), 'waiting_team', 'the inbox shows Waiting for you');
select is((select first_reply_at from admin_support_threads() where id = pg_temp.th('b1')), null, 'with no first reply yet');
select is(admin_support_waiting(), 1, 'the badge counts it');

-- A person replies: Waiting for salon, with the first reply time.
select admin_support_reply(pg_temp.th('b1'), 'Hi Layla, we will call you at 4 pm.');
select pg_temp.as_admin();
select is(pg_temp.stage('b1'), 'waiting_salon', 'a person replied: Waiting for salon');
select pg_temp.as_user('a0');
select ok((select first_reply_at > first_asked_at from admin_support_threads() where id = pg_temp.th('b1')),
  'the first reply is after the first message');
select is(admin_support_waiting(), 0, 'nothing waits for a person');

-- Solved (no reason needed now), in Changes; the salon writes again: Waiting for you.
select admin_support_set_stage(pg_temp.th('b1'), 'solved');
select pg_temp.as_admin();
select is(pg_temp.stage('b1'), 'solved', 'Solved');
select is((select array[subject, before ->> 'stage', after ->> 'stage'] from platform_audit
           where action = 'support:stage' and actor = pg_temp.u('a0') order by created_at desc limit 1),
  array['Layla', 'waiting_salon', 'solved'], 'written to Changes: who wrote, old and new status');
select pg_temp.writes('b1', 'It still does not work');
select is(pg_temp.stage('b1'), 'waiting_team', 'the salon writes after Solved: Waiting for you again');

-- Closed with a reason, kept in Changes.
select pg_temp.as_user('a0');
select admin_support_set_stage(pg_temp.th('b1'), 'closed', 'Called her, fixed by phone');
select pg_temp.as_admin();
select is((select array[status, stage] from support_threads where id = pg_temp.th('b1')), array['closed', 'closed'],
  'Closed, and the old open/closed column follows');
select is((select after ->> 'reason' from platform_audit where action = 'support:stage' and after ->> 'stage' = 'closed'),
  'Called her, fixed by phone', 'with the reason');

-- Back to Waiting for you, unless the person has a newer open conversation.
select pg_temp.as_user('a0');
select lives_ok(format($$ select admin_support_set_stage(%L, 'waiting_team') $$, pg_temp.th('b1')), 'taken back: Waiting for you');
select pg_temp.as_admin();
select set_config('t.old', pg_temp.th('b1')::text, false);
select admin_support_set_stage(current_setting('t.old')::uuid, 'closed', 'Duplicate question')
  from (select pg_temp.as_user('a0')) x;
select pg_temp.writes('b1', 'A new question about receipts');
select pg_temp.as_user('a0');
select throws_ok(format($$ select admin_support_set_stage(%L, 'waiting_team') $$, current_setting('t.old')), '22023', 'already_open',
  'one open conversation per person');

-- Every 5 minutes: unanswered for 5 minutes waits for a person; Solved and quiet for 7 days closes.
select pg_temp.writes('b2', 'Is anyone there?');
update support_threads set last_message_at = now() - interval '6 minutes' where id = pg_temp.th('b2');
select support_tick();
select is(pg_temp.stage('b2'), 'waiting_team', 'no answer in 5 minutes: Waiting for you');
update support_threads set stage = 'solved' where id = pg_temp.th('b2');
update support_threads set stage_at = now() - interval '8 days' where id = pg_temp.th('b2');
select support_tick();
select is(pg_temp.stage('b2'), 'closed', 'Solved and quiet for 7 days: Closed');

-- The assistant switched off: a message waits for a person at once.
update platform_settings set support_assistant = false where true;
select pg_temp.writes('b2', 'Another question');
select is(pg_temp.stage('b2'), 'waiting_team', 'with the assistant off, Waiting for you at once');

-- Only platform owners.
select pg_temp.as_user('b1');
select throws_ok(format($$ select admin_support_set_stage(%L, 'closed', 'spam spam') $$, pg_temp.th('b1')), '42501', 'not_allowed',
  'a salon owner cannot set a status');
select throws_ok($$ select admin_support_waiting() $$, '42501', 'not_allowed', 'nor count the waiting ones');

select * from finish();
rollback;
