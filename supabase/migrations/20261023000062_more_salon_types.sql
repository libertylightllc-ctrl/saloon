-- Two more salon types (website brief 5.4, owner 2026-10-23: "finish all in one sweep"; docs/SALON-TYPES-PLAN.md):
-- a unisex salon and a beauty & wellness studio (nails, lashes and brows, skincare, massage). Added here on their own:
-- a new value can be used only after the change that adds it is committed (migration 63 uses them).
alter type public.salon_mode add value if not exists 'unisex';
alter type public.salon_mode add value if not exists 'wellness';
