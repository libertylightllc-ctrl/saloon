-- The receipt link: every sale has its own secret token; the holder of a link sees that one receipt (lines, tax,
-- seller), signed in or not; an unknown link shows nothing; a malformed one is refused; visitors still cannot read sales.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(9);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.branch_setting(uuid, text, jsonb) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000370a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'rl-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;
create function pg_temp.sell(p_ref text) returns uuid language plpgsql as $$
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000370a');
  return (create_sale(jsonb_build_object('branch_id', current_setting('t.br'), 'client_ref', p_ref,
    'lines', '[{"kind":"custom","name":"Fade","unit_price_minor":10500}]'::jsonb,
    'payments', '[{"method":"cash","amount_minor":10500}]'::jsonb)) ->> 'sale_id')::uuid;
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-00000000370a');
select set_config('t.b', (create_business('{"business_name":"Link Salon","owner_name":"Nour","mode":"gents","vat_mode":"on","trn":"100234567800003"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select update_branch(current_setting('t.br')::uuid, '{"legal_name":"Link Salon LLC","licence_number":"778899"}');
select set_config('t.s1', pg_temp.sell('rl-1')::text, false);
select set_config('t.s2', pg_temp.sell('rl-2')::text, false);
select set_config('t.tok', (select receipt_token from sales where id = current_setting('t.s1')::uuid), false);

select ok(current_setting('t.tok') ~ '^[A-Za-z0-9_-]{24}$', 'a sale gets a 24-character secret token');
select isnt((select receipt_token from sales where id = current_setting('t.s2')::uuid), current_setting('t.tok'), 'each sale its own');

-- A visitor with the link sees that receipt.
select pg_temp.as_anon();
select is((public_receipt(current_setting('t.tok')) -> 'sale' ->> 'total_minor')::bigint, 10500::bigint, 'the holder of the link sees the receipt');
select is(public_receipt(current_setting('t.tok')) -> 'sale' -> 'sale_lines' -> 0 ->> 'name_snapshot', 'Fade', 'with its lines');
select is(public_receipt(current_setting('t.tok')) -> 'seller' ->> 'trn', '100234567800003', 'the tax number');
select is(public_receipt(current_setting('t.tok')) -> 'seller' ->> 'legal_name', 'Link Salon LLC', 'and the company details');
select is(public_receipt('AAAAAAAAAAAAAAAAAAAAAAAA'), null, 'an unknown link shows nothing');
select throws_ok($$ select public_receipt('short') $$, '22023', 'invalid_token', 'a malformed link is refused');
select is((select count(*)::int from sales), 0, 'a visitor still reads no sales');

select * from finish();
rollback;
