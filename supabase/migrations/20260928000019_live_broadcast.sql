-- Live updates by Broadcast from Database instead of one Postgres Changes subscription per table per phone.
-- With ~35 postgres_changes bindings per phone the realtime server intermittently failed to deliver a phone's
-- own member change (a disabled login stayed signed in); with M1's ~9 it never did (flow 9, 20/20 vs 3–6 of 20
-- failing). Now each changed row announces only "table X changed" on a private topic, and a phone listens on 3–4
-- topics: branch:<id>, business:<id>, member:<member id>, and owners:<business id> (owner and accountant only, for
-- payroll and compliance). No row data travels; the app re-reads what it may see.

create function public.broadcast_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  j jsonb;
  v_topic text;
begin
  if tg_op = 'DELETE' then j := to_jsonb(old); else j := to_jsonb(new); end if;
  v_topic := case tg_argv[0]
    when 'branch' then 'branch:' || (j ->> 'branch_id')
    when 'business' then 'business:' || (j ->> 'business_id')
    when 'owners' then 'owners:' || (j ->> 'business_id')
    when 'member' then 'member:' || (j ->> 'member_id') end;
  if v_topic is not null then
    perform realtime.send(jsonb_build_object('table', tg_table_name, 'op', tg_op), 'change', v_topic, true);
  end if;
  return null;
end;
$$;
revoke execute on function public.broadcast_change() from public, anon, authenticated;

do $$
declare
  t record;
begin
  for t in select * from (values
    ('appointments', 'branch'), ('sales', 'branch'), ('refunds', 'branch'), ('stock_levels', 'branch'),
    ('stock_counts', 'branch'), ('expenses', 'branch'), ('supplier_payments', 'branch'), ('cash_closings', 'branch'),
    ('tip_payouts', 'branch'), ('attendance', 'branch'), ('hygiene_logs', 'branch'), ('refund_requests', 'branch'),
    ('purchase_bills', 'business'), ('inventory_items', 'business'), ('services', 'business'),
    ('service_categories', 'business'), ('customers', 'business'), ('members', 'business'), ('employees', 'business'),
    ('suppliers', 'business'), ('expense_categories', 'business'), ('rosters', 'business'),
    ('payroll_runs', 'owners'), ('payroll_lines', 'owners'), ('payroll_adjustments', 'owners'),
    ('compliance_documents', 'owners'), ('notifications', 'member')) v(tbl, scope)
  loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row
                    execute function public.broadcast_change(%L)', t.tbl || '_broadcast', t.tbl, t.scope);
  end loop;
end $$;

-- Who may listen to which topic (private channels are authorised by these policies on realtime.messages).
create policy "salon people receive their live changes" on realtime.messages for select to authenticated
using (
  realtime.messages.extension = 'broadcast' and (
    (split_part(realtime.topic(), ':', 1) = 'branch'
       and public.can_use_branch(split_part(realtime.topic(), ':', 2)::uuid))
    or (split_part(realtime.topic(), ':', 1) = 'business'
       and public.is_member(split_part(realtime.topic(), ':', 2)::uuid))
    or (split_part(realtime.topic(), ':', 1) = 'owners'
       and public.has_role(split_part(realtime.topic(), ':', 2)::uuid, array['owner', 'accountant']::public.member_role[]))
    or (split_part(realtime.topic(), ':', 1) = 'member'
       and exists (select 1 from public.members m
                   where m.id = split_part(realtime.topic(), ':', 2)::uuid and m.user_id = auth.uid()))
  )
);
