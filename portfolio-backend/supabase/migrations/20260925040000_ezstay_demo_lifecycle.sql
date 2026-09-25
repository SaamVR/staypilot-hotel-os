-- EZStay public demo lifecycle.
-- Creates isolated Northstar Grand tenants for authenticated demo identities.
-- No external provider credentials are stored or requested here.

create or replace function private.ezstay_active_demo_session(target_user_id uuid)
returns platform.demo_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  result platform.demo_sessions;
  ezstay_app_id uuid;
begin
  select id into ezstay_app_id
  from platform.applications
  where key = 'ezstay'
    and status = 'active';

  if ezstay_app_id is null then
    raise exception 'ezstay_application_not_registered';
  end if;

  update platform.demo_sessions
  set status = 'expired',
      last_activity_at = now()
  where app_id = ezstay_app_id
    and user_id = target_user_id
    and status = 'active'
    and expires_at <= now();

  select *
  into result
  from platform.demo_sessions
  where app_id = ezstay_app_id
    and user_id = target_user_id
    and status = 'active'
    and expires_at > now()
  order by created_at desc
  limit 1;

  return result;
end;
$$;

create or replace function private.seed_ezstay_northstar_v2(
  target_hotel_id uuid,
  target_user_id uuid,
  target_demo_now timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  room_103_id uuid;
  room_108_id uuid;
  room_204_id uuid;
  room_207_id uuid;
  res_1047_id uuid;
  res_1048_id uuid;
  sheets_id uuid;
  guest_rule_id uuid;
  seed_run_id uuid;
  seed_delivery_id uuid;
begin
  insert into ezstay.hotel_members (hotel_id, user_id, role, status)
  values (target_hotel_id, target_user_id, 'owner', 'active');

  insert into ezstay.rooms (
    id, hotel_id, number, room_type, occupancy, housekeeping, maintenance, metadata
  )
  select
    gen_random_uuid(),
    target_hotel_id,
    room_number,
    case
      when room_number in ('106','112','206','212') then 'Sky Suite'
      when room_number::integer % 2 = 0 then 'Deluxe King'
      else 'City Queen'
    end,
    case
      when room_number in ('108') then 'Occupied'
      when room_number in ('105','110','202','204','211') then 'Reserved'
      else 'Vacant'
    end,
    case when room_number = '103' then 'Cleaning' else 'Clean' end,
    case when room_number = '207' then 'Out of order' else 'Clear' end,
    jsonb_build_object('fixture_key', 'room_' || room_number)
  from (
    select (floor_no * 100 + room_no)::text as room_number
    from generate_series(1,2) as floor_no
    cross join generate_series(1,12) as room_no
  ) rooms;

  select id into room_103_id from ezstay.rooms where hotel_id = target_hotel_id and number = '103';
  select id into room_108_id from ezstay.rooms where hotel_id = target_hotel_id and number = '108';
  select id into room_204_id from ezstay.rooms where hotel_id = target_hotel_id and number = '204';
  select id into room_207_id from ezstay.rooms where hotel_id = target_hotel_id and number = '207';

  -- Preserve the validated V2 relationship: Olivia Martin is Deluxe King room 204.
  update ezstay.rooms
  set room_type = 'Deluxe King'
  where id = room_204_id;

  update ezstay.rooms
  set room_type = 'City Queen'
  where id = room_108_id;

  res_1047_id := gen_random_uuid();
  res_1048_id := gen_random_uuid();

  insert into ezstay.reservations (
    id, hotel_id, external_ref, guest_name, source, room_id, room_type,
    check_in, check_out, guests, total, paid, status, metadata
  ) values
    (
      res_1047_id, target_hotel_id, 'EZ-1047', 'Noah Williams', 'Airbnb',
      room_108_id, 'City Queen',
      (target_demo_now at time zone 'Asia/Dhaka')::date - 1,
      (target_demo_now at time zone 'Asia/Dhaka')::date,
      2, 418, 418, 'Checked in',
      '{"fixture_key":"res_1047"}'::jsonb
    ),
    (
      res_1048_id, target_hotel_id, 'EZ-1048', 'Olivia Martin', 'Booking.com',
      room_204_id, 'Deluxe King',
      (target_demo_now at time zone 'Asia/Dhaka')::date,
      (target_demo_now at time zone 'Asia/Dhaka')::date + 2,
      2, 684, 684, 'Confirmed',
      '{"fixture_key":"res_1048"}'::jsonb
    );

  insert into ezstay.guest_requests (
    hotel_id, reservation_id, room_id, request, category, urgency, status,
    source_event_id, created_at
  ) values (
    target_hotel_id, res_1047_id, room_108_id,
    'Extra towels requested', 'Housekeeping', 'Normal', 'Open',
    'evt_seed_request_108', target_demo_now - interval '22 minutes'
  );

  insert into ezstay.tasks (
    hotel_id, room_id, title, team, status, due_at, automated, source_event_id, metadata
  ) values
    (
      target_hotel_id, room_103_id, 'Full turnover', 'Housekeeping',
      'In progress', target_demo_now + interval '15 minutes', true,
      'evt_seed_turnover_103', '{"fixture_key":"task_103_turnover"}'::jsonb
    ),
    (
      target_hotel_id, room_207_id, 'HVAC inspection', 'Maintenance',
      'Assigned', target_demo_now + interval '30 minutes', false,
      null, '{"fixture_key":"task_207_hvac"}'::jsonb
    );

  insert into ezstay.tasks (
    hotel_id, reservation_id, room_id, title, team, status, due_at,
    automated, source_event_id, metadata
  ) values (
    target_hotel_id, res_1047_id, room_108_id, 'Extra towels requested',
    'Housekeeping', 'New', target_demo_now + interval '5 minutes',
    true, 'evt_seed_task_108', '{"fixture_key":"task_108_towels"}'::jsonb
  );

  sheets_id := gen_random_uuid();

  insert into ezstay.inventory_items (
    id, hotel_id, item, category, stock, par, unit, unit_cost, supplier
  ) values
    (gen_random_uuid(), target_hotel_id, 'Bath towels', 'Linen', 86, 72, 'pcs', 8.50, 'Coastal Textile'),
    (sheets_id, target_hotel_id, 'Queen bed sheets', 'Linen', 34, 42, 'sets', 18.00, 'Coastal Textile'),
    (gen_random_uuid(), target_hotel_id, 'Shampoo 40ml', 'Amenities', 212, 160, 'bottles', 0.65, 'GuestCare'),
    (gen_random_uuid(), target_hotel_id, 'Dental kits', 'Amenities', 78, 96, 'kits', 0.90, 'GuestCare'),
    (gen_random_uuid(), target_hotel_id, 'Laundry detergent', 'Housekeeping', 18, 20, 'litres', 4.40, 'CleanPro'),
    (gen_random_uuid(), target_hotel_id, 'Minibar water', 'F&B', 146, 120, 'bottles', 0.35, 'Fresh Supply');

  insert into ezstay.approvals (
    hotel_id, inventory_item_id, type, title, detail, amount, quantity,
    status, requested_by_actor, payload, created_at
  ) values (
    target_hotel_id, sheets_id, 'Purchase order', 'Queen bed sheet restock',
    '20 sets · Coastal Textile', 360, 20, 'Pending', 'EZStay automation',
    '{"fixture_key":"apr_103","inventory_fixture_key":"inv_queen_sheets"}'::jsonb,
    target_demo_now - interval '34 minutes'
  );

  insert into ezstay.automation_rules (
    hotel_id, rule_key, name, event_type, status, autonomy, config
  ) values
    (target_hotel_id, 'reservation-intake', 'Reservation intake', 'reservation.created', 'Active', 'Auto', '{}'::jsonb),
    (target_hotel_id, 'checkout-turnover', 'Checkout turnover', 'guest.checked_out', 'Active', 'Auto', '{}'::jsonb),
    (target_hotel_id, 'prearrival-message', 'Pre-arrival message', 'prearrival.due', 'Active', 'Auto', '{}'::jsonb),
    (target_hotel_id, 'occupancy-rate-guard', 'Occupancy rate guard', 'occupancy.threshold', 'Active', 'Policy', '{}'::jsonb),
    (target_hotel_id, 'failed-payment-recovery', 'Failed payment recovery', 'payment.failed', 'Active', 'Auto', '{}'::jsonb),
    (target_hotel_id, 'low-stock-replenishment', 'Low-stock replenishment', 'inventory.low_stock', 'Active', 'Policy', '{}'::jsonb),
    (target_hotel_id, 'cancellation-recovery', 'Cancellation recovery', 'reservation.cancelled', 'Active', 'Auto', '{}'::jsonb),
    (target_hotel_id, 'room-ready-release', 'Room-ready release', 'housekeeping.completed', 'Active', 'Auto', '{}'::jsonb),
    (target_hotel_id, 'room-conflict-guard', 'Room conflict guard', 'room.maintenance_blocked', 'Active', 'Approval', '{}'::jsonb),
    (target_hotel_id, 'guest-request-router', 'Guest request router', 'guest.request_received', 'Active', 'Auto', '{"fixture_key":"guest-request-router"}'::jsonb),
    (target_hotel_id, 'approval-executor', 'Approval executor', 'approval.approved', 'Active', 'Auto', '{}'::jsonb),
    (target_hotel_id, 'review-recovery', 'Review recovery', 'review.negative', 'Active', 'Approval', '{}'::jsonb);

  select id into guest_rule_id
  from ezstay.automation_rules
  where hotel_id = target_hotel_id
    and rule_key = 'reservation-intake';

  seed_run_id := gen_random_uuid();

  insert into ezstay.automation_runs (
    id, hotel_id, rule_id, event_id, event_type, rule_key,
    result, summary, input, decision, created_at
  ) values (
    seed_run_id, target_hotel_id, guest_rule_id,
    'evt_seed_res_1048', 'reservation.created', 'reservation-intake',
    'Success', 'Reservation received and inventory reconciled.',
    jsonb_build_object('reservation_id', res_1048_id, 'fixture_key', 'res_1048'),
    '{"autonomy":"Auto","reason":"Routine reservation intake is inside policy."}'::jsonb,
    target_demo_now - interval '2 minutes'
  );

  seed_delivery_id := gen_random_uuid();

  insert into ezstay.deliveries (
    id, hotel_id, run_id, status, attempts, last_error, payload, created_at
  ) values
    (
      seed_delivery_id, target_hotel_id, seed_run_id, 'Delivered', 1, null,
      '{"channel":"Demo guest message","fixture_key":"DLV-402"}'::jsonb,
      target_demo_now - interval '2 minutes'
    ),
    (
      gen_random_uuid(), target_hotel_id, null, 'Dead-letter', 5,
      '503 upstream unavailable',
      '{"channel":"Demo operations webhook","fixture_key":"DLV-400"}'::jsonb,
      target_demo_now - interval '41 minutes'
    );
end;
$$;

create or replace function private.create_ezstay_demo_session(
  auth_user_id uuid,
  requested_demo_now timestamptz default '2026-09-25T10:30:00+06:00'::timestamptz
)
returns platform.demo_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_session platform.demo_sessions;
  created_session platform.demo_sessions;
  ezstay_app_id uuid;
  new_session_id uuid := gen_random_uuid();
  new_hotel_id uuid := gen_random_uuid();
begin
  if auth_user_id is null then
    raise exception 'authenticated_user_required';
  end if;

  existing_session := private.ezstay_active_demo_session(auth_user_id);
  if existing_session.id is not null then
    return existing_session;
  end if;

  select id into ezstay_app_id
  from platform.applications
  where key = 'ezstay'
    and status = 'active';

  if ezstay_app_id is null then
    raise exception 'ezstay_application_not_registered';
  end if;

  insert into platform.demo_sessions (
    id, app_id, user_id, tenant_id, seed_version, reset_generation,
    status, demo_now, expires_at
  ) values (
    new_session_id, ezstay_app_id, auth_user_id, new_hotel_id,
    'northstar-v2', 0, 'active', requested_demo_now, now() + interval '72 hours'
  )
  returning * into created_session;

  insert into ezstay.hotels (
    id, demo_session_id, slug, name, timezone, currency, automation_paused, settings
  ) values (
    new_hotel_id, new_session_id,
    'northstar-' || substr(replace(new_session_id::text, '-', ''), 1, 10),
    'Northstar Grand', 'Asia/Dhaka', 'USD', false,
    jsonb_build_object(
      'demo', true,
      'seed_version', 'northstar-v2',
      'backend_contract_version', 'ezstay-backend-v1'
    )
  );

  perform private.seed_ezstay_northstar_v2(new_hotel_id, auth_user_id, requested_demo_now);

  insert into platform.app_memberships (app_id, user_id, role, status)
  values (ezstay_app_id, auth_user_id, 'demo', 'active')
  on conflict (app_id, user_id) do update
  set role = 'demo',
      status = 'active',
      updated_at = now();

  return created_session;
end;
$$;

create or replace function private.reset_ezstay_demo_session(
  auth_user_id uuid,
  expected_session_id uuid,
  expected_reset_generation integer
)
returns platform.demo_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_session platform.demo_sessions;
  created_session platform.demo_sessions;
  new_session_id uuid := gen_random_uuid();
  new_hotel_id uuid := gen_random_uuid();
begin
  select *
  into current_session
  from platform.demo_sessions
  where id = expected_session_id
    and user_id = auth_user_id
    and status = 'active'
    and expires_at > now()
  for update;

  if current_session.id is null then
    raise exception 'active_demo_session_required';
  end if;

  if current_session.reset_generation <> expected_reset_generation then
    raise exception 'stale_demo_generation';
  end if;

  insert into platform.demo_sessions (
    id, app_id, user_id, tenant_id, seed_version, reset_generation,
    status, demo_now, expires_at
  ) values (
    new_session_id, current_session.app_id, current_session.user_id, new_hotel_id,
    'northstar-v2', current_session.reset_generation + 1,
    'reset', current_session.demo_now, now() + interval '72 hours'
  )
  returning * into created_session;

  insert into ezstay.hotels (
    id, demo_session_id, slug, name, timezone, currency, automation_paused, settings
  ) values (
    new_hotel_id, new_session_id,
    'northstar-' || substr(replace(new_session_id::text, '-', ''), 1, 10),
    'Northstar Grand', 'Asia/Dhaka', 'USD', false,
    jsonb_build_object(
      'demo', true,
      'seed_version', 'northstar-v2',
      'backend_contract_version', 'ezstay-backend-v1'
    )
  );

  perform private.seed_ezstay_northstar_v2(new_hotel_id, auth_user_id, current_session.demo_now);

  -- The replacement is fully seeded before authority switches generations.
  update platform.demo_sessions
  set status = 'reset',
      last_activity_at = now()
  where id = current_session.id;

  update platform.demo_sessions
  set status = 'active',
      last_activity_at = now()
  where id = new_session_id
  returning * into created_session;

  return created_session;
end;
$$;


create or replace function private.ezstay_reset_demo_command(
  target_user_id uuid,
  target_idempotency_key text
)
returns platform.demo_sessions
language plpgsql
security definer
set search_path = ''
as $
declare
  ezstay_app_id uuid;
  command_row platform.demo_command_idempotency;
  current_session platform.demo_sessions;
  result_session platform.demo_sessions;
  request_hash text := encode(digest('ezstay:demo.reset:v1', 'sha256'), 'hex');
  replay_session_id uuid;
begin
  if target_user_id is null then
    raise exception 'authenticated_user_required';
  end if;

  if nullif(trim(target_idempotency_key), '') is null then
    raise exception 'idempotency_key_required';
  end if;

  select id into ezstay_app_id
  from platform.applications
  where key = 'ezstay'
    and status = 'active';

  if ezstay_app_id is null then
    raise exception 'ezstay_application_not_registered';
  end if;

  insert into platform.demo_command_idempotency (
    app_id, user_id, idempotency_key, command_type, request_hash
  ) values (
    ezstay_app_id, target_user_id, target_idempotency_key, 'demo.reset', request_hash
  )
  on conflict (app_id, user_id, idempotency_key) do nothing;

  select *
  into command_row
  from platform.demo_command_idempotency
  where app_id = ezstay_app_id
    and user_id = target_user_id
    and idempotency_key = target_idempotency_key
  for update;

  if command_row.command_type <> 'demo.reset'
     or command_row.request_hash <> request_hash then
    raise exception 'idempotency_key_payload_mismatch';
  end if;

  if command_row.response ? 'session_id' then
    replay_session_id := (command_row.response ->> 'session_id')::uuid;

    select *
    into result_session
    from platform.demo_sessions
    where id = replay_session_id
      and app_id = ezstay_app_id
      and user_id = target_user_id;

    if result_session.id is null then
      raise exception 'reset_replay_session_not_found';
    end if;

    return result_session;
  end if;

  current_session := private.ezstay_active_demo_session(target_user_id);
  if current_session.id is null then
    raise exception 'active_demo_session_required';
  end if;

  result_session := private.reset_ezstay_demo_session(
    target_user_id,
    current_session.id,
    current_session.reset_generation
  );

  update platform.demo_command_idempotency
  set response = jsonb_build_object(
    'session_id', result_session.id,
    'tenant_id', result_session.tenant_id,
    'reset_generation', result_session.reset_generation,
    'demo_now', result_session.demo_now
  )
  where id = command_row.id;

  return result_session;
end;
$;
revoke execute on function private.ezstay_active_demo_session(uuid) from public, anon, authenticated;
revoke execute on function private.seed_ezstay_northstar_v2(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function private.create_ezstay_demo_session(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function private.reset_ezstay_demo_session(uuid, uuid, integer) from public, anon, authenticated;
revoke execute on function private.ezstay_reset_demo_command(uuid, text) from public, anon, authenticated;
