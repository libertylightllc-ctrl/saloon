-- Part C4 (owner's app check, 9 Nov 2026): "Payroll worked out · ready to check and approve" goes only to the people who
-- can approve payroll (the owner; approve_payroll refuses everyone else), and ends once the month is approved, paid or
-- worked out again (a new alert then replaces it). Alerts already sent end now when they no longer apply: sent to someone
-- who cannot approve, for a month already approved or paid, or replaced by a later working-out. Nothing is deleted: an
-- ended alert keeps its row and only stops showing.

create or replace function public.on_payroll_generated() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Approved, paid or worked out again: the earlier "ready to approve" alerts end.
  if tg_op = 'UPDATE' and (new.status <> 'generated' or new.generated_at is distinct from old.generated_at) then
    perform public.end_alerts('payroll_run', new.id, array['payroll_generated']);
  end if;
  if new.status = 'generated' and (tg_op = 'INSERT' or new.generated_at is distinct from old.generated_at) then
    perform public.notify(new.business_id, null, array['owner']::member_role[], 'payroll_generated',
      'Payroll worked out', 'Payroll ' || new.period || ' is ready to check and approve', 'payroll_run', new.id,
      jsonb_build_object('period', new.period), 'payroll:' || new.id || ':' || new.generated_at);
  end if;
  return new;
end;
$$;
revoke execute on function public.on_payroll_generated() from public, anon, authenticated;

drop trigger payroll_runs_notify on public.payroll_runs;
create trigger payroll_runs_notify after insert or update of generated_at, status on public.payroll_runs
  for each row execute function public.on_payroll_generated();

update public.notifications n
set expires_at = now()
where n.type = 'payroll_generated'
  and (n.expires_at is null or n.expires_at > now())
  and (not exists (select 1 from public.members m where m.id = n.member_id and m.role = 'owner')
       or exists (select 1 from public.payroll_runs r where r.id = n.entity_id and r.status <> 'generated')
       or exists (select 1 from public.notifications later
                  where later.member_id = n.member_id and later.type = n.type and later.entity_id = n.entity_id
                    and later.created_at > n.created_at));
