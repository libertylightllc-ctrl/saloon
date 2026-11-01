-- Old booking links from before migration 75 (owner's fix list, 1 Nov 2026): links a salon changed before old links were
-- kept are found again in its Activity and lead to its current link; a link another salon uses now stays that salon's;
-- any change of a link keeps the old one; and the booking page can tell a switched-off link from one that never existed.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000061' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'link-history-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b0']) n;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000061' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_visitor() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
create function pg_temp.status(p text) returns text language sql as $$ select public_booking_status(p) ->> 'status' $$;

-- Salon A ("History Barbers") and salon B, both with a plan and their pages on.
select pg_temp.as_user('a0');
select set_config('t.a', (create_business('{"business_name":"History Barbers","owner_name":"Owner A","mode":"gents"}') ->> 'business_id'), false);
select set_config('t.abr', (select id::text from branches where business_id = current_setting('t.a')::uuid), false);
select pg_temp.as_user('b0');
select set_config('t.b', (create_business('{"business_name":"Later Salon","owner_name":"Owner B","mode":"ladies"}') ->> 'business_id'), false);
select set_config('t.bbr', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
reset role;
insert into subscriptions (business_id, paid_until)
select x::uuid, current_date + 60 from unnest(array[current_setting('t.a'), current_setting('t.b')]) x
on conflict (business_id) do update set paid_until = excluded.paid_until;
select pg_temp.as_user('a0');
select set_config('t.first', set_online_booking(current_setting('t.abr')::uuid, true), false);
select pg_temp.as_user('b0');
select set_online_booking(current_setting('t.bbr')::uuid, true, 'taken-later');

-- A's history as it was before migration 75 (like Red Rose's): the link changed with only the Activity to show for it.
-- A used "taken-later" for a while, and B has it now.
reset role;
alter table branches disable trigger branches_keep_old_booking_link;
update branches set booking_slug = 'hb-third' where id = current_setting('t.abr')::uuid;
alter table branches enable trigger branches_keep_old_booking_link;
insert into audit_log (business_id, branch_id, action, entity_type, entity_id, summary, created_at)
select current_setting('t.a')::uuid, current_setting('t.abr')::uuid, 'update', 'branch', current_setting('t.abr')::uuid, s,
       now() + make_interval(mins => n)
from (values (1, 'Online booking on: taken-later'), (2, 'Online booking on: hb-second'),
             (3, 'Online booking on: hb-third'), (4, 'Online booking on: hb-third (was hb-old-form)')) v (n, s);

-- 1–4. Found again: each old link leads to A's current one.
select backfill_booking_old_links();
select is((select array_agg(slug order by slug) from booking_old_links where branch_id = current_setting('t.abr')::uuid),
  array['hb-old-form', 'hb-second', current_setting('t.first')], 'the old links are found in the Activity');
select pg_temp.as_visitor();
select is(public_booking_link(upper(current_setting('t.first'))), 'hb-third', 'the first link leads to the current one');
select is(public_booking_link('hb-second'), 'hb-third', 'and so does the one in between');
select is(public_booking_link('hb-old-form'), 'hb-third', 'and one named as "(was …)"');

-- 5–6. A link another salon uses now stays that salon's.
reset role;
select ok(not exists (select 1 from booking_old_links where slug = 'taken-later'), 'B''s link is not kept as A''s old one');
select pg_temp.as_user('b0');
select lives_ok($$ select set_online_booking(current_setting('t.bbr')::uuid, true, 'taken-later') $$, 'B keeps its link');

-- 7. Running it again adds nothing.
reset role;
select is(backfill_booking_old_links(), 0, 'a second run adds nothing');

-- 8. Any change of a link keeps the old one, not only a change made in Branch settings.
update branches set booking_slug = 'hb-fourth' where id = current_setting('t.abr')::uuid;
select pg_temp.as_visitor();
select is(public_booking_link('hb-third'), 'hb-fourth', 'a link changed another way is kept too');

-- 9–13. What the booking page is told about a link.
select is(pg_temp.status('hb-fourth'), 'open', 'the current link: the page');
select is(public_booking_status('hb-second'), '{"status": "moved", "link": "hb-fourth"}'::jsonb, 'an old link: moved, to where');
select is(pg_temp.status('never-was-here'), 'unknown', 'a link no salon ever had: unknown');
select pg_temp.as_user('a0');
select set_online_booking(current_setting('t.abr')::uuid, false);
select pg_temp.as_visitor();
select is(pg_temp.status('hb-fourth'), 'off', 'switched off: off');
select is(pg_temp.status('hb-second'), 'off', 'and its old links too');

-- 14–15. Only the database runs the search through the Activity.
select throws_ok($$ select backfill_booking_old_links() $$, '42501', null, 'visitors cannot run it');
select pg_temp.as_user('a0');
select throws_ok($$ select backfill_booking_old_links() $$, '42501', null, 'nor can a salon owner');

select * from finish();
rollback;
