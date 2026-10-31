-- Duplicate sign-ups (owner's fix list, final brief C4): sign-up asks about a number that already has an open salon
-- (yes or no only, 10 questions an hour from one address); Console → Salons lists salons whose owners have the same
-- name or number, with the other salons' names; only platform owners see that list.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Owners a0 (A), b0 (B), c0 (C), d0 (D, closed); the platform owner e0.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000057' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'dup-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b0', 'c0', 'd0', 'e0']) x;
create function pg_temp.u(p text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000057' || p)::uuid $$;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(p), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_visitor(p_ip text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.headers', json_build_object('x-forwarded-for', p_ip)::text, true);
  perform set_config('role', 'anon', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

delete from platform_admins;
insert into platform_admins (user_id) values (pg_temp.u('e0'));
insert into businesses (id, name, code, country_code, timezone) values
  ('57000000-0000-0000-0000-00000000000a', 'Dup A', 'dupa', 'AE', 'Asia/Dubai'),
  ('57000000-0000-0000-0000-00000000000b', 'Dup B', 'dupb', 'AE', 'Asia/Dubai'),
  ('57000000-0000-0000-0000-00000000000c', 'Dup C', 'dupc', 'AE', 'Asia/Dubai'),
  ('57000000-0000-0000-0000-00000000000d', 'Dup D', 'dupd', 'AE', 'Asia/Dubai');
update businesses set closed_at = now() where id = '57000000-0000-0000-0000-00000000000d';
insert into members (business_id, user_id, role, display_name) values
  ('57000000-0000-0000-0000-00000000000a', pg_temp.u('a0'), 'owner', 'Omar Saeed'),
  ('57000000-0000-0000-0000-00000000000b', pg_temp.u('b0'), 'owner', ' omar  SAEED '),
  ('57000000-0000-0000-0000-00000000000c', pg_temp.u('c0'), 'owner', 'Huda'),
  ('57000000-0000-0000-0000-00000000000d', pg_temp.u('d0'), 'owner', 'Faris');
insert into owner_contacts (user_id, phone) values
  (pg_temp.u('a0'), '+971505557001'),
  (pg_temp.u('b0'), '+971505557002'),
  (pg_temp.u('c0'), '+971505557001'),
  (pg_temp.u('d0'), '+971505557003');

-- 1–4. A visitor signing up: a number with an open salon is known (typed with spaces too); the closed salon's, an
--      unknown and a nonsense number are not.
select pg_temp.as_visitor('203.0.113.7');
select is(public.phone_has_salon('+971505557001'), true, 'a number with an open salon');
select is(public.phone_has_salon('+971 50 555 7002'), true, 'typed with spaces');
select is(public.phone_has_salon('+971505557003'), false, 'only a closed salon: no');
select is(public.phone_has_salon('+971505557999') or public.phone_has_salon('hello'), false, 'unknown or nonsense: no');

-- 5–6. Ten questions an hour from one address (four so far: nonsense is not counted); after that the answer is no, but
--      another address is still answered.
select pg_temp.as_visitor('203.0.113.7');
select public.phone_has_salon('+971505557999') from generate_series(1, 6);
select is(public.phone_has_salon('+971505557001'), false, 'the 11th question in an hour gets no');
select pg_temp.as_visitor('203.0.113.8');
select is(public.phone_has_salon('+971505557001'), true, 'another address is still answered');

-- 7. Visitors cannot read the questions asked.
select throws_ok($$ select count(*) from public.phone_checks $$, '42501', null, 'visitors cannot read the list');

-- 8–10. The platform owner sees A and B (same owner name, any case or spacing), A and C (same number), and nothing
--       for D.
select pg_temp.as_user('e0');
create temp table dup on commit drop as
  select * from public.admin_salon_duplicates() where business_id::text like '57000000-%';
select is((select others from dup where business_id = '57000000-0000-0000-0000-00000000000a' and reason = 'name'),
  array['Dup B'], 'A: same owner name as B');
select is((select others from dup where business_id = '57000000-0000-0000-0000-00000000000a' and reason = 'phone'),
  array['Dup C'], 'A: same number as C');
select is((select array_agg(reason || ':' || array_to_string(others, ',') order by reason) from dup
           where business_id in ('57000000-0000-0000-0000-00000000000b', '57000000-0000-0000-0000-00000000000c',
                                 '57000000-0000-0000-0000-00000000000d')),
  array['name:Dup A', 'phone:Dup A'], 'B and C point back to A; D has none');

-- 11–12. Nobody else sees it.
select pg_temp.as_user('a0');
select throws_ok($$ select * from public.admin_salon_duplicates() $$, '42501', 'not_allowed', 'a salon owner cannot');
select pg_temp.as_visitor('203.0.113.9');
select throws_ok($$ select * from public.admin_salon_duplicates() $$, '42501', null, 'a visitor cannot');

select * from finish();
rollback;
