-- The salon's rooms (2026-10-24): the owner adds, renames and stops using rooms; two rooms in use cannot share a name;
-- a room is never deleted; nobody else can change them; bookings offer only rooms in use.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(9);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.branch_setting(uuid, text, jsonb) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000050' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'rooms-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1']) n;

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000050a0');
select set_config('t.b', (create_business('{"business_name":"Rooms Studio","owner_name":"Owner","mode":"wellness"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);

select set_config('t.r', save_room(current_setting('t.br')::uuid, null, ' Massage room ')::text, false);
select is((select name from rooms where id = current_setting('t.r')::uuid), 'Massage room', 'the owner adds a room');
select is((select count(*)::int from rooms where branch_id = current_setting('t.br')::uuid and active), 3, 'next to the two starter rooms');
select throws_ok(format($$ select save_room('%s', null, 'massage ROOM') $$, current_setting('t.br')), '23505', 'room_taken',
  'two rooms in use cannot share a name');
select throws_ok(format($$ select save_room('%s', null, '   ') $$, current_setting('t.br')), '22023', 'room_name_required',
  'a room needs a name');
select lives_ok(format($$ select save_room('%s', '%s', 'Facial room') $$, current_setting('t.br'), current_setting('t.r')),
  'and can be renamed');
select lives_ok(format($$ select save_room('%s', '%s', 'Facial room', false) $$, current_setting('t.br'), current_setting('t.r')),
  'or no longer used');
select is((select active from rooms where id = current_setting('t.r')::uuid), false, 'it stays, not in use');

select pg_temp.as_user('00000000-0000-0000-0000-0000000050b1');
select throws_ok(format($$ select save_room('%s', null, 'Sneaky room') $$, current_setting('t.br')), '42501', null,
  'another account cannot add rooms');
select throws_ok(format($$ delete from rooms where id = '%s' $$, current_setting('t.r')), '42501', null, 'nor delete one');

select * from finish();
rollback;
