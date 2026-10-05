-- The plan price (owner, 2026-10-06: "need to change price equivalent to 50 aed"): AED 50 a branch a month in the UAE,
-- and USD 13.99 elsewhere (AED 50 is USD 13.61 at the dirham's fixed rate; the owner chose 13.99).
-- Salons already paid up keep their months; the new price applies from their next payment.
alter table public.platform_settings alter column price_per_branch_minor set default 5000;
alter table public.platform_settings alter column intl_price_per_branch_minor set default 1399;
update public.platform_settings set price_per_branch_minor = 5000, intl_price_per_branch_minor = 1399;
