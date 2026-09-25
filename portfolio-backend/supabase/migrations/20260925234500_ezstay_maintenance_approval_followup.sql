-- Make non-inventory maintenance approvals operationally actionable.
-- Inventory approval semantics remain unchanged: draft first, receive stock later.

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
  maintenance_room ezstay.rooms;
  maintenance_task ezstay.tasks;
  run_uuid uuid := gen_random_uuid();
  actual_run_id uuid;
  linked_task_id uuid;
  room_fixture_key text;
  run_summary text;
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

  if target_decision = 'Approved'
     and approval_row.inventory_item_id is not null then
    select * into item
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

    run_summary := 'Approval accepted and purchase draft created.';

  elsif target_decision = 'Approved'
        and approval_row.type = 'Maintenance' then
    linked_task_id := nullif(approval_row.payload ->> 'task_id', '')::uuid;
    room_fixture_key := nullif(approval_row.payload ->> 'room_fixture_key', '');

    if linked_task_id is not null then
      select * into maintenance_task
      from ezstay.tasks
      where hotel_id = target_hotel_id
        and id = linked_task_id
        and team = 'Maintenance'
        and status <> 'Done'
      for update;
    end if;

    if maintenance_task.id is null
       and nullif(approval_row.payload ->> 'room_id', '') is not null then
      select * into maintenance_room
      from ezstay.rooms
      where hotel_id = target_hotel_id
        and id = (approval_row.payload ->> 'room_id')::uuid;
    elsif maintenance_task.id is null and room_fixture_key is not null then
      select * into maintenance_room
      from ezstay.rooms
      where hotel_id = target_hotel_id
        and metadata ->> 'fixture_key' = room_fixture_key;
    end if;

    if maintenance_task.id is null and maintenance_room.id is not null then
      select * into maintenance_task
      from ezstay.tasks
      where hotel_id = target_hotel_id
        and room_id = maintenance_room.id
        and team = 'Maintenance'
        and status <> 'Done'
      order by due_at nulls last, created_at
      limit 1
      for update;
    end if;

    if maintenance_task.id is null then
      insert into ezstay.tasks (
        hotel_id, room_id, title, team, status, due_at,
        automated, source_event_id, metadata
      ) values (
        target_hotel_id, maintenance_room.id,
        regexp_replace(approval_row.title, ' invoice$', ' service', 'i'),
        'Maintenance', 'In progress', now() + interval '1 hour',
        false, target_command_event_id,
        jsonb_build_object('authorization','Approved','approval_id',approval_row.id)
      )
      returning * into maintenance_task;
    else
      update ezstay.tasks
      set status = 'In progress',
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'authorization','Approved',
            'approval_id',approval_row.id,
            'authorized_at',now()
          ),
          updated_at = now()
      where hotel_id = target_hotel_id
        and id = maintenance_task.id
      returning * into maintenance_task;
    end if;

    linked_task_id := maintenance_task.id;
    run_summary := 'Maintenance approved; linked work is authorized and in progress.';

  elsif target_decision = 'Rejected' then
    run_summary := 'Approval rejected; no authorized follow-up was created.';
  else
    run_summary := 'Approval accepted; authorized work may proceed.';
  end if;

  -- Inventory is intentionally unchanged until an explicit receipt event.
  insert into ezstay.automation_runs (
    id, hotel_id, event_id, event_type, rule_key, result, summary, input, decision
  ) values (
    run_uuid, target_hotel_id, target_command_event_id, 'approval.resolved',
    'approval-executor', 'Success', run_summary,
    jsonb_build_object(
      'approval_id', target_approval_id,
      'decision', target_decision,
      'task_id', linked_task_id
    ),
    '{"autonomy":"Auto","reason":"The explicit human approval decision is authoritative."}'::jsonb
  )
  on conflict (hotel_id, event_id, rule_key) do nothing;

  select id into actual_run_id
  from ezstay.automation_runs
  where hotel_id = target_hotel_id
    and event_id = target_command_event_id
    and rule_key = 'approval-executor';

  perform private.ezstay_materialize_run_evidence(target_hotel_id, actual_run_id);

  if target_decision = 'Approved'
     and approval_row.type = 'Maintenance'
     and maintenance_task.id is not null then
    perform private.ezstay_record_run_step(
      target_hotel_id, actual_run_id, 2, 'change', 'Maintenance work authorized.',
      jsonb_build_object(
        'entityType','task',
        'entityId',maintenance_task.id,
        'action','authorized'
      ),
      now()
    );
    perform private.ezstay_record_run_link(
      target_hotel_id, actual_run_id, 'task', maintenance_task.id::text,
      maintenance_task.title
    );
    perform private.ezstay_record_audit_event(
      target_hotel_id, 'automation', 'Automation',
      'Maintenance work authorized', target_command_event_id,
      jsonb_build_object('run_id',actual_run_id,'task_id',maintenance_task.id),
      now()
    );
  end if;

  return actual_run_id;
end;
$$;

revoke execute on function private.ezstay_resolve_approval(uuid, text, uuid, text)
  from public, anon, authenticated;
