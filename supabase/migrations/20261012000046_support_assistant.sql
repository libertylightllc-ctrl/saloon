-- Claude answers Help & support first (owner, 2026-10-12: "Claude to handle — any problem, you should solve it"; chose
-- "Claude answers support chats"). A new message from someone asks the support-assistant function to answer; its
-- answers are marked as the AI assistant's. When it cannot solve something, or someone asks for a person, it says a
-- person will follow up and hands the conversation over: from then on only platform owners answer it (until it is closed
-- and someone writes again), and they are emailed. A platform owner's own answer also takes the conversation over.
-- Platform owners can switch the assistant off. Without the ANTHROPIC_API_KEY secret nothing is answered automatically
-- and platform owners are emailed as before.

alter table public.support_messages drop constraint support_messages_author_check;
alter table public.support_messages add constraint support_messages_author_check
  check (author in ('user', 'support', 'assistant'));
alter table public.support_threads drop constraint support_threads_last_from_check;
alter table public.support_threads add constraint support_threads_last_from_check
  check (last_from in ('user', 'support', 'assistant'));
alter table public.support_threads
  add column handover boolean not null default false,
  add column assistant_claimed_at timestamptz;
alter table public.platform_settings add column support_assistant boolean not null default true;

-- A conversation that was closed starts afresh with the assistant when someone writes again.
create or replace function public.support_add(p_thread uuid, p_author text, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
begin
  if length(v_body) < 1 or length(v_body) > 2000 then
    raise exception 'message_required' using errcode = '22023';
  end if;
  -- At most 10 messages a minute in one conversation.
  if p_author = 'user' and (select count(*) from support_messages where thread_id = p_thread and author = 'user'
                            and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'rate_limited' using errcode = '22023';
  end if;
  -- The moment itself (not the transaction's start), so messages and "read" marks keep their exact order.
  insert into support_messages (thread_id, author, author_user_id, body, created_at)
  values (p_thread, p_author, auth.uid(), v_body, clock_timestamp());
  update support_threads set last_message_at = clock_timestamp(), last_from = p_author,
    handover = case when p_author = 'user' and status = 'closed' then false else handover end,
    status = 'open',
    alerted_at = case when p_author = 'user' then null else alerted_at end,
    user_read_at = case when p_author = 'user' then clock_timestamp() else user_read_at end,
    -- Only a platform owner's own answer marks the conversation read in the console (the assistant's does not).
    support_read_at = case when p_author = 'support' then clock_timestamp() else support_read_at end
  where id = p_thread;
end;
$$;

-- Answers not yet read count the assistant's too.
create or replace function public.support_unread() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from support_messages m join support_threads t on t.id = m.thread_id
  where t.user_id = auth.uid() and m.author <> 'user' and m.created_at > coalesce(t.user_read_at, '-infinity')
$$;

-- A platform owner's answer takes the conversation over from the assistant.
create or replace function public.admin_support_reply(p_thread uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare
  t support_threads;
  m members;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into t from support_threads where id = p_thread for update;
  if t.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  perform public.support_add(t.id, 'support', p_body);
  update support_threads set handover = true where id = t.id;
  select * into m from members where user_id = t.user_id and active
    order by (business_id is not distinct from t.business_id) desc, created_at limit 1;
  if m.id is not null then
    insert into notifications (business_id, member_id, type, title, body, data, entity_type, entity_id)
    values (m.business_id, m.id, 'support_reply', 'Saloqo support answered',
            left(btrim(p_body), 140), jsonb_build_object('preview', left(btrim(p_body), 140)), 'support', t.id);
  end if;
end;
$$;

-- The console list says which conversations need a person.
drop function public.admin_support_threads();
create function public.admin_support_threads()
returns table (id uuid, status text, created_at timestamptz, last_message_at timestamptz, last_from text, unread int,
               who text, email text, salon text, salon_code text, role text, context jsonb, preview text, handover boolean)
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
           t.handover
    from support_threads t
    left join auth.users u on u.id = t.user_id
    left join businesses b on b.id = t.business_id
    left join lateral (select * from members m2 where m2.user_id = t.user_id and m2.business_id = t.business_id
                       order by m2.created_at limit 1) mm on true
    order by (t.status = 'open') desc, t.last_message_at desc
    limit 500;
end;
$$;
revoke execute on function public.admin_support_threads() from public, anon;
grant execute on function public.admin_support_threads() to authenticated;

-- The assistant switch (platform owners).
create function public.admin_set_support_assistant(p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update platform_settings set support_assistant = coalesce(p_on, true) where true;
end;
$$;
revoke execute on function public.admin_set_support_assistant(boolean) from public, anon;
grant execute on function public.admin_set_support_assistant(boolean) to authenticated;

-- ── The assistant (support-assistant function, service role) ────────────────────────────

-- Conversations waiting for an answer it may give, claimed for two minutes so an overlapping run cannot answer twice;
-- with what it needs: the messages so far and, for someone signed in, their salon.
create function public.claim_support_assistant()
returns table (thread_id uuid, signed_in boolean, who text, role text, salon text, country_code text, modes text,
               plan_active boolean, people int, context jsonb, messages jsonb)
language plpgsql security definer set search_path = public as $$
begin
  if not (select support_assistant from platform_settings limit 1) then
    return;
  end if;
  return query
  with claimed as (
    update support_threads t set assistant_claimed_at = clock_timestamp()
    where t.status = 'open' and t.last_from = 'user' and not t.handover
      and t.last_message_at > now() - interval '1 day'
      and (t.assistant_claimed_at is null or t.assistant_claimed_at < now() - interval '2 minutes')
    returning t.*
  )
  select c.id, c.user_id is not null, coalesce(c.name, mm.display_name), mm.role::text, b.name, b.country_code,
         (select string_agg(distinct br.mode::text, ', ') from branches br where br.business_id = b.id),
         (select s.paid_until >= public.business_today(b.id) from subscriptions s where s.business_id = b.id),
         (select q.people from public.plan_quote(b.id) q),
         c.context,
         (select jsonb_agg(jsonb_build_object('author', m.author, 'body', m.body) order by m.created_at)
          from (select * from support_messages m2 where m2.thread_id = c.id order by m2.created_at desc limit 30) m)
  from claimed c
  left join businesses b on b.id = c.business_id
  left join lateral (select * from members m3 where m3.user_id = c.user_id and m3.business_id = c.business_id
                     order by m3.created_at limit 1) mm on true;
end;
$$;

-- The assistant's answer, unless someone else answered meanwhile. `p_handover`: it asks for a person.
create function public.support_assistant_reply(p_thread uuid, p_body text, p_handover boolean) returns boolean
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

-- A claim given back when the answer could not be made (the next run tries again).
create function public.unclaim_support_assistant(p_thread uuid) returns void
language sql security definer set search_path = public as $$
  update support_threads set assistant_claimed_at = null where id = p_thread
$$;

-- Ask support-assistant to answer what is waiting.
create function public.dispatch_support_assistant() returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key');
begin
  if v_url is null or v_key is null or not (select support_assistant from platform_settings limit 1)
     or not exists (select 1 from support_threads where status = 'open' and last_from = 'user' and not handover
                    and last_message_at > now() - interval '1 day') then
    return null;
  end if;
  return net.http_post(url := v_url || '/functions/v1/support-assistant', body := '{}'::jsonb,
                       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key));
end;
$$;

-- Someone writes: the assistant and the email are woken once the conversation shows a message waiting. (Woken from the
-- new message itself, the conversation still showed the assistant's last answer, so a follow-up question waited for
-- the 2-minute retry.)
drop trigger support_messages_alert on public.support_messages;
drop function public.on_support_message();
create function public.on_support_waiting() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.dispatch_support_assistant();
  perform public.dispatch_plan_alerts();
  return null;
end;
$$;
create trigger support_threads_waiting after update of last_message_at on public.support_threads
  for each row when (new.last_from = 'user' and new.last_message_at is distinct from old.last_message_at)
  execute function public.on_support_waiting();
-- An answer the assistant could not give (an outage) is tried again.
select cron.schedule('support-assistant', '*/2 * * * *', $$select public.dispatch_support_assistant()$$);

-- Platform owners are emailed when a conversation needs a person: the assistant handed it over, the assistant is off,
-- or nobody has answered in five minutes (no key, or an outage).
create or replace function public.claim_support_alerts()
returns table (thread_id uuid, who text, email text, salon text, salon_code text, preview text, admin_emails text[])
language plpgsql security definer set search_path = public as $$
begin
  return query
  with claimed as (
    update support_threads t set alerted_at = clock_timestamp()
    where t.alerted_at is null and t.status = 'open' and t.last_message_at > now() - interval '7 days'
      and (t.handover or not (select support_assistant from platform_settings limit 1)
           or (t.last_from = 'user' and t.last_message_at < now() - interval '5 minutes'))
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

-- The dispatcher wakes plan-alert only when something is due.
create or replace function public.dispatch_plan_alerts() returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key');
begin
  if v_url is null or v_key is null
     or (not exists (select 1 from plan_events where kind = 'request' and alerted_at is null
                     and created_at > now() - interval '7 days')
         and not exists (select 1 from support_threads t where t.alerted_at is null and t.status = 'open'
                         and t.last_message_at > now() - interval '7 days'
                         and (t.handover or not (select support_assistant from platform_settings limit 1)
                              or (t.last_from = 'user' and t.last_message_at < now() - interval '5 minutes')))) then
    return null;
  end if;
  return net.http_post(url := v_url || '/functions/v1/plan-alert', body := '{}'::jsonb,
                       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key));
end;
$$;

-- The assistant's answer arrives the same way a platform owner's does; a handover also wakes the email.
create function public.on_support_answer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.handover and not old.handover then
    perform public.dispatch_plan_alerts();
  end if;
  return null;
end;
$$;
create trigger support_threads_handover after update of handover on public.support_threads
  for each row execute function public.on_support_answer();

revoke execute on function public.claim_support_assistant(), public.support_assistant_reply(uuid, text, boolean),
  public.unclaim_support_assistant(uuid), public.dispatch_support_assistant(), public.on_support_answer(),
  public.on_support_waiting()
  from public, anon, authenticated;
grant execute on function public.claim_support_assistant(), public.support_assistant_reply(uuid, text, boolean),
  public.unclaim_support_assistant(uuid) to service_role;
