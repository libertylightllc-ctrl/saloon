-- The salon's logo on receipts: only the owner uploads one, into their own business's folder; it goes on receipts
-- only once uploaded there; the receipt link carries it; null takes it off.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(10);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.branch_setting(uuid, text, jsonb), public.acct(uuid, text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000041' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'logo-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'c2']) n;

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
create function pg_temp.upload(p_name text) returns void language sql as $$
  insert into storage.objects (bucket_id, name, owner_id) values ('logos', p_name, auth.uid()::text)
$$;

-- Two salons; the first has a cashier.
select pg_temp.as_user('00000000-0000-0000-0000-0000000041a0');
select set_config('t.b', (create_business('{"business_name":"Logo Salon","owner_name":"Owner","mode":"gents"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_user('00000000-0000-0000-0000-0000000041c2');
select set_config('t.b2', (create_business('{"business_name":"Other Salon","owner_name":"Other","mode":"ladies"}') ->> 'business_id'), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-0000000041b1', 'username', 'logocash', 'display_name', 'Logo Cashier', 'role', 'cashier'));
select set_config('t.logo', current_setting('t.b') || '/' || current_setting('t.br') || '-0a1b2c3d.png', false);

-- Uploads: the owner, into their own folder only.
select pg_temp.as_user('00000000-0000-0000-0000-0000000041a0');
select lives_ok($$ select pg_temp.upload(current_setting('t.logo')) $$, 'the owner uploads a logo');
select throws_ok($$ select pg_temp.upload(current_setting('t.b2') || '/x.png') $$, '42501', null, 'not into another salon''s folder');
select pg_temp.as_user('00000000-0000-0000-0000-0000000041b1');
select throws_ok($$ select pg_temp.upload(current_setting('t.b') || '/y.png') $$, '42501', null, 'a cashier uploads none');
select throws_ok(format($$ select set_branch_logo('%s', '%s') $$, current_setting('t.br'), current_setting('t.logo')),
  '42501', 'not_allowed', 'nor puts one on receipts');

-- On receipts: an uploaded file of this salon only.
select pg_temp.as_user('00000000-0000-0000-0000-0000000041a0');
select throws_ok(format($$ select set_branch_logo('%s', '%s/nothing-here.png') $$, current_setting('t.br'), current_setting('t.b')),
  '22023', 'logo_missing', 'a file that was never uploaded');
select throws_ok(format($$ select set_branch_logo('%s', '%s/x.png') $$, current_setting('t.br'), current_setting('t.b2')),
  '22023', 'logo_missing', 'or another salon''s file');
select lives_ok(format($$ select set_branch_logo('%s', '%s') $$, current_setting('t.br'), current_setting('t.logo')), 'the logo goes on receipts');
select is((select logo_path from branches where id = current_setting('t.br')::uuid), current_setting('t.logo'), 'kept with the branch');

-- The receipt link carries it; null takes it off.
select set_config('t.s', (create_sale(jsonb_build_object('branch_id', current_setting('t.br'), 'client_ref', 'logo-1',
  'lines', '[{"kind":"custom","name":"Haircut","unit_price_minor":2500}]'::jsonb,
  'payments', '[{"method":"cash","amount_minor":2500}]'::jsonb)) ->> 'sale_id'), false);
select is(public_receipt((select receipt_token from sales where id = current_setting('t.s')::uuid)) -> 'seller' ->> 'logo_path',
  current_setting('t.logo'), 'the receipt link carries the logo');
select set_branch_logo(current_setting('t.br')::uuid, null);
select is((select logo_path from branches where id = current_setting('t.br')::uuid), null, 'null takes it off');

select * from finish();
rollback;
