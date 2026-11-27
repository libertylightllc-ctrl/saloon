-- Platform console, Part E3 (owner's brief; migration 124): internal notes only platform owners see; saved replies
-- written to Changes when added, changed or removed (a removed one is kept, hidden); and an answer on WhatsApp, only
-- to someone who said WhatsApp is OK, kept in the conversation as a person's reply and written to Changes.
begin;
create extension if not exists pgtap with schema extensions;
select set_config('salon.plan_check', 'off', false);
select plan(27);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
select ('00000000-0000-0000-0000-0000000098' || x)::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'tools-' || x || '@test.local', crypt('pw-12345', gen_salt('bf')), now(), now(), now(), '{}', '{}'
from unnest(array['a0', 'b1', 'b2']) x;
create function pg_temp.u(p text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000098' || p)::uuid $$;
create function pg_temp.as_user(p text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(p), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.th(p text) returns uuid language sql security definer as $$
  select id from support_threads where user_id = pg_temp.u(p) order by last_message_at desc limit 1
$$;

-- a0: a platform owner with a salon login (Sara). b1 (Layla, Palm Salon) and b2 (Omar, Cedar Cuts): salon owners.
select pg_temp.as_user('a0');
select create_business('{"business_name":"Admin Salon","owner_name":"Sara","mode":"gents","vat_mode":"off"}');
select pg_temp.as_user('b1');
select create_business('{"business_name":"Palm Salon","owner_name":"Layla","mode":"ladies","vat_mode":"off"}');
select support_send('{"body":"My receipts print blank."}');
select pg_temp.as_user('b2');
select create_business('{"business_name":"Cedar Cuts","owner_name":"Omar","mode":"gents","vat_mode":"off"}');
select support_send('{"body":"How do I add a barber?"}');
select pg_temp.as_admin();
delete from platform_admins;
insert into platform_admins (user_id) values (pg_temp.u('a0'));
select set_config('t.th', pg_temp.th('b1')::text, false);

-- Internal notes.
select pg_temp.as_user('b1');
select throws_ok(format($$ select admin_support_add_note(%L, 'Hi') $$, current_setting('t.th')), '42501', 'not_allowed',
  'a salon owner cannot write a note');
select throws_ok($$ select count(*) from support_notes $$, '42501', null, 'nor read them');
select pg_temp.as_user('a0');
select lives_ok(format($$ select admin_support_add_note(%L, 'Printer is a Star TSP100; asked for a photo') $$,
  current_setting('t.th')), 'a platform owner writes a note');
select throws_ok(format($$ select admin_support_add_note(%L, '   ') $$, current_setting('t.th')), '22023', 'message_required',
  'an empty note is refused');
select is((select admin_support_thread(current_setting('t.th')::uuid) -> 'notes' -> 0 ->> 'author'), 'Sara',
  'the console shows the note with who wrote it');
select is((select admin_support_thread(current_setting('t.th')::uuid) -> 'notes' -> 0 ->> 'body'),
  'Printer is a Star TSP100; asked for a photo', 'and what it says');
select pg_temp.as_user('b1');
select ok(not (support_mine() ? 'notes') and support_mine()::text not like '%Star TSP100%',
  'the person asking never sees the notes');

-- Saved replies.
select throws_ok($$ select admin_saved_replies() $$, '42501', 'not_allowed', 'a salon owner cannot see saved replies');
select throws_ok($$ select admin_save_reply('Hello', 'Hi there') $$, '42501', 'not_allowed', 'nor add one');
select pg_temp.as_user('a0');
select set_config('t.reply', admin_save_reply('Receipts', 'Hi {name}, thanks for writing from {salon}.')::text, false);
select is(jsonb_array_length(admin_saved_replies()), 1, 'a saved reply is added');
select pg_temp.as_admin();
select is((select array[subject, after ->> 'title', coalesce(before::text, 'none')] from platform_audit
           where action = 'support:saved_reply'), array['Receipts', 'Receipts', 'none'], 'and written to Changes');
select pg_temp.as_user('a0');
select admin_save_reply('Receipts blank', 'Hi {name}, please send a photo.', current_setting('t.reply')::uuid);
select is(admin_saved_replies() -> 0 ->> 'title', 'Receipts blank', 'changed');
select pg_temp.as_admin();
select is((select before ->> 'title' from platform_audit where action = 'support:saved_reply' and before is not null),
  'Receipts', 'with what it was before');
select pg_temp.as_user('a0');
select throws_ok($$ select admin_save_reply('R', 'Hi there') $$, '22023', 'invalid_saved_reply',
  'a title of one letter is refused');
select admin_remove_saved_reply(current_setting('t.reply')::uuid);
select is(jsonb_array_length(admin_saved_replies()), 0, 'removed: no longer offered');
select pg_temp.as_admin();
select isnt((select removed_at from support_saved_replies where id = current_setting('t.reply')::uuid), null,
  'but kept');
select is((select count(*)::int from platform_audit where action = 'support:saved_reply' and after ->> 'removed' = 'true'), 1,
  'and the removal is in Changes');

-- Reply on WhatsApp: only with the person's OK.
select pg_temp.as_user('a0');
select throws_ok(format($$ select admin_support_whatsapp(%L, 'Please send a photo') $$, current_setting('t.th')),
  '22023', 'no_whatsapp_ok', 'no number given: no WhatsApp');
select pg_temp.as_admin();
insert into owner_contacts (user_id, phone, whatsapp_ok, whatsapp_ok_at)
values (pg_temp.u('b1'), '+971501234567', true, now()), (pg_temp.u('b2'), '+971509876543', false, null);
select pg_temp.as_user('a0');
select throws_ok(format($$ select admin_support_whatsapp(%L, 'Hello') $$, pg_temp.th('b2')),
  '22023', 'no_whatsapp_ok', 'a number without the WhatsApp OK: no WhatsApp');
select is(admin_support_thread(pg_temp.th('b2')) ->> 'whatsapp', null, 'and the console is not given the number');
select is(admin_support_thread(current_setting('t.th')::uuid) ->> 'whatsapp', '+971501234567',
  'with the OK, the console has the number');
select pg_temp.as_user('b1');
select throws_ok(format($$ select admin_support_whatsapp(%L, 'Hello') $$, current_setting('t.th')), '42501', 'not_allowed',
  'a salon owner cannot answer as Saloqo');
select pg_temp.as_user('a0');
select is(admin_support_whatsapp(current_setting('t.th')::uuid, 'Please send a photo of the receipt'), '+971501234567',
  'the answer is kept and the number given back to open WhatsApp');
select ok((select first_reply_at is not null from admin_support_threads() where id = current_setting('t.th')::uuid),
  'it counts as the first reply by a person');
select pg_temp.as_admin();
select is((select array[t.stage, m.author, m.channel, t.handover::text]
           from support_threads t join support_messages m on m.thread_id = t.id
           where t.id = current_setting('t.th')::uuid order by m.created_at desc limit 1),
  array['waiting_salon', 'support', 'whatsapp', 'true'], 'kept as a person''s answer, marked WhatsApp: Waiting for salon');
select is((select array[subject, after ->> 'channel'] from platform_audit where action = 'support:whatsapp'),
  array['Layla', 'whatsapp'], 'written to Changes');
select pg_temp.as_user('b1');
select is(support_mine() -> 'messages' -> -1 ->> 'channel', 'whatsapp', 'the salon sees it came on WhatsApp');

select * from finish();
rollback;
