-- Platform console, Part B (owner's brief, 24 Nov 2026).
-- B9 Support: open conversations; those waiting for a person (handed over by the assistant, and the last word is not
--    the team's), with the oldest; and how long the first reply by a person took on average, over conversations that
--    began in the last 30 days (from the first message to the team's first). Test salons are left out.

create function public.admin_support_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  with threads as (
    select t.* from support_threads t
    where not exists (select 1 from test_salons x where x.business_id = t.business_id and x.test)
  ), waiting as (
    select * from threads where status = 'open' and handover and last_from <> 'support'
  ), recent as (
    select (select min(m.created_at) from support_messages m where m.thread_id = t.id and m.author = 'user') as asked,
           (select min(m.created_at) from support_messages m where m.thread_id = t.id and m.author = 'support') as answered
    from threads t
    where t.created_at > now() - interval '30 days'
  ), replies as (
    select extract(epoch from answered - asked) as seconds from recent where asked is not null and answered > asked
  )
  select jsonb_build_object(
    'open', (select count(*) from threads where status = 'open'),
    'waiting', (select count(*) from waiting),
    'oldest_waiting_at', (select min(last_message_at) from waiting),
    'oldest_waiting_minutes', (select floor(extract(epoch from now() - min(last_message_at)) / 60)::int from waiting),
    'replied_30d', (select count(*) from replies),
    'first_reply_seconds', (select round(avg(seconds))::bigint from replies))
    into v;
  return v;
end;
$$;
revoke execute on function public.admin_support_stats() from public, anon;
grant execute on function public.admin_support_stats() to authenticated;
