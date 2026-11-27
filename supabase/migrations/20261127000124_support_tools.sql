-- Reply tools in the console's Support tab (owner's console brief, Part E3, 27 Nov 2026):
--   * Saved replies: answers the team writes often, filled in with the person's name and salon when used. Adding,
--     changing and removing one is written to Changes; a removed one is kept, only hidden.
--   * Reply on WhatsApp: only to someone who said WhatsApp is OK (owner_contacts.whatsapp_ok). The answer is kept in
--     the conversation marked as sent on WhatsApp, counts as a person's reply, and is written to Changes. The console
--     then opens WhatsApp with the text; what happens there is not known here.
--   * Internal notes: for platform owners only, kept apart from the messages, so the person asking never sees them.
-- (First reply time per conversation is in migration 123's console list.)

-- 1. Internal notes.
create table public.support_notes (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  -- Who wrote it, as they were called then.
  author text not null,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index support_notes_thread on public.support_notes (thread_id, created_at);
-- Only through the functions below (platform owners only).
alter table public.support_notes enable row level security;
revoke all on public.support_notes from anon, authenticated;

-- 2. Saved replies.
create table public.support_saved_replies (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 2 and 60),
  body text not null check (length(btrim(body)) between 2 and 2000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz
);
alter table public.support_saved_replies enable row level security;
revoke all on public.support_saved_replies from anon, authenticated;

-- The platform owner using the console, by the name the team knows them by.
create function public.platform_admin_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select m.display_name from members m where m.user_id = auth.uid() and m.active order by m.created_at limit 1),
    (select u.email::text from auth.users u where u.id = auth.uid()),
    'Saloqo')
$$;
revoke execute on function public.platform_admin_name() from public, anon, authenticated;

-- Who wrote a conversation, as Changes names them (the same as migration 123's status changes).
create function public.support_who(p_thread uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(t.name, (select mm.display_name from members mm where mm.user_id = t.user_id
                           order by (mm.business_id is not distinct from t.business_id) desc, mm.created_at limit 1),
                  t.email)
  from support_threads t where t.id = p_thread
$$;
revoke execute on function public.support_who(uuid) from public, anon, authenticated;

create function public.admin_support_add_note(p_thread uuid, p_body text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if length(v_body) < 1 or length(v_body) > 2000 then
    raise exception 'message_required' using errcode = '22023';
  end if;
  if not exists (select 1 from support_threads where id = p_thread) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  insert into support_notes (thread_id, author_id, author, body)
  values (p_thread, auth.uid(), public.platform_admin_name(), v_body);
end;
$$;
revoke execute on function public.admin_support_add_note(uuid, text) from public, anon;
grant execute on function public.admin_support_add_note(uuid, text) to authenticated;

create function public.admin_saved_replies() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'body', r.body,
                                                       'updated_at', r.updated_at) order by lower(r.title))
                   from support_saved_replies r where r.removed_at is null), '[]'::jsonb);
end;
$$;
revoke execute on function public.admin_saved_replies() from public, anon;
grant execute on function public.admin_saved_replies() to authenticated;

-- Adds one (no id) or changes one (its id). {name} and {salon} in the text are filled in when it is used.
create function public.admin_save_reply(p_title text, p_body text, p_id uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  r support_saved_replies;
  v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if length(v_title) < 2 or length(v_title) > 60 or length(v_body) < 2 or length(v_body) > 2000 then
    raise exception 'invalid_saved_reply' using errcode = '22023';
  end if;
  if p_id is null then
    insert into support_saved_replies (title, body, created_by) values (v_title, v_body, auth.uid()) returning id into v_id;
    perform public.platform_audit_write('support:saved_reply', null, v_title, null,
      jsonb_build_object('title', v_title, 'body', left(v_body, 500)));
    return v_id;
  end if;
  select * into r from support_saved_replies where id = p_id and removed_at is null for update;
  if r.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if r.title = v_title and r.body = v_body then
    return r.id;
  end if;
  update support_saved_replies set title = v_title, body = v_body, updated_at = now() where id = r.id;
  perform public.platform_audit_write('support:saved_reply', null, v_title,
    jsonb_build_object('title', r.title, 'body', left(r.body, 500)),
    jsonb_build_object('title', v_title, 'body', left(v_body, 500)));
  return r.id;
end;
$$;
revoke execute on function public.admin_save_reply(text, text, uuid) from public, anon;
grant execute on function public.admin_save_reply(text, text, uuid) to authenticated;

create function public.admin_remove_saved_reply(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r support_saved_replies;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into r from support_saved_replies where id = p_id and removed_at is null for update;
  if r.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  update support_saved_replies set removed_at = now() where id = r.id;
  perform public.platform_audit_write('support:saved_reply', null, r.title,
    jsonb_build_object('title', r.title, 'body', left(r.body, 500)), jsonb_build_object('removed', true));
end;
$$;
revoke execute on function public.admin_remove_saved_reply(uuid) from public, anon;
grant execute on function public.admin_remove_saved_reply(uuid) to authenticated;

-- 3. The WhatsApp number of the person who wrote, only when they said WhatsApp is OK.
create function public.support_whatsapp_of(p_thread uuid) returns text
language sql stable security definer set search_path = public as $$
  select c.phone from support_threads t join owner_contacts c on c.user_id = t.user_id
  where t.id = p_thread and c.whatsapp_ok
$$;
revoke execute on function public.support_whatsapp_of(uuid) from public, anon, authenticated;

-- The answer is kept (on WhatsApp) and the number returned for the console to open WhatsApp with it.
create function public.admin_support_whatsapp(p_thread uuid, p_body text) returns text
language plpgsql security definer set search_path = public as $$
declare
  t support_threads;
  v_phone text;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into t from support_threads where id = p_thread for update;
  if t.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_phone := public.support_whatsapp_of(t.id);
  if v_phone is null then
    raise exception 'no_whatsapp_ok' using errcode = '22023';
  end if;
  perform public.support_add(t.id, 'support', p_body, 'whatsapp');
  update support_threads set handover = true where id = t.id;
  perform public.platform_audit_write('support:whatsapp', t.business_id, public.support_who(t.id), null,
    jsonb_build_object('channel', 'whatsapp'));
  return v_phone;
end;
$$;
revoke execute on function public.admin_support_whatsapp(uuid, text) from public, anon;
grant execute on function public.admin_support_whatsapp(uuid, text) to authenticated;

-- 4. A conversation in the console: what the person sees, plus its status, the internal notes and the WhatsApp
-- number when it is OK to use. (support_thread_json, what the person asking reads, never has the notes.)
create or replace function public.admin_support_thread(p_thread uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t support_threads;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update support_threads set support_read_at = clock_timestamp() where id = p_thread returning * into t;
  if t.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return public.support_thread_json(t.id) || jsonb_build_object(
    'stage', t.stage,
    'whatsapp', public.support_whatsapp_of(t.id),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'author', n.author, 'body', n.body,
                                                           'created_at', n.created_at) order by n.created_at)
                       from support_notes n where n.thread_id = t.id), '[]'::jsonb));
end;
$$;
