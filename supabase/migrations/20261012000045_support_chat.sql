-- Help & support chat (owner, 2026-10-12: "if anyone wants to contact us or says the app is not working … can we give
-- chat in app"; chose a chat inside the app). Anyone signed in writes from More → Help & support; a visitor (or someone
-- who cannot sign in) writes from the website or the sign-in screen, known by a secret kept on their device. Messages
-- come with where they came from (salon, device, screen). Platform owners answer in the console; a signed-in person is
-- notified of the answer, and platform owners are emailed about new messages (the plan-alert email, when Resend is set).
-- The tables are read and written only through the functions below.

create table public.support_threads (
  id uuid primary key default gen_random_uuid(),
  -- A deleted account takes its conversations with it.
  user_id uuid references auth.users (id) on delete cascade,
  business_id uuid references public.businesses (id) on delete set null,
  -- A visitor's conversation: the SHA-256 of the secret kept on their device (the secret itself is never stored).
  guest_token_hash text unique,
  name text check (name is null or length(name) between 2 and 80),
  email text check (email is null or (length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  status text not null default 'open' check (status in ('open', 'closed')),
  context jsonb not null default '{}',
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_from text not null default 'user' check (last_from in ('user', 'support')),
  user_read_at timestamptz,
  support_read_at timestamptz,
  -- Set when platform owners have been emailed about the latest message.
  alerted_at timestamptz,
  check (user_id is not null or guest_token_hash is not null)
);
-- One open conversation per person.
create unique index support_threads_open_user on public.support_threads (user_id) where user_id is not null and status = 'open';
create index support_threads_recent on public.support_threads (last_message_at desc);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads (id) on delete cascade,
  author text not null check (author in ('user', 'support')),
  author_user_id uuid references auth.users (id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index support_messages_thread on public.support_messages (thread_id, created_at);

alter table public.support_threads enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_threads, public.support_messages from anon, authenticated;

-- What a message says about where it came from: only short, known keys.
create function public.support_context(p jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select coalesce(jsonb_object_agg(k, left(v, 200)), '{}'::jsonb)
  from jsonb_each_text(coalesce(p, '{}'::jsonb)) as e(k, v)
  where k in ('platform', 'version', 'language', 'screen', 'device')
$$;

-- Adds a message to a conversation; a conversation that was closed opens again.
create function public.support_add(p_thread uuid, p_author text, p_body text) returns void
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
  update support_threads set last_message_at = clock_timestamp(), last_from = p_author, status = 'open',
    alerted_at = case when p_author = 'user' then null else alerted_at end,
    user_read_at = case when p_author = 'user' then clock_timestamp() else user_read_at end,
    support_read_at = case when p_author = 'support' then clock_timestamp() else support_read_at end
  where id = p_thread;
end;
$$;

create function public.support_thread_json(p_thread uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', t.id, 'status', t.status, 'name', t.name, 'email', t.email,
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'author', m.author, 'body', m.body,
                                                             'created_at', m.created_at) order by m.created_at)
                          from support_messages m where m.thread_id = t.id), '[]'::jsonb))
  from support_threads t where t.id = p_thread
$$;

-- ── Signed in ───────────────────────────────────────────────────────────────────────────

-- My conversation (the open one, else the latest), read now.
create function public.support_mine() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_thread uuid;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  select id into v_thread from support_threads where user_id = auth.uid()
    order by (status = 'open') desc, last_message_at desc limit 1;
  if v_thread is null then
    return jsonb_build_object('id', null, 'status', 'open', 'messages', '[]'::jsonb);
  end if;
  update support_threads set user_read_at = clock_timestamp() where id = v_thread;
  return public.support_thread_json(v_thread);
end;
$$;

-- Answers I have not read yet (the badge on More).
create function public.support_unread() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from support_messages m join support_threads t on t.id = m.thread_id
  where t.user_id = auth.uid() and m.author = 'support' and m.created_at > coalesce(t.user_read_at, '-infinity')
$$;

-- p: {body, context}
create function public.support_send(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_thread uuid;
  v_business uuid;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '28000';
  end if;
  select id into v_thread from support_threads where user_id = auth.uid() and status = 'open' for update;
  if v_thread is null then
    select business_id into v_business from members where user_id = auth.uid() and active order by created_at limit 1;
    insert into support_threads (user_id, business_id, context)
    values (auth.uid(), v_business, public.support_context(p -> 'context'))
    returning id into v_thread;
  elsif p ? 'context' then
    update support_threads set context = public.support_context(p -> 'context') where id = v_thread;
  end if;
  perform public.support_add(v_thread, 'user', p ->> 'body');
  return v_thread;
end;
$$;

-- ── Visitors (and anyone who cannot sign in) ────────────────────────────────────────────

create function public.support_token_hash(p_token text) returns text
language plpgsql immutable set search_path = public, extensions as $$
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32,128}$' then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  return encode(extensions.digest(p_token, 'sha256'), 'hex');
end;
$$;

-- p: {token, name, email, body, context}; the name and email are needed to start a conversation.
create function public.support_guest_send(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_hash text := public.support_token_hash(p ->> 'token');
  v_thread uuid;
  v_name text := nullif(btrim(coalesce(p ->> 'name', '')), '');
  v_email text := lower(nullif(btrim(coalesce(p ->> 'email', '')), ''));
begin
  select id into v_thread from support_threads where guest_token_hash = v_hash for update;
  if v_thread is null then
    if v_name is null or length(v_name) < 2 or length(v_name) > 80 then
      raise exception 'name_required' using errcode = '22023';
    end if;
    if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then
      raise exception 'invalid_email' using errcode = '22023';
    end if;
    -- A flood of new visitor conversations is refused (at most 30 in 10 minutes across the service).
    if (select count(*) from support_threads where guest_token_hash is not null
        and created_at > now() - interval '10 minutes') >= 30 then
      raise exception 'rate_limited' using errcode = '22023';
    end if;
    insert into support_threads (guest_token_hash, name, email, context)
    values (v_hash, v_name, v_email, public.support_context(p -> 'context'))
    returning id into v_thread;
  end if;
  perform public.support_add(v_thread, 'user', p ->> 'body');
end;
$$;

-- The visitor's conversation, read now (empty before the first message).
create function public.support_guest_thread(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_thread uuid;
begin
  select id into v_thread from support_threads where guest_token_hash = public.support_token_hash(p_token);
  if v_thread is null then
    return jsonb_build_object('id', null, 'status', 'open', 'messages', '[]'::jsonb);
  end if;
  update support_threads set user_read_at = clock_timestamp() where id = v_thread;
  return public.support_thread_json(v_thread);
end;
$$;

-- ── Platform owners (the console) ───────────────────────────────────────────────────────

create function public.admin_support_threads()
returns table (id uuid, status text, created_at timestamptz, last_message_at timestamptz, last_from text, unread int,
               who text, email text, salon text, salon_code text, role text, context jsonb, preview text)
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
           (select left(m.body, 140) from support_messages m where m.thread_id = t.id order by m.created_at desc limit 1)
    from support_threads t
    left join auth.users u on u.id = t.user_id
    left join businesses b on b.id = t.business_id
    left join lateral (select * from members m2 where m2.user_id = t.user_id and m2.business_id = t.business_id
                       order by m2.created_at limit 1) mm on true
    order by (t.status = 'open') desc, t.last_message_at desc
    limit 500;
end;
$$;

-- A conversation, marked read by support.
create function public.admin_support_thread(p_thread uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update support_threads set support_read_at = clock_timestamp() where id = p_thread;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return public.support_thread_json(p_thread);
end;
$$;

-- An answer; a signed-in person is told in the app (and by push).
create function public.admin_support_reply(p_thread uuid, p_body text) returns void
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
  select * into m from members where user_id = t.user_id and active
    order by (business_id is not distinct from t.business_id) desc, created_at limit 1;
  if m.id is not null then
    insert into notifications (business_id, member_id, type, title, body, data, entity_type, entity_id)
    values (m.business_id, m.id, 'support_reply', 'Saloqo support answered',
            left(btrim(p_body), 140), jsonb_build_object('preview', left(btrim(p_body), 140)), 'support', t.id);
  end if;
end;
$$;

create function public.admin_support_close(p_thread uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update support_threads set status = 'closed', support_read_at = clock_timestamp() where id = p_thread;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;

-- ── Emails to platform owners (plan-alert sends them with the plan requests) ─────────────

create function public.claim_support_alerts()
returns table (thread_id uuid, who text, email text, salon text, salon_code text, preview text, admin_emails text[])
language plpgsql security definer set search_path = public as $$
begin
  return query
  with claimed as (
    update support_threads t set alerted_at = clock_timestamp()
    where t.alerted_at is null and t.last_from = 'user' and t.last_message_at > now() - interval '7 days'
    returning t.*
  )
  select c.id, coalesce(c.name, mm.display_name), coalesce(c.email, case when u.email not like '%.staff.internal' then u.email::text end),
         b.name, b.code,
         (select left(m.body, 500) from support_messages m where m.thread_id = c.id order by m.created_at desc limit 1),
         (select array_agg(au.email::text order by au.email) from platform_admins pa join auth.users au on au.id = pa.user_id
          where au.email is not null)
  from claimed c
  left join auth.users u on u.id = c.user_id
  left join businesses b on b.id = c.business_id
  left join lateral (select * from members m2 where m2.user_id = c.user_id order by m2.created_at limit 1) mm on true
  order by c.last_message_at;
end;
$$;

create function public.unclaim_support_alert(p_thread uuid) returns void
language sql security definer set search_path = public as $$
  update support_threads set alerted_at = null where id = p_thread
$$;

-- A new message asks plan-alert to send what is waiting (and the 10-minute retry catches anything missed).
create or replace function public.dispatch_plan_alerts() returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key');
begin
  if v_url is null or v_key is null
     or (not exists (select 1 from plan_events where kind = 'request' and alerted_at is null
                     and created_at > now() - interval '7 days')
         and not exists (select 1 from support_threads where alerted_at is null and last_from = 'user'
                         and last_message_at > now() - interval '7 days')) then
    return null;
  end if;
  return net.http_post(url := v_url || '/functions/v1/plan-alert', body := '{}'::jsonb,
                       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key));
end;
$$;

create function public.on_support_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.dispatch_plan_alerts();
  return null;
end;
$$;
create trigger support_messages_alert after insert on public.support_messages
  for each row when (new.author = 'user') execute function public.on_support_message();

revoke execute on function public.support_context(jsonb), public.support_add(uuid, text, text),
  public.support_thread_json(uuid), public.support_token_hash(text), public.on_support_message(),
  public.claim_support_alerts(), public.unclaim_support_alert(uuid) from public, anon, authenticated;
grant execute on function public.claim_support_alerts(), public.unclaim_support_alert(uuid) to service_role;
revoke execute on function public.support_mine(), public.support_unread(), public.support_send(jsonb),
  public.admin_support_threads(), public.admin_support_thread(uuid), public.admin_support_reply(uuid, text),
  public.admin_support_close(uuid) from public, anon;
grant execute on function public.support_mine(), public.support_unread(), public.support_send(jsonb),
  public.admin_support_threads(), public.admin_support_thread(uuid), public.admin_support_reply(uuid, text),
  public.admin_support_close(uuid) to authenticated;
-- Visitors write without signing in; the device's secret is what lets them read the answers.
revoke execute on function public.support_guest_send(jsonb), public.support_guest_thread(text) from public;
grant execute on function public.support_guest_send(jsonb), public.support_guest_thread(text) to anon, authenticated;
