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

create or replace function private.ezstay_record_run_step(
  target_hotel_id uuid,
  target_run_id uuid,
  target_step_index integer,
  target_stage text,
  target_message text,
  target_payload jsonb,
  target_effective_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into ezstay.automation_run_steps (
    hotel_id, run_id, step_index, stage, message, payload, effective_at
  ) values (
    target_hotel_id, target_run_id, target_step_index, target_stage,
    target_message, coalesce(target_payload, '{}'::jsonb), target_effective_at
  )
  on conflict (hotel_id, run_id, step_index) do nothing;
end;
$$;

create or replace function private.ezstay_record_run_link(
  target_hotel_id uuid,
  target_run_id uuid,
  target_entity_type text,
  target_entity_id text,
  target_label text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from ezstay.automation_run_links l
    where l.hotel_id = target_hotel_id
      and l.run_id = target_run_id
      and l.entity_type = target_entity_type
      and l.entity_id = target_entity_id
  ) then
    insert into ezstay.automation_run_links (
      hotel_id, run_id, entity_type, entity_id, label
    ) values (
      target_hotel_id, target_run_id, target_entity_type,
      target_entity_id, target_label
    );
  end if;
end;
$$;

create or replace function private.ezstay_record_audit_event(
  target_hotel_id uuid,
  target_actor_kind text,
  target_category text,
  target_action text,
  target_source_event_id text,
  target_payload jsonb,
  target_effective_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from ezstay.audit_events a
    where a.hotel_id = target_hotel_id
      and a.source_event_id = target_source_event_id
      and a.action = target_action
  ) then
    insert into ezstay.audit_events (
      hotel_id, actor_kind, category, action, source_event_id,
      effective_at, payload
    ) values (
      target_hotel_id, target_actor_kind, target_category, target_action,
      target_source_event_id, target_effective_at, coalesce(target_payload, '{}'::jsonb)
    );
  end if;
end;
$$;

create or replace function private.ezstay_materialize_run_evidence(
  target_hotel_id uuid,
  target_run_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_row ezstay.automation_runs;
  request_row ezstay.guest_requests;
  task_row ezstay.tasks;
  room_row ezstay.rooms;
  reservation_row ezstay.reservations;
  inventory_row ezstay.inventory_items;
  approval_row ezstay.approvals;
  purchase_row ezstay.purchase_requests;
  delivery_row ezstay.deliveries;
  effective_at timestamptz := now();
begin
  select *
  into run_row
  from ezstay.automation_runs
  where hotel_id = target_hotel_id
    and id = target_run_id;

  if run_row.id is null then
    raise exception 'automation_run_not_found';
  end if;

  case run_row.rule_key
    when 'guest-request-router' then
      select * into request_row
      from ezstay.guest_requests
      where hotel_id = target_hotel_id
        and source_event_id = run_row.event_id
      limit 1;

      select * into task_row
      from ezstay.tasks
      where hotel_id = target_hotel_id
        and source_event_id = run_row.event_id
      limit 1;

      if request_row.room_id is not null then
        select * into room_row
        from ezstay.rooms
        where hotel_id = target_hotel_id
          and id = request_row.room_id;
      end if;

      if request_row.id is not null then
        perform private.ezstay_record_run_step(
          target_hotel_id, run_row.id, 0, 'change', 'Guest request created.',
          jsonb_build_object('entityType','guest_request','entityId',request_row.id,'action','created'),
          effective_at
        );
        perform private.ezstay_record_run_link(
          target_hotel_id, run_row.id, 'guest_request', request_row.id::text, request_row.request
        );
      end if;

      if task_row.id is not null then
        perform private.ezstay_record_run_step(
          target_hotel_id, run_row.id, 1, 'change', 'Housekeeping task created.',
          jsonb_build_object('entityType','task','entityId',task_row.id,'action','created'),
          effective_at
        );
        perform private.ezstay_record_run_link(
          target_hotel_id, run_row.id, 'task', task_row.id::text,
          coalesce(task_row.title, 'Housekeeping task')
        );
      end if;

      if room_row.id is not null then
        perform private.ezstay_record_run_link(
          target_hotel_id, run_row.id, 'room', room_row.id::text, 'Room ' || room_row.number
        );
      end if;

      if not exists (
        select 1 from ezstay.deliveries d
        where d.hotel_id = target_hotel_id and d.run_id = run_row.id
      ) then
        insert into ezstay.deliveries (
          hotel_id, run_id, status, attempts, payload, delivered_at
        ) values (
          target_hotel_id, run_row.id, 'Delivered', 1,
          jsonb_build_object('channel','Demo guest acknowledgement'),
          effective_at
        );
      end if;

      perform private.ezstay_record_run_step(
        target_hotel_id, run_row.id, 80, 'audit', 'Guest request normalized and routed.',
        '{}'::jsonb, effective_at
      );
      perform private.ezstay_record_audit_event(
        target_hotel_id, 'automation', 'Automation', 'Guest request routed',
        run_row.event_id, jsonb_build_object('run_id',run_row.id), effective_at
      );

    when 'checkout-turnover' then
      select * into reservation_row
      from ezstay.reservations
      where hotel_id = target_hotel_id
        and id = nullif(run_row.input ->> 'reservation_id','')::uuid;

      if reservation_row.room_id is not null then
        select * into room_row
        from ezstay.rooms
        where hotel_id = target_hotel_id and id = reservation_row.room_id;
      end if;

      select * into task_row
      from ezstay.tasks
      where hotel_id = target_hotel_id
        and source_event_id = run_row.event_id
      limit 1;

      if reservation_row.id is not null then
        perform private.ezstay_record_run_step(
          target_hotel_id, run_row.id, 0, 'change', 'Stay closed.',
          jsonb_build_object('entityType','reservation','entityId',reservation_row.id,'action','checked_out'),
          effective_at
        );
        perform private.ezstay_record_run_link(
          target_hotel_id, run_row.id, 'reservation', reservation_row.id::text, reservation_row.external_ref
        );
      end if;

      if room_row.id is not null then
        perform private.ezstay_record_run_step(
          target_hotel_id, run_row.id, 1, 'change', 'Room moved to Vacant + Dirty.',
          jsonb_build_object('entityType','room','entityId',room_row.id,'action','vacant_dirty'),
          effective_at
        );
        perform private.ezstay_record_run_link(
          target_hotel_id, run_row.id, 'room', room_row.id::text, 'Room ' || room_row.number
        );
      end if;

      if task_row.id is not null then
        perform private.ezstay_record_run_step(
          target_hotel_id, run_row.id, 2, 'change', 'Turnover task created.',
          jsonb_build_object('entityType','task','entityId',task_row.id,'action','created'),
          effective_at
        );
        perform private.ezstay_record_run_link(
          target_hotel_id, run_row.id, 'task', task_row.id::text, task_row.title
        );
      end if;

      perform private.ezstay_record_run_step(
        target_hotel_id, run_row.id, 80, 'audit', 'Checkout turnover committed.',
        '{}'::jsonb, effective_at
      );
      perform private.ezstay_record_audit_event(
        target_hotel_id, 'automation', 'Automation', 'Checkout turnover completed',
        run_row.event_id, jsonb_build_object('run_id',run_row.id), effective_at
      );

    when 'room-ready-release' then
      select * into task_row
      from ezstay.tasks
      where hotel_id = target_hotel_id
        and id = nullif(run_row.input ->> 'task_id','')::uuid;

      select * into room_row
      from ezstay.rooms
      where hotel_id = target_hotel_id
        and id = nullif(run_row.input ->> 'room_id','')::uuid;

      if task_row.id is not null then
        perform private.ezstay_record_run_step(
          target_hotel_id, run_row.id, 0, 'change', 'Turnover task completed.',
          jsonb_build_object('entityType','task','entityId',task_row.id,'action','done'),
          effective_at
        );
        perform private.ezstay_record_run_link(
          target_hotel_id, run_row.id, 'task', task_row.id::text, task_row.title
        );
      end if;

      if room_row.id is not null then
        perform private.ezstay_record_run_step(
          target_hotel_id, run_row.id, 1, 'change', 'Room cleanliness recalculated.',
          jsonb_build_object(
            'entityType','room',
            'entityId',room_row.id,
            'action',case when room_row.occupancy='Vacant' and room_row.housekeeping='Clean' and room_row.maintenance='Clear'
              then 'clean_sellable' else 'clean_not_sellable' end
          ),
          effective_at
        );
        perform private.ezstay_record_run_link(
          target_hotel_id, run_row.id, 'room', room_row.id::text, 'Room ' || room_row.number
        );
      end if;

      perform private.ezstay_record_run_step(
        target_hotel_id, run_row.id, 80, 'audit', 'Room readiness recalculated without changing maintenance authority.',
        '{}'::jsonb, effective_at
      );
      perform private.ezstay_record_audit_event(
        target_hotel_id, 'automation', 'Automation', 'Room readiness recalculated',
        run_row.event_id, jsonb_build_object('run_id',run_row.id), effective_at
      );

    when 'low-stock-replenishment' then
      select * into inventory_row
      from ezstay.inventory_items
      where hotel_id = target_hotel_id
        and id = nullif(run_row.input ->> 'inventory_item_id','')::uuid;

      select * into approval_row
      from ezstay.approvals
      where hotel_id = target_hotel_id
        and source_event_id = run_row.event_id
      limit 1;

      if approval_row.id is not null then
        perform private.ezstay_record_run_step(
          target_hotel_id, run_row.id, 0, 'change', 'Purchase approval created.',
          jsonb_build_object('entityType','approval','entityId',approval_row.id,'action','created'),
          effective_at
        );
        perform private.ezstay_record_run_link(
          target_hotel_id, run_row.id, 'approval', approval_row.id::text, approval_row.title
        );
      end if;

      if inventory_row.id is not null then
        perform private.ezstay_record_run_link(
          target_hotel_id, run_row.id, 'inventory', inventory_row.id::text, inventory_row.item
        );
      end if;

      perform private.ezstay_record_run_step(
        target_hotel_id, run_row.id, 80, 'audit', 'Low-stock policy stopped for human approval.',
        '{}'::jsonb, effective_at
      );
      perform private.ezstay_record_audit_event(
        target_hotel_id, 'automation', 'Automation', 'Low-stock approval requested',
        run_row.event_id, jsonb_build_object('run_id',run_row.id), effective_at
      );

    when 'approval-executor' then
      select * into approval_row
      from ezstay.approvals
      where hotel_id = target_hotel_id
        and id = nullif(run_row.input ->> 'approval_id','')::uuid;

      select * into purchase_row
      from ezstay.purchase_requests
      where hotel_id = target_hotel_id
        and source_event_id = run_row.event_id
      limit 1;

      if approval_row.id is not null then
        perform private.ezstay_record_run_step(
          target_hotel_id, run_row.id, 0, 'change', 'Human decision applied.',
          jsonb_build_object(
            'entityType','approval','entityId',approval_row.id,
            'action',lower(coalesce(run_row.input ->> 'decision', approval_row.status))
          ),
          effective_at
        );
        perform private.ezstay_record_run_link(
          target_hotel_id, run_row.id, 'approval', approval_row.id::text, approval_row.title
        );
      end if;

      if purchase_row.id is not null then
        perform private.ezstay_record_run_step(
          target_hotel_id, run_row.id, 1, 'change', 'Purchase draft created.',
          jsonb_build_object('entityType','purchase_request','entityId',purchase_row.id,'action','created'),
          effective_at
        );
        perform private.ezstay_record_run_link(
          target_hotel_id, run_row.id, 'purchase_request', purchase_row.id::text,
          'Purchase draft · ' || purchase_row.quantity
        );
      end if;

      perform private.ezstay_record_run_step(
        target_hotel_id, run_row.id, 80, 'audit', 'Approval execution recorded.',
        '{}'::jsonb, effective_at
      );
      perform private.ezstay_record_audit_event(
        target_hotel_id, 'automation', 'Automation', 'Approval decision executed',
        run_row.event_id, jsonb_build_object('run_id',run_row.id), effective_at
      );

    when 'delivery-recovery' then
      select * into delivery_row
      from ezstay.deliveries
      where hotel_id = target_hotel_id
        and id = nullif(run_row.input ->> 'delivery_id','')::uuid;

      if delivery_row.id is not null then
        perform private.ezstay_record_run_step(
          target_hotel_id, run_row.id, 0, 'change', 'Failed delivery recovered.',
          jsonb_build_object('entityType','delivery','entityId',delivery_row.id,'action','delivered'),
          effective_at
        );
        perform private.ezstay_record_run_link(
          target_hotel_id, run_row.id, 'delivery', delivery_row.id::text,
          coalesce(delivery_row.payload ->> 'channel', 'Demo delivery')
        );
      end if;

      perform private.ezstay_record_run_step(
        target_hotel_id, run_row.id, 80, 'audit', 'Delivery-only recovery completed without replaying business state.',
        '{}'::jsonb, effective_at
      );
      perform private.ezstay_record_audit_event(
        target_hotel_id, 'automation', 'Recovery', 'Delivery recovered',
        run_row.event_id, jsonb_build_object('run_id',run_row.id), effective_at
      );

    when 'overdue-task-escalation' then
      select * into task_row
      from ezstay.tasks
      where hotel_id = target_hotel_id
        and id = nullif(run_row.input ->> 'task_id','')::uuid;

      if task_row.id is not null then
        perform private.ezstay_record_run_step(
          target_hotel_id, run_row.id, 0, 'change', 'Task escalated after SLA expiry.',
          jsonb_build_object('entityType','task','entityId',task_row.id,'action','escalated'),
          effective_at
        );
        perform private.ezstay_record_run_link(
          target_hotel_id, run_row.id, 'task', task_row.id::text, task_row.title
        );
      end if;

      if not exists (
        select 1 from ezstay.deliveries d
        where d.hotel_id = target_hotel_id and d.run_id = run_row.id
      ) then
        insert into ezstay.deliveries (
          hotel_id, run_id, status, attempts, payload, delivered_at
        ) values (
          target_hotel_id, run_row.id, 'Delivered', 1,
          jsonb_build_object('channel','Demo operations alert'),
          effective_at
        );
      end if;

      perform private.ezstay_record_run_step(
        target_hotel_id, run_row.id, 80, 'audit', 'Overdue task escalated once.',
        '{}'::jsonb, effective_at
      );
      perform private.ezstay_record_audit_event(
        target_hotel_id, 'automation', 'Automation', 'Overdue task escalated',
        run_row.event_id, jsonb_build_object('run_id',run_row.id), effective_at
      );

    else
      perform private.ezstay_record_run_step(
        target_hotel_id, run_row.id, 80, 'audit', 'Automation run recorded.',
        '{}'::jsonb, effective_at
      );
  end case;
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

  perform private.ezstay_materialize_run_evidence(target_hotel_id, existing_run_id);
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

  perform private.ezstay_materialize_run_evidence(target_hotel_id, actual_run_id);
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
as $$
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

  perform private.ezstay_materialize_run_evidence(target_hotel_id, actual_run_id);
  return actual_run_id;
end;
$$;

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

  perform private.ezstay_materialize_run_evidence(target_hotel_id, actual_run_id);
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

  perform private.ezstay_materialize_run_evidence(target_hotel_id, actual_run_id);
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
  recovery_run_id uuid;
begin
  perform private.ezstay_record_command(
    target_hotel_id,
    target_idempotency_key,
    'delivery.retry',
    request_hash,
    null,
    null
  );

  select id
  into recovery_run_id
  from ezstay.automation_runs
  where hotel_id = target_hotel_id
    and event_id = target_idempotency_key
    and rule_key = 'delivery-recovery';

  if recovery_run_id is not null then
    select *
    into delivery_row
    from ezstay.deliveries
    where hotel_id = target_hotel_id
      and id = target_delivery_id;

    if delivery_row.id is null then
      raise exception 'delivery_not_found';
    end if;

    return delivery_row;
  end if;

  update ezstay.deliveries
  set status = 'Delivered',
      attempts = attempts + 1,
      next_retry_at = null,
      last_error = null,
      delivered_at = now()
  where hotel_id = target_hotel_id
    and id = target_delivery_id
    and status in ('Failed','Dead-letter')
  returning * into delivery_row;

  if delivery_row.id is null then
    raise exception 'delivery_not_retryable';
  end if;

  recovery_run_id := gen_random_uuid();

  insert into ezstay.automation_runs (
    id, hotel_id, event_id, event_type, rule_key, result, summary, input, decision
  ) values (
    recovery_run_id, target_hotel_id, target_idempotency_key,
    'delivery.retry', 'delivery-recovery', 'Success',
    'Delivery recovered without replaying the original hotel action.',
    jsonb_build_object('delivery_id', target_delivery_id),
    '{"autonomy":"Auto","reason":"Only the failed delivery is retried; prior business mutations remain untouched."}'::jsonb
  )
  on conflict (hotel_id, event_id, rule_key) do nothing;

  select id
  into recovery_run_id
  from ezstay.automation_runs
  where hotel_id = target_hotel_id
    and event_id = target_idempotency_key
    and rule_key = 'delivery-recovery';

  perform private.ezstay_materialize_run_evidence(target_hotel_id, recovery_run_id);

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
  task_row ezstay.tasks;
  run_uuid uuid;
  actual_run_id uuid;
  escalated_count integer := 0;
  overdue_event_id text;
begin
  for task_row in
    update ezstay.tasks
    set escalated_at = effective_now,
        updated_at = now()
    where hotel_id = target_hotel_id
      and status <> 'Done'
      and due_at is not null
      and due_at <= effective_now
      and escalated_at is null
    returning *
  loop
    escalated_count := escalated_count + 1;
    overdue_event_id := 'evt_overdue_' || task_row.id::text;
    run_uuid := gen_random_uuid();

    insert into ezstay.automation_runs (
      id, hotel_id, event_id, event_type, rule_key, result, summary, input, decision
    ) values (
      run_uuid, target_hotel_id, overdue_event_id,
      'task.overdue', 'overdue-task-escalation', 'Success',
      coalesce(task_row.title, 'Task') || ' escalated after SLA expiry.',
      jsonb_build_object('task_id', task_row.id, 'due_at', task_row.due_at),
      '{"autonomy":"Auto","reason":"The task crossed its configured SLA deadline."}'::jsonb
    )
    on conflict (hotel_id, event_id, rule_key) do nothing;

    select id
    into actual_run_id
    from ezstay.automation_runs
    where hotel_id = target_hotel_id
      and event_id = overdue_event_id
      and rule_key = 'overdue-task-escalation';

    perform private.ezstay_materialize_run_evidence(target_hotel_id, actual_run_id);
  end loop;

  return escalated_count;
end;
$$;

revoke execute on function private.ezstay_record_run_step(uuid, uuid, integer, text, text, jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function private.ezstay_record_run_link(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function private.ezstay_record_audit_event(uuid, text, text, text, text, jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function private.ezstay_materialize_run_evidence(uuid, uuid) from public, anon, authenticated;
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
