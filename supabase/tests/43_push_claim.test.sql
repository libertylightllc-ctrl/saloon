-- Waiting pushes are taken in one step inside the database (2026-10-20: past ~200 waiting, the old way was refused by
-- the gateway and pushes stopped for good). A batch is taken once, oldest first, with the person's phones; the rest
-- follows in the next run; signed-in people cannot take them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000043a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'push-a0@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000043a0', 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);
select set_config('t.b', (create_business('{"business_name":"Push Salon","owner_name":"Owner","mode":"gents"}') ->> 'business_id'), false);
select throws_ok($$ select * from claim_pending_push(10) $$, '42501', null, 'a signed-in person cannot take pushes');
select set_config('role', 'postgres', true);
select set_config('request.jwt.claims', '', true);

select set_config('t.m', (select id::text from members where business_id = current_setting('t.b')::uuid), false);
update notifications set pushed_at = now() where pushed_at is null;
insert into push_tokens (member_id, token, platform)
values (current_setting('t.m')::uuid, 'ExponentPushToken[claim-a]', 'ios'),
       (current_setting('t.m')::uuid, 'ExponentPushToken[claim-b]', 'android');
-- 450 waiting at once (more than the old way could ever take), a minute apart from oldest to newest.
insert into notifications (business_id, member_id, type, title, body, created_at)
select current_setting('t.b')::uuid, current_setting('t.m')::uuid, 'daily_digest', 'Good morning', 'n' || i,
       now() - make_interval(secs => 450 - i)
from generate_series(1, 450) i;

set local role service_role;
create temp table first_batch as select * from claim_pending_push(300);
select is((select count(*)::int from first_batch), 300, 'a batch of 300 is taken in one step');
select is((select tokens from first_batch limit 1), array['ExponentPushToken[claim-a]', 'ExponentPushToken[claim-b]'],
  'each with the person''s phones');
select is((select max(body) from first_batch where body = 'n1'), 'n1', 'oldest first');
select is((select count(*)::int from claim_pending_push(300)), 150, 'the rest in the next run');
select is((select count(*)::int from claim_pending_push(300)), 0, 'none twice');

select * from finish();
rollback;
