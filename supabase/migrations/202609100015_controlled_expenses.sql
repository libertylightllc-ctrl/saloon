create or replace function salon_private.protect_controlled_expense() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  kind text := case when tg_op='DELETE' then old.record_type else new.record_type end;
begin
  if kind='expense' and auth.uid() is not null
    and coalesce(current_setting('salon.expense_rpc',true),'') <> '1'
  then raise exception 'Expenses must use the controlled expense workflow'; end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function salon_private.protect_controlled_expense() from public;
drop trigger if exists salon_controlled_expense_guard on public.salon_records;
create trigger salon_controlled_expense_guard
before insert or update or delete on public.salon_records
for each row execute function salon_private.protect_controlled_expense();

create or replace function public.salon_record_expense(
  target_shop uuid,
  expense_external_id text,
  expense_data jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  amount_value numeric := coalesce((expense_data->>'amount')::numeric,0);
  category_value text := trim(coalesce(expense_data->>'category',''));
  payment_value text := coalesce(expense_data->>'payment','');
  note_value text := trim(coalesce(expense_data->>'note',''));
  normalized jsonb;
  existing public.salon_records%rowtype;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if salon_private.is_platform_admin() then
    actor_role := 'platform_admin';
  else
    select membership.role into actor_role
    from public.salon_memberships membership
    join public.salon_shops shop on shop.id=membership.shop_id
    where membership.shop_id=target_shop and membership.user_id=actor
      and membership.active and shop.status='active';
  end if;
  if actor_role is null or actor_role not in ('platform_admin','owner','shop_admin','cashier') then
    raise exception 'Not authorized to record expenses';
  end if;
  if not exists (select 1 from public.salon_shops where id=target_shop and status='active') then
    raise exception 'Shop is not active';
  end if;
  if length(trim(coalesce(expense_external_id,''))) < 3 then raise exception 'Expense reference is required'; end if;
  if length(category_value) not between 1 and 80 then raise exception 'Expense category is required'; end if;
  if amount_value <= 0 or amount_value > 10000000 then raise exception 'Expense amount is invalid'; end if;
  if payment_value not in ('Cash','Card','Bank') then raise exception 'Expense payment method is invalid'; end if;
  if length(note_value) > 500 then raise exception 'Expense note is too long'; end if;

  select * into existing from public.salon_records
  where shop_id=target_shop and record_type='expense' and external_id=expense_external_id
    and deleted_at is null for update;
  if found then return jsonb_build_object('ok',true,'idempotent',true,'expense',existing.data); end if;

  normalized := jsonb_build_object(
    'id',expense_external_id,'category',category_value,'amount',amount_value,
    'payment',payment_value,'note',note_value,'status','Posted',
    'createdBy',actor::text,'createdAt',now()
  );
  if jsonb_typeof(expense_data->'evidenceFile')='object' then
    normalized := normalized || jsonb_build_object('evidenceFile',expense_data->'evidenceFile');
  end if;
  perform set_config('salon.expense_rpc','1',true);
  insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
  values(target_shop,'expense',expense_external_id,normalized,actor);
  return jsonb_build_object('ok',true,'expense',normalized);
end;
$$;
revoke all on function public.salon_record_expense(uuid,text,jsonb) from public,anon;
grant execute on function public.salon_record_expense(uuid,text,jsonb) to authenticated;

create or replace function public.salon_reverse_expense(
  target_shop uuid,
  expense_external_id text,
  reversal_reason text
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  actor_role text;
  existing public.salon_records%rowtype;
  original_amount numeric;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if salon_private.is_platform_admin() then
    actor_role := 'platform_admin';
  else
    select membership.role into actor_role
    from public.salon_memberships membership
    join public.salon_shops shop on shop.id=membership.shop_id
    where membership.shop_id=target_shop and membership.user_id=actor
      and membership.active and shop.status='active';
  end if;
  if actor_role is null or actor_role not in ('platform_admin','owner','shop_admin') then
    raise exception 'Management authorization is required to reverse expenses';
  end if;
  if length(trim(coalesce(reversal_reason,''))) < 3 then raise exception 'Expense reversal reason is required'; end if;

  select * into existing from public.salon_records
  where shop_id=target_shop and record_type='expense' and external_id=expense_external_id
    and deleted_at is null for update;
  if not found then raise exception 'Expense not found'; end if;
  if existing.data->>'status'='Reversed' then raise exception 'Expense is already reversed'; end if;
  original_amount := coalesce((existing.data->>'amount')::numeric,0);
  perform set_config('salon.expense_rpc','1',true);
  update public.salon_records set data=existing.data || jsonb_build_object(
    'status','Reversed','originalAmount',original_amount,'amount',0,
    'reversalReason',trim(reversal_reason),'reversedBy',actor::text,'reversedAt',now()
  ) where id=existing.id returning * into existing;
  return jsonb_build_object('ok',true,'expense',existing.data);
end;
$$;
revoke all on function public.salon_reverse_expense(uuid,text,text) from public,anon;
grant execute on function public.salon_reverse_expense(uuid,text,text) to authenticated;
