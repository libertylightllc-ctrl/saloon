-- Owner's app check E7: a stylist opening their own sale saw "Part refunded" but not the refund itself. They may now
-- read the refunds of the sales they can open as their own (the sales rule's "own" part: the sale is theirs), to
-- see the amount, the reason and what it took back from their commission and tip. Read only: refunding stays with
-- the owner, a manager, or the front desk with a PIN. Inside the check the sales rule applies too, so only a sale
-- they can open in a branch they work in counts.
create policy "stylists read refunds of their own sales" on public.refunds for select to authenticated
  using (exists (select 1 from public.sales s
                 where s.id = refunds.sale_id and s.employee_id in (select public.my_employee_ids())));
