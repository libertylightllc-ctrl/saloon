-- The price on the website (the terms say plans cost "the price shown on our website"): visitors may read the plan
-- prices and their currencies — only those four columns; the bank details for paying stay for signed-in salons.
create policy "visitors read the price" on public.platform_settings for select to anon using (true);
grant select (price_per_branch_minor, currency, intl_price_per_branch_minor, intl_currency) on public.platform_settings to anon;
