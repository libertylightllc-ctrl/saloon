-- Platform console, Part B (owner's brief, 24 Nov 2026).
-- B6 Coming up: free periods and pilots ending in the next 7 days (each salon's own calendar), with the owner's
--    name, email, WhatsApp number (only if they agreed to WhatsApp) and the language they use the app in, so the
--    console can write to them in that language; and plan requests still waiting, with when they first asked.
--    Test, demo and closed salons are left out.
-- "Message owner" is logged here before WhatsApp or email opens: in Changes and in the salon's own history. The
--    server works out what is ending and when, and checks the owner can be reached that way. The record says a
--    message was opened, not sent: what happens in WhatsApp or the mail app is not known here.

create function public.admin_coming_up() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_ending jsonb;
  v_requests jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  with salons as (
    select b.id, b.name, b.code, b.timezone, s.free_until, public.business_today(b.id) as today,
           public.salon_status(b.closed_at, s.access_type, s.free_until, s.paid_until, public.business_today(b.id)) as status
    from businesses b join subscriptions s on s.business_id = b.id
    where not b.is_demo and b.closed_at is null
      and not exists (select 1 from test_salons t where t.business_id = b.id and t.test)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'business_id', x.id, 'name', x.name, 'code', x.code, 'timezone', x.timezone, 'status', x.status,
           'ends_on', x.free_until, 'days_left', x.free_until - x.today,
           'owner_name', case when u.deleted_at is null or m.display_name <> 'Deleted user' then m.display_name end,
           'email', case when u.deleted_at is null and u.email not like '%.staff.internal' then u.email::text end,
           'whatsapp', case when u.deleted_at is null and c.whatsapp_ok then c.phone end,
           'language', coalesce(ms.language, 'en'),
           'contacted_at', (select max(p.created_at) from platform_audit p where p.business_id = x.id and p.action = 'salon:contact'))
           order by x.free_until, x.name), '[]')
    into v_ending
  from salons x
  left join lateral (select * from members mm where mm.business_id = x.id and mm.role = 'owner'
                     order by mm.created_at limit 1) m on true
  left join auth.users u on u.id = m.user_id
  left join owner_contacts c on c.user_id = m.user_id
  left join member_seen ms on ms.member_id = m.id
  where x.status in ('free', 'pilot') and x.free_until between x.today and x.today + 7;

  -- A request is waiting until a payment or an ending comes after it (as the Salons list).
  select coalesce(jsonb_agg(jsonb_build_object('business_id', r.business_id, 'name', b.name, 'code', b.code,
                                               'timezone', b.timezone, 'first_asked_at', r.first_at,
                                               'last_asked_at', r.last_at, 'times', r.times, 'months', r.months,
                                               'waiting_days', extract(day from now() - r.first_at)::int)
                            order by r.first_at, b.name), '[]')
    into v_requests
  from (select e.business_id, min(e.created_at) as first_at, max(e.created_at) as last_at, count(*)::int as times,
               (array_agg(e.months order by e.created_at desc))[1] as months
        from plan_events e
        where e.kind = 'request'
          and not exists (select 1 from plan_events a where a.business_id = e.business_id and a.kind in ('activate', 'end')
                          and a.created_at > e.created_at)
        group by e.business_id) r
  join businesses b on b.id = r.business_id
  where not b.is_demo and b.closed_at is null
    and not exists (select 1 from test_salons t where t.business_id = b.id and t.test);

  return jsonb_build_object('ending', v_ending, 'requests', v_requests);
end;
$$;
revoke execute on function public.admin_coming_up() from public, anon;
grant execute on function public.admin_coming_up() to authenticated;

-- Logged before the console opens WhatsApp or email. Refused if nothing is ending, or the owner cannot be reached
-- that way (no WhatsApp consent, or no email).
create function public.admin_log_contact(p_business uuid, p_channel text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_until date;
  v_ok boolean;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_channel is null or p_channel not in ('whatsapp', 'email') then
    raise exception 'invalid_setting' using errcode = '22023';
  end if;
  select public.salon_status(b.closed_at, s.access_type, s.free_until, s.paid_until, public.business_today(b.id)), s.free_until
    into v_status, v_until
  from businesses b join subscriptions s on s.business_id = b.id
  where b.id = p_business;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_status not in ('free', 'pilot') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  select case when p_channel = 'whatsapp' then coalesce(c.whatsapp_ok, false)
              else u.email is not null and u.email not like '%.staff.internal' end
         and u.deleted_at is null
    into v_ok
  from members m join auth.users u on u.id = m.user_id
  left join owner_contacts c on c.user_id = m.user_id
  where m.business_id = p_business and m.role = 'owner'
  order by m.created_at limit 1;
  if not coalesce(v_ok, false) then
    raise exception 'invalid_setting' using errcode = '22023';
  end if;
  perform public.platform_audit_write('salon:contact', p_business, null, null,
    jsonb_build_object('channel', p_channel, 'ending', v_status, 'until', v_until));
  perform public.write_audit(p_business, null, null, 'message', 'owner_contact', null,
    'The platform owner opened a message to the salon owner by ' || case when p_channel = 'whatsapp' then 'WhatsApp' else 'email' end
    || ': the ' || case when v_status = 'pilot' then 'pilot' else 'free period' end || ' ends on ' || to_char(v_until, 'YYYY-MM-DD'));
end;
$$;
revoke execute on function public.admin_log_contact(uuid, text) from public, anon;
grant execute on function public.admin_log_contact(uuid, text) to authenticated;

-- The team writing to a salon is not the salon being used: B3 and B7 leave those rows out (migration 115).
create or replace function public.salon_last_active(p_business uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select greatest(
    (select max(u.last_sign_in_at) from members m join auth.users u on u.id = m.user_id where m.business_id = p_business),
    (select max(s.last_seen_at) from member_seen s where s.business_id = p_business),
    (select max(a.created_at) from audit_log a where a.business_id = p_business and a.entity_type <> 'owner_contact'))
$$;
