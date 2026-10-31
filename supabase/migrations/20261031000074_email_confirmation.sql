-- Owner's fix list (final brief, 31 Oct 2026) C2, approved by the owner ("C2 ok"): no email-confirmation wall. Once
-- the owner turns off Supabase's "Confirm email", a new owner is signed in at once and starts setting up; a banner
-- asks them to confirm their address, and a confirmed address is needed only to buy a plan.
--
-- With "Confirm email" off, Supabase marks every new address as confirmed, so Saloqo keeps its own record of who has
-- really shown they read the inbox. Nobody can write to it from the app. An address counts as confirmed when:
--   - it was confirmed before this change (everyone today);
--   - its owner signed in with an emailed link or a password-reset code (Supabase marks such a sign-in "otp");
--   - Google says it is theirs (a Google sign-in with the same address);
--   - it was confirmed by Supabase's own link (while "Confirm email" is still on), or changed through the links sent to
--     both inboxes;
--   - the account was made directly in the database by the operator (the demo data, the database tests).
-- Nothing existing is changed or removed, apart from requests and card payments now needing a confirmed address.

-- 1. The record: one row per account, with the address that was confirmed (a new address needs confirming again).
create table public.email_confirmations (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  how text not null check (how in ('before', 'link', 'google', 'change', 'admin')),
  confirmed_at timestamptz not null default now()
);
alter table public.email_confirmations enable row level security;
create policy "users read their own confirmation" on public.email_confirmations for select to authenticated
  using (user_id = auth.uid());
revoke all on public.email_confirmations from anon;
revoke insert, update, delete on public.email_confirmations from authenticated;

insert into public.email_confirmations (user_id, email, how, confirmed_at)
select id, lower(email), 'before', email_confirmed_at
from auth.users
where email_confirmed_at is not null and email is not null and email not like '%.staff.internal';

create function public.note_email_confirmed(p_user uuid, p_how text) returns void
language sql security definer set search_path = public as $$
  insert into email_confirmations (user_id, email, how)
  select u.id, lower(u.email), p_how from auth.users u where u.id = p_user and u.email is not null
  on conflict (user_id) do update set email = excluded.email, how = excluded.how, confirmed_at = now()
    where email_confirmations.email is distinct from excluded.email;
$$;

-- Whether this account's current address is confirmed.
create function public.email_confirmed(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from email_confirmations c join auth.users u on u.id = c.user_id
                 where c.user_id = p_user and c.email = lower(u.email));
$$;

-- 2. The app asks after each sign-in: confirmed or not, and a sign-in that came through the inbox (an emailed link or
--    a reset code; never a password) confirms the address. {confirmed, newly}.
create function public.confirm_my_email() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if public.email_confirmed(v_user) then
    return jsonb_build_object('confirmed', true, 'newly', false);
  end if;
  -- "otp" is also a code sent by text message: only for accounts without a phone sign-in (Saloqo has none).
  if exists (select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
             where a ->> 'method' in ('otp', 'magiclink', 'recovery', 'email/signup', 'invite', 'email_change'))
     and (select coalesce(phone, '') = '' from auth.users where id = v_user) then
    perform public.note_email_confirmed(v_user, 'link');
    return jsonb_build_object('confirmed', true, 'newly', true);
  end if;
  return jsonb_build_object('confirmed', false, 'newly', false);
end;
$$;

-- 3. Supabase's own confirmation (its link while "Confirm email" is on, or an operator confirming in the dashboard),
--    and an address changed through the links sent to both inboxes. With "Confirm email" off, Supabase marks a new
--    account confirmed in the same step that makes it: that is not a confirmation, so accounts made in this same
--    transaction are skipped. Never stops the account change itself.
create function public.on_user_email_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if position(new.id::text in coalesce(current_setting('saloqo.new_users', true), '')) > 0 then
    return new;
  end if;
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform public.note_email_confirmed(new.id, 'link');
  elsif new.email is distinct from old.email and new.email_confirmed_at is not null then
    perform public.note_email_confirmed(new.id, 'change');
  end if;
  return new;
exception when others then
  return new;
end;
$$;
create trigger auth_users_email_confirmed after update of email, email_confirmed_at on auth.users
  for each row execute function public.on_user_email_confirmed();

-- New accounts are noted for the rest of their transaction (see above). Accounts made directly in the database (not
-- through Supabase) with a confirmed address count as confirmed: the demo data and the database tests.
create function public.on_user_created_confirmed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('saloqo.new_users', coalesce(current_setting('saloqo.new_users', true), '') || new.id::text || ',', true);
  if new.email_confirmed_at is not null and session_user <> 'supabase_auth_admin' then
    perform public.note_email_confirmed(new.id, 'admin');
  end if;
  return new;
exception when others then
  return new;
end;
$$;
create trigger auth_users_created_confirmed after insert on auth.users
  for each row execute function public.on_user_created_confirmed();

-- 4. Google. A Google sign-in with the same address confirms it. Supabase joins a Google sign-in to an existing
--    account with that address, and with "Confirm email" off it no longer checks that the existing account had
--    confirmed it: someone could sign up with another person's address and keep a way in after the real owner signs
--    in with Google. So when Google joins an account whose address was never confirmed, the password is removed and
--    every device signed in to it is signed out, as Supabase itself does while "Confirm email" is on. The real owner
--    goes on with Google, or sets a password with "Forgot password?".
create function public.on_google_identity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text := (select lower(email) from auth.users where id = new.user_id);
begin
  if v_email is null or lower(coalesce(new.identity_data ->> 'email', '')) <> v_email then
    return new;
  end if;
  if not public.email_confirmed(new.user_id)
     and exists (select 1 from auth.identities i where i.user_id = new.user_id and i.provider <> 'google') then
    update auth.users set encrypted_password = '' where id = new.user_id;
    delete from auth.sessions where user_id = new.user_id;
  end if;
  perform public.note_email_confirmed(new.user_id, 'google');
  return new;
end;
$$;
create trigger auth_identities_google after insert on auth.identities
  for each row when (new.provider = 'google') execute function public.on_google_identity();

-- 5. Buying a plan needs a confirmed address: asking for one (as migration 68, plus the check) and paying by card (as
--    migration 67, plus the check).
create or replace function public.request_plan(p_business uuid, p_months int, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  q record;
begin
  if not public.has_role(p_business, array['owner']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not public.email_confirmed(auth.uid()) then
    raise exception 'email_unconfirmed' using errcode = '22023';
  end if;
  if not (select billing_enabled from platform_settings) then
    raise exception 'billing_off' using errcode = '22023';
  end if;
  if p_months is null or public.plan_length_tenths(p_months) is null then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  -- Two requests sent at the same moment wait here for each other, so the second sees the first.
  perform pg_advisory_xact_lock(hashtext('plan_request:' || p_business::text));
  if exists (select 1 from plan_events e where e.business_id = p_business and e.kind = 'request'
             and not exists (select 1 from plan_events a where a.business_id = p_business and a.kind in ('activate', 'end')
                             and a.created_at > e.created_at)) then
    raise exception 'plan_requested' using errcode = '22023';
  end if;
  select * into q from public.plan_quote(p_business);
  insert into plan_events (business_id, kind, months, amount_minor, currency, note, created_by)
  values (p_business, 'request', p_months, round(q.monthly_minor * public.plan_length_tenths(p_months) / 10.0)::bigint,
          q.currency, nullif(btrim(coalesce(p_note, '')), ''), auth.uid());
  perform public.write_audit(p_business, null, (select id from members where business_id = p_business and user_id = auth.uid()),
    'create', 'plan_request', null, 'Asked for the plan: ' || p_months || ' month(s)');
end;
$$;

create or replace function public.card_checkout_start(p_business uuid, p_months int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s platform_settings;
  v_lines jsonb;
  v_people int;
  v_extra int;
  v_monthly bigint;
  v_amount bigint;
  v_id uuid;
begin
  select * into s from platform_settings;
  if not exists (select 1 from members where business_id = p_business and user_id = auth.uid() and active and role = 'owner') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not public.email_confirmed(auth.uid()) then
    raise exception 'email_unconfirmed' using errcode = '22023';
  end if;
  if not s.billing_enabled then
    raise exception 'billing_off' using errcode = '22023';
  end if;
  if s.card_payments = 'off' or (s.card_payments = 'test' and not public.is_platform_admin()) then
    raise exception 'card_unavailable' using errcode = '22023';
  end if;
  if p_months is null or public.plan_length_tenths(p_months) is null then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  v_lines := public.plan_branch_lines(p_business, true);
  select coalesce(sum((l ->> 'people')::int), 0), coalesce(sum((l ->> 'extra_people')::int), 0),
         coalesce(sum((l ->> 'monthly_minor')::bigint), 0)
    into v_people, v_extra, v_monthly
  from jsonb_array_elements(v_lines) l;
  v_amount := round(v_monthly * public.plan_length_tenths(p_months) / 10.0)::bigint;
  insert into card_payments (business_id, mode, months, people, extra_people, amount_minor, currency, created_by)
  values (p_business, s.card_payments, p_months, v_people, v_extra, v_amount, s.intl_currency, auth.uid())
  returning id into v_id;
  return jsonb_build_object('request_id', v_id, 'mode', s.card_payments, 'months', p_months, 'people', v_people,
    'extra_people', v_extra, 'amount_minor', v_amount, 'base_minor', s.intl_price_per_branch_minor * p_months,
    'currency', s.intl_currency, 'branches', v_lines, 'email', (select email from auth.users where id = auth.uid()),
    'salon_code', (select code from businesses where id = p_business));
end;
$$;

revoke execute on function public.note_email_confirmed(uuid, text), public.email_confirmed(uuid),
  public.confirm_my_email(), public.on_user_email_confirmed(), public.on_user_created_confirmed(),
  public.on_google_identity() from public, anon, authenticated;
grant execute on function public.confirm_my_email() to authenticated;
