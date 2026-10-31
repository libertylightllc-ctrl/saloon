-- Owner's fix list (final brief, 31 Oct 2026) A4: the WhatsApp number and its ready message become a platform setting,
-- set in Console → Settings → Contact, instead of an empty value in the app's code. Everyone may read them (the
-- homepage's round button and footer link, the app's "WhatsApp us"); only platform owners change them, and each
-- change goes to Console → Changes. Nothing existing is changed or removed.

-- 1. The setting. The number stays empty until a platform owner types one; everything that uses it stays hidden till then.
alter table public.platform_settings
  add column whatsapp_number text not null default ''
    check (whatsapp_number = '' or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$'),
  add column whatsapp_message text not null default 'Hi Saloqo, I''d like to know more about the pilot for my salon.'
    check (char_length(btrim(whatsapp_message)) between 1 and 300);

-- 2. Saving it (platform owners). The number as typed ("+971 50 123 4567", "00971 50…") is kept as +971501234567; an
--    empty box takes the number away; an empty message goes back to the default. A change is logged, before and after.
create function public.admin_set_contact(p_number text, p_message text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_number text := regexp_replace(coalesce(p_number, ''), '[[:space:]().-]', '', 'g');
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_before jsonb;
  v_after jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_number like '00%' then
    v_number := '+' || substr(v_number, 3);
  end if;
  if v_number <> '' and v_number !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if char_length(v_message) > 300 then
    raise exception 'invalid_setting' using errcode = '22023';
  end if;
  select jsonb_build_object('whatsapp_number', whatsapp_number, 'whatsapp_message', whatsapp_message)
    into v_before from platform_settings;
  update platform_settings set whatsapp_number = v_number, whatsapp_message = coalesce(v_message, whatsapp_message) where id;
  if v_message is null then
    update platform_settings set whatsapp_message = default where id;
  end if;
  select jsonb_build_object('whatsapp_number', whatsapp_number, 'whatsapp_message', whatsapp_message)
    into v_after from platform_settings;
  if v_after is distinct from v_before then
    perform public.platform_audit_write('settings:contact', null, null, v_before, v_after);
  end if;
  return v_after;
end;
$$;

-- 3. Reading it (anyone, also visitors who are not signed in): the homepage reads it when it is built and again when
--    it opens, as it does the pilot's places.
create function public.site_contact() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('whatsapp_number', ps.whatsapp_number, 'whatsapp_message', ps.whatsapp_message)
  from platform_settings ps;
$$;

revoke execute on function public.admin_set_contact(text, text), public.site_contact() from public, anon, authenticated;
grant execute on function public.admin_set_contact(text, text) to authenticated;
grant execute on function public.site_contact() to anon, authenticated;
