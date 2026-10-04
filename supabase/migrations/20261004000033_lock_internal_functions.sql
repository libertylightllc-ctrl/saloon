-- Security review (owner's platform audit, 2026-10-04). Internal helpers were callable by any signed-in user over the
-- API, and they do no checks of their own because only checked functions were meant to call them: anyone with a
-- free account could post journal entries or audit lines into another salon (post_journal, write_audit,
-- settle_deposit), add starter rows to it (seed_*), or read another salon's appointment or settings
-- (appointment_for_update, branch_setting…). Functions that run as the database owner still call them as before;
-- only direct calls from the app's sign-in roles are refused. register_staff_member already refused anyone but the
-- server; it is closed too. supabase/tests/25_function_access.test.sql lists every function a signed-in person may
-- call, so a new one cannot slip in unreviewed.

revoke execute on function
  public.acct(uuid, text),
  public.appointment_for_update(uuid),
  public.branch_business(uuid),
  public.branch_setting(uuid, text, jsonb),
  public.branch_today(uuid),
  public.branch_tz(uuid),
  public.business_today(uuid),
  public.compliance_readiness(uuid),
  public.plan_active(uuid),
  public.post_journal(uuid, uuid, date, text, uuid, text, uuid, jsonb),
  public.seed_expense_categories(uuid),
  public.seed_mode_catalogue(uuid, uuid, public.salon_mode),
  public.seed_system_accounts(uuid),
  public.settle_deposit(public.appointments, uuid, text),
  public.unique_business_code(text),
  public.write_audit(uuid, uuid, uuid, text, text, uuid, text, jsonb, jsonb),
  public.register_staff_member(jsonb),
  -- Trigger functions (they cannot be called directly anyway).
  public.check_cash_day_open(),
  public.on_booking_created(),
  public.on_close_submitted(),
  public.on_payroll_generated(),
  public.on_refund_done(),
  public.on_refund_requested(),
  public.on_stock_level_changed()
from public, anon, authenticated;

grant execute on function public.register_staff_member(jsonb) to service_role;

-- A fixed search_path on every function (the Security Advisor's "function_search_path_mutable").
alter function public.check_journal_balanced() set search_path = public;
alter function public.check_period_open() set search_path = public;
alter function public.allocate_minor(bigint, bigint[]) set search_path = public;
alter function public.method_account(public.payment_method) set search_path = public;
alter function public.paid_from_account(public.payment_method) set search_path = public;
alter function public.shift_minutes(time, time) set search_path = public;
alter function public.hygiene_items() set search_path = public;
alter function public.month_bounds(text) set search_path = public;
