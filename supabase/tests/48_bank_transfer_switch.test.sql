-- Paying by bank transfer or a card link (website brief 5.3): off until the platform owner switches it on; salons can
-- read the switch; only a platform owner can change it.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000048a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'bank-a0@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

select is((select column_default from information_schema.columns where table_name = 'platform_settings' and column_name = 'bank_transfer'),
  'false', 'off until it is switched on');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000048a0","role":"authenticated"}', true);
set local role authenticated;
select lives_ok($$ select bank_transfer from platform_settings $$, 'a signed-in owner can read the switch');
select throws_ok($$ select admin_set_bank_transfer(true) $$, '42501', null, 'but not change it');
reset role;

insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000048a0');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000048a0","role":"authenticated"}', true);
set local role authenticated;
select admin_set_bank_transfer(true);
reset role;
select is((select bank_transfer from platform_settings), true, 'a platform owner switches it on');

select * from finish();
rollback;
