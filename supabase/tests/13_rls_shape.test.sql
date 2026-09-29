-- Row security is checked once per query: no table policy calls the per-row helpers (has_role, is_member,
-- can_use_branch); they use my_business_ids() / my_branch_ids() sets instead (migration 22).
begin;
create extension if not exists pgtap with schema extensions;
-- Paid plans are tested in 14_plans; here every salon may work.
select set_config('salon.plan_check', 'off', false);
select plan(2);

select is(
  (select count(*)::int from pg_policy pol join pg_class c on c.oid = pol.polrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and (coalesce(pg_get_expr(pol.polqual, pol.polrelid), '') ~ '(has_role|is_member|can_use_branch)\('
       or coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), '') ~ '(has_role|is_member|can_use_branch)\(')),
  0, 'no table policy checks access row by row');

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'every table has row security on');

select * from finish();
rollback;
