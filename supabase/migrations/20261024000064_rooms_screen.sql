-- The salon's rooms (2026-10-24; the gap found with website brief 5.4): until now rooms came only from the starter set
-- of a ladies salon or a beauty & wellness studio and could not be added or renamed. The owner now adds, renames, and
-- stops or starts using rooms in Branch settings. A room is never deleted: past bookings keep pointing at it.

create function public.save_room(p_branch uuid, p_room uuid, p_name text, p_active boolean default true) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  m members := public.require_member(p_branch, array['owner']::member_role[]);
  v_name text := btrim(coalesce(p_name, ''));
  v_active boolean := coalesce(p_active, true);
  v_id uuid;
begin
  if v_name = '' or length(v_name) > 40 then
    raise exception 'room_name_required' using errcode = '22023';
  end if;
  if v_active and exists (select 1 from rooms r where r.branch_id = p_branch and r.active and lower(r.name) = lower(v_name)
                          and r.id is distinct from p_room) then
    raise exception 'room_taken' using errcode = '23505';
  end if;
  if p_room is null then
    insert into rooms (business_id, branch_id, name, kind, active) values (m.business_id, p_branch, v_name, 'room', v_active)
    returning id into v_id;
  else
    update rooms set name = v_name, active = v_active where id = p_room and branch_id = p_branch returning id into v_id;
    if v_id is null then
      raise exception 'not_found' using errcode = 'P0002';
    end if;
  end if;
  perform public.write_audit(m.business_id, p_branch, m.id, case when p_room is null then 'create' else 'update' end, 'room', v_id,
    case when p_room is null then 'Added the room ' || v_name
         when v_active then 'Room ' || v_name
         else 'Stopped using the room ' || v_name end);
  return v_id;
end;
$$;
revoke execute on function public.save_room(uuid, uuid, text, boolean) from public, anon;
