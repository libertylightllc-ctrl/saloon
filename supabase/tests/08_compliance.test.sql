-- Compliance: the template of required records, statuses, renewals as versions, evidence, readiness,
-- the hygiene log (cashier signs; evidence can be required), WPS status, and who may see it.
begin;
create extension if not exists pgtap with schema extensions;
-- Paid plans are tested in 14_plans; here every salon may work.
select set_config('salon.plan_check', 'off', false);
select plan(30);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000070a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cp-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000070c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cp-cashier@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000070d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'cp-staff@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

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
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.status(p_type text, p_emp text default null) returns text language sql as $$
  select status from compliance_status(current_setting('t.b')::uuid)
  where doc_type = p_type and employee_id is not distinct from p_emp::uuid
$$;
create function pg_temp.today() returns date language sql as $$ select branch_today(current_setting('t.br')::uuid) $$;
create function pg_temp.file(p_name text) returns void language sql as $$
  insert into storage.objects (bucket_id, name, owner, metadata)
  values ('documents', p_name, auth.uid(), '{"mimetype":"image/jpeg","size":2000}')
$$;

-- ── Setup: a salon with a cashier (an employee) and a barber ──────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000070a');
select set_config('t.b', (create_business('{"business_name":"Compliance Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-00000000070c', 'username', 'cpcash', 'display_name', 'Faisal', 'role', 'cashier'));
select set_config('t.emp', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-00000000070d', 'username', 'cpstaff',
  'display_name', 'Rafiq', 'role', 'staff')) ->> 'employee_id'), false);

-- ── The template ────────────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000070a');
select is((select count(*)::int from compliance_status(current_setting('t.b')::uuid)), 4 + 2 * 3,
  'required: 4 salon records + health card, visa and vaccination for each of the 2 staff');
select is((select count(*)::int from compliance_status(current_setting('t.b')::uuid) where status = 'missing'), 10,
  'all missing at the start');
select is(compliance_readiness(current_setting('t.b')::uuid), 0, 'readiness 0%');

-- ── Statuses ────────────────────────────────────────────────────────────────────────────
select set_config('t.lic', save_document(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'doc_type', 'trade_licence', 'holder_type', 'company', 'number', 'CN-1234567', 'issued_on', pg_temp.today() - 300,
  'expires_on', pg_temp.today() + 65, 'renewal_cost_minor', 1500000))::text, false);
select is(pg_temp.status('trade_licence'), 'evidence_missing', 'a licence without its scan needs evidence');
select pg_temp.file(current_setting('t.b') || '/compliance/licence.jpg');
select lives_ok(format($$ select attach_document_evidence('%s', '%s/compliance/licence.jpg') $$, current_setting('t.lic'),
  current_setting('t.b')), 'owner attaches the scan');
select is(pg_temp.status('trade_licence'), 'valid', 'valid with 65 days left');
select save_document(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'doc_type', 'ejari', 'holder_type', 'premises', 'number', 'EJ-99', 'expires_on', pg_temp.today() + 20));
select is(pg_temp.status('ejari'), 'evidence_missing', 'evidence comes before due-soon');
select save_document(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'doc_type', 'pest_control', 'holder_type', 'premises', 'expires_on', pg_temp.today() - 3));
select is(pg_temp.status('pest_control'), 'expired', 'expired 3 days ago');
select save_document(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'doc_type', 'civil_defence', 'holder_type', 'premises', 'number', 'CD-7'));
select is(pg_temp.status('civil_defence'), 'missing_date', 'no expiry date entered');
select set_config('t.card', save_document(jsonb_build_object('business_id', current_setting('t.b'), 'employee_id', current_setting('t.emp'),
  'doc_type', 'health_card', 'holder_type', 'employee', 'number', 'HC-55', 'expires_on', pg_temp.today() + 10))::text, false);
select pg_temp.file(current_setting('t.b') || '/compliance/card.jpg');
select attach_document_evidence(current_setting('t.card')::uuid, current_setting('t.b') || '/compliance/card.jpg');
select is(pg_temp.status('health_card', current_setting('t.emp')), 'due_soon', 'Rafiq''s health card is due within 30 days');
select is((select days_left from compliance_status(current_setting('t.b')::uuid) where doc_type = 'health_card'
  and employee_id = current_setting('t.emp')::uuid), 10, '10 days left');
select is(compliance_readiness(current_setting('t.b')::uuid), 20, 'readiness: 2 of 10 records valid with evidence');
select throws_ok(format($$ select save_document('{"business_id":"%s","branch_id":"%s","doc_type":"ejari","holder_type":"premises",
  "issued_on":"2026-05-01","expires_on":"2026-04-01"}') $$, current_setting('t.b'), current_setting('t.br')), '22023', 'invalid_date',
  'expiry before issue is refused');

-- ── Renewal keeps history ────────────────────────────────────────────────────────────────
select set_config('t.card2', save_document(jsonb_build_object('business_id', current_setting('t.b'), 'employee_id', current_setting('t.emp'),
  'doc_type', 'health_card', 'holder_type', 'employee', 'number', 'HC-56', 'expires_on', pg_temp.today() + 375))::text, false);
select is((select version from compliance_documents where id = current_setting('t.card2')::uuid), 2, 'renewing makes version 2');
select is((select count(*)::int from compliance_documents where doc_type = 'health_card'), 2, 'the old version is kept');
select is(pg_temp.status('health_card', current_setting('t.emp')), 'evidence_missing', 'the new version needs its own scan');
select pg_temp.file(current_setting('t.b') || '/compliance/card2.jpg');
select throws_ok(format($$ select attach_document_evidence('%s', '%s/compliance/card2.jpg') $$, current_setting('t.card'),
  current_setting('t.b')), '22023', 'invalid_status', 'an old version cannot take new evidence');

-- ── Custom records ──────────────────────────────────────────────────────────────────────
select lives_ok(format($$ select save_document('{"business_id":"%s","branch_id":"%s","doc_type":"Signboard permit",
  "holder_type":"premises","expires_on":"%s"}') $$, current_setting('t.b'), current_setting('t.br'), pg_temp.today() + 200),
  'owner adds a record of their own');
select is((select required from compliance_status(current_setting('t.b')::uuid) where doc_type = 'Signboard permit'), false,
  'it is listed but not part of the template');

-- ── Who may see it ──────────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000070c');
select throws_ok(format($$ select * from compliance_status('%s') $$, current_setting('t.b')), '42501', null,
  'a cashier cannot open the register');
select is((select count(*)::int from compliance_documents), 0, 'nor read documents');
select throws_ok(format($$ select save_document('{"business_id":"%s","branch_id":"%s","doc_type":"ejari","holder_type":"premises"}') $$,
  current_setting('t.b'), current_setting('t.br')), '42501', null, 'nor add one');

-- ── Hygiene log ─────────────────────────────────────────────────────────────────────────
select is((dashboard_today(current_setting('t.br')::uuid) ->> 'hygiene_signed')::boolean, false, 'Home: not signed yet today');
select lives_ok(format($$ select sign_hygiene_log('{"branch_id":"%s","checklist":{"tools_sterilised":true,"towels_changed":true,
  "surfaces_cleaned":true,"floors_mopped":false,"waste_disposed":true},"note":"Mop broken"}') $$, current_setting('t.br')),
  'the cashier signs today''s checklist');
select is((select checklist ->> 'floors_mopped' from hygiene_logs), 'false', 'what was not done is kept as not done');
select throws_ok(format($$ select sign_hygiene_log('{"branch_id":"%s","checklist":{}}') $$, current_setting('t.br')), '22023',
  'already_signed', 'one log per day');
select is((dashboard_today(current_setting('t.br')::uuid) ->> 'hygiene_signed')::boolean, true, 'Home: signed');
select pg_temp.as_user('00000000-0000-0000-0000-00000000070d');
select throws_ok(format($$ select sign_hygiene_log('{"branch_id":"%s","checklist":{}}') $$, current_setting('t.br')), '42501', null,
  'staff cannot sign the hygiene log');

-- Evidence required: the owner turns it on; tomorrow's log would need a photo.
select pg_temp.as_admin();
update branches set settings = settings || '{"require_hygiene_evidence": true}' where id = current_setting('t.br')::uuid;
delete from hygiene_logs where branch_id = current_setting('t.br')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-00000000070c');
select throws_ok(format($$ select sign_hygiene_log('{"branch_id":"%s","checklist":{"tools_sterilised":true}}') $$,
  current_setting('t.br')), '22023', 'evidence_required', 'with the setting on, a photo is required');

select pg_temp.as_user('00000000-0000-0000-0000-00000000070a');
select is((dashboard_today(current_setting('t.br')::uuid) -> 'compliance' ->> 'readiness')::int, compliance_readiness(current_setting('t.b')::uuid),
  'Home shows the readiness score');

select * from finish();
rollback;
