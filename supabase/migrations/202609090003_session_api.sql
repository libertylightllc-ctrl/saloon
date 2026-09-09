create or replace function public.salon_session()
returns table(user_id uuid, shop_id uuid, shop_code text, shop_name text, role text)
language sql stable security definer set search_path = '' as $$
  select auth.uid(), null::uuid, 'PLATFORM'::text, 'Salon Control'::text, 'platform_admin'::text
  where salon_private.is_platform_admin()
  union all
  select auth.uid(), s.id, s.code, s.name, m.role
  from public.salon_memberships m
  join public.salon_shops s on s.id=m.shop_id
  where m.user_id=auth.uid() and m.active and s.status='active'
    and not salon_private.is_platform_admin();
$$;
revoke all on function public.salon_session() from public,anon;
grant execute on function public.salon_session() to authenticated;

create or replace function salon_private.can_write_record(target uuid, kind text, creator uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select salon_private.has_shop_role(target,array['owner','shop_admin'])
    or (salon_private.has_shop_role(target,array['cashier']) and kind in (
      'customer','appointment','queue_ticket','sale','purchase','expense','inventory_item','cash_closing'
    ))
    or (salon_private.has_shop_role(target,array['staff']) and (
      kind='queue_ticket' or (kind='sale' and creator=(select auth.uid()))
    ));
$$;
revoke all on function salon_private.can_write_record(uuid,text,uuid) from public;
grant execute on function salon_private.can_write_record(uuid,text,uuid) to authenticated;
