-- The booking page, fuller (website brief 5.1): the owner adds the salon's Instagram (a handle or a profile link, kept
-- as the handle) and a cover photo from the salon's own folder; visitors see both on the public page; nobody else can
-- set them.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(10);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.branch_setting(uuid, text, jsonb) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000047' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'extras-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1']) n;

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000047a0');
select set_config('t.b', (create_business('{"business_name":"Extras Salon","owner_name":"Owner","mode":"ladies"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.slug', set_online_booking(current_setting('t.br')::uuid, true), false);

-- Instagram: a link or a handle, kept as the handle; blank removes it; anything else is refused.
select is(set_branch_instagram(current_setting('t.br')::uuid, ' https://www.instagram.com/extras.salon/?hl=en '), 'extras.salon',
  'a profile link is kept as the handle');
select is(set_branch_instagram(current_setting('t.br')::uuid, '@Extras_Salon'), 'Extras_Salon', 'so is "@handle"');
select throws_ok(format($$ select set_branch_instagram('%s', 'not a handle!') $$, current_setting('t.br')), '22023',
  'invalid_instagram', 'a handle is letters, digits, dots and underscores');

-- The cover photo must be in the salon's own folder of the logos bucket.
select throws_ok(format($$ select set_branch_cover('%s', '%s/missing.jpg') $$, current_setting('t.br'), current_setting('t.b')),
  '22023', 'photo_missing', 'a photo that was not uploaded is refused');
select pg_temp.as_admin();
insert into storage.objects (bucket_id, name) values ('logos', current_setting('t.b') || '/cover-test.jpg');
select pg_temp.as_user('00000000-0000-0000-0000-0000000047a0');
select lives_ok(format($$ select set_branch_cover('%s', '%s/cover-test.jpg') $$, current_setting('t.br'), current_setting('t.b')),
  'the owner puts a cover photo on the page');

-- A visitor sees both.
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select set_config('role', 'anon', true);
select is(public_booking_page(current_setting('t.slug')) -> 'salon' ->> 'instagram', 'Extras_Salon', 'the page shows the Instagram');
select is(public_booking_page(current_setting('t.slug')) -> 'salon' ->> 'cover_path', current_setting('t.b') || '/cover-test.jpg',
  'and the cover photo');

-- Someone else cannot change them; blank and null take them off.
select pg_temp.as_user('00000000-0000-0000-0000-0000000047b1');
select throws_ok(format($$ select set_branch_instagram('%s', 'other') $$, current_setting('t.br')), '42501', null,
  'another account cannot set the Instagram');
select pg_temp.as_user('00000000-0000-0000-0000-0000000047a0');
select is(set_branch_instagram(current_setting('t.br')::uuid, '  '), null, 'blank removes the Instagram');
select set_branch_cover(current_setting('t.br')::uuid, null);
select is((select cover_path from branches where id = current_setting('t.br')::uuid), null, 'and null the cover photo');

select * from finish();
rollback;
