-- A changed booking link keeps working (owner's fix list, final brief D3): the old link leads to the new one while the
-- page is on; no other salon can take an old link, not even when a link is made from its name; the salon itself can
-- go back to its old link; visitors cannot read the list of old links.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000059' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'old-link-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b0']) n;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000059' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_visitor() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

-- Salon A ("Old Link Barbers") and salon B ("Other Salon"), both with a plan.
select pg_temp.as_user('a0');
select set_config('t.a', (create_business('{"business_name":"Old Link Barbers","owner_name":"Owner A","mode":"gents"}') ->> 'business_id'), false);
select set_config('t.abr', (select id::text from branches where business_id = current_setting('t.a')::uuid), false);
select pg_temp.as_user('b0');
select set_config('t.b', (create_business('{"business_name":"Other Salon","owner_name":"Owner B","mode":"ladies"}') ->> 'business_id'), false);
select set_config('t.bbr', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
reset role;
insert into subscriptions (business_id, paid_until)
select x::uuid, current_date + 60 from unnest(array[current_setting('t.a'), current_setting('t.b')]) x
on conflict (business_id) do update set paid_until = excluded.paid_until;

-- 1–3. A switches the page on (old-link-barbers), then changes the link: the old one leads to the new one.
select pg_temp.as_user('a0');
select is(set_online_booking(current_setting('t.abr')::uuid, true), 'old-link-barbers', 'the first link, from the name');
select is(set_online_booking(current_setting('t.abr')::uuid, true, 'olb-dubai'), 'olb-dubai', 'the link is changed');
select pg_temp.as_visitor();
select is(public_booking_link('Old-Link-Barbers'), 'olb-dubai', 'the old link leads to the new one');

-- 4–5. The current link and an unknown one lead nowhere else.
select is(public_booking_link('olb-dubai'), null, 'the current link is not an old one');
select is(public_booking_link('never-was'), null, 'an unknown link leads nowhere');

-- 6. While the page is off, the old link leads nowhere (the page says it is not available).
select pg_temp.as_user('a0');
select set_online_booking(current_setting('t.abr')::uuid, false);
select pg_temp.as_visitor();
select is(public_booking_link('old-link-barbers'), null, 'page off: nowhere');
select pg_temp.as_user('a0');
select set_online_booking(current_setting('t.abr')::uuid, true);

-- 7–8. Another salon cannot take the old link, and a link made from the same name skips it.
select pg_temp.as_user('b0');
select throws_ok($$ select set_online_booking(current_setting('t.bbr')::uuid, true, 'old-link-barbers') $$, '23505', 'link_taken',
  'another salon cannot take an old link');
reset role;
select is(unique_booking_slug('Old Link Barbers'), 'old-link-barbers-2', 'a link made from the name skips the old one');

-- 9. Salon A can go back to its old link; then it is simply its link again.
select pg_temp.as_user('a0');
select is(set_online_booking(current_setting('t.abr')::uuid, true, 'old-link-barbers'), 'old-link-barbers', 'back to the old link');
select pg_temp.as_visitor();
select is(public_booking_link('olb-dubai'), 'old-link-barbers', 'and the link in between leads to it');

-- 11. Visitors cannot read the old links.
select throws_ok($$ select count(*) from public.booking_old_links $$, '42501', null, 'visitors cannot read the old links');

select * from finish();
rollback;
