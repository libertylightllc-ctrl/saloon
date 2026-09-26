-- Database health & integrity check. Run: docker exec -i supabase_db_salon-app psql -U postgres < supabase/checks/health.sql
\pset border 2
\echo '== Tables: security (RLS), policies, rows'
select c.relname as table, c.relrowsecurity as rls_on,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies,
       (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::int as rows
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' order by 1;

\echo '== Integrity checks (every line must say 0 problems)'
select 'journal entries that do not balance' as check, count(*) as problems from (
  select entry_id from journal_lines group by entry_id having sum(debit_minor) <> sum(credit_minor)) x
union all select 'sales without a journal entry', count(*) from sales s
  where not exists (select 1 from journal_entries e where e.source_type = 'sale' and e.source_id = s.id)
union all select 'refunds without a journal entry', count(*) from refunds r
  where not exists (select 1 from journal_entries e where e.source_type = 'refund' and e.source_id = r.id)
union all select 'sales whose payments + deposit do not equal the total', count(*) from sales s
  where s.total_minor <> s.deposit_applied_minor + coalesce((select sum(amount_minor) from sale_payments p where p.sale_id = s.id), 0)
union all select 'sales whose lines do not add up to the subtotal', count(*) from sales s
  where s.subtotal_minor <> coalesce((select sum(round(l.unit_price_minor * l.qty)) from sale_lines l where l.sale_id = s.id), 0)
union all select 'refunded more than the sale total', count(*) from sales s where s.refunded_minor > s.total_minor
union all select 'refund totals that differ from refund rows', count(*) from sales s
  where s.refunded_minor <> coalesce((select sum(amount_minor) from refunds r where r.sale_id = s.id), 0)
union all select 'stock levels that differ from their movements', count(*) from stock_levels sl
  where sl.qty <> coalesce((select sum(m.qty_delta) from stock_movements m where m.item_id = sl.item_id and m.branch_id = sl.branch_id), 0)
union all select 'held deposits without a deposit journal', count(*) from appointments a
  where a.deposit_minor > 0 and not exists (select 1 from journal_entries e where e.source_id = a.id)
union all select 'completed visits without a sale', count(*) from appointments a where a.status = 'completed' and a.sale_id is null
union all select 'expenses without a journal entry', count(*) from expenses x
  where not exists (select 1 from journal_entries e where e.source_type = 'expense' and e.source_id = x.id)
union all select 'reversed expenses without a reversal entry', count(*) from expenses x where x.status = 'reversed'
  and not exists (select 1 from journal_entries e where e.source_type = 'expense_reversal' and e.source_id = x.id)
union all select 'bills without a journal entry', count(*) from purchase_bills b
  where not exists (select 1 from journal_entries e where e.source_type = 'purchase_bill' and e.source_id = b.id)
union all select 'supplier payments without a journal entry', count(*) from supplier_payments sp
  where not exists (select 1 from journal_entries e where e.source_type = 'supplier_payment' and e.source_id = sp.id)
union all select 'bills whose paid amount differs from their payments', count(*) from purchase_bills b
  where b.paid_minor <> coalesce((select sum(amount_minor) from supplier_payments sp where sp.bill_id = b.id), 0)
union all select 'bills whose lines do not add up to the total', count(*) from purchase_bills b
  where b.total_minor <> (select sum(total_minor) from purchase_bill_lines l where l.bill_id = b.id)
union all select 'businesses without an owner', count(*) from businesses b
  where not exists (select 1 from members m where m.business_id = b.id and m.role = 'owner')
union all select 'tables without row level security', count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

\echo '== Demo salons: expected cash = cash account balance, books balanced'
select b.name, public_expected.cash as expected_cash_aed, public_expected.debits = public_expected.credits as balanced
from businesses b cross join lateral (
  select coalesce(sum(l.debit_minor - l.credit_minor) filter (where a.system_key = 'cash'), 0) / 100.0 as cash,
         sum(l.debit_minor) as debits, sum(l.credit_minor) as credits
  from journal_lines l join journal_entries e on e.id = l.entry_id join accounts a on a.id = l.account_id
  where e.business_id = b.id) public_expected
where b.is_demo;

\echo '== Realtime: tables that push live updates'
select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;
