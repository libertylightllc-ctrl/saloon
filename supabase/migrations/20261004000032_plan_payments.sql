-- How salons pay for their plan (owner, 2026-10-04: "tackle the important first"), until card payments are built in:
--  · the platform owner sets where to pay — bank transfer details and/or a card payment link from any provider
--    (Stripe, PayPal, Ziina…) — and the Plan page shows them to salon owners, with the salon code as the reference;
--  · when an owner asks for the plan, the platform owner gets an email (Edge Function plan-alert, through Resend),
--    then records the payment as before (Admin → the salon).

alter table public.platform_settings
  add column bank_name text check (length(bank_name) <= 80),
  add column bank_account_name text check (length(bank_account_name) <= 80),
  add column bank_iban text check (bank_iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{8,30}$'),
  add column bank_swift text check (bank_swift ~ '^[A-Z0-9]{8}([A-Z0-9]{3})?$'),
  add column pay_link_url text check (pay_link_url ~ '^https://[^ ]{4,}$' and length(pay_link_url) <= 500),
  add column pay_note text check (length(pay_note) <= 300);

-- When the platform owner was told about a request (null: not yet; the alert is retried).
alter table public.plan_events add column alerted_at timestamptz;

-- p: {bank_name, bank_account_name, bank_iban, bank_swift, pay_link_url, pay_note}; empty clears a field.
-- Spaces in the IBAN and SWIFT are dropped and letters capitalised, as people copy them from bank apps.
create function public.admin_set_payment_details(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_iban text := nullif(upper(regexp_replace(coalesce(p ->> 'bank_iban', ''), '\s', '', 'g')), '');
  v_swift text := nullif(upper(regexp_replace(coalesce(p ->> 'bank_swift', ''), '\s', '', 'g')), '');
  v_link text := nullif(btrim(coalesce(p ->> 'pay_link_url', '')), '');
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if v_iban is not null and v_iban !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{8,30}$' then
    raise exception 'invalid_iban' using errcode = '22023';
  end if;
  if v_swift is not null and v_swift !~ '^[A-Z0-9]{8}([A-Z0-9]{3})?$' then
    raise exception 'invalid_swift' using errcode = '22023';
  end if;
  if v_link is not null and (v_link !~ '^https://[^ ]{4,}$' or length(v_link) > 500) then
    raise exception 'invalid_link' using errcode = '22023';
  end if;
  update platform_settings set
    bank_name = nullif(btrim(coalesce(p ->> 'bank_name', '')), ''),
    bank_account_name = nullif(btrim(coalesce(p ->> 'bank_account_name', '')), ''),
    bank_iban = v_iban,
    bank_swift = v_swift,
    pay_link_url = v_link,
    pay_note = nullif(btrim(coalesce(p ->> 'pay_note', '')), '')
  where id;
end;
$$;

-- Ask plan-alert to email the platform owner about requests not yet told. Uses the same Vault secrets as push.
create function public.dispatch_plan_alerts() returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key');
begin
  if v_url is null or v_key is null
     or not exists (select 1 from plan_events where kind = 'request' and alerted_at is null
                    and created_at > now() - interval '7 days') then
    return null;
  end if;
  return net.http_post(url := v_url || '/functions/v1/plan-alert', body := '{}'::jsonb,
                       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key));
end;
$$;

create function public.on_plan_requested() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.dispatch_plan_alerts();
  return null;
end;
$$;
create trigger plan_events_alert after insert on public.plan_events
  for each row when (new.kind = 'request') execute function public.on_plan_requested();

-- For plan-alert (service role): the requests not yet told, claimed so an overlapping run cannot send one twice, with
-- what the email needs. The platform owners to tell are listed with each one.
create function public.claim_plan_alerts()
returns table (event_id uuid, salon text, code text, country_code text, owner_name text, owner_email text,
               branches int, months int, note text, price_per_branch_minor bigint, currency text, admin_emails text[],
               requested_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with claimed as (
    update plan_events e set alerted_at = clock_timestamp()
    where e.kind = 'request' and e.alerted_at is null and e.created_at > now() - interval '7 days'
    returning e.*
  )
  select c.id, b.name, b.code, b.country_code, m.display_name, u.email::text,
         (select count(*)::int from branches br where br.business_id = b.id), c.months, c.note,
         pp.price_minor, pp.currency,
         (select array_agg(au.email::text order by au.email) from platform_admins pa join auth.users au on au.id = pa.user_id
          where au.email is not null),
         c.created_at
  from claimed c
  join businesses b on b.id = c.business_id
  cross join lateral public.plan_price(b.id) pp
  left join lateral (select * from members mm where mm.business_id = b.id and mm.role = 'owner'
                     order by mm.created_at limit 1) m on true
  left join auth.users u on u.id = m.user_id
  order by c.created_at;
end;
$$;

-- An email that could not be sent goes back to the queue (the next request or the 10-minute retry sends it).
create function public.unclaim_plan_alert(p_event uuid) returns void
language sql security definer set search_path = public as $$
  update plan_events set alerted_at = null where id = p_event
$$;

select cron.schedule('plan-alerts', '*/10 * * * *', $$select public.dispatch_plan_alerts()$$);

revoke execute on function public.admin_set_payment_details(jsonb), public.dispatch_plan_alerts(),
  public.on_plan_requested(), public.claim_plan_alerts(), public.unclaim_plan_alert(uuid) from public, anon;
revoke execute on function public.dispatch_plan_alerts(), public.on_plan_requested(), public.claim_plan_alerts(),
  public.unclaim_plan_alert(uuid) from authenticated;
grant execute on function public.admin_set_payment_details(jsonb) to authenticated;
grant execute on function public.claim_plan_alerts(), public.unclaim_plan_alert(uuid) to service_role;
