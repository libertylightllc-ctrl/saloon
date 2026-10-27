-- Cash cannot leave a drawer that does not hold it (owner's fix list #9, 27 Oct 2026). Demo Shop's Home showed expected
-- cash of -AED 396.92 with no sales that day: since its last close (30 Sep) more went out "in cash" than came in
-- (AED 500 electricity, supplier bills and tips paid from a drawer holding about AED 60), and the cash the owner put in
-- from their own pocket was never recorded, so the drawer's running total went below zero.
--
-- 1. post_journal refuses an entry that takes more cash out than the branch's drawer holds: an expense, a bill
--    payment, a refund or deposit refund, a tip payout, pay or an advance. The error carries what the drawer holds
--    ("not_enough_cash: 6000"). The cash close is not checked: it only takes out what was counted.
-- 2. add_drawer_cash records cash put into the drawer, any number of times: the owner's own money (owner equity) or
--    cash drawn from the bank. The one-off opening cash (set_opening_cash) stays as it is.

-- What a branch's drawer holds now: every cash movement recorded for it (the same sum as expected_cash, without its
-- caller check; internal).
create function public.drawer_cash(p_branch uuid) returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce(sum(l.debit_minor - l.credit_minor), 0)::bigint
  from journal_lines l
  join journal_entries e on e.id = l.entry_id
  where e.branch_id = p_branch
    and l.account_id = public.acct(public.branch_business(p_branch), 'cash')
$$;
revoke execute on function public.drawer_cash(uuid) from public, anon, authenticated;

-- p_lines: [{"account":"cash","debit":100}, {"account":"service_revenue","credit":100}]
-- Zero amounts are skipped; an entry with no non-zero lines is not created.
create or replace function public.post_journal(
  p_business uuid, p_branch uuid, p_date date, p_source_type text, p_source_id uuid,
  p_memo text, p_actor uuid, p_lines jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_entry uuid;
  l jsonb;
  v_debit bigint;
  v_credit bigint;
  v_cash_out bigint;
  v_drawer bigint;
begin
  if not exists (
    select 1 from jsonb_array_elements(p_lines) x
    where coalesce((x ->> 'debit')::bigint, 0) > 0 or coalesce((x ->> 'credit')::bigint, 0) > 0
  ) then
    return null;
  end if;
  -- Cash this entry takes out of the drawer. Two payments at the same moment wait here for each other, so the second
  -- sees the first.
  select coalesce(sum(coalesce((x ->> 'credit')::bigint, 0) - coalesce((x ->> 'debit')::bigint, 0)), 0)
    into v_cash_out
    from jsonb_array_elements(p_lines) x where x ->> 'account' = 'cash';
  if v_cash_out > 0 and p_branch is not null and p_source_type <> 'cash_close' then
    perform pg_advisory_xact_lock(hashtext('drawer:' || p_branch::text));
    v_drawer := public.drawer_cash(p_branch);
    if v_drawer < v_cash_out then
      raise exception 'not_enough_cash: %', greatest(v_drawer, 0) using errcode = '22023';
    end if;
  end if;
  insert into journal_entries (business_id, branch_id, business_date, source_type, source_id, memo, created_by)
  values (p_business, p_branch, p_date, p_source_type, p_source_id, p_memo, p_actor)
  returning id into v_entry;
  for l in select * from jsonb_array_elements(p_lines) loop
    v_debit := coalesce((l ->> 'debit')::bigint, 0);
    v_credit := coalesce((l ->> 'credit')::bigint, 0);
    if v_debit < 0 or v_credit < 0 then
      raise exception 'negative_journal_amount';
    end if;
    if v_debit > 0 or v_credit > 0 then
      insert into journal_lines (entry_id, account_id, debit_minor, credit_minor)
      values (v_entry, public.acct(p_business, l ->> 'account'), v_debit, v_credit);
    end if;
  end loop;
  return v_entry;
end;
$$;

-- Cash put into the drawer today: from the owner's own pocket or drawn from the bank. Owner or cashier of the branch;
-- refused once today's count is submitted (the cash-day lock on journal_lines). p: {branch_id, amount_minor,
-- from: 'owner' | 'bank', note?}.
create function public.add_drawer_cash(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_branch uuid := (p ->> 'branch_id')::uuid;
  m members := public.require_member(v_branch, array['owner', 'cashier']::member_role[]);
  v_amount bigint := (p ->> 'amount_minor')::bigint;
  v_from text := coalesce(p ->> 'from', 'owner');
  v_note text := nullif(btrim(coalesce(p ->> 'note', '')), '');
  v_id uuid := gen_random_uuid();
begin
  if v_amount is null or v_amount <= 0 or v_from not in ('owner', 'bank') then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  perform public.post_journal(m.business_id, v_branch, public.branch_today(v_branch), 'cash_added', v_id,
    'Cash added · ' || case v_from when 'bank' then 'from the bank' else 'from the owner' end
      || coalesce(' · ' || v_note, ''),
    m.id,
    jsonb_build_array(jsonb_build_object('account', 'cash', 'debit', v_amount),
                      jsonb_build_object('account', case v_from when 'bank' then 'bank' else 'owner_equity' end,
                                         'credit', v_amount)));
  perform public.write_audit(m.business_id, v_branch, m.id, 'create', 'cash_added', v_id,
    'Added ' || to_char(v_amount / 100.0, 'FM999999990.00') || ' cash to the drawer '
      || case v_from when 'bank' then 'from the bank' else 'from the owner' end,
    null, jsonb_build_object('amount_minor', v_amount, 'from', v_from, 'note', v_note));
  return jsonb_build_object('id', v_id, 'expected_cash_minor', public.drawer_cash(v_branch));
end;
$$;
revoke execute on function public.add_drawer_cash(jsonb) from public, anon;
grant execute on function public.add_drawer_cash(jsonb) to authenticated;
