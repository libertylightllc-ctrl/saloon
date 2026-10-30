-- Owner's fix list round 2, A3: one free period everywhere. Since migration 66 (25 Oct) a new salon's free period is
-- "Free days for a new salon" (start_free_period, labelled e.g. "30-day free period"), and the salons that had started
-- the old 7-day trial were given the same length then (subscriptions.free_until). Their plan history still said
-- "7-day free trial" with the old end date, so Console → Plans and Console → Salons showed different dates. Those
-- records now carry the salon's free date and its real length; the old values go to the console's change log first.

-- 1. The records to correct: an old trial label on a salon still on its free period, whose date differs.
create temporary table free_period_fix as
select e.id, e.business_id, e.paid_until as old_until, e.note as old_note, s.free_until as new_until,
       (s.free_until - (b.created_at at time zone coalesce(b.timezone, 'Asia/Dubai'))::date) || '-day free period' as new_note
from plan_events e
join subscriptions s on s.business_id = e.business_id
join businesses b on b.id = e.business_id
where e.kind = 'trial'
  and e.note ~ '^[0-9]+-day free trial$'
  and s.access_type = 'trial'
  and s.free_until > (b.created_at at time zone coalesce(b.timezone, 'Asia/Dubai'))::date;

-- 2. Before and after in the change log (Console → Changes), one row per record.
insert into platform_audit (actor, action, business_id, subject, before, after)
select null, 'free_period:record', f.business_id, f.id::text,
       jsonb_build_object('note', f.old_note, 'until', f.old_until),
       jsonb_build_object('note', f.new_note, 'until', f.new_until)
from free_period_fix f;

-- 3. The records themselves.
update plan_events e set paid_until = f.new_until, note = f.new_note
from free_period_fix f
where e.id = f.id;

drop table free_period_fix;

-- 4. The 7-day trial's function (migration 47) is no longer called by anything (sign-up uses start_free_period); it
--    read the retired trial_days, so it goes, and nothing can start a 7-day trial again.
drop function if exists public.start_trial(uuid, uuid);
