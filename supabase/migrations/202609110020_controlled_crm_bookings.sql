create or replace function salon_private.protect_controlled_crm() returns trigger
language plpgsql security definer set search_path = '' as $$
declare kind text := case when tg_op='DELETE' then old.record_type else new.record_type end;
begin
  if kind in ('customer','appointment','queue_ticket') and auth.uid() is not null
    and coalesce(current_setting('salon.crm_rpc',true),'') <> '1'
  then raise exception 'Customers and bookings must use the controlled CRM workflow'; end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function salon_private.protect_controlled_crm() from public;
drop trigger if exists salon_controlled_crm_guard on public.salon_records;
create trigger salon_controlled_crm_guard before insert or update or delete on public.salon_records
for each row execute function salon_private.protect_controlled_crm();

create or replace function public.salon_save_customer(target_shop uuid,customer_external_id text,customer_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); existing public.salon_records%rowtype; duplicate_record public.salon_records%rowtype;
  customer_name text := trim(coalesce(customer_data->>'name',''));
  customer_phone text := trim(coalesce(customer_data->>'phone',''));
  normalized_phone text := regexp_replace(customer_phone,'[^0-9+]','','g');
  normalized_customer jsonb;
begin
  if actor is null or not (
    (salon_private.is_platform_admin() and exists(select 1 from public.salon_shops where id=target_shop and status='active'))
    or salon_private.has_shop_role(target_shop,array['owner','shop_admin','cashier'])
  ) then raise exception 'Front desk authorization is required to manage customers'; end if;
  if length(trim(coalesce(customer_external_id,'')))<3 then raise exception 'Customer reference is required'; end if;
  if length(customer_name) not between 1 and 160 then raise exception 'Customer name is required'; end if;
  if length(customer_phone)>40 or length(coalesce(customer_data->>'preference',''))>500
    or length(coalesce(customer_data->>'riskNote',''))>1000 then raise exception 'Customer details are too long'; end if;
  select * into existing from public.salon_records where shop_id=target_shop and record_type='customer'
    and external_id=customer_external_id and deleted_at is null for update;
  if normalized_phone<>'' then
    select * into duplicate_record from public.salon_records where shop_id=target_shop and record_type='customer'
      and external_id<>customer_external_id and deleted_at is null
      and regexp_replace(coalesce(data->>'phone',''),'[^0-9+]','','g')=normalized_phone limit 1;
    if found then raise exception 'A customer with this phone number already exists'; end if;
  end if;
  normalized_customer := jsonb_build_object(
    'id',customer_external_id,'name',customer_name,'phone',customer_phone,
    'preference',trim(coalesce(customer_data->>'preference','')),
    'riskNote',trim(coalesce(customer_data->>'riskNote','')),
    'visits',coalesce((existing.data->>'visits')::integer,0),
    'noShows',coalesce((existing.data->>'noShows')::integer,0),
    'lastVisit',coalesce(existing.data->>'lastVisit',''),
    'updatedAt',now(),'updatedBy',actor::text
  );
  if existing.id is null then normalized_customer := normalized_customer || jsonb_build_object('createdAt',now(),'createdBy',actor::text);
  else normalized_customer := normalized_customer || jsonb_build_object('createdAt',coalesce(existing.data->>'createdAt',existing.created_at::text)); end if;
  perform set_config('salon.crm_rpc','1',true);
  if existing.id is null then
    insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
    values(target_shop,'customer',customer_external_id,normalized_customer,actor);
  else update public.salon_records set data=normalized_customer where id=existing.id; end if;
  return jsonb_build_object('ok',true,'customer',normalized_customer);
end;
$$;
revoke all on function public.salon_save_customer(uuid,text,jsonb) from public,anon;
grant execute on function public.salon_save_customer(uuid,text,jsonb) to authenticated;

create or replace function public.salon_record_booking(target_shop uuid,ticket_external_id text,ticket_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); customer_record public.salon_records%rowtype; service_record public.salon_records%rowtype;
  visit_type text := coalesce(ticket_data->>'type',''); visit_date date; visit_time time;
  deposit_amount numeric := coalesce((ticket_data->>'deposit')::numeric,0); service_price numeric;
  staff_name text := trim(coalesce(ticket_data->>'staff','Any staff')); authoritative jsonb;
begin
  if actor is null or not (
    (salon_private.is_platform_admin() and exists(select 1 from public.salon_shops where id=target_shop and status='active'))
    or salon_private.has_shop_role(target_shop,array['owner','shop_admin','cashier'])
  ) then raise exception 'Front desk authorization is required to create bookings'; end if;
  if length(trim(coalesce(ticket_external_id,'')))<3 then raise exception 'Booking reference is required'; end if;
  if visit_type not in ('Walk-in','Appointment') then raise exception 'Visit type is invalid'; end if;
  visit_date := coalesce(nullif(ticket_data->>'date','')::date,current_date);
  visit_time := coalesce(nullif(ticket_data->>'time','')::time,current_time::time);
  if visit_type='Appointment' and visit_date<current_date-1 then raise exception 'Appointments cannot be booked in the past'; end if;
  if deposit_amount<0 then raise exception 'Booking deposit is invalid'; end if;
  if visit_type<>'Appointment' and deposit_amount<>0 then raise exception 'Deposits are only allowed for appointments'; end if;
  if deposit_amount>0 and coalesce(ticket_data->>'depositPayment','') not in ('Cash','Card','Wallet') then raise exception 'Deposit payment method is invalid'; end if;
  if coalesce(ticket_data->>'cancellationPolicy','refund') not in ('refund','forfeit') then raise exception 'Cancellation policy is invalid'; end if;
  select * into customer_record from public.salon_records where shop_id=target_shop and record_type='customer'
    and external_id=ticket_data->>'customerId' and deleted_at is null;
  if not found then raise exception 'Customer not found'; end if;
  select * into service_record from public.salon_records where shop_id=target_shop and record_type='service'
    and deleted_at is null and coalesce((data->>'active')::boolean,true)
    and (external_id=coalesce(ticket_data->>'serviceId','') or data->>'name'=ticket_data->>'service') limit 1;
  if not found then raise exception 'Active service not found'; end if;
  service_price := coalesce((service_record.data->>'price')::numeric,0);
  if deposit_amount>service_price then raise exception 'Booking deposit cannot exceed the service price'; end if;
  if exists(select 1 from public.salon_records where shop_id=target_shop and record_type='queue_ticket'
    and external_id=ticket_external_id and deleted_at is null) then
    select data into authoritative from public.salon_records where shop_id=target_shop and record_type='queue_ticket'
      and external_id=ticket_external_id and deleted_at is null;
    return jsonb_build_object('ok',true,'idempotent',true,'ticket',authoritative);
  end if;
  if visit_type='Appointment' and staff_name<>'Any staff' and exists(
    select 1 from public.salon_records where shop_id=target_shop and record_type='queue_ticket' and deleted_at is null
      and data->>'type'='Appointment' and data->>'staff'=staff_name and data->>'date'=visit_date::text
      and data->>'time'=to_char(visit_time,'HH24:MI') and data->>'status' in ('Booked','Waiting','In chair')
  ) then raise exception 'This staff member is already booked at that time'; end if;
  authoritative := jsonb_build_object(
    'id',ticket_external_id,'customerId',customer_record.external_id,'serviceId',service_record.external_id,
    'service',service_record.data->>'name','staff',staff_name,'type',visit_type,'date',visit_date::text,
    'time',to_char(visit_time,'HH24:MI'),'deposit',deposit_amount,
    'depositPayment',case when deposit_amount>0 then ticket_data->>'depositPayment' else '' end,
    'depositStatus',case when deposit_amount>0 then 'Held' else 'None' end,
    'cancellationPolicy',coalesce(ticket_data->>'cancellationPolicy','refund'),
    'status',case when visit_type='Appointment' then 'Booked' else 'Waiting' end,
    'createdAt',now(),'createdBy',actor::text
  );
  perform set_config('salon.crm_rpc','1',true);
  insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
  values(target_shop,'queue_ticket',ticket_external_id,authoritative,actor);
  if visit_type='Appointment' then insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
    values(target_shop,'appointment',ticket_external_id,authoritative,actor); end if;
  return jsonb_build_object('ok',true,'idempotent',false,'ticket',authoritative);
end;
$$;
revoke all on function public.salon_record_booking(uuid,text,jsonb) from public,anon;
grant execute on function public.salon_record_booking(uuid,text,jsonb) to authenticated;

create or replace function public.salon_update_booking_status(target_shop uuid,ticket_external_id text,next_status text,action_reason text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role text; ticket_record public.salon_records%rowtype; updated_ticket jsonb;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if salon_private.is_platform_admin() then
    if not exists(select 1 from public.salon_shops where id=target_shop and status='active') then raise exception 'Shop is not active'; end if;
    actor_role := 'platform_admin';
  else
    select membership.role into actor_role from public.salon_memberships membership
    join public.salon_shops shop on shop.id=membership.shop_id
    where membership.shop_id=target_shop and membership.user_id=actor and membership.active and shop.status='active';
  end if;
  if actor_role is null or actor_role not in ('platform_admin','owner','shop_admin','cashier','staff') then raise exception 'Not authorized for this booking'; end if;
  select * into ticket_record from public.salon_records where shop_id=target_shop and record_type='queue_ticket'
    and external_id=ticket_external_id and deleted_at is null for update;
  if not found then raise exception 'Booking not found'; end if;
  if ticket_record.data->>'status'=next_status then return jsonb_build_object('ok',true,'idempotent',true,'ticket',ticket_record.data); end if;
  if next_status in ('Cancelled','No-show') and actor_role='staff' then raise exception 'Front desk authorization is required for cancellation or no-show'; end if;
  if next_status in ('Cancelled','No-show') and length(trim(coalesce(action_reason,'')))<3 then raise exception 'Cancellation or no-show reason is required'; end if;
  if not (
    (ticket_record.data->>'status'='Booked' and next_status in ('Waiting','Cancelled','No-show'))
    or (ticket_record.data->>'status'='Waiting' and next_status in ('In chair','Cancelled','No-show'))
    or (ticket_record.data->>'status' in ('Completed','Cancelled','No-show') and next_status='Archived')
  ) then raise exception 'Invalid booking status transition'; end if;
  updated_ticket := ticket_record.data || jsonb_build_object('status',next_status,'updatedAt',now(),'updatedBy',actor::text);
  if next_status in ('Cancelled','No-show') then
    updated_ticket := updated_ticket || jsonb_build_object(
      'depositStatus',case when coalesce((ticket_record.data->>'deposit')::numeric,0)=0 then 'None'
        when next_status='No-show' or coalesce(ticket_record.data->>'cancellationPolicy','refund')='forfeit' then 'Forfeited' else 'Refunded' end,
      'cancelledAt',now(),'cancelledBy',actor::text,'cancellationReason',trim(action_reason)
    );
  end if;
  perform set_config('salon.crm_rpc','1',true);
  update public.salon_records set data=updated_ticket where id=ticket_record.id;
  update public.salon_records set data=updated_ticket where shop_id=target_shop and record_type='appointment'
    and external_id=ticket_external_id and deleted_at is null;
  if next_status='No-show' then update public.salon_records set data=data || jsonb_build_object(
    'noShows',coalesce((data->>'noShows')::integer,0)+1,'updatedAt',now(),'updatedBy',actor::text)
    where shop_id=target_shop and record_type='customer' and external_id=ticket_record.data->>'customerId' and deleted_at is null; end if;
  return jsonb_build_object('ok',true,'ticket',updated_ticket);
end;
$$;
revoke all on function public.salon_update_booking_status(uuid,text,text,text) from public,anon;
grant execute on function public.salon_update_booking_status(uuid,text,text,text) to authenticated;

create or replace function salon_private.apply_sale_to_customer_booking() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ticket_record public.salon_records%rowtype; deposit_expected numeric; booking_id text := coalesce(new.data->>'bookingId',''); customer_id text := coalesce(new.data->>'customerId','');
begin
  if new.record_type<>'sale' then return new; end if;
  if booking_id<>'' then
    select * into ticket_record from public.salon_records where shop_id=new.shop_id and record_type='queue_ticket'
      and external_id=booking_id and deleted_at is null for update;
    if not found or ticket_record.data->>'status' not in ('Booked','Waiting','In chair') then raise exception 'Selected booking is not available'; end if;
    if ticket_record.data->>'customerId'<>customer_id then raise exception 'Booking customer does not match the sale'; end if;
    deposit_expected := least(coalesce((ticket_record.data->>'deposit')::numeric,0),coalesce((new.data->>'amount')::numeric,0));
    if abs(coalesce((new.data->>'depositApplied')::numeric,0)-deposit_expected)>0.0005 then raise exception 'Booking deposit does not match the held balance'; end if;
    if deposit_expected>0 and ticket_record.data->>'depositStatus'<>'Held' then raise exception 'Booking deposit is not available'; end if;
  end if;
  perform set_config('salon.crm_rpc','1',true);
  if booking_id<>'' then
    update public.salon_records set data=data || jsonb_build_object('status','Completed','depositStatus',case when deposit_expected>0 then 'Redeemed' else 'None' end,
      'saleId',new.external_id,'completedAt',coalesce(new.data->>'createdAt',now()::text),'updatedAt',now())
      where id=ticket_record.id;
    update public.salon_records set data=data || jsonb_build_object('status','Completed','depositStatus',case when deposit_expected>0 then 'Redeemed' else 'None' end,
      'saleId',new.external_id,'completedAt',coalesce(new.data->>'createdAt',now()::text),'updatedAt',now())
      where shop_id=new.shop_id and record_type='appointment' and external_id=booking_id and deleted_at is null;
  end if;
  if customer_id<>'' and customer_id<>'walk-in-guest' then update public.salon_records set data=data || jsonb_build_object(
    'visits',coalesce((data->>'visits')::integer,0)+1,'lastVisit',left(coalesce(new.data->>'createdAt',now()::text),10),'updatedAt',now())
    where shop_id=new.shop_id and record_type='customer' and external_id=customer_id and deleted_at is null; end if;
  return new;
end;
$$;
revoke all on function salon_private.apply_sale_to_customer_booking() from public;
drop trigger if exists salon_sale_customer_booking on public.salon_records;
create trigger salon_sale_customer_booking after insert on public.salon_records
for each row when (new.record_type='sale') execute function salon_private.apply_sale_to_customer_booking();
