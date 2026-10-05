-- Every compliance item can be edited and deleted (owner, 2026-10-05): edit corrects the current version in place; delete
-- takes the item off the register (kept, listed, and put back with its details); only the salon's owner may do either.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(30);
grant execute on function public.branch_today(uuid), public.branch_tz(uuid), public.business_today(uuid),
  public.compliance_readiness(uuid), public.plan_active(uuid), public.unique_business_code(text),
  public.post_journal(uuid, uuid, date, text, uuid, text, uuid, jsonb), public.branch_setting(uuid, text, jsonb)
  to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000270a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ce-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000270c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ce-cashier@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000270d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ce-staff@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000270e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ce-other@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

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
create function pg_temp.slot(p_type text, p_emp text default null) returns jsonb language sql as $$
  select to_jsonb(s) from compliance_status(current_setting('t.b')::uuid) s
  where s.doc_type = p_type and s.employee_id is not distinct from p_emp::uuid
$$;
create function pg_temp.remove(p_type text, p_holder text, p_emp text default null, p_reason text default null)
returns void language sql as $$
  select remove_document_slot(jsonb_build_object('business_id', current_setting('t.b'), 'doc_type', p_type,
    'holder_type', p_holder, 'branch_id', current_setting('t.br'), 'employee_id', p_emp, 'reason', p_reason))
$$;

-- ── A salon with a cashier and a barber, and another salon ────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000270a');
select set_config('t.b', (create_business('{"business_name":"Edit Delete Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-00000000270c', 'username', 'cecash', 'display_name', 'Faisal', 'role', 'cashier'));
select set_config('t.emp', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-00000000270d', 'username', 'cestaff',
  'display_name', 'Rafiq', 'role', 'staff')) ->> 'employee_id'), false);
select pg_temp.as_user('00000000-0000-0000-0000-00000000270e');
select create_business('{"business_name":"Other Salon","owner_name":"Other","mode":"ladies","vat_mode":"off"}');

select pg_temp.as_user('00000000-0000-0000-0000-00000000270a');
select set_config('t.lic', save_document(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'doc_type', 'trade_licence', 'holder_type', 'company', 'number', 'CN-1234', 'expires_on', branch_today(current_setting('t.br')::uuid) + 200))::text, false);
select set_config('t.own', save_document(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'doc_type', 'Signbord permit', 'holder_type', 'premises', 'number', 'SP-1'))::text, false);

-- ── Edit in place ────────────────────────────────────────────────────────────────────────
select lives_ok(format($$ select update_document('{"id":"%s","number":"CN-12345","expires_on":"%s","reminder_days":45}') $$,
  current_setting('t.lic'), branch_today(current_setting('t.br')::uuid) + 300), 'the owner corrects the licence');
select is(pg_temp.slot('trade_licence') ->> 'number', 'CN-12345', 'the number is corrected');
select is((pg_temp.slot('trade_licence') ->> 'days_left')::int, 300, 'and the expiry date');
select is((pg_temp.slot('trade_licence') ->> 'version')::int, 1, 'still version 1: an edit is not a renewal');
select is((select count(*)::int from compliance_documents where doc_type = 'trade_licence'), 1, 'no new version was made');
select ok(exists (select 1 from audit_log where entity_id = current_setting('t.lic')::uuid and action = 'edit'
  and summary like 'Edited Trade licence%'), 'the edit is in the audit trail');
select throws_ok(format($$ select update_document('{"id":"%s","issued_on":"2026-05-01","expires_on":"2026-04-01"}') $$,
  current_setting('t.lic')), '22023', 'invalid_date', 'expiry before issue is refused');
select lives_ok(format($$ select update_document('{"id":"%s","doc_type":"Signboard permit","number":"SP-1"}') $$,
  current_setting('t.own')), 'the owner''s own record can be renamed');
select is(pg_temp.slot('Signboard permit') ->> 'number', 'SP-1', 'it is listed under its new name');
select throws_ok(format($$ select update_document('{"id":"%s","doc_type":"My licence"}') $$, current_setting('t.lic')),
  '22023', 'invalid_line', 'checklist items keep their names');

-- ── Who may edit or delete ───────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000270c');
select throws_ok(format($$ select update_document('{"id":"%s","number":"X"}') $$, current_setting('t.lic')), '42501', null,
  'a cashier cannot edit a record');
select throws_ok($$ select pg_temp.remove('trade_licence', 'company') $$, '42501', null, 'nor delete one');
select pg_temp.as_user('00000000-0000-0000-0000-00000000270e');
select throws_ok(format($$ select update_document('{"id":"%s","number":"X"}') $$, current_setting('t.lic')), '42501', null,
  'another salon''s owner cannot edit it');
select throws_ok($$ select pg_temp.remove('trade_licence', 'company') $$, '42501', null, 'nor delete it');

-- ── Delete a record with details ─────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000270a');
select lives_ok($$ select pg_temp.remove('trade_licence', 'company', null, 'Licence moved to the head office') $$,
  'the owner deletes the trade licence');
select is((select count(*)::int from compliance_status(current_setting('t.b')::uuid) where doc_type = 'trade_licence'), 0,
  'it leaves the register');
select ok((select not active and removed_at is not null from compliance_documents where id = current_setting('t.lic')::uuid),
  'the record is kept, marked removed');
select is((select reason from compliance_removals where doc_type = 'trade_licence'), 'Licence moved to the head office',
  'and listed with the reason');
select throws_ok($$ select pg_temp.remove('trade_licence', 'company') $$, '22023', 'invalid_status', 'it cannot be deleted twice');
select throws_ok(format($$ select update_document('{"id":"%s","number":"X"}') $$, current_setting('t.lic')), '22023',
  'invalid_status', 'a deleted record cannot be edited');

-- ── Delete an empty checklist item ───────────────────────────────────────────────────────
select is((select count(*)::int from compliance_status(current_setting('t.b')::uuid)), 3 + 6 + 1,
  'before: 3 salon records, 3 for each of the 2 staff, the signboard permit');
select lives_ok(format($$ select pg_temp.remove('visa', 'employee', '%s', 'Family visa, not needed') $$, current_setting('t.emp')),
  'the owner deletes Rafiq''s visa item (nothing entered yet)');
select is((select count(*)::int from compliance_status(current_setting('t.b')::uuid)), 9, 'it leaves the register');
select is((select document_id from compliance_removals where doc_type = 'visa'), null, 'there were no details to keep');

-- ── Put back ─────────────────────────────────────────────────────────────────────────────
select lives_ok(format($$ select restore_document_slot('%s') $$, (select id from compliance_removals where doc_type = 'trade_licence')),
  'the owner puts the trade licence back');
select is(pg_temp.slot('trade_licence') ->> 'number', 'CN-12345', 'with its details');
select is((select count(*)::int from compliance_removals where doc_type = 'trade_licence'), 0, 'and it leaves the removed list');
select pg_temp.as_user('00000000-0000-0000-0000-00000000270c');
select is((select count(*)::int from compliance_removals), 0, 'a cashier cannot read the removed list');
select pg_temp.as_user('00000000-0000-0000-0000-00000000270a');
-- Adding details to a deleted item puts it back too.
select save_document(jsonb_build_object('business_id', current_setting('t.b'), 'employee_id', current_setting('t.emp'),
  'doc_type', 'visa', 'holder_type', 'employee', 'number', 'V-77'));
select is(pg_temp.slot('visa', current_setting('t.emp')) ->> 'number', 'V-77', 'adding details to a deleted item brings it back');
select is((select count(*)::int from compliance_removals), 0, 'nothing is left on the removed list');

select * from finish();
rollback;
