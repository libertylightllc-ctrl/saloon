-- The receipt as a link (owner, 2026-10-19: "from the owner's WhatsApp, how can we send it in PDF format, free?"; no
-- preference between a link and the file, so the link): every sale gets a secret, unguessable token, and the WhatsApp
-- receipt (sent from the salon's own WhatsApp, free) ends with saloqo.com/r/<token>, where the customer sees the
-- receipt and downloads it as a PDF. Anyone holding the link sees that one receipt, as on paper; nothing else.

-- 18 random bytes, URL-safe base64: 24 characters. A volatile default fills every existing sale with its own token.
alter table public.sales
  add column receipt_token text not null unique
    default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_');

-- One receipt for the holder of its link: the sale as printed (lines, payments, tax, who served) and the seller's
-- details (salon, branch, tax number, company name, licence). Null for an unknown link.
create function public.public_receipt(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s sales;
  b branches;
  bu businesses;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{24}$' then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  select * into s from sales where receipt_token = p_token;
  if s.id is null then
    return null;
  end if;
  select * into b from branches where id = s.branch_id;
  select * into bu from businesses where id = s.business_id;
  return jsonb_build_object(
    'sale', jsonb_build_object(
      'number', s.number, 'created_at', s.created_at, 'customer_name', s.customer_name,
      'subtotal_minor', s.subtotal_minor, 'discount_minor', s.discount_minor, 'vat_mode', s.vat_mode,
      'vat_minor', s.vat_minor, 'tax_rate_bps', s.tax_rate_bps, 'tax_inclusive', s.tax_inclusive,
      'tip_minor', s.tip_minor, 'total_minor', s.total_minor, 'deposit_applied_minor', s.deposit_applied_minor,
      'refunded_minor', s.refunded_minor,
      'employees', (select jsonb_build_object('full_name', e.full_name) from employees e where e.id = s.employee_id),
      'sale_lines', coalesce((select jsonb_agg(jsonb_build_object(
          'qty', l.qty, 'name_snapshot', l.name_snapshot, 'unit_price_minor', l.unit_price_minor,
          'employees', (select jsonb_build_object('full_name', e.full_name) from employees e where e.id = l.employee_id)))
          from sale_lines l where l.sale_id = s.id), '[]'),
      'sale_payments', coalesce((select jsonb_agg(jsonb_build_object('method', p.method, 'amount_minor', p.amount_minor))
          from sale_payments p where p.sale_id = s.id), '[]')),
    'seller', jsonb_build_object(
      'business_name', bu.name, 'country_code', bu.country_code, 'currency', bu.currency, 'timezone', bu.timezone,
      'branch_name', b.name, 'address', b.address, 'phone', b.phone,
      'trn', case when s.vat_mode = 'on' then b.trn end, 'tax_name', b.tax_name, 'tax_id_label', b.tax_id_label,
      'legal_name', b.legal_name, 'licence_label', b.licence_label, 'licence_number', b.licence_number));
end;
$$;
revoke execute on function public.public_receipt(text) from public;
grant execute on function public.public_receipt(text) to anon, authenticated;
