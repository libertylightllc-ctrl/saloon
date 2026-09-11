alter function public.salon_record_sale(uuid,text,jsonb,jsonb) rename to salon_record_sale_staff_internal;
revoke all on function public.salon_record_sale_staff_internal(uuid,text,jsonb,jsonb) from public,anon,authenticated;

create function public.salon_record_sale(
  target_shop uuid,
  sale_external_id text,
  sale_data jsonb,
  stock_usage jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  staff_profile public.salon_records%rowtype;
begin
  select membership.role into actor_role
  from public.salon_memberships membership
  join public.salon_shops shop on shop.id=membership.shop_id
  where membership.shop_id=target_shop and membership.user_id=actor
    and membership.active and shop.status='active';

  if actor_role='staff' then
    select * into staff_profile
    from public.salon_records
    where shop_id=target_shop and record_type='staff_profile' and deleted_at is null
      and coalesce((data->>'active')::boolean,true) and data->>'userId'=actor::text
    limit 1;
    if not found then raise exception 'An active staff profile is required to record sales'; end if;
    sale_data := sale_data || jsonb_build_object(
      'staff',staff_profile.data->>'name',
      'staffId',staff_profile.external_id
    );
  end if;

  perform set_config('salon.inventory_rpc','1',true);
  return public.salon_record_sale_staff_internal(target_shop,sale_external_id,sale_data,stock_usage);
end;
$$;

revoke all on function public.salon_record_sale(uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.salon_record_sale(uuid,text,jsonb,jsonb) to authenticated;
