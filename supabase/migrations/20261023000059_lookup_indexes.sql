-- Lookups by customer and by salon (2026-10-23). Without these, each lookup read every sale (or staff member) of every
-- salon, so the time grew with the whole platform, not with the salon:
-- - the customer report: a salon with 1,200 customers took about a second on a quiet machine and ran past the 8 s
--   limit on a busy one;
-- - the console's salon list (admin_salon_stats: staff, sales in 30 days, sales this month, last sale per salon):
--   0.65 s for 500 salons, past the limit on a busy machine.
create index sales_customer_idx on public.sales (customer_id) where customer_id is not null;
create index sales_business_created_idx on public.sales (business_id, created_at);
create index employees_business_idx on public.employees (business_id);
