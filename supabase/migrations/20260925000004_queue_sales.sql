-- M1 · Queue, appointments, sales, refunds (04-DATA-MODEL §3).

create type public.appointment_status as enum (
  'booked', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show'
);
create type public.appointment_source as enum ('walk_in', 'phone', 'staff', 'app');
create type public.deposit_status as enum ('none', 'held', 'applied', 'forfeited', 'refunded');
create type public.payment_method as enum ('cash', 'card', 'wallet', 'bank');
create type public.sale_status as enum ('completed', 'partially_refunded', 'refunded');
create type public.sale_line_kind as enum ('service', 'retail', 'custom');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  -- Name shown on queue rows (customer name or walk-in guest), so staff never need the customer book.
  customer_name text,
  source public.appointment_source not null,
  status public.appointment_status not null,
  scheduled_at timestamptz not null,
  business_date date not null,
  duration_min int not null default 30,
  checked_in_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  employee_id uuid references public.employees (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  notes text,
  deposit_minor bigint not null default 0 check (deposit_minor >= 0),
  deposit_status public.deposit_status not null default 'none',
  deposit_method public.payment_method,
  cancel_reason text,
  sale_id uuid,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index appointments_branch_date_idx on public.appointments (branch_id, business_date, status);

create table public.appointment_services (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  service_id uuid not null references public.services (id),
  name_snapshot text not null,
  employee_id uuid references public.employees (id) on delete set null,
  duration_min int not null,
  price_minor bigint not null
);
create index appointment_services_appt_idx on public.appointment_services (appointment_id);

create table public.sale_counters (
  branch_id uuid primary key references public.branches (id) on delete cascade,
  next_number int not null default 1001
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  number int not null,
  business_date date not null,
  customer_id uuid references public.customers (id) on delete set null,
  customer_name text,
  appointment_id uuid references public.appointments (id) on delete set null,
  employee_id uuid references public.employees (id) on delete set null,
  status public.sale_status not null default 'completed',
  subtotal_minor bigint not null,
  discount_minor bigint not null default 0,
  vat_minor bigint not null default 0,
  tip_minor bigint not null default 0,
  tip_employee_id uuid references public.employees (id) on delete set null,
  total_minor bigint not null,
  deposit_applied_minor bigint not null default 0,
  refunded_minor bigint not null default 0,
  vat_mode public.vat_mode not null,
  note text,
  client_ref text unique,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (branch_id, number)
);
create index sales_branch_date_idx on public.sales (branch_id, business_date desc, created_at desc);

alter table public.appointments
  add constraint appointments_sale_fk foreign key (sale_id) references public.sales (id) on delete set null;

create table public.sale_lines (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  kind public.sale_line_kind not null,
  service_id uuid references public.services (id),
  item_id uuid references public.inventory_items (id),
  name_snapshot text not null,
  qty numeric(12, 3) not null check (qty > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  discount_minor bigint not null default 0,
  net_minor bigint not null,
  vat_minor bigint not null default 0,
  employee_id uuid references public.employees (id) on delete set null,
  commission_bps int not null default 0,
  commission_minor bigint not null default 0
);
create index sale_lines_sale_idx on public.sale_lines (sale_id);

create table public.sale_payments (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  method public.payment_method not null,
  amount_minor bigint not null check (amount_minor > 0)
);
create index sale_payments_sale_idx on public.sale_payments (sale_id);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  business_date date not null,
  amount_minor bigint not null check (amount_minor > 0),
  method public.payment_method not null,
  reason text not null check (length(btrim(reason)) >= 3),
  restock boolean not null default false,
  idempotency_key text unique,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index refunds_sale_idx on public.refunds (sale_id);

alter table public.appointments enable row level security;
alter table public.appointment_services enable row level security;
alter table public.sale_counters enable row level security;
alter table public.sales enable row level security;
alter table public.sale_lines enable row level security;
alter table public.sale_payments enable row level security;
alter table public.refunds enable row level security;

create policy "members read appointments" on public.appointments
  for select to authenticated using (public.can_use_branch(branch_id));

create policy "members read appointment services" on public.appointment_services
  for select to authenticated
  using (exists (select 1 from appointments a where a.id = appointment_id and public.can_use_branch(a.branch_id)));

-- Staff see sales they worked on; the front desk sees all of the branch.
create policy "members read sales" on public.sales
  for select to authenticated
  using (public.can_use_branch(branch_id)
         and (public.has_role(business_id, array['owner', 'cashier', 'accountant']::public.member_role[])
              or employee_id in (select e.id from employees e join members m on m.id = e.member_id
                                 where m.user_id = auth.uid())));

create policy "members read sale lines" on public.sale_lines
  for select to authenticated using (exists (select 1 from sales s where s.id = sale_id));

create policy "members read sale payments" on public.sale_payments
  for select to authenticated using (exists (select 1 from sales s where s.id = sale_id));

create policy "front desk reads refunds" on public.refunds
  for select to authenticated
  using (public.has_role(business_id, array['owner', 'cashier', 'accountant']::public.member_role[])
         and public.can_use_branch(branch_id));
