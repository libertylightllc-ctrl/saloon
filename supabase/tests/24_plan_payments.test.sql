-- How salons pay (owner, 2026-10-04): only the platform owner sets the payment details, everyone signed in reads them;
-- bad IBANs, SWIFT codes and links are refused; a plan request is queued for the platform owner's email, told once,
-- and goes back to the queue if the email could not be sent.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(12);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000024' || n)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'pay-' || n || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1']) n;
insert into platform_admins (user_id) values ('00000000-0000-0000-0000-0000000024a0');

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

-- A salon owner cannot set where to pay.
select pg_temp.as_user('00000000-0000-0000-0000-0000000024b1');
select set_config('t.b', (create_business('{"business_name":"Pay Salon","owner_name":"Owner","mode":"gents"}') ->> 'business_id'), false);
select throws_ok($$ select admin_set_payment_details('{"bank_iban":"AE070331234567890123456"}') $$, '42501', 'not_allowed',
  'a salon owner cannot set the payment details');

-- The platform owner can; spaces go, letters are capitalised; bad values are refused.
select pg_temp.as_user('00000000-0000-0000-0000-0000000024a0');
select throws_ok($$ select admin_set_payment_details('{"bank_iban":"12 34"}') $$, '22023', 'invalid_iban', 'a bad IBAN is refused');
select throws_ok($$ select admin_set_payment_details('{"bank_swift":"NBAD"}') $$, '22023', 'invalid_swift', 'a bad SWIFT code is refused');
select throws_ok($$ select admin_set_payment_details('{"pay_link_url":"http://pay.example"}') $$, '22023', 'invalid_link',
  'a link that is not https is refused');
select lives_ok($$ select admin_set_payment_details('{"bank_name":"Emirates NBD","bank_account_name":"Saloqo FZ-LLC",
  "bank_iban":"ae07 0331 2345 6789 0123 456","bank_swift":"ebilaead","pay_link_url":"https://buy.stripe.com/test_123",
  "pay_note":""}') $$, 'the platform owner saves bank details and a card link');

-- Everyone signed in reads them (to pay).
select pg_temp.as_user('00000000-0000-0000-0000-0000000024b1');
select is((select bank_iban || ' ' || bank_swift || ' ' || pay_link_url || ' ' || coalesce(pay_note, '∅') from platform_settings),
  'AE070331234567890123456 EBILAEAD https://buy.stripe.com/test_123 ∅', 'a salon owner reads them, tidied');

-- The owner asks for 3 months: the platform owner's email is queued.
select request_plan(current_setting('t.b')::uuid, 3, 'Paying by transfer today');
select pg_temp.as_service();
select results_eq($$ select salon, code, months, note, price_per_branch_minor, currency,
                           array(select e from unnest(admin_emails) e where e like '%@test.local')
                    from claim_plan_alerts() where code = (select code from businesses where id = current_setting('t.b')::uuid) $$,
  $$ values ('Pay Salon'::text, (select code from businesses where id = current_setting('t.b')::uuid), 3,
             'Paying by transfer today'::text, 9900::bigint, 'AED'::text, array['pay-a0@test.local']::text[]) $$,
  'the request is handed to plan-alert with the salon, the amount and whom to tell');
select is((select count(*)::int from claim_plan_alerts()), 0, 'and told only once');
select isnt((select alerted_at from plan_events where business_id = current_setting('t.b')::uuid and kind = 'request'), null,
  'marked as told');

-- An email that could not go out returns to the queue.
select unclaim_plan_alert((select id from plan_events where business_id = current_setting('t.b')::uuid and kind = 'request'));
select is((select count(*)::int from claim_plan_alerts()), 1, 'an email that failed is sent again later');

-- Salon logins cannot read the queue or claim alerts.
select pg_temp.as_user('00000000-0000-0000-0000-0000000024b1');
select throws_ok($$ select claim_plan_alerts() $$, '42501', null, 'a salon login cannot claim alerts');
select throws_ok($$ select dispatch_plan_alerts() $$, '42501', null, 'nor trigger the emails');

select * from finish();
rollback;
