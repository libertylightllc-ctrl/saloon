-- Pushes could stop for good (found 2026-10-20 by the notifications e2e test): send-push marked each batch of up to
-- 300 waiting notifications as taken with one request listing their ids; past about 200 ids that request is longer
-- than the API gateway accepts (414), nothing was marked, and every minute the same oldest 300 were tried again, so no
-- newer notification ever reached a phone. That happens whenever more than ~200 are waiting at once (e.g. the
-- morning summary to every owner in the same minute). Now the database takes the batch in one step, with each
-- person's phones, and nothing is listed in a URL.

-- Takes up to p_limit waiting notifications from the last day (oldest first; skips any another run has just taken),
-- marks them pushed, and gives them back with the push tokens of the person each is for. Service role only.
create function public.claim_pending_push(p_limit int default 300)
returns table (id uuid, member_id uuid, type text, title text, body text, entity_type text, entity_id uuid, tokens text[])
language sql volatile security definer set search_path = public as $$
  with taken as (
    update notifications n set pushed_at = now()
    where n.id in (select x.id from notifications x
                   where x.pushed_at is null and x.created_at > now() - interval '1 day'
                   order by x.created_at limit greatest(p_limit, 1) for update skip locked)
    returning n.id, n.member_id, n.type, n.title, n.body, n.entity_type, n.entity_id, n.created_at
  )
  select t.id, t.member_id, t.type, t.title, t.body, t.entity_type, t.entity_id,
         coalesce((select array_agg(p.token order by p.token) from push_tokens p where p.member_id = t.member_id), '{}')
  from taken t order by t.created_at
$$;
revoke execute on function public.claim_pending_push(int) from public, anon, authenticated;
grant execute on function public.claim_pending_push(int) to service_role;
