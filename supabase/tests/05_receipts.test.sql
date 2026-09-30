-- Receipt photos: the front desk uploads into its own business folder only, staff and other salons see
-- nothing, a photo can be attached once and never changed or removed.
begin;
create extension if not exists pgtap with schema extensions;
-- Paid plans are tested in 14_plans; here every salon may work.
select set_config('salon.plan_check', 'off', false);
select plan(16);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-00000000040a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rc-owner@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000040c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rc-cashier@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000040d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rc-staff@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'),
  ('00000000-0000-0000-0000-00000000040e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rc-other@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}');

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
create function pg_temp.upload(p_name text) returns void language sql as $$
  insert into storage.objects (bucket_id, name, owner, metadata)
  values ('receipts', p_name, auth.uid(), '{"mimetype":"image/jpeg","size":1200}')
$$;

-- ── Setup: a salon with a cashier and a stylist, and another salon ──────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000040e');
select set_config('t.other', (create_business('{"business_name":"Other Salon","owner_name":"Other","mode":"gents",
  "vat_mode":"off"}') ->> 'business_id'), false);
select pg_temp.as_user('00000000-0000-0000-0000-00000000040a');
select set_config('t.b', (create_business('{"business_name":"Receipt Salon","owner_name":"Owner","mode":"gents",
  "vat_mode":"off","opening_cash_minor":10000}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-00000000040c', 'username', 'rccash', 'display_name', 'Cashier', 'role', 'cashier'));
select register_staff_member(jsonb_build_object('business_id', current_setting('t.b'), 'branch_id', current_setting('t.br'),
  'user_id', '00000000-0000-0000-0000-00000000040d', 'username', 'rcstaff', 'display_name', 'Staff', 'role', 'staff'));
select pg_temp.as_user('00000000-0000-0000-0000-00000000040a');
select set_config('t.exp', (record_expense(jsonb_build_object('branch_id', current_setting('t.br'), 'amount_minor', 4500,
  'method', 'cash', 'category_id', (select id from expense_categories where business_id = current_setting('t.b')::uuid
  and key = 'dry_cleaning'))) ->> 'expense_id'), false);

-- ── Uploads ──────────────────────────────────────────────────────────────────────────────
select lives_ok(format($$ select pg_temp.upload('%s/expenses/one.jpg') $$, current_setting('t.b')),
  'the owner uploads a photo into the salon''s folder');
select throws_ok(format($$ select pg_temp.upload('%s/expenses/sneaky.jpg') $$, current_setting('t.other')), '42501', null,
  'nobody uploads into another salon''s folder');
select pg_temp.as_user('00000000-0000-0000-0000-00000000040c');
select lives_ok(format($$ select pg_temp.upload('%s/expenses/two.jpg') $$, current_setting('t.b')), 'the cashier uploads too');
select pg_temp.as_user('00000000-0000-0000-0000-00000000040d');
select throws_ok(format($$ select pg_temp.upload('%s/expenses/three.jpg') $$, current_setting('t.b')), '42501', null,
  'staff cannot upload receipts');
select is((select count(*)::int from storage.objects where bucket_id = 'receipts'), 0, 'staff see no receipts');
select pg_temp.as_user('00000000-0000-0000-0000-00000000040e');
select is((select count(*)::int from storage.objects where bucket_id = 'receipts'), 0, 'another salon sees no receipts');
select pg_temp.as_user('00000000-0000-0000-0000-00000000040a');
select is((select count(*)::int from storage.objects where bucket_id = 'receipts'), 2, 'the owner sees both');

-- ── Attaching ────────────────────────────────────────────────────────────────────────────
select pg_temp.as_user('00000000-0000-0000-0000-00000000040c');
select throws_ok(format($$ select attach_receipt('expense', '%s', '%s/expenses/two.jpg') $$,
  current_setting('t.exp'), current_setting('t.b')), '42501', null, 'a cashier cannot attach to the owner''s expense');
select pg_temp.as_user('00000000-0000-0000-0000-00000000040a');
select throws_ok(format($$ select attach_receipt('expense', '%s', '%s/expenses/missing.jpg') $$,
  current_setting('t.exp'), current_setting('t.b')), '22023', 'receipt_missing', 'the file must exist');
select lives_ok(format($$ select attach_receipt('expense', '%s', '%s/expenses/one.jpg') $$,
  current_setting('t.exp'), current_setting('t.b')), 'the owner attaches the photo');
select is((select receipt_path from expenses where id = current_setting('t.exp')::uuid),
  current_setting('t.b') || '/expenses/one.jpg', 'the expense keeps the path');
select throws_ok(format($$ select attach_receipt('expense', '%s', '%s/expenses/two.jpg') $$,
  current_setting('t.exp'), current_setting('t.b')), '22023', 'receipt_exists', 'a photo is attached once');

-- ── Photos are never changed or removed ──────────────────────────────────────────────────
select throws_ok($$ delete from storage.objects where bucket_id = 'receipts' $$, null, null, 'photos cannot be deleted');
update storage.objects set name = name || '.old' where bucket_id = 'receipts';
select is((select count(*)::int from storage.objects where bucket_id = 'receipts' and name not like '%.old'), 2,
  'renaming changes nothing (no one may update a photo)');
select pg_temp.as_admin();
select is((select count(*)::int from audit_log where business_id = current_setting('t.b')::uuid and entity_type = 'expense'
  and action = 'attach'), 1,
  'attaching is in the history');
select ok((select not public from storage.buckets where id = 'receipts'), 'the bucket is private');

select * from finish();
rollback;
