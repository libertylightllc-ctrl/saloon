-- Two sales taxes (Canada: GST + PST): a sale charges both at the combined rate and keeps the second tax's share; the
-- books post each to its own account; a refund takes each back; the tax report shows the second tax apart; a second
-- tax needs a name, and rate 0 removes it.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(17);
grant execute on function public.branch_today(uuid), public.business_today(uuid), public.unique_business_code(text),
  public.branch_setting(uuid, text, jsonb), public.acct(uuid, text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000039' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'tt-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['0a', '0b']) n;

create function pg_temp.as_owner() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000390a', 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_owner2() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000390b', 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.posted(p_source text, p_key text) returns bigint language sql as $$
  select coalesce(sum(l.credit_minor - l.debit_minor), 0)::bigint from journal_entries je
  join journal_lines l on l.entry_id = je.id join accounts a on a.id = l.account_id
  where je.business_id = current_setting('t.b')::uuid and je.source_type = p_source and a.system_key = p_key
$$;

select pg_temp.as_owner();
select set_config('t.b', (create_business('{"business_name":"Vancouver Cuts","owner_name":"Lee","mode":"gents","country_code":"CA","currency":"CAD","timezone":"America/Vancouver","vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);

-- A second tax needs a name; then GST 5% + PST 7%, added at the till.
select throws_ok(format($$ select update_branch('%s', '{"vat_mode":"on","tax_name":"GST","tax_rate_bps":500,"tax_inclusive":false,"tax2_rate_bps":700}') $$,
  current_setting('t.br')), '22023', 'tax2_name_required', 'a second tax needs a name');
select lives_ok(format($$ select update_branch('%s', '{"vat_mode":"on","tax_name":"GST","tax_rate_bps":500,"tax_inclusive":false,"tax2_name":"PST","tax2_rate_bps":700}') $$,
  current_setting('t.br')), 'GST 5%% + PST 7%% added at the till');

-- A CAD 100.00 haircut: 12.00 of tax, 7.00 of it PST.
select set_config('t.s', (create_sale(jsonb_build_object('branch_id', current_setting('t.br'), 'client_ref', 'tt-1',
  'lines', '[{"kind":"custom","name":"Haircut","unit_price_minor":10000}]'::jsonb,
  'payments', '[{"method":"cash","amount_minor":11200}]'::jsonb)) ->> 'sale_id'), false);
select is((select row(vat_minor, tax2_minor, tax2_name, tax2_rate_bps, total_minor)::text from sales where id = current_setting('t.s')::uuid),
  '(1200,700,PST,700.0,11200)', 'the sale charges both and keeps the PST share');
select pg_temp.as_admin();
select is(pg_temp.posted('sale', 'vat_payable'), 500::bigint, 'GST goes to its account');
select is(pg_temp.posted('sale', 'tax2_payable'), 700::bigint, 'PST to its own');

-- A full refund takes each back.
select pg_temp.as_owner();
select lives_ok(format($$ select refund_sale(jsonb_build_object('sale_id', '%s', 'amount_minor', 11200, 'method', 'cash',
  'reason', 'Customer unhappy', 'idempotency_key', 'tt-r1')) $$, current_setting('t.s')), 'the sale is refunded');
select pg_temp.as_admin();
select is(pg_temp.posted('refund', 'vat_payable'), -500::bigint, 'the refund takes the GST back');
select is(pg_temp.posted('refund', 'tax2_payable'), -700::bigint, 'and the PST');

-- The tax report shows the second tax apart.
select pg_temp.as_owner();
select results_eq(format($$ select kind, vat_minor, tax2_minor from report_vat('%s', to_char(branch_today('%s'), 'YYYY-MM'))
                            where kind in ('sales', 'refunds') order by kind $$, current_setting('t.br'), current_setting('t.br')),
  $$ values ('refunds'::text, -1200::bigint, -700::bigint), ('sales'::text, 1200::bigint, 700::bigint) $$,
  'the tax report: all tax collected, the second tax apart');

-- One tax again (Ontario HST): rate 0 removes the second tax; a sale keeps no PST.
select lives_ok(format($$ select update_branch('%s', '{"tax_name":"HST","tax_rate_bps":1300,"tax2_rate_bps":0}') $$, current_setting('t.br')),
  'back to one tax');
select is((select row(tax2_name, tax2_rate_bps)::text from branches where id = current_setting('t.br')::uuid), '(,0.0)', 'the second tax is gone');
select is((create_sale(jsonb_build_object('branch_id', current_setting('t.br'), 'client_ref', 'tt-2',
  'lines', '[{"kind":"custom","name":"Haircut","unit_price_minor":10000}]'::jsonb,
  'payments', '[{"method":"cash","amount_minor":11300}]'::jsonb)) ->> 'vat_minor')::bigint, 1300::bigint, 'HST 13%% on one line');

select is((public_receipt((select receipt_token from sales where id = current_setting('t.s')::uuid)) -> 'sale'
           ->> 'tax2_minor')::bigint, 700::bigint, 'the receipt link carries the PST');

-- A province code only; a new country takes the second tax and the province away.
select throws_ok(format($$ select update_branch('%s', '{"settings":{"tax_region":"British Columbia"}}') $$, current_setting('t.br')),
  '22023', 'unknown_setting: tax_region', 'the province is its two-letter code');
select lives_ok(format($$ select update_branch('%s', '{"tax_name":"GST","tax_rate_bps":500,"tax2_name":"QST","tax2_rate_bps":997.5,"settings":{"tax_region":"QC"}}') $$,
  current_setting('t.br')), 'Quebec: GST 5%% + QST 9.975%%');
select pg_temp.as_admin();
update businesses set country_code = 'US' where id = current_setting('t.b')::uuid;
select is((select row(tax2_name, tax2_rate_bps, settings ? 'tax_region')::text from branches where id = current_setting('t.br')::uuid),
  '(,0.0,f)', 'a new country: no second tax, no province');

-- Setup takes the province and the second tax in one go.
select pg_temp.as_owner2();
select set_config('t.br2', (create_business('{"business_name":"Regina Cuts","owner_name":"Sam","mode":"gents","country_code":"CA","currency":"CAD","timezone":"America/Regina","vat_mode":"on","tax_name":"GST","tax_rate_bps":500,"tax_inclusive":false,"tax2_name":"PST","tax2_rate_bps":600,"tax_region":"SK"}') ->> 'branch_id'), false);
select is((select row(tax_name, tax_rate_bps, tax2_name, tax2_rate_bps, settings ->> 'tax_region')::text from branches
           where id = current_setting('t.br2')::uuid),
  '(GST,500.0,PST,600.0,SK)', 'a Saskatchewan salon set up with GST 5% + PST 6%');

select * from finish();
rollback;
