-- Part B (owner's app check, 9 Nov 2026; plan in docs/PART-B-PLAN.md): a fifth login type, Manager.
-- On its own: Postgres has to save a new enum value before any function or row can use it (migration 87 does).
-- Inside the database the other types keep their names (owner's answer 1, 10 Nov): cashier is shown as
-- "Front desk", staff as "Stylist / therapist". Nobody becomes a manager by this change.

alter type public.member_role add value if not exists 'manager' after 'owner';
