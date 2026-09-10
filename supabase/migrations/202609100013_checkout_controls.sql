create or replace function public.salon_record_sale(
  target_shop uuid,
  sale_external_id text,
  sale_data jsonb,
  stock_usage jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  usage_line jsonb;
  payment_line jsonb;
  inventory_record public.salon_records%rowtype;
  requested numeric;
  available numeric;
  movement_id text;
  subtotal numeric := coalesce((sale_data->>'subtotal')::numeric,(sale_data->>'amount')::numeric,0);
  discount numeric := coalesce((sale_data->>'discount')::numeric,0);
  tip numeric := coalesce((sale_data->>'tip')::numeric,0);
  revenue_amount numeric;
  sale_amount numeric;
  deposit_applied numeric := coalesce((sale_data->>'depositApplied')::numeric,0);
  amount_paid numeric;
  tender_total numeric := 0;
  cash_total numeric := 0;
  normalized_payments jsonb := coalesce(sale_data->'paymentLines','[]'::jsonb);
  catalog_subtotal numeric;
  catalog_count integer;
  requested_service_count integer;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if salon_private.is_platform_admin() then
    actor_role := 'platform_admin';
    if not exists (select 1 from public.salon_shops where id=target_shop and status='active') then
      raise exception 'Not authorized for this shop';
    end if;
  else
    select membership.role into actor_role
    from public.salon_memberships membership
    join public.salon_shops shop on shop.id=membership.shop_id
    where membership.shop_id=target_shop and membership.user_id=actor
      and membership.active and shop.status='active';
    if actor_role is null then raise exception 'Not authorized for this shop'; end if;
  end if;

  if exists (
    select 1 from public.salon_records
    where shop_id=target_shop and record_type='sale' and external_id=sale_external_id and deleted_at is null
  ) then return jsonb_build_object('ok',true,'idempotent',true); end if;

  revenue_amount := subtotal-discount;
  sale_amount := revenue_amount+tip;
  amount_paid := sale_amount-deposit_applied;
  if subtotal <= 0 or discount < 0 or discount > subtotal or tip < 0 or deposit_applied < 0 or amount_paid < 0 then
    raise exception 'Sale totals are invalid';
  end if;
  if abs(sale_amount-coalesce((sale_data->>'amount')::numeric,0)) > 0.0005 then
    raise exception 'Sale total does not match subtotal, discount and tip';
  end if;
  if sale_data ? 'serviceIds' then
    if jsonb_typeof(sale_data->'serviceIds') <> 'array' or jsonb_array_length(sale_data->'serviceIds')=0 then
      raise exception 'At least one service is required';
    end if;
    requested_service_count := jsonb_array_length(sale_data->'serviceIds');
    select coalesce(sum((record.data->>'price')::numeric),0),count(*)
      into catalog_subtotal,catalog_count
    from public.salon_records record
    where record.shop_id=target_shop and record.record_type='service' and record.deleted_at is null
      and coalesce((record.data->>'active')::boolean,true)
      and record.external_id in (select jsonb_array_elements_text(sale_data->'serviceIds'));
    if catalog_count <> requested_service_count or abs(catalog_subtotal-subtotal) > 0.0005 then
      raise exception 'Service subtotal does not match the active catalog';
    end if;
  end if;
  if discount > 0 and actor_role not in ('platform_admin','owner','shop_admin') then
    raise exception 'Management approval is required for discounts';
  end if;
  if discount > 0 and length(trim(coalesce(sale_data->>'discountReason',''))) < 3 then
    raise exception 'Discount reason is required';
  end if;
  if jsonb_typeof(stock_usage) <> 'array' or jsonb_typeof(normalized_payments) <> 'array' then
    raise exception 'Stock usage and payment lines must be arrays';
  end if;

  if jsonb_array_length(normalized_payments)=0 and amount_paid > 0 then
    normalized_payments := jsonb_build_array(jsonb_build_object(
      'method',coalesce(sale_data->>'payment','Cash'),'amount',amount_paid
    ));
  end if;
  for payment_line in select value from jsonb_array_elements(normalized_payments)
  loop
    if coalesce(payment_line->>'method','') not in ('Cash','Card','Wallet') then raise exception 'Invalid payment method'; end if;
    requested := coalesce((payment_line->>'amount')::numeric,0);
    if requested <= 0 then raise exception 'Payment amounts must be above zero'; end if;
    tender_total := tender_total+requested;
    if payment_line->>'method'='Cash' then cash_total := cash_total+requested; end if;
  end loop;
  if abs(tender_total-amount_paid) > 0.0005 then raise exception 'Payment lines do not match amount due'; end if;
  if abs(cash_total-coalesce((sale_data->>'cashAmount')::numeric,cash_total)) > 0.0005 then raise exception 'Cash amount does not match payment lines'; end if;

  for usage_line in select value from jsonb_array_elements(stock_usage) order by value->>'itemId'
  loop
    requested := coalesce((usage_line->>'quantity')::numeric,0);
    if requested <= 0 then raise exception 'Recipe quantities must be above zero'; end if;
    select * into inventory_record from public.salon_records
      where shop_id=target_shop and record_type='inventory_item'
        and external_id=usage_line->>'itemId' and deleted_at is null for update;
    if not found then raise exception 'Inventory item % is missing', usage_line->>'itemId'; end if;
    available := coalesce((inventory_record.data->>'quantity')::numeric,0);
    if available < requested then
      raise exception 'Insufficient stock for %: % available, % required', inventory_record.data->>'name', available, requested;
    end if;
    update public.salon_records set data=jsonb_set(data,'{quantity}',to_jsonb(available-requested),true)
      where id=inventory_record.id;
    movement_id := sale_external_id || ':' || (usage_line->>'itemId');
    insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
    values(target_shop,'stock_movement',movement_id,jsonb_build_object(
      'id',movement_id,'itemId',usage_line->>'itemId','itemName',inventory_record.data->>'name',
      'type','service_use','quantity',-requested,'unit',inventory_record.data->>'unit',
      'unitCost',coalesce((inventory_record.data->>'unitCost')::numeric,0),
      'reference',sale_external_id,'reason',coalesce(sale_data->>'service','Service sale'),
      'createdBy',actor::text,'createdAt',now()
    ),actor) on conflict(shop_id,record_type,external_id) do nothing;
  end loop;

  sale_data := sale_data || jsonb_build_object(
    'subtotal',subtotal,'discount',discount,'tip',tip,'revenueAmount',revenue_amount,
    'amount',sale_amount,'amountPaid',amount_paid,'cashAmount',cash_total,'paymentLines',normalized_payments
  );
  insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
  values(target_shop,'sale',sale_external_id,sale_data,actor);
  return jsonb_build_object('ok',true,'idempotent',false);
end;
$$;
revoke all on function public.salon_record_sale(uuid,text,jsonb,jsonb) from public,anon;
grant execute on function public.salon_record_sale(uuid,text,jsonb,jsonb) to authenticated;

create or replace function public.salon_refund_sale(
  target_shop uuid,
  refund_external_id text,
  sale_external_id text,
  refund_data jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  sale_record public.salon_records%rowtype;
  sale_amount numeric;
  sale_revenue numeric;
  sale_tip numeric;
  refunded_amount numeric;
  refunded_revenue numeric;
  refunded_tip numeric;
  refund_amount numeric := coalesce((refund_data->>'amount')::numeric,0);
  refund_revenue numeric := coalesce((refund_data->>'revenueAmount')::numeric,refund_amount);
  refund_tip numeric := coalesce((refund_data->>'tipAmount')::numeric,0);
  refund_payments jsonb := coalesce(refund_data->'paymentLines','[]'::jsonb);
  original_payments jsonb;
  payment_line jsonb;
  payment_method text;
  payment_amount numeric;
  payment_available numeric;
  payment_returned numeric;
  refund_tender_total numeric := 0;
  refund_cash_total numeric := 0;
begin
  if actor is null or not (
    (salon_private.is_platform_admin() and exists (select 1 from public.salon_shops where id=target_shop and status='active'))
    or exists (
      select 1 from public.salon_memberships membership
      join public.salon_shops shop on shop.id=membership.shop_id
      where membership.shop_id=target_shop and membership.user_id=actor and membership.active
        and membership.role in ('owner','shop_admin','cashier') and shop.status='active'
    )
  ) then raise exception 'Not authorized to refund sales for this shop'; end if;

  if exists (
    select 1 from public.salon_records
    where shop_id=target_shop and record_type='refund' and external_id=refund_external_id and deleted_at is null
  ) then return jsonb_build_object('ok',true,'idempotent',true); end if;

  select * into sale_record from public.salon_records
  where shop_id=target_shop and record_type='sale' and external_id=sale_external_id and deleted_at is null
  for update;
  if not found then raise exception 'Sale not found'; end if;

  sale_amount := coalesce((sale_record.data->>'amount')::numeric,0);
  sale_revenue := coalesce((sale_record.data->>'revenueAmount')::numeric,sale_amount);
  sale_tip := coalesce((sale_record.data->>'tip')::numeric,0);
  original_payments := coalesce(sale_record.data->'paymentLines','[]'::jsonb);
  if jsonb_typeof(original_payments) <> 'array' then raise exception 'Original payment lines are invalid'; end if;
  if jsonb_array_length(original_payments)=0 and coalesce((sale_record.data->>'amountPaid')::numeric,sale_amount) > 0 then
    original_payments := jsonb_build_array(jsonb_build_object(
      'method',coalesce(sale_record.data->>'payment','Cash'),
      'amount',coalesce((sale_record.data->>'amountPaid')::numeric,sale_amount)
    ));
  end if;
  if coalesce((sale_record.data->>'depositApplied')::numeric,0) > 0 then
    original_payments := original_payments || jsonb_build_array(jsonb_build_object(
      'method',coalesce(sale_record.data->>'depositPayment','Cash'),
      'amount',(sale_record.data->>'depositApplied')::numeric
    ));
  end if;
  select coalesce(sum((data->>'amount')::numeric),0),
    coalesce(sum(coalesce((data->>'revenueAmount')::numeric,(data->>'amount')::numeric)),0),
    coalesce(sum(coalesce((data->>'tipAmount')::numeric,0)),0)
    into refunded_amount,refunded_revenue,refunded_tip
  from public.salon_records
  where shop_id=target_shop and record_type='refund' and data->>'saleId'=sale_external_id and deleted_at is null;

  if refund_amount <= 0 or refund_amount > sale_amount-refunded_amount then
    raise exception 'Refund amount exceeds the remaining sale balance';
  end if;
  if refund_revenue < 0 or refund_tip < 0 or abs(refund_revenue+refund_tip-refund_amount) > 0.0005
    or refund_revenue > sale_revenue-refunded_revenue or refund_tip > sale_tip-refunded_tip then
    raise exception 'Refund allocation is invalid';
  end if;
  if length(trim(coalesce(refund_data->>'reason',''))) < 3 then raise exception 'Refund reason is required'; end if;
  if coalesce(refund_data->>'payment','') <> coalesce(sale_record.data->>'payment','') then
    raise exception 'Refund payment method must match the sale';
  end if;
  if jsonb_typeof(refund_payments) <> 'array' then raise exception 'Refund payment lines must be an array'; end if;
  if jsonb_array_length(refund_payments)=0 then
    refund_payments := jsonb_build_array(jsonb_build_object('method',refund_data->>'payment','amount',refund_amount));
  end if;
  for payment_line in select value from jsonb_array_elements(refund_payments)
  loop
    payment_method := coalesce(payment_line->>'method','');
    payment_amount := coalesce((payment_line->>'amount')::numeric,0);
    if payment_method not in ('Cash','Card','Wallet') or payment_amount <= 0 then raise exception 'Refund payment lines are invalid'; end if;
    select coalesce(sum((line->>'amount')::numeric),0) into payment_available
      from jsonb_array_elements(original_payments) line where line->>'method'=payment_method;
    select coalesce(sum((line->>'amount')::numeric),0) into payment_returned
      from public.salon_records prior
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(prior.data->'paymentLines')='array' and jsonb_array_length(prior.data->'paymentLines')>0
          then prior.data->'paymentLines'
          else jsonb_build_array(jsonb_build_object('method',prior.data->>'payment','amount',(prior.data->>'amount')::numeric)) end
      ) line
      where prior.shop_id=target_shop and prior.record_type='refund' and prior.data->>'saleId'=sale_external_id
        and prior.deleted_at is null and line->>'method'=payment_method;
    if payment_amount > payment_available-payment_returned then raise exception 'Refund exceeds the remaining original tender'; end if;
    refund_tender_total := refund_tender_total+payment_amount;
    if payment_method='Cash' then refund_cash_total := refund_cash_total+payment_amount; end if;
  end loop;
  if abs(refund_tender_total-refund_amount) > 0.0005 then raise exception 'Refund payment lines do not match the refund amount'; end if;
  if abs(refund_cash_total-coalesce((refund_data->>'cashAmount')::numeric,refund_cash_total)) > 0.0005 then
    raise exception 'Refund cash amount does not match payment lines';
  end if;

  refund_data := refund_data || jsonb_build_object('paymentLines',refund_payments,'cashAmount',refund_cash_total);

  insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
  values(target_shop,'refund',refund_external_id,refund_data,actor);
  refunded_amount := refunded_amount+refund_amount;
  update public.salon_records
    set data=data || jsonb_build_object(
      'status',case when refunded_amount >= sale_amount then 'Refunded' else 'Partially refunded' end,
      'refundedAmount',refunded_amount,
      'refundedAt',coalesce(refund_data->>'createdAt',now()::text),
      'refundId',refund_external_id
    )
  where id=sale_record.id;

  return jsonb_build_object('ok',true,'idempotent',false,'refundedAmount',refunded_amount,'remaining',sale_amount-refunded_amount);
end;
$$;
revoke all on function public.salon_refund_sale(uuid,text,text,jsonb) from public,anon;
grant execute on function public.salon_refund_sale(uuid,text,text,jsonb) to authenticated;
