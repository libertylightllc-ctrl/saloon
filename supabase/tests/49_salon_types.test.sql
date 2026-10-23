-- Two more salon types (website brief 5.4): a unisex salon and a beauty & wellness studio each start with their own
-- services (not the ladies list); the studio has treatment rooms, and its massage needs a free room, online too.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(10);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.branch_setting(uuid, text, jsonb) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000049' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'types-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1']) n;

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- A unisex salon.
select pg_temp.as_user('00000000-0000-0000-0000-0000000049a0');
select set_config('t.u', (create_business('{"business_name":"Unisex Cuts","owner_name":"Owner","mode":"unisex"}') ->> 'business_id'), false);
select is((select mode::text from branches where business_id = current_setting('t.u')::uuid), 'unisex', 'a branch can be a unisex salon');
select is((select count(*)::int from services where business_id = current_setting('t.u')::uuid), 7, 'with 7 starter services');
select ok(exists (select 1 from services where business_id = current_setting('t.u')::uuid and name = 'Men''s Haircut'), 'cuts for men');
select ok(not exists (select 1 from services where business_id = current_setting('t.u')::uuid and name = 'Bridal Makeup'), 'not the ladies list');
select is((select count(*)::int from rooms where business_id = current_setting('t.u')::uuid), 0, 'no rooms');

-- A beauty & wellness studio.
select pg_temp.as_user('00000000-0000-0000-0000-0000000049b1');
select set_config('t.w', (create_business('{"business_name":"Calm Studio","owner_name":"Owner","mode":"wellness"}') ->> 'business_id'), false);
select set_config('t.wb', (select id::text from branches where business_id = current_setting('t.w')::uuid), false);
select is((select count(*)::int from services where business_id = current_setting('t.w')::uuid), 9, 'a studio starts with 9 services');
select is((select array_agg(name order by sort) from service_categories where business_id = current_setting('t.w')::uuid),
  array['Nails', 'Lashes & brows', 'Skincare & facials', 'Massage', 'Waxing'], 'in nails, lashes and brows, skincare, massage and waxing');
select is((select count(*)::int from rooms where business_id = current_setting('t.w')::uuid), 2, 'with 2 treatment rooms');
select ok(public.mode_uses_rooms('wellness') and public.mode_uses_rooms('ladies') and not public.mode_uses_rooms('unisex'),
  'rooms are for ladies salons and studios');

-- Both rooms taken at 11:00: a massage then cannot be booked without one.
select set_config('role', 'postgres', true);
insert into appointments (business_id, branch_id, room_id, business_date, scheduled_at, duration_min, status, source)
select current_setting('t.w')::uuid, current_setting('t.wb')::uuid, r.id, public.branch_today(current_setting('t.wb')::uuid) + 3,
       ((public.branch_today(current_setting('t.wb')::uuid) + 3) + time '11:00') at time zone 'Asia/Dubai', 60, 'booked', 'phone'
from rooms r where r.business_id = current_setting('t.w')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-0000000049b1');
select throws_ok(format($$ select create_appointment(jsonb_build_object('branch_id', '%s', 'service_ids',
    jsonb_build_array((select id from services where business_id = '%s' and name = 'Swedish Massage')),
    'scheduled_at', ((public.branch_today('%s'::uuid) + 3) + time '11:00') at time zone 'Asia/Dubai', 'customer_name', 'Test')) $$,
  current_setting('t.wb'), current_setting('t.w'), current_setting('t.wb')), null, 'room_required', 'a massage needs a free room');

select * from finish();
rollback;
