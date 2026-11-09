-- Home's compliance line shows the real status (owner's app check A4, 9 Nov 2026): a licence that expires in 2 days
-- without its scan and records never entered are not "expired"; "expired" is only a date that has passed.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(8);
-- Internal helpers the sign-in roles cannot call, allowed inside this rolled-back test only.
grant execute on function public.branch_today(uuid) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-0000-0000-0000000066a0', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'home-compliance@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000066a0',
  'role', 'authenticated')::text, false);
set role authenticated;

select set_config('t.b', (create_business('{"business_name":"Home Compliance Salon","owner_name":"Owner","mode":"ladies",
  "vat_mode":"off"}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
create function pg_temp.today() returns date language sql as $$ select branch_today(current_setting('t.br')::uuid) $$;
create function pg_temp.home() returns jsonb language sql as $$
  select dashboard_today(current_setting('t.br')::uuid) -> 'compliance'
$$;
create function pg_temp.n(k text) returns int language sql as $$ select (pg_temp.home() ->> k)::int $$;

-- 1–2. Nothing entered: every record is missing, none expired.
select is(pg_temp.n('expired'), 0, 'nothing entered is not "expired"');
select is(pg_temp.n('missing'), pg_temp.n('attention'), 'every record that needs attention is missing');

-- 3–5. The licence entered, expiring in 2 days, no scan yet.
select save_document(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'doc_type', 'trade_licence', 'holder_type', 'company', 'number', 'CN-1', 'expires_on', pg_temp.today() + 2));
select is(pg_temp.n('evidence_missing'), 1, 'the licence: scan missing');
select is(pg_temp.n('soonest_days'), 2, 'and it expires in 2 days');
select is(pg_temp.n('expired'), 0, 'still nothing expired');

-- 6–8. Another record whose date passed yesterday: now one is expired; the groups add up.
select save_document(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'doc_type', 'ejari', 'holder_type', 'premises', 'number', 'EJ-1', 'expires_on', pg_temp.today() - 1));
select is(pg_temp.n('expired'), 1, 'a date that has passed is expired');
select is(pg_temp.n('expired') + pg_temp.n('missing') + pg_temp.n('missing_date') + pg_temp.n('evidence_missing')
          + pg_temp.n('due_soon'), pg_temp.n('attention'), 'the statuses add up to the records needing attention');
select is(pg_temp.n('soonest_days'), 2, 'the expired one is not "expires in"');

select * from finish();
rollback;
