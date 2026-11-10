-- Part B, step 1 (brief B5): manager approval on the spot, and the Approvals list.
-- When the front desk or a stylist hits a limit, a manager of the branch or the owner picks their name and enters their
-- quick-switch PIN on the same device. approve_with_pin() checks the PIN and gives a one-time approval for that action,
-- amount and person, good for 5 minutes; the function that does the action uses it up (use_approval) and the record
-- keeps both names. Managers' and owners' own refunds, price changes and big discounts are listed too, with their
-- reason (log_approval). Five wrong PINs lock that PIN for 15 minutes (owner's answer 4, 10 Nov; was 5 minutes),
-- for quick-switch and approvals alike.

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  action text not null check (action in ('discount', 'price_change', 'refund', 'deposit_refund', 'petty_cash',
                                         'clock_other')),
  method text not null check (method in ('pin', 'reason')),
  amount bigint,          -- what was allowed: a discount in basis points, money in minor units
  limit_amount bigint,    -- the limit it went over, when there is one
  reason text,
  requested_by uuid references public.members(id) on delete set null,
  requested_name text not null,
  approved_by uuid references public.members(id) on delete set null,
  approved_name text not null,
  ref_type text,
  ref_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  used_at timestamptz
);
create index approvals_branch_idx on public.approvals (branch_id, created_at desc);
alter table public.approvals enable row level security;
-- Reports → Approvals: the owner, and managers for their branches.
create policy "owner and managers read approvals" on public.approvals for select to authenticated
  using (business_id in (select public.my_business_ids_can('viewApprovals'))
         and branch_id in (select public.my_branch_ids()));
revoke insert, update, delete, truncate, references, trigger on public.approvals from anon, authenticated;
revoke select on public.approvals from anon;

-- One PIN try: 'ok', 'wrong', 'locked' or 'none' (no PIN set). The fifth wrong try in a row locks the PIN for
-- 15 minutes. Callers must not raise after 'wrong', or the count would be rolled back.
create function public.pin_attempt(p_member uuid, p_pin text) returns text
language plpgsql security definer set search_path = public as $$
declare
  pin member_pins;
begin
  select * into pin from member_pins where member_id = p_member for update;
  if pin.member_id is null then
    return 'none';
  end if;
  if pin.locked_until > now() then
    return 'locked';
  end if;
  if pin.pin_hash = extensions.crypt(coalesce(p_pin, ''), pin.pin_hash) then
    update member_pins set failed_count = 0, locked_until = null where member_id = p_member;
    return 'ok';
  end if;
  update member_pins
    set failed_count = case when pin.failed_count + 1 >= 5 then 0 else pin.failed_count + 1 end,
        locked_until = case when pin.failed_count + 1 >= 5 then now() + interval '15 minutes' end
  where member_id = p_member;
  return case when pin.failed_count + 1 >= 5 then 'locked' else 'wrong' end;
end;
$$;
revoke execute on function public.pin_attempt(uuid, text) from public, anon, authenticated;

-- Quick-switch: the same check, with the 15-minute lock.
create or replace function public.check_pin(p_member uuid, p_pin text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  target members;
  v text;
begin
  select * into target from members where id = p_member and active;
  if target.id is null or not exists (select 1 from members where business_id = target.business_id
                                       and user_id = auth.uid() and active) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from member_pins where member_id = p_member) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from member_pins where member_id = p_member and locked_until > now()) then
    raise exception 'pin_locked' using errcode = '22023';
  end if;
  v := public.pin_attempt(p_member, p_pin);
  return v = 'ok';
end;
$$;

-- Who can approve in this branch: the owner and the branch's managers who have a PIN, not counting me.
create function public.approvers(p_branch uuid)
returns table (member_id uuid, name text, role public.member_role, locked boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_use_branch(p_branch) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
  select m.id, m.display_name, m.role, coalesce(p.locked_until > now(), false)
  from members m
  join branches b on b.business_id = m.business_id and b.id = p_branch
  join member_pins p on p.member_id = m.id
  where m.active and m.user_id <> auth.uid()
    and (m.role = 'owner'
         or (m.role = 'manager' and exists (select 1 from member_branches mb
                                            where mb.member_id = m.id and mb.branch_id = p_branch)))
  order by m.role, m.display_name;
end;
$$;

-- A manager or the owner approves with their PIN. Returns {ok, approval_id, approved_name} or {ok: false, error:
-- wrong_pin | pin_locked | no_pin, tries_left}.
create function public.approve_with_pin(p_branch uuid, p_approver uuid, p_pin text, p_action text,
                                        p_amount bigint default null, p_reason text default null,
                                        p_details jsonb default '{}')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me members;
  a members;
  v text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  select mem.* into me from members mem join branches b on b.business_id = mem.business_id
  where b.id = p_branch and mem.user_id = auth.uid() and mem.active;
  if me.id is null or not public.can_use_branch(p_branch) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_action not in ('discount', 'price_change', 'refund', 'deposit_refund', 'petty_cash', 'clock_other') then
    raise exception 'unknown_action' using errcode = '22023';
  end if;
  select * into a from members where id = p_approver and business_id = me.business_id and active;
  if a.id is null or a.id = me.id
     or not (a.role = 'owner'
             or (a.role = 'manager' and exists (select 1 from member_branches mb
                                                where mb.member_id = a.id and mb.branch_id = p_branch))) then
    raise exception 'not_an_approver' using errcode = '42501';
  end if;
  v := public.pin_attempt(a.id, p_pin);
  if v = 'none' then
    return jsonb_build_object('ok', false, 'error', 'no_pin');
  elsif v = 'locked' then
    perform public.write_audit(me.business_id, p_branch, me.id, 'deny', 'approval', a.id,
      'Manager approval: ' || a.display_name || '''s PIN is locked (asked by ' || me.display_name || ')');
    return jsonb_build_object('ok', false, 'error', 'pin_locked');
  elsif v = 'wrong' then
    return jsonb_build_object('ok', false, 'error', 'wrong_pin',
      'tries_left', 5 - (select failed_count from member_pins where member_id = a.id));
  end if;
  insert into approvals (business_id, branch_id, action, method, amount, reason, requested_by, requested_name,
                         approved_by, approved_name, details, expires_at)
  values (me.business_id, p_branch, p_action, 'pin', p_amount, nullif(btrim(p_reason), ''), me.id, me.display_name,
          a.id, a.display_name, coalesce(p_details, '{}'), now() + interval '5 minutes')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'approval_id', v_id, 'approved_name', a.display_name);
end;
$$;

-- Used by the function that does the action: the approval must be this person's, for this branch and action, not
-- used, not expired, and cover the amount (a 25% approval covers 20%, not 30%). It is then used up and linked.
create function public.use_approval(p_approval uuid, p_member uuid, p_branch uuid, p_action text, p_amount bigint,
                                    p_limit bigint, p_ref_type text, p_ref_id uuid)
returns public.approvals
language plpgsql security definer set search_path = public as $$
declare
  r approvals;
begin
  select * into r from approvals where id = p_approval for update;
  if r.id is null or r.method <> 'pin' or r.branch_id <> p_branch or r.action <> p_action
     or r.requested_by is distinct from p_member or r.used_at is not null or r.expires_at <= now()
     or (p_amount is not null and (r.amount is null or p_amount > r.amount)) then
    raise exception 'approval_needed' using errcode = '42501';
  end if;
  update approvals set used_at = now(), limit_amount = p_limit, ref_type = p_ref_type, ref_id = p_ref_id
  where id = r.id returning * into r;
  return r;
end;
$$;
revoke execute on function public.use_approval(uuid, uuid, uuid, text, bigint, bigint, text, uuid)
  from public, anon, authenticated;

-- A manager's or the owner's own refund, price change or discount over the limit: listed with their reason.
create function public.log_approval(p_member uuid, p_branch uuid, p_action text, p_amount bigint, p_limit bigint,
                                    p_reason text, p_ref_type text, p_ref_id uuid, p_details jsonb default '{}')
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  m members;
  v_id uuid;
begin
  select * into m from members where id = p_member;
  insert into approvals (business_id, branch_id, action, method, amount, limit_amount, reason, requested_by,
                         requested_name, approved_by, approved_name, ref_type, ref_id, details, used_at)
  values (m.business_id, p_branch, p_action, 'reason', p_amount, p_limit, nullif(btrim(p_reason), ''), m.id,
          m.display_name, m.id, m.display_name, p_ref_type, p_ref_id, coalesce(p_details, '{}'), now())
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.log_approval(uuid, uuid, text, bigint, bigint, text, text, uuid, jsonb)
  from public, anon, authenticated;

-- Signed in only.
revoke execute on function public.approvers(uuid), public.approve_with_pin(uuid, uuid, text, text, bigint, text, jsonb)
  from public, anon;
