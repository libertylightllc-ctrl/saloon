-- Platform console, Part B (owner's brief, 24 Nov 2026): one reporting currency for the Overview (also H2), with each
-- salon's own currency converted at the day's rate and shown with "≈".
--
-- Rates come once a day from ExchangeRate-API's open endpoint (no key; it asks for a credit line, shown under the
-- converted amounts), fetched by the fx-rates function, which the database wakes every hour until it has the day's
-- rates. The currencies fixed to the US dollar are here from the start, so AED, SAR and QAR amounts convert even
-- before the first fetch. If a fetch fails, the last rates are used and the console says which day they are from.

alter table public.platform_settings add column reporting_currency text not null default 'USD'
  check (reporting_currency ~ '^[A-Z]{3}$');

create table public.fx_rates (
  day date not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  per_usd numeric not null check (per_usd > 0),
  -- 'fixed': a currency pegged to the US dollar (never replaced by a fetch); 'exchangerate-api': a day's fetch.
  source text not null default 'exchangerate-api' check (source in ('fixed', 'exchangerate-api')),
  primary key (day, currency)
);
alter table public.fx_rates enable row level security;
revoke all on public.fx_rates from anon, authenticated;
-- No policies: the console reads the rates through admin_fx_rates().

insert into public.fx_rates (day, currency, per_usd, source) values
  ('2000-01-01', 'USD', 1, 'fixed'),
  ('2000-01-01', 'AED', 3.6725, 'fixed'),
  ('2000-01-01', 'SAR', 3.75, 'fixed'),
  ('2000-01-01', 'QAR', 3.64, 'fixed'),
  ('2000-01-01', 'BHD', 0.376, 'fixed'),
  ('2000-01-01', 'OMR', 0.3845, 'fixed'),
  ('2000-01-01', 'JOD', 0.709, 'fixed');

-- The latest rate of every currency (a fetched day wins over the fixed one only when it is newer, which it always is).
create function public.fx_latest() returns table (currency text, per_usd numeric, day date, source text)
language sql stable security definer set search_path = public as $$
  select distinct on (r.currency) r.currency, r.per_usd, r.day, r.source
  from fx_rates r order by r.currency, r.day desc
$$;
revoke execute on function public.fx_latest() from public, anon, authenticated;

-- Is today's fetch still to do (the day as the rates service counts it: UTC)?
create function public.fx_rates_due() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from fx_rates where source = 'exchangerate-api' and day >= (now() at time zone 'utc')::date)
$$;
revoke execute on function public.fx_rates_due() from public, anon, authenticated;
grant execute on function public.fx_rates_due() to service_role;

-- The fx-rates function saves a day's rates (per US dollar). A reply that does not look like a full table is refused;
-- fixed rates are kept; days older than 400 are let go.
create function public.save_fx_rates(p_day date, p_rates jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if p_day is null or p_day > (now() at time zone 'utc')::date + 1 or jsonb_typeof(p_rates) <> 'object'
     or (p_rates ->> 'USD')::numeric is distinct from 1
     or (select count(*) from jsonb_each(p_rates)) < 20 then
    raise exception 'invalid_rates' using errcode = '22023';
  end if;
  insert into fx_rates (day, currency, per_usd, source)
  select p_day, r.key, r.value::text::numeric, 'exchangerate-api'
  from jsonb_each(p_rates) r
  where r.key ~ '^[A-Z]{3}$' and jsonb_typeof(r.value) = 'number' and r.value::text::numeric > 0
    and not exists (select 1 from fx_rates f where f.currency = r.key and f.source = 'fixed')
  on conflict (day, currency) do update set per_usd = excluded.per_usd;
  get diagnostics v_count = row_count;
  delete from fx_rates where source = 'exchangerate-api' and day < p_day - 400;
  return v_count;
end;
$$;
revoke execute on function public.save_fx_rates(date, jsonb) from public, anon, authenticated;
grant execute on function public.save_fx_rates(date, jsonb) to service_role;

-- Wake fx-rates while the day's rates are missing (every hour, so a failed fetch is tried again).
create function public.dispatch_fx_rates() returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key');
begin
  if v_url is null or v_key is null or not public.fx_rates_due() then
    return null;
  end if;
  return net.http_post(url := v_url || '/functions/v1/fx-rates', body := '{}'::jsonb,
                       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key));
end;
$$;
revoke execute on function public.dispatch_fx_rates() from public, anon, authenticated;
select cron.schedule('fx-rates', '17 * * * *', $$select public.dispatch_fx_rates()$$);

-- What the console converts with: the reporting currency, the newest fetched day (null before the first fetch) and
-- every currency's latest rate.
create function public.admin_fx_rates() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'reporting_currency', (select reporting_currency from platform_settings),
    'day', (select max(day) from fx_rates where source = 'exchangerate-api'),
    'fixed', (select coalesce(jsonb_agg(currency order by currency), '[]') from fx_rates where source = 'fixed'),
    'rates', (select coalesce(jsonb_object_agg(currency, per_usd), '{}') from public.fx_latest()));
end;
$$;
revoke execute on function public.admin_fx_rates() from public, anon;
grant execute on function public.admin_fx_rates() to authenticated;

-- Settings → Reporting currency: only a currency there is a rate for; written to Changes.
create function public.admin_set_reporting_currency(p_currency text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_before text := (select reporting_currency from platform_settings);
  v_currency text := upper(btrim(coalesce(p_currency, '')));
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from fx_rates where currency = v_currency) then
    raise exception 'invalid_setting' using errcode = '22023';
  end if;
  if v_currency is distinct from v_before then
    update platform_settings set reporting_currency = v_currency where id;
    perform public.platform_audit_write('settings:currency', null, null,
      jsonb_build_object('reporting_currency', v_before), jsonb_build_object('reporting_currency', v_currency));
  end if;
  return v_currency;
end;
$$;
revoke execute on function public.admin_set_reporting_currency(text) from public, anon;
grant execute on function public.admin_set_reporting_currency(text) to authenticated;
