-- A part refund leaves the stylist's tip alone (owner's app check A2, 9 Nov 2026): a QAR 40 service with a QAR 5 tip
-- and a QAR 10 refund takes the QAR 10 from the service, so the stylist keeps the whole tip and earns commission on
-- QAR 30. The tip is refunded only when the person refunding asks for it. A refund made in a later month comes off that
-- month's commission, never a month already worked out.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(15);
-- Internal helpers the sign-in roles cannot call, allowed inside this rolled-back test only.
grant execute on function public.branch_today(uuid), public.commission_for(uuid, text) to authenticated;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000063' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'keep-tip-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1']) n;

create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', ('00000000-0000-0000-0000-0000000063' || p)::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  perform set_config('role', 'service_role', true);
end $$;

select pg_temp.as_user('a0');
select set_config('t.b', (create_business('{"business_name":"Keep Tip Salon","owner_name":"Owner","mode":"ladies",
  "opening_cash_minor":100000}') ->> 'business_id'), false);
select set_config('t.br', (select id::text from branches where business_id = current_setting('t.b')::uuid), false);
select pg_temp.as_service();
select set_config('t.emp', (register_staff_member(jsonb_build_object('business_id', current_setting('t.b'),
  'branch_id', current_setting('t.br'), 'user_id', '00000000-0000-0000-0000-0000000063b1', 'username', 'keeptip',
  'display_name', 'Keep Tip Stylist', 'role', 'staff', 'commission_bps', 3500)) ->> 'employee_id'), false);
select pg_temp.as_user('a0');
select set_config('t.month', to_char(branch_today(current_setting('t.br')::uuid), 'YYYY-MM'), false);

create function pg_temp.sale(p_tip bigint) returns uuid language sql as $$
  select (create_sale(jsonb_build_object('branch_id', current_setting('t.br'), 'employee_id', current_setting('t.emp'),
    'tip_minor', p_tip, 'tip_employee_id', current_setting('t.emp'),
    'lines', jsonb_build_array(jsonb_build_object('kind', 'custom', 'name', 'Blow dry', 'unit_price_minor', 4000,
                                                  'employee_id', current_setting('t.emp'))),
    'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount_minor', 4000 + p_tip)))) ->> 'sale_id')::uuid
$$;
create function pg_temp.refund(p_sale text, p_amount bigint, p_tip boolean default false) returns jsonb language sql as $$
  select refund_sale(jsonb_build_object('sale_id', p_sale, 'amount_minor', p_amount, 'method', 'cash',
    'reason', 'Part redone', 'refund_tip', p_tip))
$$;
create function pg_temp.owed() returns bigint language sql as $$
  select owed_minor from tips_owed(current_setting('t.br')::uuid) where employee_id = current_setting('t.emp')::uuid
$$;

-- 1–6. QAR 40 + QAR 5 tip, QAR 10 refunded.
select set_config('t.s1', pg_temp.sale(500)::text, false);
select pg_temp.refund(current_setting('t.s1'), 1000);
select is((select tip_minor from refunds where sale_id = current_setting('t.s1')::uuid), 0::bigint,
  'the QAR 10 refund takes nothing from the tip');
select is((select coalesce(sum(l.debit_minor), 0) from journal_lines l join journal_entries e on e.id = l.entry_id
           join accounts a on a.id = l.account_id
           where e.source_type = 'refund' and a.system_key = 'tips_payable'
             and e.source_id = (select id from refunds where sale_id = current_setting('t.s1')::uuid)), 0::numeric,
  'and the books take nothing from tips owed');
select is(pg_temp.owed(), 500::bigint, 'the stylist is still owed the whole QAR 5 tip');
select is(commission_for(current_setting('t.emp')::uuid, current_setting('t.month')), 1050::bigint,
  'commission is 35% of QAR 30');
select results_eq(format($$ select revenue_minor, tips_minor from report_staff(%L, %L) where employee_id = %L $$,
  current_setting('t.br'), current_setting('t.month'), current_setting('t.emp')),
  $$ values (3000::bigint, 500::bigint) $$, 'Staff sales: revenue after the refund, the tip kept');
select is((select status::text from sales where id = current_setting('t.s1')::uuid), 'partially_refunded', 'part refunded');

-- 7–9. A sale from last month refunded this month: last month keeps its commission, this month gives it back.
select set_config('t.s3', pg_temp.sale(0)::text, false);
reset role;
select set_config('t.last', to_char(branch_today(current_setting('t.br')::uuid) - interval '1 month', 'YYYY-MM'), false);
update sales set business_date = business_date - interval '1 month' where id = current_setting('t.s3')::uuid;
select pg_temp.as_user('a0');
select is(commission_for(current_setting('t.emp')::uuid, current_setting('t.last')), 1400::bigint,
  'last month: 35% of QAR 40');
select pg_temp.refund(current_setting('t.s3'), 1000);
select is(commission_for(current_setting('t.emp')::uuid, current_setting('t.last')), 1400::bigint,
  'a refund this month does not change last month');
select is(commission_for(current_setting('t.emp')::uuid, current_setting('t.month')), 700::bigint,
  'it comes off this month: QAR 10.50 less QAR 3.50');

-- 10. Home's "Commission this month" for the stylist is the same figure.
select pg_temp.as_user('b1');
select is((dashboard_today(current_setting('t.br')::uuid) -> 'me' ->> 'commission_month_minor')::bigint, 700::bigint,
  'the stylist''s Home shows the same commission');

select pg_temp.as_user('a0');

-- 11–13. More than the service left needs "Also refund the tip"; refunding all the service leaves the sale refunded.
select throws_ok($$ select pg_temp.refund(current_setting('t.s1'), 3500) $$, '22023', 'tip_not_refunded',
  'refunding past the service without asking for the tip is refused');
select pg_temp.refund(current_setting('t.s1'), 3000);
select is((select status::text from sales where id = current_setting('t.s1')::uuid), 'refunded',
  'with only the kept tip left the sale counts as refunded');
select is(pg_temp.owed(), 500::bigint, 'the stylist still keeps the tip');

-- 14–15. A full refund with the tip: the tip comes back too.
select set_config('t.s2', pg_temp.sale(500)::text, false);
select pg_temp.refund(current_setting('t.s2'), 4500, true);
select is((select tip_minor from refunds where sale_id = current_setting('t.s2')::uuid), 500::bigint,
  'asked for, the tip is refunded too');
select is(pg_temp.owed(), 500::bigint, 'so only the first sale''s tip is owed');

select * from finish();
rollback;
