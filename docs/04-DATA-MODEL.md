# 04 — Data model (Supabase / Postgres)

Conventions: `uuid` primary keys (`gen_random_uuid()`), `created_at timestamptz default now()`, `created_by uuid`
(member id). Money columns end in `_minor` and are `bigint`. Percentages end in `_bps` (`int`).
Quantities are `numeric(12,3)`. Every tenant table has `business_id` (and `branch_id` where it belongs to a branch).
Enums as Postgres enums. One migration per phase.

## 1. Tenancy & people

| Table | Key columns |
|---|---|
| `businesses` | name, code (short unique, used for staff logins), country_code (`AE`), currency (`AED`), timezone |
| `branches` | business_id, name, **mode** (`gents`/`ladies`), address, phone, opening_hours jsonb, vat_mode (`off`/`on`), trn, invoice_prefix, settings jsonb (see 01-PRODUCT §3.15), opening_cash_minor |
| `members` | business_id, user_id (auth.users), role (`owner`/`cashier`/`staff`/`accountant`), display_name, username, active, default_branch_id |
| `member_branches` | member_id, branch_id (which branches a member can use) |
| `employees` | business_id, branch_id, member_id (nullable), full_name, employee_code, role_title, base_salary_minor, commission_bps, wps_required, phone, colour, active |
| `rosters` | employee_id, weekday (0–6), start_time, end_time |
| `access_history` | member_id, event (`sign_in`/`sign_out`/`failed`), device, created_at |

## 2. Catalogue & customers

| Table | Key columns |
|---|---|
| `service_categories` | business_id, name, translations jsonb, icon, sort, mode (`gents`/`ladies`/`both`) |
| `services` | business_id, category_id, name, translations jsonb (`{ar,hi,ur}`), price_minor, duration_min, buffer_min, requires_room, requires_patch_test, status (`active`/`archived`) |
| `service_recipe_items` | service_id, item_id, qty |
| `rooms` | branch_id, name, kind (`room`/`bed`/`chair`), active |
| `customers` | business_id, name, phone, notes, preferences, risk_flags text[] (`allergy`,`patch_test`,`no_show`), no_show_count, visit_count, last_visit_at, preferred_employee_id, marketing_opt_in |

## 3. Queue & sales

| Table | Key columns |
|---|---|
| `appointments` | branch_id, customer_id (nullable), guest_name, source (`walk_in`/`phone`/`staff`/`app`), status (`booked`/`waiting`/`in_progress`/`completed`/`cancelled`/`no_show`), scheduled_at, checked_in_at, started_at, completed_at, employee_id (nullable = Any), room_id, notes, deposit_minor, deposit_status (`none`/`held`/`applied`/`forfeited`/`refunded`), deposit_method, cancel_reason, sale_id |
| `appointment_services` | appointment_id, service_id, employee_id, duration_min, price_minor |
| `sale_counters` | branch_id, next_number (row-locked when numbering) |
| `sales` | branch_id, number, business_date, customer_id, appointment_id, status (`completed`/`partially_refunded`/`refunded`), subtotal_minor, discount_minor, tip_minor, tip_employee_id, vat_minor, total_minor, deposit_applied_minor, note |
| `sale_lines` | sale_id, kind (`service`/`retail`/`custom`), service_id, item_id, name_snapshot, qty, unit_price_minor, discount_minor, employee_id, commission_bps, commission_minor |
| `sale_payments` | sale_id, method (`cash`/`card`/`wallet`/`bank`), amount_minor |
| `refunds` | sale_id, amount_minor, method, reason, restock bool, created_by |

## 4. Stock, purchases, expenses

| Table | Key columns |
|---|---|
| `inventory_items` | business_id, name, kind (`consumable`/`retail`/`tool`), unit (`pcs`/`ml`/`g`/`pairs`), reorder_level, avg_unit_cost_minor numeric(14,4), sell_price_minor, location, condition (`good`/`needs_service`), next_service_date, assigned_to, montaji_reg_no |
| `stock_levels` | item_id, branch_id, qty (maintained only by stock functions) |
| `stock_movements` | branch_id, item_id, qty_delta, reason (`purchase`/`service_use`/`retail_sale`/`adjustment`/`count`/`reversal`/`opening`), unit_cost_minor, ref_type, ref_id, note |
| `suppliers` | business_id, name, phone, trn, terms_days |
| `purchase_bills` | branch_id, supplier_id, invoice_ref, bill_date, due_date, total_minor, paid_minor, status (`unpaid`/`partial`/`paid`/`reversed`), attachment_path, reverse_reason |
| `purchase_bill_lines` | bill_id, item_id (nullable), description, qty, unit_cost_minor, total_minor, update_stock bool |
| `supplier_payments` | supplier_id, bill_id (nullable), branch_id, business_date, method, amount_minor |
| `expense_categories` | business_id, name, account_id |
| `expenses` | branch_id, business_date, category_id, note, paid_by_member_id, method, amount_minor, attachment_path, status (`posted`/`reversed`), reverse_reason |

## 5. Staff money, compliance, closing

| Table | Key columns |
|---|---|
| `attendance` | employee_id, branch_id, business_date, clock_in, clock_out, recorded_by, late bool |
| `payroll_adjustments` | employee_id, period (`YYYY-MM`), type (`bonus`/`deduction`/`advance`), amount_minor, method (for advances), business_date, note |
| `payroll_runs` | business_id, period, status (`generated`/`approved`/`paid`) |
| `payroll_lines` | run_id, employee_id, base_minor, commission_minor, bonus_minor, deductions_minor, advances_minor, net_minor, paid_method, paid_at, wps_status (`na`/`required`/`proven`), wps_evidence_path |
| `tip_payouts` | branch_id, business_date, employee_id, amount_minor |
| `compliance_documents` | business_id, branch_id, doc_type, holder_type (`company`/`premises`/`employee`), employee_id, number, issued_on, expires_on, renewal_cost_minor, reminder_days (30), evidence_path, version, previous_id, active |
| `hygiene_logs` | branch_id, business_date, checklist jsonb, signed_by, evidence_path |
| `cash_closings` | branch_id, business_date (unique with branch), opening_cash_minor, expected_cash_minor, counted_cash_minor, variance_minor, reason, counted_by, status (`draft`/`pending_approval`/`approved`), approved_by, approved_at, taken_out_minor, taken_out_to (`bank`/`owner`) |

## 6. Ledger, audit, notifications

| Table | Key columns |
|---|---|
| `accounts` | business_id, code, name, type (`asset`/`liability`/`equity`/`income`/`expense`), system_key (unique per business) |
| `periods` | business_id, month (`YYYY-MM`), status (`open`/`closed`) |
| `journal_entries` | business_id, branch_id, business_date, source_type, source_id, memo |
| `journal_lines` | entry_id, account_id, debit_minor, credit_minor (one side > 0) |
| `audit_log` | business_id, branch_id, actor_member_id, action, entity_type, entity_id, summary, before jsonb, after jsonb |
| `notifications` | business_id, member_id (nullable = all owners), type, title, body, entity_type, entity_id, read_at |
| `push_tokens` | member_id, token, platform |

**Balance guarantee:** a deferred constraint trigger on `journal_lines` rejects any entry whose debits ≠ credits.
Postings into a `closed` period are rejected.

### 6.1 System accounts (seeded per business)

`cash`, `card_clearing`, `wallet_clearing`, `bank`, `inventory`, `staff_advances` (assets) ·
`supplier_payable`, `deposits_held`, `tips_payable`, `salaries_payable`, `vat_payable` (liabilities) ·
`owner_equity`, `owner_drawings` (equity) ·
`service_revenue`, `product_revenue`, `other_income` (income) ·
`consumables_used`, `cost_of_goods_sold`, `salaries_expense`, `commission_expense`, `cash_over_short`,
one expense account per expense category (expenses).

## 7. RPC functions (the only way to change money or stock)

All `security definer`, check role with `has_role(business_id, roles[])`, run in one transaction, write audit log.

| Function | Journal |
|---|---|
| `create_sale(payload)` | Dr cash/card/wallet by payment, Dr deposits_held (deposit applied) · Cr service_revenue / product_revenue (net of discount, ex-VAT), Cr vat_payable (VAT on: inclusive, 5/105), Cr tips_payable. Plus recipe usage: Dr consumables_used, Cr inventory at avg cost; retail: Dr cost_of_goods_sold, Cr inventory |
| `refund_sale(sale_id, amount, method, reason, restock)` | Reverse revenue/VAT pro-rata, Cr cash/card/wallet; restock retail at original cost |
| `take_deposit(appointment_id, amount, method)` | Dr cash/card · Cr deposits_held |
| `settle_deposit(appointment_id, outcome)` | forfeit: Dr deposits_held · Cr other_income; refund: Dr deposits_held · Cr cash/card |
| `post_purchase_bill(payload)` | Dr inventory (stock lines) / Dr supplies expense (others) · Cr supplier_payable; updates weighted average cost |
| `reverse_purchase_bill(bill_id, reason)` | Mirror entry; stock out |
| `pay_supplier(payload)` | Dr supplier_payable · Cr cash/bank/card |
| `record_expense(payload)` / `reverse_expense(id, reason)` | Dr category expense account · Cr cash/card/bank (and mirror) |
| `adjust_stock(payload)` / `record_stock_count(payload)` / `set_opening_stock(payload)` | Loss: Dr consumables_used · Cr inventory; gain: mirror; opening: Dr inventory · Cr owner_equity |
| `set_opening_cash(branch_id, amount)` | Dr cash · Cr owner_equity |
| `record_advance(payload)` | Dr staff_advances · Cr cash/bank |
| `generate_payroll(period)` | Dr salaries_expense (base + bonus − deductions) and commission_expense · Cr salaries_payable (net) and Cr staff_advances (advances recovered) |
| `pay_payroll_line(line_id, method)` | Dr salaries_payable · Cr cash/bank |
| `pay_out_tips(payload)` | Dr tips_payable · Cr cash |
| `submit_cash_count(payload)` / `approve_cash_closing(id)` | On approve: short → Dr cash_over_short · Cr cash; over → mirror; taken out → Dr bank/owner_drawings · Cr cash |
| `close_period(month)` | Locks the period |
| Non-money: `check_in`, `start_service`, `mark_no_show`, `cancel_appointment`, `clock_in`, `clock_out` | Status changes + audit log |

Read helpers (SQL views or functions): `expected_cash(branch_id, date)`, `dashboard_today(branch_id)`,
`low_stock(branch_id)`, `compliance_status(business_id)`, `trial_balance(business_id, month)`,
`staff_sales(business_id, month)`, `available_slots(branch_id, date, service_ids, employee_id)`.

## 8. Security (RLS)

- Helpers: `current_member(business_id)`, `has_role(business_id, text[])`, `can_use_branch(branch_id)`.
- Every table: `select` allowed when the user is a member of the business and can use the branch, filtered further
  by the role matrix (e.g. `payroll_*` owner/accountant only; `employees.base_salary_minor` hidden from cashier via a view).
- Money tables: no `insert`/`update`/`delete` policies at all — only RPCs write.
- Storage buckets: `receipts`, `evidence`, `bills`, `avatars` — path prefix `business_id/…`, same membership check.
- SQL tests must cover: cashier cannot read payroll; staff sees masked phone; member of business A sees nothing of B;
  unbalanced journal is rejected; posting into a closed period is rejected; `create_sale` totals and stock deduction.

## 9. Seed data (`supabase/seed.sql`)

Two demo branches with realistic data so screens can be compared to the references:
- **Al Barsha Gents** (gents): services Haircut AED 25 (30 min), Shave 15, Beard Trim 10, Beard Color 45, Hair Color 80,
  Facial 60, Head Massage 35 with recipes; staff Rafiq, Sameer, Imran (barbers, 10–12%), Faisal (cashier);
  items Blades, Shaving Foam, Hair Oil, Developer 20 Vol, Beard Color, Hair Color, Gloves, Neck strips, Tissues,
  Trimming Machine, Scissors; a few days of sales, one pending cash shortage, two suppliers, expenses.
- **Jumeirah Ladies Salon & Spa** (ladies): Hair Styling, Blow-dry, Hair Color, Manicure, Pedicure, Gel Nails,
  Facial & Eye, Threading, Waxing, Bridal Makeup, Moroccan Bath, Swedish Massage; stylists and therapists; two spa rooms.
