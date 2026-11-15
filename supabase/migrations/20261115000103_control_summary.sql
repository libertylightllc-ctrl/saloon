-- Owner's app check E8 (d): the control summary said "Last close Sun 25 Oct: balanced" while 26 Oct was not closed.
-- It now also gives the days before today that still need a cash close (cash moved that day, and no count was sent
-- or approved; a count sent back is a draft again), from the last 30 days as Close history lists them, newest
-- first. Managers read it for the branches they work in (Reports is theirs too); the compliance count goes to those
-- who look after compliance records (owner and manager). Same facts as before otherwise (migration 84).
create or replace function public.owner_control(p_branch uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner', 'manager', 'accountant']::member_role[]);
  c cash_closings;
  v_today date := public.branch_today(p_branch);
  v_cash uuid := public.acct(m.business_id, 'cash');
begin
  select * into c from cash_closings where branch_id = p_branch and status <> 'draft' order by business_date desc limit 1;
  return jsonb_build_object(
    'last_close_date', c.business_date,
    'last_close_variance_minor', c.variance_minor,
    'unclosed_days', coalesce((
      select jsonb_agg(d.day order by d.day desc)
      from (select distinct e.business_date as day from journal_entries e
            join journal_lines l on l.entry_id = e.id and l.account_id = v_cash
            where e.branch_id = p_branch and e.business_date > v_today - 30 and e.business_date < v_today) d
      where not exists (select 1 from cash_closings cc where cc.branch_id = p_branch and cc.business_date = d.day
                          and cc.status in ('pending_approval', 'approved'))), '[]'::jsonb),
    'supplier_owed_minor', coalesce((select sum(total_minor - paid_minor) from purchase_bills
                                     where business_id = m.business_id and status in ('unpaid', 'partial')), 0),
    -- Low, and out of stock after having had stock here, as Home counts them (owner's app check A6).
    'low_items', (select count(*) from inventory_items i left join stock_levels s on s.item_id = i.id and s.branch_id = p_branch
                  where i.business_id = m.business_id
                    and case public.stock_state(i.kind, i.active, coalesce(s.qty, 0), i.reorder_level)
                          when 'low' then true when 'out' then public.had_stock(i.id, p_branch) else false end),
    'compliance_issues', case when m.role in ('owner', 'manager')
      then (select count(*) from public.compliance_status(m.business_id) where status <> 'valid') end);
end;
$$;
