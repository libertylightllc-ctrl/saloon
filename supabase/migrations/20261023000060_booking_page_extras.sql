-- The booking page, fuller (website brief 5.1, 2026-10-23): an optional cover photo and the salon's Instagram, set in
-- Branch settings → Online booking, and shown on the public page with the logo, address, open days and a map link.
-- The cover photo is kept like the receipt logo: the public `logos` bucket, under the business's folder.

alter table public.branches
  add column instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  add column cover_path text;

-- The salon's Instagram: a handle ("@albarsha.gents", "albarsha.gents") or a profile link; kept as the handle. Blank
-- removes it.
create function public.set_branch_instagram(p_branch uuid, p_instagram text) returns text
language plpgsql security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner']::member_role[]);
  v text := btrim(coalesce(p_instagram, ''));
begin
  v := regexp_replace(v, '^(https?://)?(www\.)?(instagram\.com|instagr\.am)/', '', 'i');
  v := regexp_replace(regexp_replace(v, '^@', ''), '[/?#].*$', '');
  if v = '' then
    v := null;
  elsif v !~ '^[A-Za-z0-9._]{1,30}$' then
    raise exception 'invalid_instagram' using errcode = '22023';
  end if;
  update branches set instagram = v where id = p_branch;
  perform public.write_audit(m.business_id, p_branch, m.id, 'update', 'branch', p_branch,
    case when v is null then 'Took Instagram off the booking page' else 'Instagram on the booking page: @' || v end);
  return v;
end;
$$;
revoke execute on function public.set_branch_instagram(uuid, text) from public, anon;

-- The cover photo at the top of the booking page; null takes it off.
create function public.set_branch_cover(p_branch uuid, p_path text) returns void
language plpgsql security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner']::member_role[]);
begin
  if p_path is not null and (split_part(p_path, '/', 1) <> m.business_id::text
     or not exists (select 1 from storage.objects o where o.bucket_id = 'logos' and o.name = p_path)) then
    raise exception 'photo_missing' using errcode = '22023';
  end if;
  update branches set cover_path = p_path where id = p_branch;
  perform public.write_audit(m.business_id, p_branch, m.id, 'update', 'branch', p_branch,
    case when p_path is null then 'Took the cover photo off the booking page' else 'Put a cover photo on the booking page' end);
end;
$$;
revoke execute on function public.set_branch_cover(uuid, text) from public, anon;

-- The public page carries both.
create or replace function public.public_booking_page(p_slug text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  b branches := public.booking_branch(p_slug);
  bu businesses;
begin
  if b.id is null then
    return null;
  end if;
  select * into bu from businesses where id = b.business_id;
  return jsonb_build_object(
    'salon', jsonb_build_object(
      'business_name', bu.name, 'branch_name', b.name, 'mode', b.mode, 'address', b.address, 'phone', b.phone,
      'logo_path', b.logo_path, 'cover_path', b.cover_path, 'instagram', b.instagram,
      'open_days', b.opening_hours -> 'days', 'currency', bu.currency, 'timezone', bu.timezone,
      'country_code', bu.country_code, 'today', public.branch_today(b.id),
      'cancel_cutoff_hours', coalesce((b.settings ->> 'cancel_cutoff_hours')::int, 12),
      'tax_added', b.vat_mode = 'on' and not b.tax_inclusive and b.tax_rate_bps > 0, 'tax_name', b.tax_name),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'translations', c.translations)
                                             order by c.sort, c.name)
                            from service_categories c where c.business_id = b.business_id and not c.archived
                              and exists (select 1 from services s where s.category_id = c.id and s.status = 'active')), '[]'),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'category_id', s.category_id, 'name', s.name,
                                             'translations', s.translations, 'price_minor', s.price_minor,
                                             'duration_min', s.duration_min) order by s.name)
                          from services s where s.business_id = b.business_id and s.status = 'active'), '[]'),
    'staff', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'name', public.public_staff_name(e.full_name))
                                        order by e.full_name)
                       from employees e where e.branch_id = b.id and e.active and e.role_title <> 'cashier'), '[]'));
end;
$$;
