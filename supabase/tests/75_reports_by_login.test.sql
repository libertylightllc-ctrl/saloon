-- Part B, step 7 (owner's app check, 10 Nov 2026; brief B2 "Reports and books", "Setup"): each of the five login
-- types tried on the reports, closing a month, the audit trail and sign-ins, compliance records and their files, and
-- the daily hygiene log.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(51);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000075' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'report-roles-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(),
       '{}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6']) n;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000075' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.upload(p_folder text) returns text language sql as $$
  insert into storage.objects (bucket_id, name, owner, metadata)
  values ('documents', current_setting('t.b') || '/' || p_folder || '/' || gen_random_uuid() || '.jpg', auth.uid(),
          '{"mimetype":"image/jpeg","size":1200}')
  returning name
$$;
create function pg_temp.doc(p_branch text) returns uuid language sql as $$
  select save_document(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting(p_branch),
    'doc_type', 'trade_licence', 'holder_type', 'company', 'number', 'CN-75', 'issued_on', current_setting('t.today')::date - 300,
    'expires_on', current_setting('t.today')::date + 65))
$$;

select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"Report Roles Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select set_config('t.svc', (select id::text from services where business_id = current_setting('t.b')::uuid
                            and status = 'active' order by price_minor desc limit 1), false);

-- Manager Mona (b1), front desk Dina (b2), stylists Sami (b3) and Rami (b5) in the branch; the accountant (b4);
-- manager Zed (b6) of a second branch.
select pg_temp.as_admin();
select set_config('t.today', branch_today(current_setting('t.br')::uuid)::text, false);
select set_config('t.month', to_char(current_setting('t.today')::date, 'YYYY-MM'), false);
select set_config('t.last', to_char(current_setting('t.today')::date - interval '1 month', 'YYYY-MM'), false);
with b as (insert into branches (business_id, name, mode, created_at)
           values (current_setting('t.b')::uuid, 'Second branch', 'gents', clock_timestamp()) returning id)
select set_config('t.br2', id::text, false) from b;
create function pg_temp.member(p_user text, p_role text, p_name text, p_branch text default 't.br') returns void
language plpgsql as $$
declare v uuid;
begin
  insert into members (business_id, user_id, role, display_name, username)
  values (current_setting('t.b')::uuid, ('00000000-0000-0000-0000-0000000075' || p_user)::uuid, p_role::member_role,
          p_name, lower(p_name) || 'seventyfive') returning id into v;
  perform set_config('t.m' || p_user, v::text, false);
  if p_role <> 'accountant' then
    insert into member_branches (member_id, branch_id) values (v, current_setting(p_branch)::uuid);
    insert into employees (business_id, branch_id, member_id, full_name, role_title, base_salary_minor)
    values (current_setting('t.b')::uuid, current_setting(p_branch)::uuid, v, p_name,
            case p_role when 'cashier' then 'cashier' when 'manager' then 'manager' else 'staff' end, 300000)
    returning id into v;
    perform set_config('t.e' || p_user, v::text, false);
  end if;
end $$;
select pg_temp.member('b1', 'manager', 'Mona'), pg_temp.member('b2', 'cashier', 'Dina'),
       pg_temp.member('b3', 'staff', 'Sami'), pg_temp.member('b4', 'accountant', 'Books'),
       pg_temp.member('b5', 'staff', 'Rami'), pg_temp.member('b6', 'manager', 'Zed', 't.br2');

-- A sale each for Sami and Rami; a no-show booked with Sami; a bonus and a salary change (pay lines in the audit trail).
select pg_temp.as_user('b2');
create function pg_temp.sale(p_employee text) returns void language sql as $$
  select create_sale(jsonb_build_object('branch_id', current_setting('t.br'), 'employee_id', current_setting(p_employee),
    'lines', '[{"kind":"custom","name":"Fade","unit_price_minor":5000}]'::jsonb,
    'payments', '[{"method":"card","amount_minor":5000}]'::jsonb));
$$;
select pg_temp.sale('t.eb3'), pg_temp.sale('t.eb5');
select set_config('t.ns', create_appointment(jsonb_build_object('branch_id', current_setting('t.br'), 'kind', 'booking',
  'customer_name', 'Walk-in Omar', 'employee_id', current_setting('t.eb3'), 'service_ids', jsonb_build_array(current_setting('t.svc')),
  'scheduled_at', (current_setting('t.today')::date + time '23:30') at time zone 'Asia/Dubai'))::text, false);
select pg_temp.as_admin();
update appointments set status = 'no_show', customer_name = 'Walk-in Omar' where id = current_setting('t.ns')::uuid;
select pg_temp.as_user('a0');
select record_adjustment(jsonb_build_object('employee_id', current_setting('t.eb3'), 'kind', 'bonus', 'amount_minor', 5000));
select save_employee(jsonb_build_object('business_id', current_setting('t.b'), 'id', current_setting('t.eb5'),
  'full_name', 'Rami', 'base_salary_minor', 320000));

-- 1. Reports.
select pg_temp.as_user('b1');
select is((report_monthly(current_setting('t.br')::uuid, current_setting('t.month')) -> 'days' -> 0) ? 'sales_minor', true,
  'a manager opens the monthly sales');
select is(report_monthly(current_setting('t.br')::uuid, current_setting('t.month')) ->> 'costs_minor', null,
  'without the books'' costs');
select is(report_monthly(current_setting('t.br')::uuid, current_setting('t.month')) ->> 'revenue_minor', null,
  'or revenue');
select throws_ok(format($$ select report_monthly('%s', '%s') $$, current_setting('t.br2'), current_setting('t.month')),
  '42501', null, 'not for a branch they do not work in');
select is((select count(*)::int from report_staff(current_setting('t.br')::uuid, current_setting('t.month'))), 3,
  'staff sales: every stylist of the branch (and the manager, who also takes clients)');
select lives_ok(format($$ select * from report_closing('%s', '%s') $$, current_setting('t.br'), current_setting('t.month')),
  'daily closing');
select lives_ok(format($$ select * from report_shortages('%s', '%s') $$, current_setting('t.br'), current_setting('t.month')),
  'cash differences');
select lives_ok(format($$ select * from report_stock('%s', '%s') $$, current_setting('t.br'), current_setting('t.month')),
  'stock');
select is((select customer_name || ' · ' || staff_name from report_no_shows(current_setting('t.br')::uuid,
  current_setting('t.month'))), 'Walk-in Omar · Sami', 'and no-shows');
select throws_ok(format($$ select * from report_customers('%s', '%s') $$, current_setting('t.b'), current_setting('t.month')),
  '42501', null, 'not the customers report');
select throws_ok(format($$ select * from report_vat('%s', '%s') $$, current_setting('t.br'), current_setting('t.month')),
  '42501', null, 'nor VAT');
select pg_temp.as_user('a0');
select isnt(report_monthly(current_setting('t.br')::uuid, current_setting('t.month')) ->> 'revenue_minor', null,
  'the owner sees the books'' figures');
select pg_temp.as_user('b4');
select isnt(report_monthly(current_setting('t.br')::uuid, current_setting('t.month')) ->> 'costs_minor', null,
  'so does the accountant');
select is((select count(*)::int from report_no_shows(current_setting('t.br')::uuid, current_setting('t.month'))), 1,
  'who also sees the no-shows');
select pg_temp.as_user('b3');
select is((select string_agg(full_name, ',') from report_staff(current_setting('t.br')::uuid, current_setting('t.month'))),
  'Sami', 'a stylist sees only their own line of staff sales');
select throws_ok(format($$ select report_monthly('%s', '%s') $$, current_setting('t.br'), current_setting('t.month')),
  '42501', null, 'and no other report');
select throws_ok(format($$ select * from report_no_shows('%s', '%s') $$, current_setting('t.br'), current_setting('t.month')),
  '42501', null, 'not even the no-shows');
select pg_temp.as_user('b2');
select throws_ok(format($$ select * from report_staff('%s', '%s') $$, current_setting('t.br'), current_setting('t.month')),
  '42501', null, 'the front desk has no reports');
select throws_ok(format($$ select * from report_closing('%s', '%s') $$, current_setting('t.br'), current_setting('t.month')),
  '42501', null, 'not even daily closing');

-- 2. Closing a month: owner and accountant; reopening: the owner.
select pg_temp.as_user('b1');
select throws_ok(format($$ select close_period('%s', '%s') $$, current_setting('t.b'), current_setting('t.last')), '42501', null,
  'a manager does not close a month');
select pg_temp.as_user('b4');
select lives_ok(format($$ select close_period('%s', '%s') $$, current_setting('t.b'), current_setting('t.last')),
  'the accountant closes last month');
select throws_ok(format($$ select reopen_period('%s', '%s', 'Late bill') $$, current_setting('t.b'), current_setting('t.last')),
  '42501', null, 'but does not reopen it');
select pg_temp.as_user('a0');
select lives_ok(format($$ select reopen_period('%s', '%s', 'Late bill') $$, current_setting('t.b'), current_setting('t.last')),
  'the owner does');

-- 3. The audit trail and sign-ins.
select pg_temp.as_admin();
insert into audit_log (business_id, branch_id, actor_member_id, action, entity_type, entity_id, summary)
values (current_setting('t.b')::uuid, current_setting('t.br2')::uuid, null, 'update', 'sale', null, 'Second branch line');
insert into access_history (business_id, member_id, event)
select current_setting('t.b')::uuid, x::uuid, 'sign_in'
from unnest(array[current_setting('t.mb3'), current_setting('t.mb6'),
                  (select id::text from members where user_id = '00000000-0000-0000-0000-0000000075a0')]) x;
select pg_temp.as_user('b1');
select ok((select count(*) from audit_log) > 0, 'a manager reads the audit trail');
select is((select count(*)::int from audit_log where entity_type in ('employee', 'payroll_adjustment')), 0,
  'without pay lines or salary changes');
select is((select count(*)::int from audit_log where branch_id is distinct from current_setting('t.br')::uuid), 0,
  'and only their branch''s lines');
select is((select count(*)::int from access_history), 1, 'sign-ins of the people in their branch only');
select pg_temp.as_user('b6');
select is((select count(*)::int from audit_log where branch_id = current_setting('t.br')::uuid), 0,
  'the other branch''s manager sees none of these');
select pg_temp.as_user('b4');
select is((select count(*)::int from audit_log where entity_type in ('employee', 'payroll_adjustment')), 2,
  'the accountant sees the pay lines');
select is((select count(*)::int from access_history), 3, 'and every sign-in');
select pg_temp.as_user('b2');
select is((select count(*)::int from audit_log), 0, 'the front desk has no audit trail');
select is((select count(*)::int from access_history), 0, 'and sees no sign-ins');
select pg_temp.as_user('b3');
select is((select count(*)::int from audit_log), 0, 'nor does a stylist');

-- 4. Compliance records: owner and manager keep them (a manager in their branches); the accountant views.
select pg_temp.as_user('b1');
select ok(pg_temp.doc('t.br') is not null, 'a manager saves the branch''s trade licence');
select throws_ok($$ select pg_temp.doc('t.br2') $$, '42501', null, 'but not another branch''s');
select is((select count(*)::int from compliance_status(current_setting('t.b')::uuid)
           where branch_id = current_setting('t.br2')::uuid), 0, 'and sees only their branches'' records');
select is((select count(*)::int from compliance_documents), 1, 'their branch''s documents');
select lives_ok($$ select pg_temp.upload('compliance') $$, 'and uploads a scan');
select pg_temp.as_user('b4');
select throws_ok($$ select pg_temp.doc('t.br') $$, '42501', null, 'the accountant views but does not change records');
select ok((select count(*) from compliance_status(current_setting('t.b')::uuid)
           where branch_id = current_setting('t.br2')::uuid) > 0, 'and sees every branch''s');
select lives_ok($$ select pg_temp.upload('wps') $$, 'the accountant uploads salary transfer proof');
select pg_temp.as_user('b2');
select throws_ok(format($$ select * from compliance_status('%s') $$, current_setting('t.b')), '42501', null,
  'the front desk has no compliance records');
select is((select count(*)::int from compliance_documents), 0, 'and reads none');
select throws_ok($$ select pg_temp.upload('compliance') $$, '42501', null, 'nor uploads any');
select pg_temp.as_user('b3');
select throws_ok($$ select pg_temp.upload('wps') $$, '42501', null, 'a stylist uploads no pay papers');

-- 5. The daily hygiene log: owner, manager, front desk and stylists.
select pg_temp.as_user('b4');
select throws_ok(format($$ select sign_hygiene_log('{"branch_id":"%s","checklist":{}}') $$, current_setting('t.br')), '42501',
  null, 'the accountant does not sign the hygiene log');
select pg_temp.as_user('b3');
select set_config('t.photo', pg_temp.upload('hygiene'), false);
select lives_ok(format($$ select sign_hygiene_log('{"branch_id":"%s","checklist":{"tools_sterilised":true},"evidence_path":"%s"}') $$,
  current_setting('t.br'), current_setting('t.photo')), 'a stylist signs it, with a photo');
select is((select count(*)::int from hygiene_logs), 1, 'and sees it');
select pg_temp.as_user('b1');
select is((select count(*)::int from hygiene_logs), 1, 'so does the manager');
select pg_temp.as_user('b6');
select is((select count(*)::int from hygiene_logs), 0, 'not the other branch''s manager');
select pg_temp.as_user('b4');
select is((select count(*)::int from hygiene_logs), 0, 'nor the accountant');

select * from finish();
rollback;
