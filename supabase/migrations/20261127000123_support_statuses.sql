-- Platform console, Part E (owner's brief, 24 Nov 2026; progress check 26 Nov: a salon's request for a call from the
-- team, handed over by the assistant on 12 Oct, was still "Closed" with no person's reply).
-- E1 Every conversation has one of five statuses, kept by the database:
--    new            someone wrote and the AI assistant is about to answer;
--    waiting_team   "Waiting for you": the assistant handed it over, someone asked for a person, the assistant is off,
--                   or nobody answered in 5 minutes. It stays here until a person from the team replies;
--    waiting_salon  the team (a person, or the assistant without handing over) answered last;
--    solved         marked by a person; when the salon writes again it is waiting for a person again;
--    closed         solved and quiet for 7 days, or closed by a person.
--    Marking a conversation Solved or Closed while it is New or Waiting for you needs a reason. Every status a person
--    sets is written to Changes (who, when, old, new, reason). The old open/closed column follows the status.
--    Existing conversations get the status they are in now; one the assistant handed over that was closed without
--    any reply from a person goes back to Waiting for you.
-- E2 When a conversation starts waiting for a person: the email goes to hello@saloqo.com too (plan-alert), and each
--    platform owner with a salon login gets a notice (and a push) there, which opens Console → Support.
-- (E3) Messages remember whether a person answered in the app or on WhatsApp.

alter table public.support_threads
  add column stage text not null default 'new'
    check (stage in ('new', 'waiting_team', 'waiting_salon', 'solved', 'closed')),
  add column stage_at timestamptz not null default now();
alter table public.support_messages
  add column channel text not null default 'app' check (channel in ('app', 'whatsapp'));

-- Existing conversations: the status they are in now (before the triggers below, so nobody is notified).
update public.support_threads t set stage_at = t.last_message_at, stage = case
    when t.status = 'closed' and t.handover
         and not exists (select 1 from support_messages m where m.thread_id = t.id and m.author = 'support')
         and (t.user_id is null or not exists (select 1 from support_threads o where o.user_id = t.user_id
                                               and o.status = 'open' and o.id <> t.id)) then 'waiting_team'
    when t.status = 'closed' then 'closed'
    when t.handover and t.last_from <> 'support' then 'waiting_team'
    when t.last_from = 'user' and (not (select support_assistant from platform_settings limit 1)
                                   or t.last_message_at < now() - interval '5 minutes') then 'waiting_team'
    when t.last_from = 'user' then 'new'
    else 'waiting_salon' end;
update public.support_threads set status = case when stage = 'closed' then 'closed' else 'open' end;
create index support_threads_stage on public.support_threads (stage, stage_at);

-- The status leads; open/closed follows it, and the moment it changed is kept.
create function public.support_stage_sync() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.stage is distinct from old.stage then
    new.stage_at := clock_timestamp();
  end if;
  new.status := case when new.stage = 'closed' then 'closed' else 'open' end;
  return new;
end;
$$;
create trigger support_threads_stage_sync before update on public.support_threads
  for each row execute function public.support_stage_sync();

-- Adds a message. The salon writing: waiting for a person if one has taken it over (or it was solved, or the
-- assistant is off), else new for the assistant; a closed conversation opens again, afresh with the assistant.
-- A person answering (in the app or on WhatsApp): waiting for the salon. The assistant's own status is set by
-- support_assistant_reply.
drop function public.support_add(uuid, text, text);
create function public.support_add(p_thread uuid, p_author text, p_body text, p_channel text default 'app') returns void
language plpgsql security definer set search_path = public as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_assistant boolean := coalesce((select support_assistant from platform_settings limit 1), true);
begin
  if length(v_body) < 1 or length(v_body) > 2000 then
    raise exception 'message_required' using errcode = '22023';
  end if;
  -- An answer opens a closed conversation again, unless the person has a newer one open (one open conversation each).
  if p_author = 'support' and exists (
       select 1 from support_threads t where t.id = p_thread and t.stage = 'closed' and t.user_id is not null
         and exists (select 1 from support_threads o where o.user_id = t.user_id and o.status = 'open' and o.id <> t.id)) then
    raise exception 'already_open' using errcode = '22023';
  end if;
  -- At most 10 messages a minute in one conversation.
  if p_author = 'user' and (select count(*) from support_messages where thread_id = p_thread and author = 'user'
                            and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  -- The moment itself (not the transaction's start), so messages and "read" marks keep their exact order.
  insert into support_messages (thread_id, author, author_user_id, body, created_at, channel)
  values (p_thread, p_author, auth.uid(), v_body, clock_timestamp(), coalesce(p_channel, 'app'));
  -- (Every value on the right is the conversation as it was before this message.)
  update support_threads set last_message_at = clock_timestamp(), last_from = p_author,
    handover = case when p_author = 'user' and stage = 'closed' then false else handover end,
    stage = case
      when p_author = 'user' and stage = 'closed' then case when v_assistant then 'new' else 'waiting_team' end
      when p_author = 'user' and (handover or stage in ('solved', 'waiting_team') or not v_assistant) then 'waiting_team'
      when p_author = 'user' then 'new'
      when p_author = 'support' then 'waiting_salon'
      else stage end,
    alerted_at = case when p_author = 'user' then null else alerted_at end,
    user_read_at = case when p_author = 'user' then clock_timestamp() else user_read_at end,
    -- Only a platform owner's own answer marks the conversation read in the console (the assistant's does not).
    support_read_at = case when p_author = 'support' then clock_timestamp() else support_read_at end
  where id = p_thread;
end;
$$;
revoke execute on function public.support_add(uuid, text, text, text) from public, anon, authenticated;

-- What the person asking sees: their messages and the answers, and which answers came on WhatsApp.
create or replace function public.support_thread_json(p_thread uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', t.id, 'status', t.status, 'name', t.name, 'email', t.email,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'author', m.author, 'body', m.body,
                                                             'created_at', m.created_at, 'channel', m.channel)
                                           order by m.created_at)
                          from support_messages m where m.thread_id = t.id), '[]'::jsonb))
  from support_threads t where t.id = p_thread
$$;

-- The assistant's answer, unless someone else answered meanwhile. `p_handover`: it asks for a person.
create or replace function public.support_assistant_reply(p_thread uuid, p_body text, p_handover boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  t support_threads;
  m members;
begin
  select * into t from support_threads where id = p_thread for update;
  if t.id is null or t.last_from <> 'user' or t.handover then
    return false;
  end if;
  perform public.support_add(t.id, 'assistant', p_body);
  update support_threads set handover = coalesce(p_handover, false), assistant_claimed_at = null,
    stage = case when coalesce(p_handover, false) then 'waiting_team' else 'waiting_salon' end,
    -- A conversation handed to a person is emailed to platform owners.
    alerted_at = case when coalesce(p_handover, false) then null else alerted_at end
  where id = t.id;
  select * into m from members where user_id = t.user_id and active
    order by (business_id is not distinct from t.business_id) desc, created_at limit 1;
  if m.id is not null then
    insert into notifications (business_id, member_id, type, title, body, data, entity_type, entity_id)
    values (m.business_id, m.id, 'support_reply', 'Saloqo support answered',
            left(btrim(p_body), 140), jsonb_build_object('preview', left(btrim(p_body), 140)), 'support', t.id);
  end if;
  return true;
end;
$$;

-- A platform owner sets the status: Waiting for you (takes it back), Solved or Closed. Solved and Closed need a reason
-- while nobody from the team has answered the salon's last message. Written to Changes.
create function public.admin_support_set_stage(p_thread uuid, p_stage text, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  t support_threads;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_who text;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_stage is null or p_stage not in ('waiting_team', 'solved', 'closed') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;
  select * into t from support_threads where id = p_thread for update;
  if t.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if t.stage = p_stage then
    return;
  end if;
  if p_stage in ('solved', 'closed') and t.stage in ('new', 'waiting_team') and coalesce(length(v_reason), 0) < 3 then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  -- One open conversation per person: an old one cannot open while a newer one is.
  if t.stage = 'closed' and t.user_id is not null
     and exists (select 1 from support_threads o where o.user_id = t.user_id and o.status = 'open' and o.id <> t.id) then
    raise exception 'already_open' using errcode = '22023';
  end if;
  -- A person has it now: the assistant stays out of it.
  update support_threads set stage = p_stage, handover = true, support_read_at = clock_timestamp() where id = t.id;
  v_who := coalesce(t.name, (select mm.display_name from members mm where mm.user_id = t.user_id
                             order by (mm.business_id is not distinct from t.business_id) desc, mm.created_at limit 1), t.email);
  perform public.platform_audit_write('support:stage', t.business_id, v_who,
    jsonb_build_object('stage', t.stage),
    jsonb_strip_nulls(jsonb_build_object('stage', p_stage, 'reason', left(v_reason, 200))));
end;
$$;
revoke execute on function public.admin_support_set_stage(uuid, text, text) from public, anon;
grant execute on function public.admin_support_set_stage(uuid, text, text) to authenticated;

-- The old Close button, for an app not yet reloaded: the same rule (no reason given).
create or replace function public.admin_support_close(p_thread uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_support_set_stage(p_thread, 'closed', null);
end;
$$;

-- Switching the assistant off: what it was about to answer waits for a person at once.
create or replace function public.admin_set_support_assistant(p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update platform_settings set support_assistant = coalesce(p_on, true) where true;
  if not coalesce(p_on, true) then
    update support_threads set stage = 'waiting_team' where stage = 'new';
  end if;
end;
$$;

-- How many conversations wait for a person (the console's badges).
create function public.admin_support_waiting() returns int
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return (select count(*)::int from support_threads where stage = 'waiting_team');
end;
$$;
revoke execute on function public.admin_support_waiting() from public, anon;
grant execute on function public.admin_support_waiting() to authenticated;

-- Every 5 minutes: a message nobody answered in 5 minutes waits for a person (no assistant key, or an outage), as
-- does every new one once the assistant is off; a solved conversation quiet for 7 days is closed.
create function public.support_tick() returns void
language plpgsql security definer set search_path = public as $$
begin
  update support_threads set stage = 'waiting_team'
  where stage = 'new' and (last_message_at < now() - interval '5 minutes'
                           or not coalesce((select support_assistant from platform_settings limit 1), true));
  update support_threads set stage = 'closed'
  where stage = 'solved' and stage_at < now() - interval '7 days';
end;
$$;
revoke execute on function public.support_tick() from public, anon, authenticated;
select cron.schedule('support-tick', '*/5 * * * *', $$select public.support_tick()$$);

-- E2: starting to wait for a person tells the platform owners: the email (plan-alert, also to hello@saloqo.com) and,
-- for each platform owner with a salon login, a notice there (and a push) that opens Console → Support. Not the
-- platform owner who did it themselves.
create function public.on_support_waiting_team() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_who text;
  v_salon text;
  v_preview text;
begin
  select coalesce(new.name, (select mm.display_name from members mm where mm.user_id = new.user_id
                             order by (mm.business_id is not distinct from new.business_id) desc, mm.created_at limit 1)),
         (select b.name from businesses b where b.id = new.business_id),
         (select left(m.body, 120) from support_messages m where m.thread_id = new.id and m.author = 'user'
          order by m.created_at desc limit 1)
    into v_who, v_salon, v_preview;
  insert into notifications (business_id, member_id, type, title, body, data, entity_type, entity_id)
  select m.business_id, m.id, 'support_waiting', 'Support: someone is waiting for you',
         left(concat_ws(': ', concat_ws(' · ', coalesce(v_who, 'Someone'), v_salon), v_preview), 140),
         jsonb_strip_nulls(jsonb_build_object('who', coalesce(v_who, 'Someone'), 'salon', v_salon,
                                              'from', concat_ws(' · ', coalesce(v_who, 'Someone'), v_salon), 'preview', v_preview)),
         'support_console', new.id
  from platform_admins pa
  cross join lateral (select * from members mm where mm.user_id = pa.user_id and mm.active
                      order by mm.created_at limit 1) m
  where pa.user_id is distinct from auth.uid();
  perform public.dispatch_plan_alerts();
  return null;
end;
$$;
revoke execute on function public.on_support_waiting_team() from public, anon, authenticated;
create trigger support_threads_waiting_team after update of stage on public.support_threads
  for each row when (new.stage = 'waiting_team' and old.stage is distinct from 'waiting_team')
  execute function public.on_support_waiting_team();
-- (The handover trigger of migration 46 did part of this; the status covers it now.)
drop trigger support_threads_handover on public.support_threads;
drop function public.on_support_answer();

-- The email goes out for conversations waiting for a person (as before: handed over, the assistant off, or 5 minutes
-- without an answer), once per message from the salon. A New one caught by the last two waits for a person from now.
create or replace function public.claim_support_alerts()
returns table (thread_id uuid, who text, email text, salon text, salon_code text, preview text, admin_emails text[])
language plpgsql security definer set search_path = public as $$
declare
  v_assistant boolean := coalesce((select support_assistant from platform_settings limit 1), true);
begin
  return query
  with claimed as (
    update support_threads t set alerted_at = clock_timestamp(),
      stage = case when t.stage = 'new' then 'waiting_team' else t.stage end
    where t.alerted_at is null and t.last_message_at > now() - interval '7 days'
      and (t.stage = 'waiting_team'
           or (t.stage = 'new' and (not v_assistant or t.last_message_at < now() - interval '5 minutes')))
    returning t.*
  )
  select c.id, coalesce(c.name, mm.display_name), coalesce(c.email, case when u.email not like '%.staff.internal' then u.email::text end),
         b.name, b.code,
         (select left(m.body, 500) from support_messages m where m.thread_id = c.id and m.author = 'user'
          order by m.created_at desc limit 1),
         (select array_agg(au.email::text order by au.email) from platform_admins pa join auth.users au on au.id = pa.user_id
          where au.email is not null)
  from claimed c
  left join auth.users u on u.id = c.user_id
  left join businesses b on b.id = c.business_id
  left join lateral (select * from members m2 where m2.user_id = c.user_id order by m2.created_at limit 1) mm on true
  order by c.last_message_at;
end;
$$;

create or replace function public.dispatch_plan_alerts() returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key');
begin
  if v_url is null or v_key is null
     or (not exists (select 1 from plan_events where kind = 'request' and alerted_at is null
                     and created_at > now() - interval '7 days')
         and not exists (select 1 from support_threads t where t.alerted_at is null and t.last_message_at > now() - interval '7 days'
                         and (t.stage = 'waiting_team'
                              or (t.stage = 'new' and (not coalesce((select support_assistant from platform_settings limit 1), true)
                                                       or t.last_message_at < now() - interval '5 minutes'))))
         and not exists (select 1 from pilot_applications where alerted_at is null
                         and created_at > now() - interval '7 days')) then
    return null;
  end if;
  return net.http_post(url := v_url || '/functions/v1/plan-alert', body := '{}'::jsonb,
                       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key));
end;
$$;

-- The console's inbox, with each conversation's status, when it got there, and how long the first reply by a person
-- took (from the first message to the team's first answer, in the app or on WhatsApp). Waiting for you first.
drop function public.admin_support_threads();
create function public.admin_support_threads()
returns table (id uuid, status text, created_at timestamptz, last_message_at timestamptz, last_from text, unread int,
               who text, email text, salon text, salon_code text, role text, context jsonb, preview text, handover boolean,
               stage text, stage_at timestamptz, first_asked_at timestamptz, first_reply_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return query
    select t.id, t.status, t.created_at, t.last_message_at, t.last_from,
           (select count(*)::int from support_messages m where m.thread_id = t.id and m.author = 'user'
              and m.created_at > coalesce(t.support_read_at, '-infinity')),
           coalesce(t.name, mm.display_name, u.raw_user_meta_data ->> 'display_name'),
           coalesce(t.email, case when u.email not like '%.staff.internal' then u.email::text end),
           b.name, b.code, mm.role::text, t.context,
           -- What they last wrote (the assistant's answer is in the conversation).
           (select left(m.body, 140) from support_messages m where m.thread_id = t.id and m.author = 'user'
            order by m.created_at desc limit 1),
           t.handover, t.stage, t.stage_at,
           (select min(m.created_at) from support_messages m where m.thread_id = t.id and m.author = 'user'),
           (select min(m.created_at) from support_messages m where m.thread_id = t.id and m.author = 'support')
    from support_threads t
    left join auth.users u on u.id = t.user_id
    left join businesses b on b.id = t.business_id
    left join lateral (select * from members m2 where m2.user_id = t.user_id and m2.business_id = t.business_id
                       order by m2.created_at limit 1) mm on true
    order by array_position(array['waiting_team', 'new', 'waiting_salon', 'solved', 'closed'], t.stage), t.last_message_at desc
    limit 500;
end;
$$;
revoke execute on function public.admin_support_threads() from public, anon;
grant execute on function public.admin_support_threads() to authenticated;

-- B9 by the same statuses: open is New, Waiting for you and Waiting for salon; waiting is Waiting for you, since it
-- started waiting. Test salons are left out (as before).
create or replace function public.admin_support_stats() returns jsonb
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
    select * from threads where stage = 'waiting_team'
  ), recent as (
    select (select min(m.created_at) from support_messages m where m.thread_id = t.id and m.author = 'user') as asked,
           (select min(m.created_at) from support_messages m where m.thread_id = t.id and m.author = 'support') as answered
    from threads t
    where t.created_at > now() - interval '30 days'
  ), replies as (
    select extract(epoch from answered - asked) as seconds from recent where asked is not null and answered > asked
  )
  select jsonb_build_object(
    'open', (select count(*) from threads where stage in ('new', 'waiting_team', 'waiting_salon')),
    'waiting', (select count(*) from waiting),
    'oldest_waiting_at', (select min(stage_at) from waiting),
    'oldest_waiting_minutes', (select floor(extract(epoch from now() - min(stage_at)) / 60)::int from waiting),
    'replied_30d', (select count(*) from replies),
    'first_reply_seconds', (select round(avg(seconds))::bigint from replies))
    into v;
  return v;
end;
$$;
