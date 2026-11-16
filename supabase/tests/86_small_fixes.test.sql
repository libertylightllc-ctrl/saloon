-- Owner's fix list, 16 Nov 2026 (migration 108): a licence due today or tomorrow says so ("Document due today",
-- "Document due tomorrow"), and alerts already sent say the same; the manager's Home has the compliance line, as the
-- owner's; the front desk's Home gets no week of revenue (today only); the accountant's Home has the expected cash.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000086' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'small-fixes-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(),
       '{}', '{}'
from unnest(array['a0', 'b1', 'b2', 'b4']) n;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000086' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"Small Fixes Salon","owner_name":"Owner","mode":"ladies",
  "vat_mode":"off","opening_cash_minor":20000}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);

-- Manager (b1) and front desk (b2) in the branch; the accountant (b4).
select pg_temp.as_admin();
create function pg_temp.member(p_user text, p_role text, p_name text) returns void language plpgsql as $$
declare v uuid;
begin
  insert into members (business_id, user_id, role, display_name, username)
  values (current_setting('t.b')::uuid, ('00000000-0000-0000-0000-0000000086' || p_user)::uuid, p_role::member_role,
          p_name, lower(p_name) || 'eightysix') returning id into v;
  if p_role <> 'accountant' then
    insert into member_branches (member_id, branch_id) values (v, current_setting('t.br')::uuid);
    insert into employees (business_id, branch_id, member_id, full_name, role_title)
    values (current_setting('t.b')::uuid, current_setting('t.br')::uuid, v, p_name, p_role);
  end if;
end $$;
select pg_temp.member('b1', 'manager', 'Mona'), pg_temp.member('b2', 'cashier', 'Dina'),
       pg_temp.member('b4', 'accountant', 'Books');

-- A trade licence expiring today and a health card tomorrow.
select set_config('t.today', branch_today(current_setting('t.br')::uuid)::text, false);
insert into compliance_documents (business_id, branch_id, doc_type, holder_type, expires_on, reminder_days)
values (current_setting('t.b')::uuid, current_setting('t.br')::uuid, 'trade_licence', 'company',
        current_setting('t.today')::date, 30),
       (current_setting('t.b')::uuid, current_setting('t.br')::uuid, 'health_card', 'premises',
        current_setting('t.today')::date + 1, 1);
select notify_documents_due(current_setting('t.today')::date);
select is((select array_agg(distinct title order by title) from notifications
           where business_id = current_setting('t.b')::uuid and type = 'document_due'),
  array['Document due today', 'Document due tomorrow'], 'due today and due tomorrow, not "in 0 days" or "in 1 days"');

-- Alerts sent before the change get the same words (the update in migration 108, run again here on old titles).
update notifications set title = case data ->> 'days' when '0' then 'Document expires today' else 'Document due in 1 days' end
where business_id = current_setting('t.b')::uuid and type = 'document_due';
update public.notifications
set title = case (data ->> 'days')::int when 0 then 'Document due today' else 'Document due tomorrow' end
where type = 'document_due' and data ->> 'days' in ('0', '1') and business_id = current_setting('t.b')::uuid;
select is((select array_agg(distinct title order by title) from notifications
           where business_id = current_setting('t.b')::uuid and type = 'document_due'),
  array['Document due today', 'Document due tomorrow'], 'alerts already sent read the same');

-- Home: compliance for the owner and the manager.
select pg_temp.as_user('a0');
select set_config('t.owner_attention', (dashboard_today(current_setting('t.br')::uuid) -> 'compliance' ->> 'attention'), false);
select ok(current_setting('t.owner_attention')::int >= 2, 'the owner''s Home counts the compliance records');
select pg_temp.as_user('b1');
select is(dashboard_today(current_setting('t.br')::uuid) -> 'compliance' ->> 'attention',
  current_setting('t.owner_attention'), 'the manager''s Home has the same compliance line');
select isnt(dashboard_today(current_setting('t.br')::uuid) -> 'revenue_7d', 'null'::jsonb, 'the manager still has the week');

-- The front desk: no week of revenue, no compliance line.
select pg_temp.as_user('b2');
select is(dashboard_today(current_setting('t.br')::uuid) -> 'revenue_7d', 'null'::jsonb, 'the front desk''s Home has no week of revenue');
select is(dashboard_today(current_setting('t.br')::uuid) -> 'compliance', 'null'::jsonb, 'nor the compliance line');
select ok(dashboard_today(current_setting('t.br')::uuid) ? 'payment_mix', 'but keeps today''s payment mix');

-- The accountant: the expected cash, blind count or not.
select pg_temp.as_user('b4');
select is((dashboard_today(current_setting('t.br')::uuid) ->> 'expected_cash')::bigint, 20000::bigint,
  'the accountant''s Home has the expected cash');

select * from finish();
rollback;
