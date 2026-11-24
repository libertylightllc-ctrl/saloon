-- Platform console, Part B (owner's brief, 24 Nov 2026; migration 121): B9 open support conversations, those waiting
-- for a person, and the average first reply by a person over the last 30 days. The test database holds other
-- conversations, so counts compare with before; the reply time is checked with only these conversations.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000096' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'support-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b3', 'b4', 'b5']) x;
create function pg_temp.u(p text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000096' || p)::uuid $$;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(p), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
delete from platform_admins;
insert into platform_admins (user_id) values (pg_temp.u('a0'));
create temp table before on commit drop as select admin_support_stats() as v from (select pg_temp.as_user('a0')) x;
select pg_temp.as_admin();

-- b1: handed over, waiting 2 hours. b2: handed over, the team answered after 30 minutes. b3: the assistant is helping.
-- b4: closed, the team answered after 90 minutes. b5: from 40 days ago, answered after 10 hours (too old to count).
insert into support_threads (id, user_id, status, handover, last_from, created_at, last_message_at)
values (pg_temp.u('b1'), pg_temp.u('b1'), 'open', true, 'user', now() - interval '3 hours', now() - interval '2 hours'),
       (pg_temp.u('b2'), pg_temp.u('b2'), 'open', true, 'support', now() - interval '1 day', now() - interval '1 day'),
       (pg_temp.u('b3'), pg_temp.u('b3'), 'open', false, 'assistant', now() - interval '1 hour', now() - interval '1 hour'),
       (pg_temp.u('b4'), pg_temp.u('b4'), 'closed', true, 'support', now() - interval '5 days', now() - interval '5 days'),
       (pg_temp.u('b5'), pg_temp.u('b5'), 'closed', true, 'support', now() - interval '40 days', now() - interval '40 days');
insert into support_messages (thread_id, author, body, created_at)
values (pg_temp.u('b1'), 'user', 'Hello', now() - interval '3 hours'),
       (pg_temp.u('b1'), 'assistant', 'Let me find someone', now() - interval '3 hours' + interval '1 minute'),
       (pg_temp.u('b1'), 'user', 'Thanks', now() - interval '2 hours'),
       (pg_temp.u('b2'), 'user', 'Hello', now() - interval '1 day' - interval '30 minutes'),
       (pg_temp.u('b2'), 'support', 'Hi there', now() - interval '1 day'),
       (pg_temp.u('b3'), 'user', 'Hello', now() - interval '1 hour'),
       (pg_temp.u('b4'), 'user', 'Hello', now() - interval '5 days' - interval '90 minutes'),
       (pg_temp.u('b4'), 'support', 'Hi', now() - interval '5 days'),
       (pg_temp.u('b4'), 'support', 'Anything else?', now() - interval '4 days'),
       (pg_temp.u('b5'), 'user', 'Hello', now() - interval '40 days' - interval '10 hours'),
       (pg_temp.u('b5'), 'support', 'Hi', now() - interval '40 days');

select pg_temp.as_user('a0');
create temp table after on commit drop as select admin_support_stats() as v;
select pg_temp.as_admin();
create function pg_temp.more(p_key text) returns int language sql as $$
  select (a.v ->> p_key)::int - (b.v ->> p_key)::int from before b, after a
$$;

select is(pg_temp.more('open'), 3, 'open: the two handed over and the one with the assistant');
select is(pg_temp.more('waiting'), 1, 'waiting for a person: the one handed over and not answered');
select ok((select (v ->> 'oldest_waiting_at')::timestamptz <= now() - interval '2 hours' and (v ->> 'oldest_waiting_minutes')::int >= 120 from after),
  'with how long');
select is(pg_temp.more('replied_30d'), 2, 'answered by a person in the last 30 days: two (not the 40-day-old one)');

-- With only these conversations: (30 + 90) / 2 = 60 minutes.
delete from support_threads where id not in (select pg_temp.u(x) from unnest(array['b1', 'b2', 'b3', 'b4', 'b5']) x);
select pg_temp.as_user('a0');
select is((admin_support_stats() ->> 'first_reply_seconds')::int, 3600, 'the first reply took an hour on average');

select pg_temp.as_user('b1');
select throws_ok($$ select admin_support_stats() $$, '42501', 'not_allowed', 'a salon owner cannot see support numbers');

select * from finish();
rollback;
