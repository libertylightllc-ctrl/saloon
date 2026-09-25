-- M1+ · Owner's books (read-only): account totals for any period and how expected cash is made up.
-- Owner and accountant only (01-PRODUCT §2 "Accounting & reports"). Also removes privileges that
-- Supabase grants by default but this app never uses — TRUNCATE ignores row level security.

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;

-- Debits and credits per account for journal entries dated p_from..p_to (either may be null).
-- A trial balance is the whole history (p_from null); "this month" is one month.
create function public.account_totals(p_business uuid, p_from date default null, p_to date default null)
returns table (account_id uuid, code text, name text, type public.account_type, system_key text,
               debit_minor bigint, credit_minor bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_role(p_business, array['owner', 'accountant']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select a.id, a.code, a.name, a.type, a.system_key,
           coalesce(sum(l.debit_minor), 0)::bigint, coalesce(sum(l.credit_minor), 0)::bigint
    from accounts a
    left join (journal_lines l join journal_entries e on e.id = l.entry_id
               and (p_from is null or e.business_date >= p_from)
               and (p_to is null or e.business_date <= p_to)) on l.account_id = a.id
    where a.business_id = p_business
    group by a.id
    order by a.code;
end;
$$;

-- How a branch's expected cash for a business date is made up: the cash balance brought forward,
-- then the net cash of each kind of event that day. Opening + movements = expected cash.
create function public.cash_breakdown(p_branch uuid, p_date date default null)
returns table (kind text, entries int, amount_minor bigint)
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid := public.branch_business(p_branch);
  v_date date := coalesce(p_date, public.branch_today(p_branch));
  v_cash uuid;
begin
  if not public.can_use_branch(p_branch)
     or not public.has_role(v_business, array['owner', 'accountant']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  v_cash := public.acct(v_business, 'cash');
  return query
    select 'brought_forward'::text, count(distinct e.id)::int,
           coalesce(sum(l.debit_minor - l.credit_minor), 0)::bigint
    from journal_lines l join journal_entries e on e.id = l.entry_id
    where e.branch_id = p_branch and e.business_date < v_date and l.account_id = v_cash
    union all
    select e.source_type, count(distinct e.id)::int, sum(l.debit_minor - l.credit_minor)::bigint
    from journal_lines l join journal_entries e on e.id = l.entry_id
    where e.branch_id = p_branch and e.business_date = v_date and l.account_id = v_cash
    group by e.source_type;
end;
$$;

revoke execute on function public.account_totals(uuid, date, date), public.cash_breakdown(uuid, date) from public, anon;
grant execute on function public.account_totals(uuid, date, date), public.cash_breakdown(uuid, date) to authenticated;
