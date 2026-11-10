-- Part B, step 1 (owner's app check, 9 Nov 2026; docs/PART-B-PLAN.md): one list of who can do what.
-- Each row of the brief's B2 table is a capability; each login type has a level for it:
--   yes    allowed
--   own    only their own (their appointments, clients, sales, payslips)
--   pin    needs a manager's or the owner's PIN on the spot (migration 89)
--   limit  allowed up to the branch's limit (Controls, migration 88); above it, a PIN
--   reason allowed with a reason, which is saved
--   branch only for the branches they work in
-- No row = not allowed. The app's src/lib/permissions.ts holds the same list (a test checks they match), and the
-- database functions check it with require_can() as each step of Part B reaches them.
-- cashier is shown as "Front desk" and staff as "Stylist / therapist" (owner's answer 1, 10 Nov).

create table public.role_capabilities (
  capability text not null,
  role public.member_role not null,
  level text not null default 'yes' check (level in ('yes', 'own', 'pin', 'limit', 'reason', 'branch')),
  primary key (capability, role)
);
alter table public.role_capabilities enable row level security;
create policy "everyone signed in reads who can do what" on public.role_capabilities
  for select to authenticated using (true);
revoke insert, update, delete, truncate, references, trigger on public.role_capabilities from anon, authenticated;
revoke select on public.role_capabilities from anon;

insert into public.role_capabilities (capability, role, level)
select c, r::public.member_role, l
from (values
  -- Bookings and queue
  ('viewQueue', 'owner', 'yes'), ('viewQueue', 'manager', 'yes'), ('viewQueue', 'cashier', 'yes'),
  ('viewQueue', 'staff', 'own'),
  ('addToQueue', 'owner', 'yes'), ('addToQueue', 'manager', 'yes'), ('addToQueue', 'cashier', 'yes'),
  ('addToQueue', 'staff', 'own'),
  ('book', 'owner', 'yes'), ('book', 'manager', 'yes'), ('book', 'cashier', 'yes'), ('book', 'staff', 'own'),
  ('noShowOrCancel', 'owner', 'yes'), ('noShowOrCancel', 'manager', 'yes'), ('noShowOrCancel', 'cashier', 'yes'),
  -- Sales
  ('sell', 'owner', 'yes'), ('sell', 'manager', 'yes'), ('sell', 'cashier', 'yes'), ('sell', 'staff', 'own'),
  ('discount', 'owner', 'yes'), ('discount', 'manager', 'reason'), ('discount', 'cashier', 'limit'),
  ('discount', 'staff', 'limit'),
  ('changePrice', 'owner', 'yes'), ('changePrice', 'manager', 'reason'), ('changePrice', 'cashier', 'pin'),
  ('refund', 'owner', 'yes'), ('refund', 'manager', 'reason'), ('refund', 'cashier', 'pin'),
  ('refundDeposit', 'owner', 'yes'), ('refundDeposit', 'manager', 'yes'), ('refundDeposit', 'cashier', 'pin'),
  ('receipts', 'owner', 'yes'), ('receipts', 'manager', 'yes'), ('receipts', 'cashier', 'yes'),
  ('receipts', 'staff', 'own'),
  ('viewSales', 'owner', 'yes'), ('viewSales', 'manager', 'yes'), ('viewSales', 'cashier', 'yes'),
  ('viewSales', 'staff', 'own'), ('viewSales', 'accountant', 'yes'),
  ('viewMoney', 'owner', 'yes'), ('viewMoney', 'manager', 'yes'), ('viewMoney', 'cashier', 'yes'),
  ('viewMoney', 'accountant', 'yes'),
  -- Cash drawer
  ('countCash', 'owner', 'yes'), ('countCash', 'manager', 'yes'), ('countCash', 'cashier', 'yes'),
  ('viewClosing', 'owner', 'yes'), ('viewClosing', 'manager', 'yes'), ('viewClosing', 'cashier', 'yes'),
  ('viewClosing', 'accountant', 'yes'),
  ('approveClosing', 'owner', 'yes'), ('approveClosing', 'manager', 'yes'),
  ('pettyCash', 'owner', 'yes'), ('pettyCash', 'manager', 'yes'), ('pettyCash', 'cashier', 'limit'),
  ('cashOut', 'owner', 'yes'), ('cashOut', 'manager', 'yes'),
  ('bankDeposit', 'owner', 'yes'), ('bankDeposit', 'manager', 'yes'), ('bankDeposit', 'accountant', 'yes'),
  ('payTips', 'owner', 'yes'), ('payTips', 'manager', 'yes'), ('payTips', 'cashier', 'yes'),
  -- Customers
  ('viewCustomers', 'owner', 'yes'), ('viewCustomers', 'manager', 'yes'), ('viewCustomers', 'cashier', 'yes'),
  ('viewCustomers', 'staff', 'own'),
  ('customerContacts', 'owner', 'yes'), ('customerContacts', 'manager', 'yes'),
  ('customerContacts', 'cashier', 'yes'), ('customerContacts', 'staff', 'own'),
  ('manageCustomers', 'owner', 'yes'), ('manageCustomers', 'manager', 'yes'), ('manageCustomers', 'cashier', 'yes'),
  ('serviceNotes', 'owner', 'yes'), ('serviceNotes', 'manager', 'yes'), ('serviceNotes', 'cashier', 'yes'),
  ('serviceNotes', 'staff', 'own'),
  ('mergeCustomers', 'owner', 'yes'), ('mergeCustomers', 'manager', 'yes'),
  ('exportCustomers', 'owner', 'yes'),
  ('deleteCustomers', 'owner', 'yes'),
  -- Team
  ('recordAttendance', 'owner', 'yes'), ('recordAttendance', 'manager', 'yes'), ('recordAttendance', 'cashier', 'pin'),
  ('fixAttendance', 'owner', 'yes'), ('fixAttendance', 'manager', 'reason'),
  ('viewAttendance', 'owner', 'yes'), ('viewAttendance', 'manager', 'yes'), ('viewAttendance', 'cashier', 'yes'),
  ('viewAttendance', 'staff', 'own'), ('viewAttendance', 'accountant', 'yes'),
  ('manageRoster', 'owner', 'yes'), ('manageRoster', 'manager', 'yes'),
  ('viewRoster', 'owner', 'yes'), ('viewRoster', 'manager', 'yes'), ('viewRoster', 'cashier', 'yes'),
  ('viewRoster', 'staff', 'own'), ('viewRoster', 'accountant', 'yes'),
  ('viewStaff', 'owner', 'yes'), ('viewStaff', 'manager', 'yes'), ('viewStaff', 'accountant', 'yes'),
  ('manageStaff', 'owner', 'yes'),
  ('manageUsers', 'owner', 'yes'),
  ('resetLogin', 'owner', 'yes'), ('resetLogin', 'manager', 'branch'),
  ('viewStaffSales', 'owner', 'yes'), ('viewStaffSales', 'manager', 'yes'), ('viewStaffSales', 'staff', 'own'),
  ('viewStaffSales', 'accountant', 'yes'),
  ('viewPayroll', 'owner', 'yes'), ('viewPayroll', 'accountant', 'yes'),
  ('recordPay', 'owner', 'yes'), ('recordPay', 'accountant', 'yes'),
  ('runPayroll', 'owner', 'yes'), ('runPayroll', 'accountant', 'yes'),
  ('approvePayroll', 'owner', 'yes'),
  ('payPayroll', 'owner', 'yes'), ('payPayroll', 'accountant', 'yes'),
  ('myPay', 'staff', 'own'),
  -- Stock and suppliers
  ('viewInventory', 'owner', 'yes'), ('viewInventory', 'manager', 'yes'), ('viewInventory', 'cashier', 'yes'),
  ('viewInventory', 'staff', 'yes'), ('viewInventory', 'accountant', 'yes'),
  ('countStock', 'owner', 'yes'), ('countStock', 'manager', 'yes'),
  ('manageInventory', 'owner', 'yes'),
  ('orderStock', 'owner', 'yes'), ('orderStock', 'manager', 'yes'),
  ('receiveDelivery', 'owner', 'yes'), ('receiveDelivery', 'manager', 'yes'), ('receiveDelivery', 'cashier', 'yes'),
  ('priceDelivery', 'owner', 'yes'), ('priceDelivery', 'manager', 'yes'), ('priceDelivery', 'accountant', 'yes'),
  ('addPurchase', 'owner', 'yes'), ('addPurchase', 'manager', 'yes'), ('addPurchase', 'accountant', 'yes'),
  ('viewPurchases', 'owner', 'yes'), ('viewPurchases', 'manager', 'yes'), ('viewPurchases', 'accountant', 'yes'),
  ('payBill', 'owner', 'yes'), ('payBill', 'accountant', 'yes'),
  ('addExpense', 'owner', 'yes'), ('addExpense', 'manager', 'yes'), ('addExpense', 'accountant', 'yes'),
  ('viewExpenses', 'owner', 'yes'), ('viewExpenses', 'manager', 'yes'), ('viewExpenses', 'cashier', 'own'),
  ('viewExpenses', 'accountant', 'yes'),
  ('payOrReverseMoneyOut', 'owner', 'yes'),
  -- Reports and books
  ('viewReports', 'owner', 'yes'), ('viewReports', 'manager', 'branch'), ('viewReports', 'staff', 'own'),
  ('viewReports', 'accountant', 'yes'),
  ('viewAccounting', 'owner', 'yes'), ('viewAccounting', 'accountant', 'yes'),
  ('closePeriod', 'owner', 'yes'), ('closePeriod', 'accountant', 'yes'),
  ('reopenPeriod', 'owner', 'yes'),
  ('exportLedger', 'owner', 'yes'), ('exportLedger', 'accountant', 'yes'),
  ('viewActivity', 'owner', 'yes'), ('viewActivity', 'manager', 'branch'), ('viewActivity', 'accountant', 'yes'),
  ('viewApprovals', 'owner', 'yes'), ('viewApprovals', 'manager', 'branch'),
  -- Setup
  ('viewServices', 'owner', 'yes'), ('viewServices', 'manager', 'yes'), ('viewServices', 'cashier', 'yes'),
  ('viewServices', 'staff', 'yes'), ('viewServices', 'accountant', 'yes'),
  ('manageServices', 'owner', 'yes'),
  ('manageBranch', 'owner', 'yes'),
  ('manageControls', 'owner', 'yes'),
  ('viewCompliance', 'owner', 'yes'), ('viewCompliance', 'manager', 'yes'), ('viewCompliance', 'accountant', 'yes'),
  ('manageCompliance', 'owner', 'yes'), ('manageCompliance', 'manager', 'yes'),
  ('signHygiene', 'owner', 'yes'), ('signHygiene', 'manager', 'yes'), ('signHygiene', 'cashier', 'yes'),
  ('signHygiene', 'staff', 'yes'),
  ('backup', 'owner', 'yes'),
  ('viewPlan', 'owner', 'yes'), ('viewPlan', 'accountant', 'yes'),
  ('requestPlan', 'owner', 'yes'),
  ('support', 'owner', 'yes'), ('support', 'manager', 'yes'), ('support', 'cashier', 'yes'),
  ('support', 'staff', 'yes'), ('support', 'accountant', 'yes')
) v(c, r, l);

-- A login type's level for a capability; null = not allowed.
create function public.role_level(p_role public.member_role, p_capability text) returns text
language sql stable security definer set search_path = public as $$
  select level from role_capabilities where role = p_role and capability = p_capability
$$;

-- The signed-in person's membership for a branch they work in, if their login type has the capability (any level;
-- the caller checks own / pin / limit / reason / branch). Replaces require_member's fixed lists step by step.
create function public.require_can(p_branch uuid, p_capability text) returns public.members
language plpgsql stable security definer set search_path = public as $$
declare
  m members;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  select mem.* into m
  from members mem join branches b on b.business_id = mem.business_id
  where b.id = p_branch and mem.user_id = auth.uid() and mem.active;
  if m.id is null or not public.can_use_branch(p_branch) or public.role_level(m.role, p_capability) is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return m;
end;
$$;

-- The same for the whole salon (books, payroll, staff), where no branch is involved.
create function public.require_can_business(p_business uuid, p_capability text) returns public.members
language plpgsql stable security definer set search_path = public as $$
declare
  m members;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  select * into m from members where business_id = p_business and user_id = auth.uid() and active;
  if m.id is null or public.role_level(m.role, p_capability) is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return m;
end;
$$;

-- For row rules: the salons where my login type has the capability.
create function public.my_business_ids_can(p_capability text) returns setof uuid
language sql stable security definer set search_path = public as $$
  select m.business_id from members m
  join role_capabilities c on c.role = m.role and c.capability = p_capability
  where m.user_id = auth.uid() and m.active
$$;

-- Branches (brief B, rule 7): manager, front desk and stylist work in the branches they are given; the owner and the
-- accountant see every branch.
create or replace function public.can_use_branch(p_branch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from branches b
    join members m on m.business_id = b.business_id and m.user_id = auth.uid() and m.active
    where b.id = p_branch
      and (m.role in ('owner', 'accountant')
           or exists (select 1 from member_branches mb where mb.member_id = m.id and mb.branch_id = b.id))
  )
$$;

create or replace function public.my_branch_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select b.id
  from branches b
  join members m on m.business_id = b.business_id and m.user_id = auth.uid() and m.active
  where m.role in ('owner', 'accountant')
     or exists (select 1 from member_branches mb where mb.member_id = m.id and mb.branch_id = b.id)
$$;

-- The checks run inside the database's own functions; the app does not call them. Row rules need
-- my_business_ids_can as the signed-in person.
revoke execute on function public.role_level(public.member_role, text), public.require_can(uuid, text),
  public.require_can_business(uuid, text) from public, anon, authenticated;
revoke execute on function public.my_business_ids_can(text) from public, anon;
