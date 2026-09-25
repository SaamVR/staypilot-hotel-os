-- EZStay durable automation runtime.
-- Business state is committed independently from external delivery attempts.

create or replace function private.ezstay_claim_inbound_events(
  worker_name text,
  batch_size integer default 5
)
returns setof ezstay.inbound_events
language sql
security definer
set search_path = ''
as $$
  with candidates as (
    select e.id
    from ezstay.inbound_events e
    where e.status in ('queued','failed')
      and (e.next_attempt_at is null or e.next_attempt_at <= now())
      and (e.lease_expires_at is null or e.lease_expires_at <= now())
    order by e.received_at
    limit greatest(1, least(coalesce(batch_size, 5), 10))
    for update skip locked
  ),
  claimed as (
    update ezstay.inbound_events e
    set status = 'processing',
        claimed_by = worker_name,
        claimed_at = now(),
        lease_expires_at = now() + interval '90 seconds',
        attempt_count = e.attempt_count + 1
    from candidates c
    where e.id = c.id
    returning e.*
  )
  select * from claimed;
$$;

create or replace function private.ezstay_finish_inbound_event(
  event_uuid uuid,
  outcome text,
  error_message text default null,
  retry_delay_seconds integer default 60
)
returns ezstay.inbound_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  finished ezstay.inbound_events;
begin
  if outcome not in ('completed','failed','dead_letter') then
    raise exception 'invalid_event_outcome';
  end if;

  update ezstay.inbound_events
  set status = outcome,
      last_error = error_message,
      processed_at = case when outcome in ('completed','dead_letter') then now() else processed_at end,
      next_attempt_at = case
        when outcome = 'failed' then now() + make_interval(secs => greatest(1, retry_delay_seconds))
        else null
      end,
      claimed_by = null,
      claimed_at = null,
      lease_expires_at = null
  where id = event_uuid
  returning * into finished;

  if finished.id is null then
    raise exception 'event_not_found';
  end if;

  return finished;
end;
$$;

create or replace function private.ezstay_record_command(
  target_hotel_id uuid,
  target_idempotency_key text,
  target_command_type text,
  target_request_hash text,
  target_run_id uuid default null,
  target_response jsonb default null
)
returns ezstay.command_idempotency
language plpgsql
security definer
set search_path = ''
as $$
declare
  command_row ezstay.command_idempotency;
begin
  insert into ezstay.command_idempotency (
    hotel_id, idempotency_key, command_type, request_hash, run_id, response
  ) values (
    target_hotel_id, target_idempotency_key, target_command_type,
    target_request_hash, target_run_id, target_response
  )
  on conflict (hotel_id, idempotency_key) do nothing;

  select *
  into command_row
  from ezstay.command_idempotency
  where hotel_id = target_hotel_id
    and idempotency_key = target_idempotency_key;

  if command_row.request_hash <> target_request_hash then
    raise exception 'idempotency_key_payload_mismatch';
  end if;

  return command_row;
end;
$$;

create or replace function private.ezstay_apply_guest_request(
  target_hotel_id uuid,
  target_event_id text,
  target_room_number text,
  target_request text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_room ezstay.rooms;
  target_reservation ezstay.reservations;
  existing_run_id uuid;
  new_run_id uuid := gen_random_uuid();
begin
  select id into existing_run_id
  from ezstay.automation_runs
  where hotel_id = target_hotel_id
    and event_id = target_event_id
    and rule_key = 'guest-request-router';

  if existing_run_id is not null then
    return existing_run_id;
  end if;

  select *
  into target_room
  from ezstay.rooms
  where hotel_id = target_hotel_id
    and number = target_room_number;

  if target_room.id is null then
    raise exception 'room_not_found';
  end if;

  select *
  into target_reservation
  from ezstay.reservations
  where hotel_id = target_hotel_id
    and room_id = target_room.id
    and status not in ('Checked out','Cancelled')
  order by check_in desc
  limit 1;

  if target_reservation.id is null then
    raise exception 'active_reservation_not_found';
  end if;

  insert into ezstay.guest_requests (
    hotel_id, reservation_id, room_id, request, category, urgency,
    status, source_event_id
  ) values (
    target_hotel_id, target_reservation.id, target_room.id,
    target_request, 'Housekeeping', 'Normal', 'Open', target_event_id
  )
  on conflict do nothing;

  insert into ezstay.tasks (
    hotel_id, reservation_id, room_id, title, team, status, due_at,
    automated, source_event_id
  ) values (
    target_hotel_id, target_reservation.id, target_room.id,
    target_request, 'Housekeeping', 'New', now() + interval '20 minutes',
    true, target_event_id
  )
  on conflict do nothing;

  insert into ezstay.automation_runs (
    id, hotel_id, event_id, event_type, rule_key, result, summary, input, decision
  ) values (
    new_run_id, target_hotel_id, target_event_id, 'guest.request_received',
    'guest-request-router', 'Success',
    'Guest request routed to Housekeeping.',
    jsonb_build_object('room_number', target_room_number, 'request', target_request),
    '{"autonomy":"Auto","reason":"Routine in-stay request is within policy."}'::jsonb
  )
  on conflict (hotel_id, event_id, rule_key) do nothing;

  select id into existing_run_id
  from ezstay.automation_runs
  where hotel_id = target_hotel_id
    and event_id = target_event_id
    and rule_key = 'guest-request-router';

  return existing_run_id;
end;
$$;

create or replace function private.ezstay_apply_checkout(
  target_hotel_id uuid,
  target_event_id text,
  target_reservation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  reservation_row ezstay.reservations;
  run_uuid uuid := gen_random_uuid();
  actual_run_id uuid;
begin
  select id into actual_run_id
  from ezstay.automation_runs
  where hotel_id = target_hotel_id
    and event_id = target_event_id
    and rule_key = 'checkout-turnover';

  if actual_run_id is not null then
    return actual_run_id;
  end if;

  select *
  into reservation_row
  from ezstay.reservations
  where hotel_id = target_hotel_id
    and id = target_reservation_id
    and status = 'Checked in'
  for update;

  if reservation_row.id is null then
    raise exception 'checked_in_reservation_not_found';
  end if;

  update ezstay.reservations
  set status = 'Checked out',
      updated_at = now()
  where hotel_id = target_hotel_id
    and id = reservation_row.id;

  update ezstay.rooms
  set occupancy = 'Vacant',
      housekeeping = 'Dirty',
      updated_at = now()
  where hotel_id = target_hotel_id
    and id = reservation_row.room_id;

  insert into ezstay.tasks (
    hotel_id, reservation_id, room_id, title, team, status, due_at,
    automated, source_event_id
  ) values (
    target_hotel_id, reservation_row.id, reservation_row.room_id,
    'Full turnover', 'Housekeeping', 'New', now() + interval '45 minutes',
    true, target_event_id
  )
  on conflict do nothing;

  insert into ezstay.automation_runs (
    id, hotel_id, event_id, event_type, rule_key, result, summary, input, decision
  ) values (
    run_uuid, target_hotel_id, target_event_id, 'guest.checked_out',
    'checkout-turnover', 'Success',
    'Checkout closed; room moved to Vacant + Dirty and turnover work was created.',
    jsonb_build_object('reservation_id', target_reservation_id),
    '{"autonomy":"Auto","reason":"Routine checkout turnover is within policy."}'::jsonb
  )
  on conflict (hotel_id, event_id, rule_key) do nothing;

  select id into actual_run_id
  from ezstay.automation_runs
  where hotel_id = target_hotel_id
    and event_id = target_event_id
    and rule_key = 'checkout-turnover';

  return actual_run_id;
end;
$$;

create or replace function private.ezstay_complete_housekeeping(
  target_hotel_id uuid,
  target_event_id text,
  target_task_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $
declare
  task_row ezstay.tasks;
  room_row ezstay.rooms;
  run_uuid uuid := gen_random_uuid();
  actual_run_id uuid;
  room_sellable boolean;
  summary_text text;
begin
  select id into actual_run_id
  from ezstay.automation_runs
  where hotel_id = target_hotel_id
    and event_id = target_event_id
    and rule_key = 'room-ready-release';

  if actual_run_id is not null then
    return actual_run_id;
  end if;

  select *
  into task_row
  from ezstay.tasks
  where hotel_id = target_hotel_id
    and id = target_task_id
    and status <> 'Done'
    and team = 'Housekeeping'
    and title = 'Full turnover'
    and room_id is not null
  for update;

  if task_row.id is null then
    raise exception 'open_turnover_task_not_found';
  end if;

  select *
  into room_row
  from ezstay.rooms
  where hotel_id = target_hotel_id
    and id = task_row.room_id
  for update;

  if room_row.id is null then
    raise exception 'turnover_room_not_found';
  end if;

  update ezstay.tasks
  set status = 'Done',
      updated_at = now()
  where hotel_id = target_hotel_id
    and id = task_row.id;

  update ezstay.rooms
  set housekeeping = 'Clean',
      updated_at = now()
  where hotel_id = target_hotel_id
    and id = room_row.id;

  room_sellable := room_row.occupancy = 'Vacant' and room_row.maintenance = 'Clear';
  summary_text := case
    when room_sellable then
      'Room ' || room_row.number || ' is Clean and sellable after housekeeping completion.'
    when room_row.maintenance <> 'Clear' then
      'Room ' || room_row.number || ' is Clean but remains unavailable because maintenance is blocked.'
    else
      'Room ' || room_row.number || ' is Clean but remains unavailable because occupancy is ' || room_row.occupancy || '.'
  end;

  insert into ezstay.automation_runs (
    id, hotel_id, event_id, event_type, rule_key, result, summary, input, decision
  ) values (
    run_uuid, target_hotel_id, target_event_id, 'housekeeping.completed',
    'room-ready-release', 'Success', summary_text,
    jsonb_build_object('task_id', target_task_id, 'room_id', room_row.id),
    jsonb_build_object(
      'autonomy', 'Auto',
      'reason', case
        when room_row.maintenance <> 'Clear'
          then 'Housekeeping completion changes cleanliness but maintenance still blocks sellability.'
        else 'Readiness is recalculated from occupancy, cleanliness, and maintenance state.'
      end
    )
  )
  on conflict (hotel_id, event_id, rule_key) do nothing;

  select id into actual_run_id
  from ezstay.automation_runs
  where hotel_id = target_hotel_id
    and event_id = target_event_id
    and rule_key = 'room-ready-release';

  return actual_run_id;
end;
$;

create or replace function private.ezstay_apply_low_stock(
  target_hotel_id uuid,
  target_event_id text,
  target_inventory_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  item ezstay.inventory_items;
  approval_id uuid := gen_random_uuid();
  run_uuid uuid := gen_random_uuid();
  actual_run_id uuid;
  reorder_qty numeric(12,2);
begin
  select id into actual_run_id
  from ezstay.automation_runs
  where hotel_id = target_hotel_id
    and event_id = target_event_id
    and rule_key = 'low-stock-replenishment';

  if actual_run_id is not null then
    return actual_run_id;
  end if;

  select *
  into item
  from ezstay.inventory_items
  where hotel_id = target_hotel_id
    and id = target_inventory_item_id
  for update;

  if item.id is null then
    raise exception 'inventory_item_not_found';
  end if;

  if item.stock >= item.par then
    raise exception 'inventory_not_below_par';
  end if;

  reorder_qty := greatest(1, ceil(item.par * 1.5 - item.stock));

  insert into ezstay.approvals (
    id, hotel_id, inventory_item_id, type, title, detail, amount, quantity,
    status, requested_by_actor, source_event_id
  ) values (
    approval_id, target_hotel_id, item.id, 'Purchase order',
    item.item || ' replenishment',
    reorder_qty || ' ' || item.unit || ' · ' || item.supplier,
    round(reorder_qty * item.unit_cost, 2), reorder_qty,
    'Pending', 'EZStay automation', target_event_id
  )
  on conflict do nothing;

  insert into ezstay.automation_runs (
    id, hotel_id, event_id, event_type, rule_key, result, summary, input, decision
  ) values (
    run_uuid, target_hotel_id, target_event_id, 'inventory.low_stock',
    'low-stock-replenishment', 'Approval',
    item.item || ' is below par; purchase approval is required.',
    jsonb_build_object('inventory_item_id', item.id, 'stock', item.stock, 'par', item.par),
    '{"autonomy":"Policy","reason":"Replenishment requires a human spending decision."}'::jsonb
  )
  on conflict (hotel_id, event_id, rule_key) do nothing;

  select id into actual_run_id
  from ezstay.automation_runs
  where hotel_id = target_hotel_id
    and event_id = target_event_id
    and rule_key = 'low-stock-replenishment';

  return actual_run_id;
end;
$$;

create or replace function private.ezstay_resolve_approval(
  target_hotel_id uuid,
  target_command_event_id text,
  target_approval_id uuid,
  target_decision text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  approval_row ezstay.approvals;
  item ezstay.inventory_items;
  run_uuid uuid := gen_random_uuid();
  actual_run_id uuid;
begin
  if target_decision not in ('Approved','Rejected') then
    raise exception 'invalid_approval_decision';
  end if;

  select id into actual_run_id
  from ezstay.automation_runs
  where hotel_id = target_hotel_id
    and event_id = target_command_event_id
    and rule_key = 'approval-executor';

  if actual_run_id is not null then
    return actual_run_id;
  end if;

  select *
  into approval_row
  from ezstay.approvals
  where hotel_id = target_hotel_id
    and id = target_approval_id
    and status = 'Pending'
  for update;

  if approval_row.id is null then
    raise exception 'pending_approval_not_found';
  end if;

  update ezstay.approvals
  set status = target_decision,
      resolved_at = now()
  where hotel_id = target_hotel_id
    and id = approval_row.id;

  if target_decision = 'Approved' and approval_row.inventory_item_id is not null then
    select *
    into item
    from ezstay.inventory_items
    where hotel_id = target_hotel_id
      and id = approval_row.inventory_item_id;

    insert into ezstay.purchase_requests (
      hotel_id, approval_id, inventory_item_id, quantity, amount,
      supplier, status, source_event_id
    ) values (
      target_hotel_id, approval_row.id, approval_row.inventory_item_id,
      approval_row.quantity, coalesce(approval_row.amount, 0),
      coalesce(item.supplier, 'Supplier'), 'Draft', target_command_event_id
    )
    on conflict do nothing;
  end if;

  -- Inventory is intentionally unchanged until an explicit receipt event.
  insert into ezstay.automation_runs (
    id, hotel_id, event_id, event_type, rule_key, result, summary, input, decision
  ) values (
    run_uuid, target_hotel_id, target_command_event_id, 'approval.resolved',
    'approval-executor', 'Success',
    'Human approval decision applied without receiving inventory.',
    jsonb_build_object('approval_id', target_approval_id, 'decision', target_decision),
    '{"autonomy":"Auto","reason":"The explicit human approval decision is authoritative."}'::jsonb
  )
  on conflict (hotel_id, event_id, rule_key) do nothing;

  select id into actual_run_id
  from ezstay.automation_runs
  where hotel_id = target_hotel_id
    and event_id = target_command_event_id
    and rule_key = 'approval-executor';

  return actual_run_id;
end;
$$;

create or replace function private.ezstay_retry_delivery(
  target_hotel_id uuid,
  target_delivery_id uuid,
  target_idempotency_key text
)
returns ezstay.deliveries
language plpgsql
security definer
set search_path = ''
as $$
declare
  delivery_row ezstay.deliveries;
  request_hash text := encode(digest(target_delivery_id::text, 'sha256'), 'hex');
begin
  perform private.ezstay_record_command(
    target_hotel_id,
    target_idempotency_key,
    'delivery.retry',
    request_hash,
    null,
    null
  );

  update ezstay.deliveries
  set status = 'Queued',
      next_retry_at = now(),
      last_error = null
  where hotel_id = target_hotel_id
    and id = target_delivery_id
    and status in ('Failed','Dead-letter')
  returning * into delivery_row;

  if delivery_row.id is null then
    select *
    into delivery_row
    from ezstay.deliveries
    where hotel_id = target_hotel_id
      and id = target_delivery_id;

    if delivery_row.id is null then
      raise exception 'delivery_not_found';
    end if;
  end if;

  return delivery_row;
end;
$$;

create or replace function private.ezstay_evaluate_overdue_tasks(
  target_hotel_id uuid,
  effective_now timestamptz
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  escalated_count integer;
begin
  with escalated as (
    update ezstay.tasks
    set escalated_at = effective_now,
        updated_at = now()
    where hotel_id = target_hotel_id
      and status <> 'Done'
      and due_at is not null
      and due_at <= effective_now
      and escalated_at is null
    returning id
  )
  select count(*)::integer
  into escalated_count
  from escalated;

  return escalated_count;
end;
$$;

revoke execute on function private.ezstay_claim_inbound_events(text, integer) from public, anon, authenticated;
revoke execute on function private.ezstay_finish_inbound_event(uuid, text, text, integer) from public, anon, authenticated;
revoke execute on function private.ezstay_record_command(uuid, text, text, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function private.ezstay_apply_guest_request(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function private.ezstay_apply_checkout(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function private.ezstay_complete_housekeeping(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function private.ezstay_apply_low_stock(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function private.ezstay_resolve_approval(uuid, text, uuid, text) from public, anon, authenticated;
revoke execute on function private.ezstay_retry_delivery(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function private.ezstay_evaluate_overdue_tasks(uuid, timestamptz) from public, anon, authenticated;
