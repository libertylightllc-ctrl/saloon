-- One waiting plan request per salon (owner's fix list #6, 26 Oct 2026). While a request has not been paid
-- (activate) or ended, asking again is refused: two phones, or a second tap before the screen shows the first one,
-- made a second request and a second email to the platform owners. Same function as migration 67 otherwise.
create or replace function public.request_plan(p_business uuid, p_months int, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  q record;
begin
  if not public.has_role(p_business, array['owner']::member_role[]) then
    raise exception 'not_allowed' using errcode = '42501';
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
