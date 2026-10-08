-- Salons in any country (owner, 2026-10-04): the country brings the currency, time zone and sales tax; tax is either
-- included in prices or added on top; a 3-decimal currency counts in thousandths; UAE-only rules stay with the UAE;
-- the plan is USD 13.99 (about AED 50) outside the UAE.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(25);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000023' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'intl-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'c2']) n;

create function pg_temp.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- A New York barber: sales tax 8.875% added at the till, no tax number.
select pg_temp.as_user('00000000-0000-0000-0000-0000000023a0');
select set_config('t.us', (create_business('{"business_name":"Brooklyn Cuts","owner_name":"Owner","mode":"gents",
  "country_code":"US","currency":"USD","timezone":"America/New_York","vat_mode":"on","tax_name":"Sales tax",
  "tax_rate_bps":887.5,"tax_inclusive":false,"tax_id_label":"EIN"}') ->> 'business_id'), false);
select set_config('t.usbr', (select id::text from branches where business_id = current_setting('t.us')::uuid), false);
select is((select country_code || ' ' || currency || ' ' || timezone from businesses where id = current_setting('t.us')::uuid),
  'US USD America/New_York', 'the salon keeps its country, currency and time zone');
select is((select tax_name || ' ' || tax_rate_bps || ' ' || tax_inclusive || ' ' || tax_id_label from branches
           where id = current_setting('t.usbr')::uuid), 'Sales tax 887.5 false EIN', 'and its sales tax');
select is((select price_minor from services where business_id = current_setting('t.us')::uuid and name = 'Haircut'),
  680::bigint, 'starter prices come in dollars (AED 25 haircut → USD 6.80)');

-- USD 100.00 service and a USD 5.00 tip: tax 8.88 (8.875%, rounded to the cent) on top; the customer pays 113.88.
select throws_ok(format($$ select create_sale(jsonb_build_object('branch_id', '%s', 'tip_minor', 500,
  'lines', '[{"kind":"custom","name":"Fade","unit_price_minor":10000}]'::jsonb,
  'payments', '[{"method":"cash","amount_minor":10500}]'::jsonb)) $$, current_setting('t.usbr')),
  '22023', 'payment_mismatch: due 11388 paid 10500', 'the tax is added to the bill');
select set_config('t.sale', (create_sale(jsonb_build_object('branch_id', current_setting('t.usbr'), 'tip_minor', 500,
  'lines', '[{"kind":"custom","name":"Fade","unit_price_minor":10000}]'::jsonb,
  'payments', '[{"method":"card","amount_minor":11388}]'::jsonb)) ->> 'sale_id'), false);
select is((select vat_minor || ' ' || total_minor || ' ' || tax_rate_bps || ' ' || tax_inclusive from sales
           where id = current_setting('t.sale')::uuid), '888 11388 887.5 false', 'tax 8.88, total 113.88, rate kept on the sale');
select is((select net_minor || ' ' || vat_minor from sale_lines where sale_id = current_setting('t.sale')::uuid),
  '10888 888', 'the line carries its tax like an included price');
select is((select sum(l.credit_minor) from journal_lines l join journal_entries e on e.id = l.entry_id
           join accounts a on a.id = l.account_id
           where e.source_type = 'sale' and e.source_id = current_setting('t.sale')::uuid and a.system_key = 'service_revenue')::bigint,
  10000::bigint, 'the books show 100.00 of revenue');
select is((select sum(l.credit_minor) from journal_lines l join journal_entries e on e.id = l.entry_id
           join accounts a on a.id = l.account_id
           where e.source_type = 'sale' and e.source_id = current_setting('t.sale')::uuid and a.system_key = 'vat_payable')::bigint,
  888::bigint, 'and 8.88 of tax owed');
select is((select summary from audit_log where entity_type = 'sale' and entity_id = current_setting('t.sale')::uuid),
  'Saved sale #1001 · USD 113.88', 'the history speaks dollars');
select lives_ok(format($$ select refund_sale(jsonb_build_object('sale_id', '%s', 'amount_minor', 11388, 'method', 'card',
  'reason', 'Wrong customer')) $$, current_setting('t.sale')), 'a full refund goes through');
select is((select fmt_money(-2500)), '-USD 25.00', 'money without a currency is the salon''s');
select is(plan_status(current_setting('t.us')::uuid) ->> 'currency', 'USD', 'the plan is priced in dollars');
select is((plan_status(current_setting('t.us')::uuid) ->> 'monthly_minor')::bigint, 1399::bigint, 'USD 13.99 a month for up to 4 people');
select is((select count(*)::int from compliance_status(current_setting('t.us')::uuid)
           where doc_type in ('business_licence', 'lease')), 2, 'the checklist asks for a business licence and the lease');
select is((select count(*)::int from compliance_status(current_setting('t.us')::uuid)
           where doc_type in ('trade_licence', 'ejari', 'civil_defence', 'pest_control')), 0, 'and no UAE documents');
select throws_ok(format($$ select update_branch('%s', '{"tax_rate_bps":5000}') $$, current_setting('t.usbr')),
  '22023', 'invalid_tax_rate', 'a tax rate above 30% is refused');
select throws_ok(format($$ select update_branch('%s', '{"tax_rate_bps":887.55}') $$, current_setting('t.usbr')),
  '22023', 'invalid_tax_rate', 'and so is a rate finer than 0.001%');

-- A Kuwait salon: dinars with three decimals, no VAT.
select pg_temp.as_user('00000000-0000-0000-0000-0000000023b1');
select set_config('t.kw', (create_business('{"business_name":"Salmiya Ladies","owner_name":"Owner","mode":"ladies",
  "country_code":"KW","currency":"KWD","timezone":"Asia/Kuwait","tax_rate_bps":0}') ->> 'business_id'), false);
select set_config('t.kwbr', (select id::text from branches where business_id = current_setting('t.kw')::uuid), false);
select is((select price_minor from services where business_id = current_setting('t.kw')::uuid and name = 'Manicure'),
  5800::bigint, 'starter prices in fils of 1/1000 (AED 70 manicure → KWD 5.800)');
select set_config('t.kwsale', (create_sale(jsonb_build_object('branch_id', current_setting('t.kwbr'),
  'lines', '[{"kind":"custom","name":"Blow-dry","unit_price_minor":7500}]'::jsonb,
  'payments', '[{"method":"cash","amount_minor":7500}]'::jsonb)) ->> 'sale_id'), false);
select is((select summary from audit_log where entity_type = 'sale' and entity_id = current_setting('t.kwsale')::uuid),
  'Saved sale #1001 · KWD 7.500', 'KWD 7.500, three decimals');
-- The owner turns on a 10% VAT included in prices.
select lives_ok(format($$ select update_branch('%s', '{"vat_mode":"on","tax_rate_bps":1000,"tax_inclusive":true}') $$,
  current_setting('t.kwbr')), 'tax switched on without a 15-digit TRN outside the UAE');
select is((create_sale(jsonb_build_object('branch_id', current_setting('t.kwbr'),
  'lines', '[{"kind":"custom","name":"Colour","unit_price_minor":11000}]'::jsonb,
  'payments', '[{"method":"cash","amount_minor":11000}]'::jsonb)) ->> 'vat_minor')::bigint, 1000::bigint,
  '10% included: KWD 11.000 holds KWD 1.000 of VAT');
select is(plan_status(current_setting('t.kw')::uuid) ->> 'currency', 'USD', 'outside the UAE the plan is in dollars');

-- The UAE stays as it was.
select pg_temp.as_user('00000000-0000-0000-0000-0000000023c2');
select throws_ok($$ select create_business('{"business_name":"Deira Gents","mode":"gents","vat_mode":"on","trn":"123"}') $$,
  '22023', 'trn_required', 'a UAE salon charging VAT still needs its 15-digit TRN');
select throws_ok($$ select create_business('{"business_name":"Nowhere","mode":"gents","country_code":"US","currency":"USD",
  "timezone":"Mars/Olympus"}') $$, '22023', 'invalid_country', 'an unknown time zone is refused');
select set_config('t.ae', (create_business('{"business_name":"Deira Gents","mode":"gents"}') ->> 'business_id'), false);
select is((select b.currency || ' ' || br.tax_name || ' ' || br.tax_rate_bps || ' ' || br.tax_inclusive || ' ' || b.timezone
           from businesses b join branches br on br.business_id = b.id where b.id = current_setting('t.ae')::uuid),
  'AED VAT 500.0 true Asia/Dubai', 'with no country given: UAE, AED, VAT 5% included, Dubai time');

select * from finish();
rollback;
