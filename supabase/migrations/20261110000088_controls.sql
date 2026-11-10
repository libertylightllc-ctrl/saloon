-- Part B, step 1 (brief B3): the owner's controls, per branch (Branch settings → Controls). Kept in branches.settings
-- beside the other branch settings; anything not set takes the brief's default. Money limits are in the salon's own
-- currency: the brief's QAR 200 / 5 / 20 are turned into about the same amount (QAR and AED: 200, 5, 20; a Kuwaiti
-- salon: 17, 0.42, 1.7, rounded the way starter prices are). staff_can_sell already existed ("Staff can take
-- payments"); it is now one of the controls.

create function public.control_defaults(p_currency text) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object(
    'discount_limit_bps', 1000,                                   -- front desk / stylist discount without approval
    'petty_cash_limit_minor', public.starter_price(20000, p_currency), -- petty cash from the drawer without approval
    'cash_reason_minor', public.starter_price(500, p_currency),   -- a cash difference this big needs a reason
    'cash_notify_minor', public.starter_price(2000, p_currency),  -- and this big tells the owner
    'blind_count', true,                                          -- the front desk counts before seeing the expected cash
    'staff_can_sell', false,                                      -- stylists take payments
    'staff_see_phones', false,                                    -- stylists see their clients' phone numbers
    'staff_book_self', true)                                      -- stylists add bookings for themselves
$$;

-- The branch's controls: the defaults with the owner's choices on top. Everyone who works in the branch reads them
-- (the app needs the limits to know when to ask for a manager's PIN).
create function public.branch_controls(p_branch uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_defaults jsonb;
  v_settings jsonb;
begin
  if not public.can_use_branch(p_branch) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select public.control_defaults(bz.currency), b.settings into v_defaults, v_settings
  from branches b join businesses bz on bz.id = b.business_id where b.id = p_branch;
  return v_defaults || coalesce((select jsonb_object_agg(k, v_settings -> k) from jsonb_object_keys(v_defaults) k
                                 where v_settings ? k and jsonb_typeof(v_settings -> k) <> 'null'), '{}');
end;
$$;

-- The same, for the database's own checks (no sign-in check: callers have already checked the person).
create function public.branch_control(p_branch uuid, p_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(b.settings -> p_key, 'null'::jsonb), public.control_defaults(bz.currency) -> p_key)
  from branches b join businesses bz on bz.id = b.business_id where b.id = p_branch
$$;
revoke execute on function public.branch_control(uuid, text) from public, anon, authenticated;

-- The owner saves the controls. Each change is one line in the audit trail, with the old and new value.
create function public.save_controls(p_branch uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  m members := public.require_can(p_branch, 'manageControls');
  v_now jsonb := public.branch_controls(p_branch);
  k text;
  v jsonb;
  v_changed int := 0;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception 'invalid_controls' using errcode = '22023';
  end if;
  for k, v in select * from jsonb_each(p) loop
    if not v_now ? k then
      raise exception 'unknown_setting: %', k using errcode = '22023';
    end if;
    if k in ('blind_count', 'staff_can_sell', 'staff_see_phones', 'staff_book_self') then
      if jsonb_typeof(v) <> 'boolean' then
        raise exception 'invalid_control: %', k using errcode = '22023';
      end if;
    elsif jsonb_typeof(v) <> 'number' or (v #>> '{}')::numeric <> trunc((v #>> '{}')::numeric)
          or (v #>> '{}')::numeric < 0
          or (k = 'discount_limit_bps' and (v #>> '{}')::numeric > 10000)
          or (v #>> '{}')::numeric > 1000000000000 then
      raise exception 'invalid_control: %', k using errcode = '22023';
    end if;
    if v_now -> k is distinct from v then
      perform public.write_audit(m.business_id, p_branch, m.id, 'update', 'control', p_branch,
        'Controls: ' || k || ' ' || (v_now ->> k) || ' → ' || (v #>> '{}'),
        jsonb_build_object(k, v_now -> k), jsonb_build_object(k, v));
      v_changed := v_changed + 1;
    end if;
  end loop;
  update branches set settings = settings || p where id = p_branch;
  return jsonb_build_object('changed', v_changed, 'controls', public.branch_controls(p_branch));
end;
$$;
revoke execute on function public.branch_controls(uuid), public.save_controls(uuid, jsonb) from public, anon;
