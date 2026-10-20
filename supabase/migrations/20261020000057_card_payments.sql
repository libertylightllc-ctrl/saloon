-- Paying for the plan by card through Creem (owner, 2026-10-20: the Creem handoff). The owner picks the months on
-- Plan & billing → Pay by card; the app's server asks Creem for a checkout and opens it; when Creem says it is paid
-- (a signed webhook), the plan is extended at once, exactly like a payment the platform owner records. Bank transfer
-- stays as it is. One payment in US dollars covers the months and the extra people: (base + extra × each extra
-- person) × months, at the international price (USD 13.99 + 2.99), with tax added by Creem where it applies.
-- Card payments are off until the platform owner switches them to test (only platform admins see the button) or live.

alter table public.platform_settings add column card_payments text not null default 'off'
  check (card_payments in ('off', 'test', 'live'));
grant select (card_payments) on public.platform_settings to authenticated;

create table public.card_payments (
  -- Also the request_id sent to Creem.
  id uuid primary key default gen_random_uuid(),
  -- Null only for a payment nobody could match to a salon (kept for review).
  business_id uuid references public.businesses (id) on delete cascade,
  mode text not null check (mode in ('test', 'live')),
  months int not null check (months in (1, 3, 6, 12)),
  people int not null default 0 check (people >= 0),
  extra_people int not null default 0 check (extra_people >= 0),
  -- What was asked, before tax (USD cents).
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'USD',
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'review')),
  checkout_id text unique,
  order_id text unique,
  -- What Creem charged (with any tax), and to whom.
  paid_minor bigint,
  paid_currency text,
  customer_email text,
  paid_until date,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  refunded_at timestamptz
);
create index card_payments_business_idx on public.card_payments (business_id, created_at desc);
alter table public.card_payments enable row level security;
create policy "owner and accountant read their card payments" on public.card_payments for select to authenticated
  using (business_id in (select public.my_business_ids(array['owner', 'accountant']::member_role[])));
create policy "platform admins read all card payments" on public.card_payments for select to authenticated
  using (public.is_platform_admin());

-- Starts a card payment for the owner: works out the amount from the salon's people now and gives back what the
-- server sends to Creem. Owner only; while card payments are in test, platform admins only.
create function public.card_checkout_start(p_business uuid, p_months int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s platform_settings;
  v_people int;
  v_extra int;
  v_amount bigint;
  v_id uuid;
begin
  select * into s from platform_settings;
  if not exists (select 1 from members where business_id = p_business and user_id = auth.uid() and active and role = 'owner') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if s.card_payments = 'off' or (s.card_payments = 'test' and not public.is_platform_admin()) then
    raise exception 'card_unavailable' using errcode = '22023';
  end if;
  if p_months is null or p_months not in (1, 3, 6, 12) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  v_people := (select count(*)::int from members where business_id = p_business and active);
  v_extra := greatest(v_people - s.included_people, 0);
  v_amount := (s.intl_price_per_branch_minor + v_extra * s.intl_extra_person_minor) * p_months;
  insert into card_payments (business_id, mode, months, people, extra_people, amount_minor, currency, created_by)
  values (p_business, s.card_payments, p_months, v_people, v_extra, v_amount, s.intl_currency, auth.uid())
  returning id into v_id;
  return jsonb_build_object('request_id', v_id, 'mode', s.card_payments, 'months', p_months, 'people', v_people,
    'extra_people', v_extra, 'amount_minor', v_amount, 'base_minor', s.intl_price_per_branch_minor * p_months,
    'currency', s.intl_currency, 'email', (select email from auth.users where id = auth.uid()),
    'salon_code', (select code from businesses where id = p_business));
end;
$$;

-- The checkout Creem opened for a payment. Service role (the server).
create function public.card_checkout_opened(p_id uuid, p_checkout_id text) returns void
language sql security definer set search_path = public as $$
  update card_payments set checkout_id = p_checkout_id where id = p_id and status = 'pending'
$$;

-- Creem says a checkout is paid (webhook checkout.completed). p = {request_id?, checkout_id, order_id, months?,
-- salon_code?, mode, paid_minor, paid_currency, email}. Finds the payment by its request id (or checkout id); a
-- payment made from a plain payment link is matched by the salon code typed at checkout (months from its product);
-- anything else is kept for review. Extends the plan once: the same event again changes nothing. Service role.
create function public.card_payment_completed(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c card_payments;
  v_business uuid;
  v_months int := nullif(p ->> 'months', '')::int;
  v_today date;
  v_current date;
  v_until date;
begin
  if nullif(p ->> 'order_id', '') is not null and exists (select 1 from card_payments where order_id = p ->> 'order_id') then
    return jsonb_build_object('result', 'duplicate');
  end if;
  select * into c from card_payments
  where (nullif(p ->> 'request_id', '') is not null and id::text = p ->> 'request_id')
     or (nullif(p ->> 'checkout_id', '') is not null and checkout_id = p ->> 'checkout_id')
  order by created_at limit 1 for update;
  if c.id is not null and c.status <> 'pending' then
    return jsonb_build_object('result', 'duplicate');
  end if;
  if c.id is null then
    -- A plain payment link: the salon code typed at checkout, and the months of the product bought.
    select id into v_business from businesses where code = lower(btrim(coalesce(p ->> 'salon_code', '')));
    if v_business is null or v_months is null or v_months not in (1, 3, 6, 12) then
      insert into card_payments (business_id, mode, months, amount_minor, currency, status, checkout_id, order_id,
                                 paid_minor, paid_currency, customer_email, note, paid_at)
      values (v_business, coalesce(nullif(p ->> 'mode', ''), 'live'), coalesce(v_months, 1),
              coalesce((p ->> 'paid_minor')::bigint, 0), coalesce(nullif(p ->> 'paid_currency', ''), 'USD'), 'review',
              nullif(p ->> 'checkout_id', ''), nullif(p ->> 'order_id', ''), (p ->> 'paid_minor')::bigint,
              nullif(p ->> 'paid_currency', ''), nullif(p ->> 'email', ''),
              'No salon matched (salon code: ' || coalesce(nullif(p ->> 'salon_code', ''), 'none') || ')', now());
      return jsonb_build_object('result', 'review');
    end if;
    insert into card_payments (business_id, mode, months, amount_minor, currency, checkout_id, note)
    values (v_business, coalesce(nullif(p ->> 'mode', ''), 'live'), v_months, coalesce((p ->> 'paid_minor')::bigint, 0),
            coalesce(nullif(p ->> 'paid_currency', ''), 'USD'), nullif(p ->> 'checkout_id', ''), 'Paid from a payment link')
    returning * into c;
  end if;

  -- Extend the plan as a recorded payment does: from the end of a running plan or trial, else from today.
  v_today := public.business_today(c.business_id);
  select paid_until into v_current from subscriptions where business_id = c.business_id;
  v_until := (greatest(coalesce(v_current, v_today - 1), v_today - 1) + make_interval(months => c.months))::date;
  insert into subscriptions (business_id, paid_until, trial) values (c.business_id, v_until, false)
  on conflict (business_id) do update set paid_until = excluded.paid_until, trial = false, updated_at = now();
  insert into plan_events (business_id, kind, months, amount_minor, currency, paid_until, note)
  values (c.business_id, 'activate', c.months, coalesce((p ->> 'paid_minor')::bigint, c.amount_minor),
          coalesce(nullif(p ->> 'paid_currency', ''), c.currency), v_until,
          'Card payment (Creem' || case when c.mode = 'test' then ', test' else '' end || ') '
            || coalesce(nullif(p ->> 'order_id', ''), coalesce(nullif(p ->> 'checkout_id', ''), '')));
  update card_payments set status = 'paid', paid_at = now(), paid_until = v_until,
    checkout_id = coalesce(checkout_id, nullif(p ->> 'checkout_id', '')), order_id = nullif(p ->> 'order_id', ''),
    paid_minor = (p ->> 'paid_minor')::bigint, paid_currency = nullif(p ->> 'paid_currency', ''),
    customer_email = nullif(p ->> 'email', '')
  where id = c.id;
  return jsonb_build_object('result', 'paid', 'business_id', c.business_id, 'paid_until', v_until);
end;
$$;

-- Creem says a payment was refunded (webhook refund.created): marked refunded for the platform owner to look at; the
-- plan is not cut short on its own. Service role.
create function public.card_payment_refunded(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c card_payments;
begin
  select * into c from card_payments
  where (nullif(p ->> 'request_id', '') is not null and id::text = p ->> 'request_id')
     or (nullif(p ->> 'checkout_id', '') is not null and checkout_id = p ->> 'checkout_id')
     or (nullif(p ->> 'order_id', '') is not null and order_id = p ->> 'order_id')
  limit 1 for update;
  if c.id is null then
    return jsonb_build_object('result', 'unknown');
  end if;
  if c.status = 'refunded' then
    return jsonb_build_object('result', 'duplicate');
  end if;
  update card_payments set status = 'refunded', refunded_at = now(),
    note = concat_ws(' · ', note, 'Refunded ' || coalesce(p ->> 'refund_minor', '?') || ' ' || coalesce(p ->> 'refund_currency', ''))
  where id = c.id;
  return jsonb_build_object('result', 'refunded');
end;
$$;

-- The console: card payments on or off (test: platform admins only), and the latest card payments.
create function public.admin_set_card_payments(p_mode text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_mode not in ('off', 'test', 'live') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  update platform_settings set card_payments = p_mode where id;
end;
$$;

create function public.admin_card_payments()
returns table (id uuid, salon text, code text, mode text, months int, extra_people int, amount_minor bigint,
               paid_minor bigint, paid_currency text, status text, order_id text, customer_email text, note text,
               created_at timestamptz, paid_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select c.id, b.name, b.code, c.mode, c.months, c.extra_people, c.amount_minor, c.paid_minor, c.paid_currency, c.status,
           c.order_id, c.customer_email, c.note, c.created_at, c.paid_at
    from card_payments c left join businesses b on b.id = c.business_id
    where c.status <> 'pending' or c.created_at > now() - interval '1 day'
    order by c.created_at desc limit 50;
end;
$$;

revoke execute on function public.card_checkout_opened(uuid, text), public.card_payment_completed(jsonb),
  public.card_payment_refunded(jsonb) from public, anon, authenticated;
grant execute on function public.card_checkout_opened(uuid, text), public.card_payment_completed(jsonb),
  public.card_payment_refunded(jsonb) to service_role;
revoke execute on function public.card_checkout_start(uuid, int), public.admin_set_card_payments(text),
  public.admin_card_payments() from public, anon;
