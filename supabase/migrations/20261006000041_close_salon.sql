-- Closing a salon from the platform console (owner, 2026-10-06: remove the Demo Shop and Red Lion Demo salons, while
-- the Demo Shop owner's account stays the dev account). Every login of the salon is switched off and its plan ends;
-- nothing is deleted (financial records are never deleted). A platform owner whose salon is closed keeps the console.

-- businesses.closed_at already marks a salon whose owner deleted their account (migration 25); a platform owner's
-- closing sets it too, with who and why.
alter table public.businesses
  add column closed_by uuid references auth.users (id) on delete set null,
  add column close_note text check (close_note is null or length(close_note) <= 200);

create function public.admin_close_salon(p_business uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  b businesses;
  v_note text := nullif(btrim(p_note), '');
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into b from businesses where id = p_business for update;
  if b.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if b.closed_at is not null then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  if v_note is null or length(v_note) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  -- Ending a plan and switching logins off are corrections a closed salon must take even without a plan.
  perform set_config('salon.plan_check', 'off', true);
  update members set active = false where business_id = b.id;
  update businesses set closed_at = now(), closed_by = auth.uid(), close_note = left(v_note, 200) where id = b.id;
  if exists (select 1 from subscriptions where business_id = b.id and paid_until >= public.business_today(b.id)) then
    update subscriptions set paid_until = public.business_today(b.id) - 1 where business_id = b.id;
    insert into plan_events (business_id, kind, note, created_by, currency)
    values (b.id, 'end', 'Salon closed: ' || left(v_note, 180), auth.uid(), (select currency from public.plan_price(b.id)));
  end if;
  perform public.write_audit(b.id, null, null, 'close', 'business', b.id, 'Salon closed by the platform owner: ' || left(v_note, 180));
end;
$$;
revoke execute on function public.admin_close_salon(uuid, text) from public, anon;
grant execute on function public.admin_close_salon(uuid, text) to authenticated;

-- The overview counts open salons; closed ones are counted apart.
create or replace function public.admin_salon_stats()
returns table (business_id uuid, currency text, mode text, staff integer, customers integer, services integer,
               sales_30d integer, sales_month_minor bigint, last_sale_at timestamptz, last_sign_in_at timestamptz,
               closed boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select b.id, b.currency,
           (select string_agg(distinct br.mode::text, ', ') from branches br where br.business_id = b.id),
           (select count(*)::int from employees e where e.business_id = b.id and e.active),
           (select count(*)::int from customers c where c.business_id = b.id),
           (select count(*)::int from services sv where sv.business_id = b.id and sv.status = 'active'),
           (select count(*)::int from sales s where s.business_id = b.id and s.created_at > now() - interval '30 days'),
           (select coalesce(sum(s.total_minor), 0)::bigint from sales s where s.business_id = b.id
              and s.business_date >= date_trunc('month', public.business_today(b.id))::date),
           (select max(s.created_at) from sales s where s.business_id = b.id),
           (select max(u.last_sign_in_at) from members m join auth.users u on u.id = m.user_id where m.business_id = b.id),
           b.closed_at is not null
             or not exists (select 1 from members m where m.business_id = b.id and m.role = 'owner' and m.active)
    from businesses b
    where not b.is_demo;
end;
$$;

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', now() at time zone 'Asia/Dubai')::date;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'salons', (select count(*) from businesses where not is_demo and closed_at is null),
    'salons_closed', (select count(*) from businesses where not is_demo and closed_at is not null),
    'salons_plan_active', (select count(*) from businesses b join subscriptions s on s.business_id = b.id
                           where not b.is_demo and b.closed_at is null and s.paid_until >= public.business_today(b.id)),
    'plan_requests_open', (select count(distinct e.business_id) from plan_events e where e.kind = 'request'
                             and not exists (select 1 from plan_events a where a.business_id = e.business_id
                                             and a.kind in ('activate', 'end') and a.created_at > e.created_at)),
    'branches', (select count(*) from branches br join businesses b on b.id = br.business_id where not b.is_demo),
    'accounts', (select count(*) from auth.users),
    'owners', (select count(*) from members m join businesses b on b.id = m.business_id where m.role = 'owner' and not b.is_demo),
    'staff_logins', (select count(*) from members m join businesses b on b.id = m.business_id where m.role <> 'owner' and not b.is_demo),
    'no_salon', (select count(*) from auth.users u where not exists (select 1 from members m where m.user_id = u.id)),
    'signups_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'signups_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'signed_in_7d', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('code', country_code, 'salons', n) order by n desc)
                           from (select country_code, count(*) as n from businesses where not is_demo group by 1) c), '[]'),
    'sales_month', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'count', n, 'total_minor', total) order by total desc)
                             from (select b.currency, count(*) as n, sum(s.total_minor) as total from sales s
                                   join businesses b on b.id = s.business_id
                                   where not b.is_demo and s.business_date >= v_month group by 1) x), '[]'),
    'plan_income', coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'total_minor', total) order by total desc)
                             from (select coalesce(e.currency, 'AED') as currency, sum(e.amount_minor) as total from plan_events e
                                   where e.kind = 'activate' and e.amount_minor > 0 group by 1) y), '[]')
  );
end;
$$;
