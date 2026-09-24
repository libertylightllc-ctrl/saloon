-- M1 · Double-entry ledger, audit log (04-DATA-MODEL §6).

create type public.account_type as enum ('asset', 'liability', 'equity', 'income', 'expense');

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  code text not null,
  name text not null,
  type public.account_type not null,
  system_key text,
  unique (business_id, code),
  unique (business_id, system_key)
);

create table public.periods (
  business_id uuid not null references public.businesses (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  status text not null default 'open' check (status in ('open', 'closed')),
  primary key (business_id, month)
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid references public.branches (id) on delete cascade,
  business_date date not null,
  source_type text not null,
  source_id uuid,
  memo text,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index journal_entries_branch_date_idx on public.journal_entries (branch_id, business_date);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries (id) on delete cascade,
  account_id uuid not null references public.accounts (id),
  debit_minor bigint not null default 0,
  credit_minor bigint not null default 0,
  check ((debit_minor > 0 and credit_minor = 0) or (credit_minor > 0 and debit_minor = 0))
);
create index journal_lines_entry_idx on public.journal_lines (entry_id);
create index journal_lines_account_idx on public.journal_lines (account_id);

-- Balance guarantee: checked at commit, so an RPC can insert lines one by one.
create function public.check_journal_balanced() returns trigger
language plpgsql as $$
declare
  v_entry uuid := coalesce(new.entry_id, old.entry_id);
  v_debit bigint;
  v_credit bigint;
begin
  if not exists (select 1 from journal_entries where id = v_entry) then
    return null; -- entry deleted with its lines
  end if;
  select coalesce(sum(debit_minor), 0), coalesce(sum(credit_minor), 0)
    into v_debit, v_credit
  from journal_lines where entry_id = v_entry;
  if v_debit <> v_credit then
    raise exception 'journal_unbalanced: entry % debits % credits %', v_entry, v_debit, v_credit
      using errcode = '23514';
  end if;
  return null;
end;
$$;

create constraint trigger journal_lines_balanced
  after insert or update or delete on public.journal_lines
  deferrable initially deferred
  for each row execute function public.check_journal_balanced();

create function public.check_period_open() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from periods
    where business_id = new.business_id and month = to_char(new.business_date, 'YYYY-MM') and status = 'closed'
  ) then
    raise exception 'period_closed: %', to_char(new.business_date, 'YYYY-MM') using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger journal_entries_period_open
  before insert on public.journal_entries
  for each row execute function public.check_period_open();

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid references public.branches (id) on delete cascade,
  actor_member_id uuid references public.members (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_branch_idx on public.audit_log (branch_id, created_at desc);

-- ── Internal helpers used by the RPCs ───────────────────────────────────────────────────

create function public.acct(p_business uuid, p_key text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare
  v uuid;
begin
  select id into v from accounts where business_id = p_business and system_key = p_key;
  if v is null then
    raise exception 'missing_account: %', p_key;
  end if;
  return v;
end;
$$;

-- p_lines: [{"account":"cash","debit":100}, {"account":"service_revenue","credit":100}]
-- Zero amounts are skipped; an entry with no non-zero lines is not created.
create function public.post_journal(
  p_business uuid, p_branch uuid, p_date date, p_source_type text, p_source_id uuid,
  p_memo text, p_actor uuid, p_lines jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_entry uuid;
  l jsonb;
  v_debit bigint;
  v_credit bigint;
begin
  if not exists (
    select 1 from jsonb_array_elements(p_lines) x
    where coalesce((x ->> 'debit')::bigint, 0) > 0 or coalesce((x ->> 'credit')::bigint, 0) > 0
  ) then
    return null;
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

create function public.write_audit(
  p_business uuid, p_branch uuid, p_actor uuid, p_action text, p_entity_type text,
  p_entity_id uuid, p_summary text, p_before jsonb default null, p_after jsonb default null
) returns void
language sql security definer set search_path = public as $$
  insert into audit_log (business_id, branch_id, actor_member_id, action, entity_type, entity_id, summary, before, after)
  values (p_business, p_branch, p_actor, p_action, p_entity_type, p_entity_id, p_summary, p_before, p_after)
$$;

-- Largest-remainder split, same maths as src/lib/money.ts allocate().
create function public.allocate_minor(p_total bigint, p_weights bigint[]) returns bigint[]
language plpgsql immutable as $$
declare
  n int := coalesce(array_length(p_weights, 1), 0);
  w bigint[] := p_weights;
  wsum numeric;
  abs_total bigint := abs(p_total);
  sgn int := case when p_total < 0 then -1 else 1 end;
  base bigint[] := '{}';
  rem numeric[] := '{}';
  leftover bigint;
  i int;
  best int;
  done bool[] := '{}';
begin
  if n = 0 then
    return '{}';
  end if;
  select sum(x) into wsum from unnest(w) x;
  if wsum = 0 then
    w := array_fill(1::bigint, array[n]);
    wsum := n;
  end if;
  for i in 1..n loop
    base := base || floor(abs_total::numeric * w[i] / wsum)::bigint;
    rem := rem || (abs_total::numeric * w[i] - floor(abs_total::numeric * w[i] / wsum) * wsum);
    done := done || false;
  end loop;
  leftover := abs_total - (select sum(x) from unnest(base) x);
  while leftover > 0 loop
    best := null;
    for i in 1..n loop
      if not done[i] and (best is null or rem[i] > rem[best]) then
        best := i;
      end if;
    end loop;
    base[best] := base[best] + 1;
    done[best] := true;
    leftover := leftover - 1;
  end loop;
  for i in 1..n loop
    base[i] := base[i] * sgn;
  end loop;
  return base;
end;
$$;

alter table public.accounts enable row level security;
alter table public.periods enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;
alter table public.audit_log enable row level security;

create policy "owners and accountants read accounts" on public.accounts
  for select to authenticated
  using (public.has_role(business_id, array['owner', 'accountant']::public.member_role[]));

create policy "members read periods" on public.periods
  for select to authenticated using (public.is_member(business_id));

create policy "owners and accountants read journal" on public.journal_entries
  for select to authenticated
  using (public.has_role(business_id, array['owner', 'accountant']::public.member_role[]));

create policy "owners and accountants read journal lines" on public.journal_lines
  for select to authenticated
  using (exists (
    select 1 from journal_entries e
    where e.id = entry_id and public.has_role(e.business_id, array['owner', 'accountant']::public.member_role[])
  ));

create policy "owners and cashiers read activity" on public.audit_log
  for select to authenticated
  using (public.has_role(business_id, array['owner', 'cashier', 'accountant']::public.member_role[])
         and (branch_id is null or public.can_use_branch(branch_id)));
