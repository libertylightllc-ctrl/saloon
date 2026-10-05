-- Which privileged functions a signed-in person may call (security review, 2026-10-04). SECURITY DEFINER functions
-- skip row-level security, so each one callable from the app checks the caller's salon and role itself (reviewed);
-- internal helpers are not callable at all (migration 33). A new privileged function fails this test until it is
-- either added to the list below after a review of its checks, or closed to the app's sign-in roles.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

create temp table reviewed (name text primary key) on commit drop;
insert into reviewed values
    ('account_totals'),
    ('adjust_stock'),
    ('admin_activate'),
    ('admin_end_plan'),
    ('admin_salons'),
    ('admin_set_payment_details'),
    ('approve_cash_closing'),
    ('approve_payroll'),
    ('attach_document_evidence'),
    ('attach_receipt'),
    ('attach_wps_evidence'),
    ('attendance_day'),
    ('available_slots'),
    ('can_use_branch'),
    ('cancel_appointment'),
    ('cash_breakdown'),
    ('check_in'),
    ('check_pin'),
    ('clock'),
    ('close_period'),
    ('closing_history'),
    ('closing_preview'),
    ('compliance_status'),
    ('create_appointment'),
    ('create_business'),
    ('create_sale'),
    ('current_member_id'),
    ('dashboard_today'),
    ('dismiss_refund_request'),
    ('expected_cash'),
    ('fmt_money'),
    ('generate_payroll'),
    ('has_pin'),
    ('has_role'),
    ('inventory_levels'),
    ('is_member'),
    ('is_platform_admin'),
    ('log_access'),
    ('mark_no_show'),
    ('mark_notifications_read'),
    ('my_branch_ids'),
    ('my_business_ids'),
    ('owner_control'),
    ('pay_payroll_line'),
    ('pay_supplier'),
    ('pay_tips'),
    ('period_list'),
    ('plan_status'),
    ('post_purchase_bill'),
    ('record_adjustment'),
    ('record_expense'),
    ('record_stock_count'),
    ('refund_sale'),
    ('register_push_token'),
    ('remove_document_slot'),
    ('reopen_period'),
    ('report_closing'),
    ('report_customers'),
    ('report_monthly'),
    ('report_shortages'),
    ('report_staff'),
    ('report_stock'),
    ('report_vat'),
    ('request_plan'),
    ('request_refund'),
    ('require_member'),
    ('restore_document_slot'),
    ('return_cash_closing'),
    ('reverse_adjustment'),
    ('reverse_expense'),
    ('reverse_purchase_bill'),
    ('save_document'),
    ('save_employee'),
    ('save_expense_category'),
    ('save_item'),
    ('save_service'),
    ('save_supplier'),
    ('set_branch_mode'),
    ('set_my_pin'),
    ('set_opening_cash'),
    ('set_opening_stock'),
    ('set_roster'),
    ('sign_hygiene_log'),
    ('staff_directory'),
    ('start_service'),
    ('submit_cash_count'),
    ('supplier_balances'),
    ('tips_owed'),
    ('undo_no_show'),
    ('unregister_push_token'),
    ('update_branch'),
    ('update_document'),
    ('wps_status');

select is(
  array(select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef and has_function_privilege('authenticated', p.oid, 'EXECUTE')
          and p.proname not in (select name from reviewed) order by 1),
  array[]::text[],
  'every privileged function a signed-in person can call has been reviewed');

select is(
  array(select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'EXECUTE') order by 1),
  array[]::text[],
  'signed-out visitors can call none of them');

select is(
  array(select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proconfig is null and p.prolang <> (select oid from pg_language where lanname = 'c')
        order by 1),
  array[]::text[],
  'every function has a fixed search_path');

select * from finish();
rollback;
