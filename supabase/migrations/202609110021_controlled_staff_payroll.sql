create or replace function salon_private.protect_controlled_payroll() returns trigger
language plpgsql security definer set search_path = '' as $$
declare kind text := case when tg_op='DELETE' then old.record_type else new.record_type end;
begin
  if kind in ('staff_profile','attendance','staff_adjustment','payroll') and auth.uid() is not null
    and coalesce(current_setting('salon.payroll_rpc',true),'') <> '1'
  then raise exception 'Staff and payroll records must use the controlled payroll workflow'; end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;
revoke all on function salon_private.protect_controlled_payroll() from public;
drop trigger if exists salon_controlled_payroll_guard on public.salon_records;
create trigger salon_controlled_payroll_guard before insert or update or delete on public.salon_records
for each row execute function salon_private.protect_controlled_payroll();

create or replace function salon_private.can_manage_payroll(target_shop uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (salon_private.is_platform_admin() and exists(select 1 from public.salon_shops where id=target_shop and status='active'))
    or salon_private.has_shop_role(target_shop,array['owner','shop_admin']);
$$;
revoke all on function salon_private.can_manage_payroll(uuid) from public;

create or replace function public.salon_save_staff_profile(target_shop uuid,profile_external_id text,profile_data jsonb,change_reason text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); existing public.salon_records%rowtype; duplicate_record public.salon_records%rowtype;
  staff_name text := trim(coalesce(profile_data->>'name','')); employee_number text := trim(coalesce(profile_data->>'employeeNo',''));
  user_reference text := trim(coalesce(profile_data->>'userId','')); salary numeric := coalesce((profile_data->>'baseSalary')::numeric,-1);
  commission numeric := coalesce((profile_data->>'commissionRate')::numeric,-1); joining_date date;
  normalized_profile jsonb;
begin
  if actor is null or not salon_private.can_manage_payroll(target_shop) then raise exception 'Management authorization is required for staff profiles'; end if;
  if length(trim(coalesce(profile_external_id,'')))<3 then raise exception 'Staff profile reference is required'; end if;
  if length(staff_name) not between 1 and 160 or length(employee_number) not between 1 and 80 then raise exception 'Staff name and employee ID are required'; end if;
  if length(coalesce(profile_data->>'jobTitle',''))>120 or salary<0 or salary>10000000 or commission<0 or commission>100 then raise exception 'Staff employment terms are invalid'; end if;
  joining_date := coalesce(nullif(profile_data->>'joinDate','')::date,current_date);
  if joining_date>current_date+1 then raise exception 'Joining date cannot be in the future'; end if;
  if user_reference<>'' and not exists(select 1 from public.salon_memberships where shop_id=target_shop and user_id::text=user_reference and role='staff' and active) then
    raise exception 'Linked staff login is not active for this shop';
  end if;
  select * into existing from public.salon_records where shop_id=target_shop and record_type='staff_profile'
    and external_id=profile_external_id and deleted_at is null for update;
  if existing.id is not null and not coalesce((existing.data->>'active')::boolean,true) then raise exception 'Archived staff profile cannot be edited'; end if;
  select * into duplicate_record from public.salon_records where shop_id=target_shop and record_type='staff_profile'
    and external_id<>profile_external_id and deleted_at is null and coalesce((data->>'active')::boolean,true)
    and lower(data->>'employeeNo')=lower(employee_number) limit 1;
  if found then raise exception 'An active profile with this employee ID already exists'; end if;
  if user_reference<>'' and exists(select 1 from public.salon_records where shop_id=target_shop and record_type='staff_profile'
    and external_id<>profile_external_id and deleted_at is null and coalesce((data->>'active')::boolean,true) and data->>'userId'=user_reference) then
    raise exception 'This staff login is already linked to another profile';
  end if;
  if existing.id is not null and length(trim(coalesce(change_reason,'')))<3 then raise exception 'Staff profile change reason is required'; end if;
  normalized_profile := jsonb_build_object(
    'id',profile_external_id,'userId',user_reference,'subject_user_id',user_reference,'name',staff_name,
    'employeeNo',employee_number,'jobTitle',trim(coalesce(profile_data->>'jobTitle','Staff')),
    'joinDate',joining_date::text,'baseSalary',salary,'commissionRate',commission,
    'wpsRequired',coalesce((profile_data->>'wpsRequired')::boolean,false),'active',true,
    'updatedAt',now(),'updatedBy',actor::text,'changeReason',trim(coalesce(change_reason,''))
  );
  if existing.id is null then normalized_profile := normalized_profile || jsonb_build_object('createdAt',now(),'createdBy',actor::text);
  else normalized_profile := normalized_profile || jsonb_build_object('createdAt',coalesce(existing.data->>'createdAt',existing.created_at::text)); end if;
  perform set_config('salon.payroll_rpc','1',true);
  if existing.id is null then insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
    values(target_shop,'staff_profile',profile_external_id,normalized_profile,actor);
  else update public.salon_records set data=normalized_profile where id=existing.id; end if;
  return jsonb_build_object('ok',true,'profile',normalized_profile);
end;
$$;
revoke all on function public.salon_save_staff_profile(uuid,text,jsonb,text) from public,anon;
grant execute on function public.salon_save_staff_profile(uuid,text,jsonb,text) to authenticated;

create or replace function public.salon_archive_staff_profile(target_shop uuid,profile_external_id text,archive_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); profile_record public.salon_records%rowtype;
begin
  if actor is null or not salon_private.can_manage_payroll(target_shop) then raise exception 'Management authorization is required for staff profiles'; end if;
  if length(trim(coalesce(archive_reason,'')))<3 then raise exception 'Staff archive reason is required'; end if;
  select * into profile_record from public.salon_records where shop_id=target_shop and record_type='staff_profile'
    and external_id=profile_external_id and deleted_at is null for update;
  if not found then raise exception 'Staff profile not found'; end if;
  if not coalesce((profile_record.data->>'active')::boolean,true) then return jsonb_build_object('ok',true,'idempotent',true,'profile',profile_record.data); end if;
  if exists(select 1 from public.salon_records where shop_id=target_shop and record_type='payroll' and deleted_at is null
    and data->>'staffId'=profile_external_id and data->>'status'<>'Paid') then raise exception 'Unpaid payroll must be completed before archiving staff'; end if;
  perform set_config('salon.payroll_rpc','1',true);
  update public.salon_records set data=data || jsonb_build_object('active',false,'archiveReason',trim(archive_reason),'archivedAt',now(),'archivedBy',actor::text)
    where id=profile_record.id returning * into profile_record;
  return jsonb_build_object('ok',true,'profile',profile_record.data);
end;
$$;
revoke all on function public.salon_archive_staff_profile(uuid,text,text) from public,anon;
grant execute on function public.salon_archive_staff_profile(uuid,text,text) to authenticated;

create or replace function public.salon_save_attendance(target_shop uuid,attendance_external_id text,attendance_data jsonb,change_reason text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); profile_record public.salon_records%rowtype; existing public.salon_records%rowtype;
  attendance_date date; attendance_status text := coalesce(attendance_data->>'status',''); clock_in time; clock_out time;
  start_minutes integer; end_minutes integer; worked_hours numeric := 0; normalized_attendance jsonb;
begin
  if actor is null or not salon_private.can_manage_payroll(target_shop) then raise exception 'Management authorization is required for attendance'; end if;
  if attendance_status not in ('Present','Absent','Paid Leave','Unpaid Leave','Rest Day') then raise exception 'Attendance status is invalid'; end if;
  attendance_date := coalesce(nullif(attendance_data->>'date','')::date,current_date);
  if attendance_date>current_date+1 then raise exception 'Attendance date cannot be in the future'; end if;
  select * into profile_record from public.salon_records where shop_id=target_shop and record_type='staff_profile'
    and external_id=attendance_data->>'staffId' and deleted_at is null and coalesce((data->>'active')::boolean,true);
  if not found then raise exception 'Active staff profile not found'; end if;
  if attendance_status='Present' then
    clock_in := nullif(attendance_data->>'clockIn','')::time; clock_out := nullif(attendance_data->>'clockOut','')::time;
    if clock_in is null or clock_out is null then raise exception 'Clock-in and clock-out are required for present attendance'; end if;
    start_minutes := extract(hour from clock_in)::integer*60+extract(minute from clock_in)::integer;
    end_minutes := extract(hour from clock_out)::integer*60+extract(minute from clock_out)::integer;
    if end_minutes<start_minutes then end_minutes := end_minutes+1440; end if;
    worked_hours := round(((end_minutes-start_minutes)::numeric/60),1);
  end if;
  select * into existing from public.salon_records where shop_id=target_shop and record_type='attendance'
    and external_id=attendance_external_id and deleted_at is null for update;
  if existing.id is not null and length(trim(coalesce(change_reason,'')))<3 then raise exception 'Attendance correction reason is required'; end if;
  normalized_attendance := jsonb_build_object(
    'id',attendance_external_id,'staffId',profile_record.external_id,'subject_user_id',coalesce(profile_record.data->>'userId',''),
    'date',attendance_date::text,'status',attendance_status,
    'clockIn',case when attendance_status='Present' then to_char(clock_in,'HH24:MI') else '' end,
    'clockOut',case when attendance_status='Present' then to_char(clock_out,'HH24:MI') else '' end,
    'hours',worked_hours,'note',trim(coalesce(attendance_data->>'note','')),
    'updatedAt',now(),'updatedBy',actor::text,'changeReason',trim(coalesce(change_reason,''))
  );
  if existing.id is null then normalized_attendance := normalized_attendance || jsonb_build_object('createdAt',now(),'createdBy',actor::text);
  else normalized_attendance := normalized_attendance || jsonb_build_object('createdAt',coalesce(existing.data->>'createdAt',existing.created_at::text)); end if;
  perform set_config('salon.payroll_rpc','1',true);
  if existing.id is null then insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
    values(target_shop,'attendance',attendance_external_id,normalized_attendance,actor);
  else update public.salon_records set data=normalized_attendance where id=existing.id; end if;
  return jsonb_build_object('ok',true,'attendance',normalized_attendance);
end;
$$;
revoke all on function public.salon_save_attendance(uuid,text,jsonb,text) from public,anon;
grant execute on function public.salon_save_attendance(uuid,text,jsonb,text) to authenticated;

create or replace function public.salon_record_staff_adjustment(target_shop uuid,adjustment_external_id text,adjustment_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); profile_record public.salon_records%rowtype; period_value text := coalesce(adjustment_data->>'period',''); amount_value numeric := coalesce((adjustment_data->>'amount')::numeric,0); normalized_adjustment jsonb;
begin
  if actor is null or not salon_private.can_manage_payroll(target_shop) then raise exception 'Management authorization is required for payroll adjustments'; end if;
  if period_value !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Payroll period is invalid'; end if;
  if coalesce(adjustment_data->>'type','') not in ('Allowance','Bonus','Advance','Deduction') or amount_value<=0 or amount_value>10000000 then raise exception 'Payroll adjustment is invalid'; end if;
  if length(trim(coalesce(adjustment_data->>'reason','')))<3 then raise exception 'Adjustment reason is required'; end if;
  select * into profile_record from public.salon_records where shop_id=target_shop and record_type='staff_profile'
    and external_id=adjustment_data->>'staffId' and deleted_at is null and coalesce((data->>'active')::boolean,true);
  if not found then raise exception 'Active staff profile not found'; end if;
  if exists(select 1 from public.salon_records where shop_id=target_shop and record_type='payroll' and deleted_at is null
    and data->>'staffId'=profile_record.external_id and data->>'period'=period_value) then raise exception 'Payroll already exists for this staff and period'; end if;
  if exists(select 1 from public.salon_records where shop_id=target_shop and record_type='staff_adjustment'
    and external_id=adjustment_external_id and deleted_at is null) then
    select data into normalized_adjustment from public.salon_records where shop_id=target_shop and record_type='staff_adjustment' and external_id=adjustment_external_id and deleted_at is null;
    return jsonb_build_object('ok',true,'idempotent',true,'adjustment',normalized_adjustment);
  end if;
  normalized_adjustment := jsonb_build_object(
    'id',adjustment_external_id,'staffId',profile_record.external_id,'subject_user_id',coalesce(profile_record.data->>'userId',''),
    'period',period_value,'type',adjustment_data->>'type','amount',amount_value,'reason',trim(adjustment_data->>'reason'),
    'createdAt',now(),'createdBy',actor::text
  );
  perform set_config('salon.payroll_rpc','1',true);
  insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
  values(target_shop,'staff_adjustment',adjustment_external_id,normalized_adjustment,actor);
  return jsonb_build_object('ok',true,'idempotent',false,'adjustment',normalized_adjustment);
end;
$$;
revoke all on function public.salon_record_staff_adjustment(uuid,text,jsonb) from public,anon;
grant execute on function public.salon_record_staff_adjustment(uuid,text,jsonb) to authenticated;

create or replace function public.salon_generate_payroll(target_shop uuid,target_period text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); profile_record public.salon_records%rowtype; days_in_month integer; unpaid_days integer;
  base_salary numeric; base_pay numeric; commission_rate numeric; gross_sales numeric; refunded_sales numeric;
  commission_pay numeric; additions numeric; deductions numeric; net_pay numeric; payroll_data jsonb; generated jsonb := '[]'::jsonb;
begin
  if actor is null or not salon_private.can_manage_payroll(target_shop) then raise exception 'Management authorization is required to generate payroll'; end if;
  if target_period !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Payroll period is invalid'; end if;
  if exists(select 1 from public.salon_records where shop_id=target_shop and record_type='payroll' and deleted_at is null and data->>'period'=target_period) then raise exception 'Payroll already exists for this month'; end if;
  days_in_month := extract(day from ((target_period||'-01')::date + interval '1 month - 1 day'))::integer;
  perform set_config('salon.payroll_rpc','1',true);
  for profile_record in select * from public.salon_records where shop_id=target_shop and record_type='staff_profile'
    and deleted_at is null and coalesce((data->>'active')::boolean,true) order by external_id for update
  loop
    base_salary := coalesce((profile_record.data->>'baseSalary')::numeric,0);
    commission_rate := coalesce((profile_record.data->>'commissionRate')::numeric,0);
    select count(distinct data->>'date') into unpaid_days from public.salon_records where shop_id=target_shop and record_type='attendance'
      and deleted_at is null and data->>'staffId'=profile_record.external_id and left(data->>'date',7)=target_period and data->>'status' in ('Absent','Unpaid Leave');
    base_pay := greatest(base_salary-(base_salary/days_in_month)*unpaid_days,0);
    select coalesce(sum(coalesce((data->>'revenueAmount')::numeric,(data->>'amount')::numeric,0)),0) into gross_sales
      from public.salon_records where shop_id=target_shop and record_type='sale' and deleted_at is null
        and left(data->>'createdAt',7)=target_period and lower(data->>'staff')=lower(profile_record.data->>'name');
    select coalesce(sum(coalesce((refund.data->>'revenueAmount')::numeric,(refund.data->>'amount')::numeric,0)),0) into refunded_sales
      from public.salon_records refund join public.salon_records sale on sale.shop_id=refund.shop_id and sale.record_type='sale'
        and sale.external_id=refund.data->>'saleId' and sale.deleted_at is null
      where refund.shop_id=target_shop and refund.record_type='refund' and refund.deleted_at is null
        and left(sale.data->>'createdAt',7)=target_period and lower(sale.data->>'staff')=lower(profile_record.data->>'name');
    commission_pay := greatest(gross_sales-refunded_sales,0)*commission_rate/100;
    select coalesce(sum(case when data->>'type' in ('Allowance','Bonus') then (data->>'amount')::numeric else 0 end),0),
      coalesce(sum(case when data->>'type' in ('Advance','Deduction') then (data->>'amount')::numeric else 0 end),0)
      into additions,deductions from public.salon_records where shop_id=target_shop and record_type='staff_adjustment'
        and deleted_at is null and data->>'staffId'=profile_record.external_id and data->>'period'=target_period;
    net_pay := greatest(base_pay+commission_pay+additions-deductions,0);
    payroll_data := jsonb_build_object(
      'id','payroll-'||profile_record.external_id||'-'||target_period,'staffId',profile_record.external_id,
      'subject_user_id',coalesce(profile_record.data->>'userId',''),'period',target_period,
      'basePay',round(base_pay,2),'commission',round(commission_pay,2),'additions',round(additions,2),
      'deductions',round(deductions,2),'netPay',round(net_pay,2),
      'wpsRequired',coalesce((profile_record.data->>'wpsRequired')::boolean,false),
      'wpsStatus',case when coalesce((profile_record.data->>'wpsRequired')::boolean,false) then 'Pending' else 'Not required' end,
      'status','Generated','generatedBy',actor::text,'createdAt',now()
    );
    insert into public.salon_records(shop_id,record_type,external_id,data,created_by)
    values(target_shop,'payroll',payroll_data->>'id',payroll_data,actor);
    generated := generated || jsonb_build_array(payroll_data);
  end loop;
  if jsonb_array_length(generated)=0 then raise exception 'Add at least one active staff profile first'; end if;
  return jsonb_build_object('ok',true,'payroll',generated);
end;
$$;
revoke all on function public.salon_generate_payroll(uuid,text) from public,anon;
grant execute on function public.salon_generate_payroll(uuid,text) to authenticated;

create or replace function public.salon_pay_payroll(target_shop uuid,payroll_external_id text,payment_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); payroll_record public.salon_records%rowtype; method_value text := coalesce(payment_data->>'method',''); reference_value text := trim(coalesce(payment_data->>'reference','')); evidence_path text := trim(coalesce(payment_data->>'evidencePath','')); updated_payroll jsonb;
begin
  if actor is null or not salon_private.can_manage_payroll(target_shop) then raise exception 'Management authorization is required to pay payroll'; end if;
  select * into payroll_record from public.salon_records where shop_id=target_shop and record_type='payroll'
    and external_id=payroll_external_id and deleted_at is null for update;
  if not found then raise exception 'Payroll record not found'; end if;
  if payroll_record.data->>'status'='Paid' then return jsonb_build_object('ok',true,'idempotent',true,'payroll',payroll_record.data); end if;
  if method_value not in ('Bank','Cash','WPS') or length(reference_value)<3 then raise exception 'Valid payment method and reference are required'; end if;
  if coalesce((payroll_record.data->>'wpsRequired')::boolean,false) and method_value='WPS' and evidence_path='' then raise exception 'WPS payment evidence is required'; end if;
  updated_payroll := payroll_record.data || jsonb_build_object(
    'status','Paid','paymentMethod',method_value,'paymentReference',reference_value,
    'evidencePath',evidence_path,'evidenceName',trim(coalesce(payment_data->>'evidenceName','')),
    'paidAt',now(),'paidBy',actor::text,
    'wpsStatus',case when coalesce((payroll_record.data->>'wpsRequired')::boolean,false) and method_value<>'WPS' then 'Pending'
      when coalesce((payroll_record.data->>'wpsRequired')::boolean,false) then 'Completed' else 'Not required' end
  );
  perform set_config('salon.payroll_rpc','1',true);
  update public.salon_records set data=updated_payroll where id=payroll_record.id;
  return jsonb_build_object('ok',true,'idempotent',false,'payroll',updated_payroll);
end;
$$;
revoke all on function public.salon_pay_payroll(uuid,text,jsonb) from public,anon;
grant execute on function public.salon_pay_payroll(uuid,text,jsonb) to authenticated;
