-- M1 · Tenancy, people and the RLS helpers every other table uses (04-DATA-MODEL §1, §8).

create type public.salon_mode as enum ('gents', 'ladies');
create type public.member_role as enum ('owner', 'cashier', 'staff', 'accountant');
create type public.vat_mode as enum ('off', 'on');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 80),
  code text not null unique check (code ~ '^[a-z0-9]{4,12}$'),
  country_code text not null default 'AE',
  currency text not null default 'AED',
  timezone text not null default 'Asia/Dubai',
  is_demo boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 80),
  mode public.salon_mode not null,
  address text,
  phone text,
  -- {"open":"09:00","close":"22:00","days":[0..6]} (0 = Sunday)
  opening_hours jsonb not null default '{"open":"09:00","close":"22:00","days":[0,1,2,3,4,5,6]}',
  vat_mode public.vat_mode not null default 'off',
  trn text,
  invoice_prefix text,
  -- waiting_target_min, cancel_cutoff_hours, default_deposit_minor, staff_can_sell,
  -- block_insufficient_stock, tax_confirmed, opening_cash_set
  settings jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index branches_business_idx on public.branches (business_id);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  display_name text not null check (length(btrim(display_name)) between 1 and 60),
  username text check (username ~ '^[a-z0-9._-]{3,20}$'),
  active boolean not null default true,
  default_branch_id uuid references public.branches (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (business_id, user_id),
  unique (business_id, username)
);
create index members_user_idx on public.members (user_id);

create table public.member_branches (
  member_id uuid not null references public.members (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  primary key (member_id, branch_id)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  member_id uuid unique references public.members (id) on delete set null,
  full_name text not null check (length(btrim(full_name)) between 1 and 60),
  role_title text not null default 'staff',
  commission_bps int not null default 0 check (commission_bps between 0 and 10000),
  colour text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index employees_branch_idx on public.employees (branch_id);

create table public.access_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  member_id uuid references public.members (id) on delete set null,
  event text not null check (event in ('sign_in', 'sign_out', 'failed')),
  device text,
  created_at timestamptz not null default now()
);

-- ── Helpers (security definer so policies can call them without recursion) ──────────────

create function public.current_member_id(p_business uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from members where business_id = p_business and user_id = auth.uid() and active
$$;

create function public.is_member(p_business uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where business_id = p_business and user_id = auth.uid() and active)
$$;

create function public.has_role(p_business uuid, p_roles public.member_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from members
    where business_id = p_business and user_id = auth.uid() and active and role = any (p_roles)
  )
$$;

create function public.branch_business(p_branch uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select business_id from branches where id = p_branch
$$;

create function public.can_use_branch(p_branch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from branches b
    join members m on m.business_id = b.business_id and m.user_id = auth.uid() and m.active
    where b.id = p_branch
      and (m.role = 'owner'
           or exists (select 1 from member_branches mb where mb.member_id = m.id and mb.branch_id = b.id))
  )
$$;

-- The caller's member row for a branch (raises if they may not use it). Used by every RPC.
create function public.require_member(p_branch uuid, p_roles public.member_role[]) returns public.members
language plpgsql stable security definer set search_path = public as $$
declare
  m members;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  select mem.* into m
  from members mem
  join branches b on b.business_id = mem.business_id
  where b.id = p_branch and mem.user_id = auth.uid() and mem.active;
  if m.id is null or not public.can_use_branch(p_branch) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not (m.role = any (p_roles)) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return m;
end;
$$;

create function public.branch_today(p_branch uuid) returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone bu.timezone)::date
  from branches b join businesses bu on bu.id = b.business_id
  where b.id = p_branch
$$;

create function public.branch_setting(p_branch uuid, p_key text, p_default jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select settings -> p_key from branches where id = p_branch), p_default)
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────────────────

alter table public.businesses enable row level security;
alter table public.branches enable row level security;
alter table public.members enable row level security;
alter table public.member_branches enable row level security;
alter table public.employees enable row level security;
alter table public.access_history enable row level security;

create policy "members read their business" on public.businesses
  for select to authenticated using (public.is_member(id));

create policy "members read usable branches" on public.branches
  for select to authenticated using (public.can_use_branch(id));

create policy "members read colleagues" on public.members
  for select to authenticated using (public.is_member(business_id) or user_id = auth.uid());

create policy "members read branch access" on public.member_branches
  for select to authenticated
  using (exists (select 1 from members m where m.id = member_id and public.is_member(m.business_id)));

create policy "members read employees" on public.employees
  for select to authenticated using (public.is_member(business_id));

create policy "owners read access history" on public.access_history
  for select to authenticated using (public.has_role(business_id, array['owner']::public.member_role[]));

-- Writes to these tables only happen through RPCs / the service role.
