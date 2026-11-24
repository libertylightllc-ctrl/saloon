-- Platform console, Part B (owner's brief, 24 Nov 2026), B10 "System health": what the console can show about the
-- service itself. Saloqo's own emails (plan requests, support, pilot applications), Creem's payment notices, the day's
-- exchange rates and screens that crashed in the app are written here as they happen. Sign-up and password emails come
-- from the sign-in service and backups from the database host: neither can be seen from here, and the console says so.
-- Kept 90 days.

create table public.health_log (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('email', 'card_webhook', 'rates', 'app_error')),
  ok boolean not null,
  detail text check (char_length(detail) <= 500),
  screen text check (char_length(screen) <= 200),
  user_id uuid,
  business_id uuid,
  created_at timestamptz not null default now()
);
create index health_log_kind_idx on public.health_log (kind, created_at desc);
alter table public.health_log enable row level security;
revoke all on public.health_log from anon, authenticated;

-- The service's own functions write here (emails, Creem, rates). At most 200 rows of a kind an hour, so a flood of
-- forged payment notices cannot fill the table.
create function public.log_health(p_kind text, p_ok boolean, p_detail text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from health_log where kind = p_kind and created_at > now() - interval '1 hour') >= 200 then
    return;
  end if;
  insert into health_log (kind, ok, detail) values (p_kind, coalesce(p_ok, false), left(p_detail, 500));
end;
$$;
revoke execute on function public.log_health(text, boolean, text) from public, anon, authenticated;
grant execute on function public.log_health(text, boolean, text) to service_role;

-- A screen that crashed in the app: the error's text and the screen, at most 20 a person an hour. The salon is kept
-- only when the person works there.
create function public.report_app_error(p_message text, p_screen text default null, p_business uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or nullif(btrim(coalesce(p_message, '')), '') is null then
    return;
  end if;
  if (select count(*) from health_log where kind = 'app_error' and user_id = auth.uid() and created_at > now() - interval '1 hour') >= 20 then
    return;
  end if;
  insert into health_log (kind, ok, detail, screen, user_id, business_id)
  values ('app_error', false, left(btrim(p_message), 500), left(p_screen, 200), auth.uid(),
          (select m.business_id from members m where m.business_id = p_business and m.user_id = auth.uid() limit 1));
end;
$$;
revoke execute on function public.report_app_error(text, text, uuid) from public, anon;
grant execute on function public.report_app_error(text, text, uuid) to authenticated;

select cron.schedule('health-log-prune', '40 3 * * *', $$delete from public.health_log where created_at < now() - interval '90 days'$$);

-- The System health card: the last good and the last failed of each kind, failures in the last 24 hours, and the
-- latest crashed screens with their salon.
create function public.admin_health() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb := '{}';
  k text;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  foreach k in array array['email', 'card_webhook', 'rates'] loop
    v := v || jsonb_build_object(k, jsonb_build_object(
      'last_ok_at', (select max(created_at) from health_log where kind = k and ok),
      'last_fail_at', (select max(created_at) from health_log where kind = k and not ok),
      'last_fail', (select detail from health_log where kind = k and not ok order by created_at desc limit 1),
      'ok_24h', (select count(*) from health_log where kind = k and ok and created_at > now() - interval '24 hours'),
      'fails_24h', (select count(*) from health_log where kind = k and not ok and created_at > now() - interval '24 hours')));
  end loop;
  return v || jsonb_build_object(
    'card_payments', (select card_payments from platform_settings),
    'rates_day', (select max(day) from fx_rates where source = 'exchangerate-api'),
    'app_errors_24h', (select count(*) from health_log where kind = 'app_error' and created_at > now() - interval '24 hours'),
    'app_errors', coalesce((select jsonb_agg(e order by e ->> 'at' desc) from (
        select jsonb_build_object('at', h.created_at, 'detail', h.detail, 'screen', h.screen, 'salon', b.name, 'code', b.code) as e
        from health_log h left join businesses b on b.id = h.business_id
        where h.kind = 'app_error' and h.created_at > now() - interval '24 hours'
        order by h.created_at desc limit 5) x), '[]'));
end;
$$;
revoke execute on function public.admin_health() from public, anon;
grant execute on function public.admin_health() to authenticated;
