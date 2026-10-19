-- What a receipt says about the seller: the owner sets the tax type, the registered company name and the licence /
-- CR number in branch settings; bad numbers are refused; empty clears; staff cannot change them, but can read them
-- (the receipt prints them).
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(9);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.branch_setting(uuid, text, jsonb) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000360a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rd-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000360c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rd-cashier@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

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
create function pg_temp.branch() returns branches language sql as $$
  select * from branches where id = current_setting('t.br')::uuid
$$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000360a');
select set_config('t.b', (create_business('{"business_name":"Riyadh Cuts","owner_name":"Fahad","mode":"gents","country_code":"SA","currency":"SAR","timezone":"Asia/Riyadh","vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-00000000360c', 'username', 'rdcash', 'display_name', 'Saad', 'role', 'cashier'));

-- The owner picks the tax type and adds the company name and CR number.
select pg_temp.as_user('00000000-0000-0000-0000-00000000360a');
select lives_ok(format($$ select update_branch('%s', '{"vat_mode":"on","tax_name":"VAT","tax_rate_bps":1500,"trn":"300000000000003",
  "legal_name":"Riyadh Cuts Trading Est.","licence_label":"CR no.","licence_number":"1010123456"}') $$, current_setting('t.br')),
  'the owner saves the seller details');
select is((select row(legal_name, licence_label, licence_number, tax_name)::text from branches where id = current_setting('t.br')::uuid),
  '("Riyadh Cuts Trading Est.","CR no.",1010123456,VAT)', 'they are kept with the branch');
select lives_ok(format($$ select update_branch('%s', '{"tax_name":"GST"}') $$, current_setting('t.br')), 'the tax type changes');
select is((pg_temp.branch()).legal_name, 'Riyadh Cuts Trading Est.', 'other details stay when not sent');

-- Bad numbers are refused; an empty one clears.
select throws_ok(format($$ select update_branch('%s', '{"licence_number":"CR#12;"}') $$, current_setting('t.br')),
  '22023', 'invalid_licence', 'a number with other characters is refused');
select throws_ok(format($$ select update_branch('%s', jsonb_build_object('legal_name', repeat('x', 121))) $$, current_setting('t.br')),
  '22023', 'too_long', 'a name over 120 characters is refused');
select lives_ok(format($$ select update_branch('%s', '{"licence_number":" "}') $$, current_setting('t.br')), 'an empty number…');
select is((pg_temp.branch()).licence_number, null, '…clears it');

-- Staff read them (their receipts print them) but cannot change them.
select pg_temp.as_user('00000000-0000-0000-0000-00000000360c');
select throws_ok(format($$ select update_branch('%s', '{"legal_name":"Mine"}') $$, current_setting('t.br')), '42501', null,
  'a cashier cannot change them');

select * from finish();
rollback;
