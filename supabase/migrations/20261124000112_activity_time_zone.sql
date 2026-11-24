-- Platform console, Part A (owner's brief, 24 Nov 2026).
--
-- A9. Console → Activity showed every salon's events in Dubai time: a Red Rose (Qatar) event at 11:20 PM on 16 Nov
-- read "17 Nov 2026 · 1:20 AM". Each event now comes with its salon's time zone, so the console shows it at the
-- salon's own time and place ("16 Nov 2026 · 11:20 PM Doha"). Reads only.
drop function public.admin_activity(uuid, integer);
create function public.admin_activity(p_business uuid default null, p_limit integer default 200)
returns table (id uuid, business_id uuid, salon text, actor text, action text, entity_type text, summary text,
               created_at timestamptz, timezone text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select l.id, l.business_id, b.name, m.display_name, l.action, l.entity_type, l.summary, l.created_at,
           coalesce(b.timezone, 'Asia/Dubai')
    from audit_log l
    join businesses b on b.id = l.business_id
    left join members m on m.id = l.actor_member_id
    where p_business is null or l.business_id = p_business
    order by l.created_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end;
$$;
revoke execute on function public.admin_activity(uuid, integer) from public, anon;
grant execute on function public.admin_activity(uuid, integer) to authenticated;
