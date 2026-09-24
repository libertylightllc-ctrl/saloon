-- M1 · Services, stock items used by recipes, rooms, customers, expense categories (04-DATA-MODEL §2, §4).

create type public.item_kind as enum ('consumable', 'retail', 'tool');
create type public.stock_reason as enum (
  'purchase', 'service_use', 'retail_sale', 'adjustment', 'count', 'reversal', 'opening'
);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  icon text not null default 'scissors',
  translations jsonb not null default '{}',
  sort int not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index service_categories_name_idx
  on public.service_categories (business_id, lower(name)) where not archived;

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  category_id uuid not null references public.service_categories (id),
  name text not null check (length(btrim(name)) between 1 and 60),
  translations jsonb not null default '{}',
  price_minor bigint not null check (price_minor >= 0),
  duration_min int not null check (duration_min between 5 and 600),
  buffer_min int not null default 0 check (buffer_min between 0 and 120),
  requires_room boolean not null default false,
  requires_patch_test boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);
create index services_business_idx on public.services (business_id, status);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  kind public.item_kind not null default 'consumable',
  unit text not null default 'pcs' check (unit in ('pcs', 'ml', 'g', 'pairs')),
  reorder_level numeric(12, 3) not null default 0,
  avg_unit_cost_minor numeric(14, 4) not null default 0,
  sell_price_minor bigint,
  location text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index inventory_items_name_idx on public.inventory_items (business_id, lower(name));

create table public.service_recipe_items (
  service_id uuid not null references public.services (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id),
  qty numeric(12, 3) not null check (qty > 0),
  primary key (service_id, item_id)
);

create table public.stock_levels (
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  qty numeric(12, 3) not null default 0,
  primary key (item_id, branch_id)
);

create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id),
  qty_delta numeric(12, 3) not null,
  reason public.stock_reason not null,
  unit_cost_minor numeric(14, 4) not null default 0,
  ref_type text,
  ref_id uuid,
  note text,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index stock_movements_item_idx on public.stock_movements (item_id, created_at desc);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  name text not null,
  kind text not null default 'room' check (kind in ('room', 'bed', 'chair')),
  active boolean not null default true
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  phone text check (phone is null or phone ~ '^\+?[0-9 ]{7,20}$'),
  notes text,
  preferences text,
  risk_flags text[] not null default '{}',
  no_show_count int not null default 0,
  visit_count int not null default 0,
  last_visit_at timestamptz,
  preferred_employee_id uuid references public.employees (id) on delete set null,
  marketing_opt_in boolean not null default false,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index customers_business_idx on public.customers (business_id, lower(name));

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  account_id uuid references public.accounts (id)
);

alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.inventory_items enable row level security;
alter table public.service_recipe_items enable row level security;
alter table public.stock_levels enable row level security;
alter table public.stock_movements enable row level security;
alter table public.rooms enable row level security;
alter table public.customers enable row level security;
alter table public.expense_categories enable row level security;

create policy "members read categories" on public.service_categories
  for select to authenticated using (public.is_member(business_id));
create policy "owners add categories" on public.service_categories
  for insert to authenticated with check (public.has_role(business_id, array['owner']::public.member_role[]));
create policy "owners edit categories" on public.service_categories
  for update to authenticated
  using (public.has_role(business_id, array['owner']::public.member_role[]))
  with check (public.has_role(business_id, array['owner']::public.member_role[]));

create policy "members read services" on public.services
  for select to authenticated using (public.is_member(business_id));

create policy "members read items" on public.inventory_items
  for select to authenticated using (public.is_member(business_id));

create policy "members read recipes" on public.service_recipe_items
  for select to authenticated
  using (exists (select 1 from services s where s.id = service_id and public.is_member(s.business_id)));

create policy "members read stock levels" on public.stock_levels
  for select to authenticated using (public.can_use_branch(branch_id));

create policy "owners read stock movements" on public.stock_movements
  for select to authenticated
  using (public.has_role(business_id, array['owner', 'cashier', 'accountant']::public.member_role[])
         and public.can_use_branch(branch_id));

create policy "members read rooms" on public.rooms
  for select to authenticated using (public.can_use_branch(branch_id));

-- Staff see customer names on queue rows (denormalised onto appointments), not the customer book.
create policy "front desk reads customers" on public.customers
  for select to authenticated
  using (public.has_role(business_id, array['owner', 'cashier', 'accountant']::public.member_role[]));
create policy "front desk adds customers" on public.customers
  for insert to authenticated
  with check (public.has_role(business_id, array['owner', 'cashier']::public.member_role[]));
create policy "front desk edits customers" on public.customers
  for update to authenticated
  using (public.has_role(business_id, array['owner', 'cashier']::public.member_role[]))
  with check (public.has_role(business_id, array['owner', 'cashier']::public.member_role[]));

create policy "members read expense categories" on public.expense_categories
  for select to authenticated using (public.is_member(business_id));
