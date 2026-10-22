-- Lookups by customer and by salon use indexes (migration 59): the customer report and the console's salon list
-- must not read every sale of every salon.
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select has_index('public', 'sales', 'sales_customer_idx', array['customer_id'], 'sales by customer');
select has_index('public', 'sales', 'sales_business_created_idx', array['business_id', 'created_at'], 'sales by salon and time');
select has_index('public', 'employees', 'employees_business_idx', array['business_id'], 'staff by salon');

select * from finish();
rollback;
