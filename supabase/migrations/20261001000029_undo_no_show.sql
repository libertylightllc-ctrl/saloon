-- Undo a no-show marked by mistake (owner, 2026-10-01). On the same day only: the visit goes back to waiting (a walk-in
-- or a checked-in booking) or booked; the customer's no-show count drops (and the repeat no-show flag goes when it
-- falls under two); a deposit that was kept goes back to being held — by a reversing entry, never by deleting one.
create function public.undo_no_show(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  a appointments := public.appointment_for_update(p_id);
  m members := public.require_member(a.branch_id, array['owner', 'cashier']::member_role[]);
  v_status appointment_status;
begin
  if a.status <> 'no_show' or a.business_date <> public.branch_today(a.branch_id) then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  v_status := case when a.source = 'walk_in' or a.checked_in_at is not null then 'waiting' else 'booked' end;
  update appointments set status = v_status, updated_at = now() where id = p_id;
  if a.customer_id is not null then
    update customers set
      no_show_count = greatest(no_show_count - 1, 0),
      risk_flags = case when greatest(no_show_count - 1, 0) < 2 then array_remove(risk_flags, 'no_show') else risk_flags end
    where id = a.customer_id;
  end if;
  if a.deposit_status = 'forfeited' and a.deposit_minor > 0 then
    perform public.post_journal(a.business_id, a.branch_id, public.branch_today(a.branch_id), 'deposit_forfeit_reversal',
      a.id, 'Deposit kept — no-show undone', m.id,
      jsonb_build_array(jsonb_build_object('account', 'other_income', 'debit', a.deposit_minor),
                        jsonb_build_object('account', 'deposits_held', 'credit', a.deposit_minor)));
    update appointments set deposit_status = 'held' where id = p_id;
  end if;
  perform public.write_audit(a.business_id, a.branch_id, m.id, 'update', 'appointment', p_id,
    'Undid no-show for ' || coalesce(a.customer_name, 'guest'));
end;
$$;
revoke execute on function public.undo_no_show(uuid) from public, anon;
grant execute on function public.undo_no_show(uuid) to authenticated;
