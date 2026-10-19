-- The salon's logo at the top of every receipt (owner, 2026-10-19: "the easiest way to add the salon logo in the
-- receipt"). The phone shrinks the picture to receipt size and keeps PNG's see-through background; it goes to the
-- public `logos` bucket (a logo is meant to be seen, and the receipt link page opens without signing in) under the
-- business's folder. Only the owner adds or changes it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "owner uploads logos" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] in (
    select m.business_id::text from public.members m where m.user_id = auth.uid() and m.active and m.role = 'owner'));

alter table public.branches add column logo_path text;

-- Puts an uploaded logo on the branch's receipts, or takes it off (null). Owner.
create function public.set_branch_logo(p_branch uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner']::member_role[]);
begin
  if p_path is not null and (split_part(p_path, '/', 1) <> m.business_id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'logos' and o.name = p_path)) then
    raise exception 'logo_missing' using errcode = '22023';
  end if;
  update branches set logo_path = p_path where id = p_branch;
  perform public.write_audit(m.business_id, p_branch, m.id, 'update', 'branch', p_branch,
    case when p_path is null then 'Took the logo off receipts' else 'Put a logo on receipts' end);
end;
$$;
revoke execute on function public.set_branch_logo(uuid, text) from public, anon;

-- The receipt link page shows the logo too.
create or replace function public.public_receipt(p_token text) returns jsonb
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
      'tax2_name', s.tax2_name, 'tax2_rate_bps', s.tax2_rate_bps, 'tax2_minor', s.tax2_minor,
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
      'legal_name', b.legal_name, 'licence_label', b.licence_label, 'licence_number', b.licence_number,
      'logo_path', b.logo_path));
end;
$$;
