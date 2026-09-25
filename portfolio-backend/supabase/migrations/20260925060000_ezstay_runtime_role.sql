-- Least-privilege EZStay runtime role and read interfaces.
-- This role is intended for the future Cloudflare Hyperdrive connection.
-- It has no login credential in migrations and no direct business-table grants.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ezstay_runtime') then
    create role ezstay_runtime noinherit nologin;
  end if;
end;
$$;

revoke all on schema public from ezstay_runtime;
revoke all on schema platform from ezstay_runtime;
revoke all on schema ezstay from ezstay_runtime;
revoke all on schema ezstay_api from ezstay_runtime;
revoke all on schema private from ezstay_runtime;

grant usage on schema private to ezstay_runtime;

create or replace function private.ezstay_snapshot(target_hotel_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  snapshot jsonb;
begin
  select jsonb_build_object(
    'meta', jsonb_build_object(
      'seedVersion', coalesce(h.settings ->> 'seed_version', 'northstar-v2'),
      'backendContractVersion', coalesce(h.settings ->> 'backend_contract_version', 'ezstay-backend-v1'),
      'demoNow', ds.demo_now,
      'resetGeneration', ds.reset_generation
    ),
    'hotel', jsonb_build_object(
      'id', h.id,
      'name', h.name,
      'timezone', h.timezone,
      'currency', h.currency,
      'automationPaused', h.automation_paused
    ),
    'rooms', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'hotelId', r.hotel_id,
          'number', r.number,
          'type', r.room_type,
          'occupancy', r.occupancy,
          'housekeeping', r.housekeeping,
          'maintenance', r.maintenance
        )
        order by r.number
      )
      from ezstay.rooms r
      where r.hotel_id = h.id
    ), '[]'::jsonb),
    'reservations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'hotelId', x.hotel_id,
          'externalRef', x.external_ref,
          'guestName', x.guest_name,
          'source', x.source,
          'roomId', x.room_id,
          'roomType', x.room_type,
          'checkIn', x.check_in,
          'checkOut', x.check_out,
          'guests', x.guests,
          'total', x.total,
          'paid', x.paid,
          'status', x.status
        )
        order by x.created_at desc
      )
      from ezstay.reservations x
      where x.hotel_id = h.id
    ), '[]'::jsonb),
    'guestRequests', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'hotelId', x.hotel_id,
          'reservationId', x.reservation_id,
          'roomId', x.room_id,
          'request', x.request,
          'category', x.category,
          'urgency', x.urgency,
          'status', x.status,
          'createdAt', x.created_at
        )
        order by x.created_at desc
      )
      from ezstay.guest_requests x
      where x.hotel_id = h.id
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'hotelId', x.hotel_id,
          'reservationId', x.reservation_id,
          'roomId', x.room_id,
          'place', case
            when x.room_id is not null then 'Room ' || coalesce(r.number, '')
            else 'Property'
          end,
          'title', x.title,
          'team', x.team,
          'dueAt', x.due_at,
          'status', x.status,
          'automated', x.automated,
          'sourceEventId', x.source_event_id,
          'escalatedAt', x.escalated_at
        )
        order by x.created_at desc
      )
      from ezstay.tasks x
      left join ezstay.rooms r
        on r.hotel_id = x.hotel_id
       and r.id = x.room_id
      where x.hotel_id = h.id
    ), '[]'::jsonb),
    'inventory', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'hotelId', x.hotel_id,
          'item', x.item,
          'category', x.category,
          'stock', x.stock,
          'par', x.par,
          'unit', x.unit,
          'unitCost', x.unit_cost,
          'supplier', x.supplier
        )
        order by x.item
      )
      from ezstay.inventory_items x
      where x.hotel_id = h.id
    ), '[]'::jsonb),
    'approvals', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'hotelId', x.hotel_id,
          'inventoryItemId', x.inventory_item_id,
          'type', x.type,
          'title', x.title,
          'detail', x.detail,
          'amount', x.amount,
          'quantity', x.quantity,
          'status', x.status,
          'requestedBy', x.requested_by_actor,
          'createdAt', x.created_at,
          'resolvedAt', x.resolved_at
        )
        order by x.created_at desc
      )
      from ezstay.approvals x
      where x.hotel_id = h.id
    ), '[]'::jsonb),
    'purchaseRequests', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'hotelId', x.hotel_id,
          'approvalId', x.approval_id,
          'inventoryItemId', x.inventory_item_id,
          'quantity', x.quantity,
          'amount', x.amount,
          'supplier', x.supplier,
          'status', x.status,
          'createdAt', x.created_at
        )
        order by x.created_at desc
      )
      from ezstay.purchase_requests x
      where x.hotel_id = h.id
    ), '[]'::jsonb),
    'automationRules', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'hotelId', x.hotel_id,
          'key', x.rule_key,
          'name', x.name,
          'eventType', x.event_type,
          'status', x.status,
          'autonomy', x.autonomy
        )
        order by x.name
      )
      from ezstay.automation_rules x
      where x.hotel_id = h.id
    ), '[]'::jsonb),
    'automationRuns', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'eventId', x.event_id,
          'ruleKey', x.rule_key,
          'result', x.result,
          'summary', x.summary,
          'input', x.input,
          'decision', x.decision,
          'changes', coalesce((
            select jsonb_agg(s.payload order by s.step_index)
            from ezstay.automation_run_steps s
            where s.hotel_id = x.hotel_id
              and s.run_id = x.id
              and s.stage = 'change'
          ), '[]'::jsonb),
          'delivery', coalesce((
            select jsonb_agg(
              jsonb_build_object('id', d.id, 'status', d.status)
              order by d.created_at
            )
            from ezstay.deliveries d
            where d.hotel_id = x.hotel_id
              and d.run_id = x.id
          ), '[]'::jsonb),
          'audit', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'at', s.recorded_at,
                'effectiveAt', s.effective_at,
                'message', s.message
              )
              order by s.step_index
            )
            from ezstay.automation_run_steps s
            where s.hotel_id = x.hotel_id
              and s.run_id = x.id
              and s.stage = 'audit'
          ), '[]'::jsonb),
          'linkedRecords', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'type', l.entity_type,
                'id', l.entity_id,
                'label', l.label
              )
              order by l.created_at
            )
            from ezstay.automation_run_links l
            where l.hotel_id = x.hotel_id
              and l.run_id = x.id
          ), '[]'::jsonb)
        )
        order by x.created_at
      )
      from ezstay.automation_runs x
      where x.hotel_id = h.id
    ), '[]'::jsonb),
    'deliveries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'hotelId', x.hotel_id,
          'runId', x.run_id,
          'channel', coalesce(x.payload ->> 'channel', 'Demo delivery'),
          'status', x.status,
          'attempts', x.attempts,
          'lastError', x.last_error,
          'createdAt', x.created_at,
          'deliveredAt', x.delivered_at
        )
        order by x.created_at desc
      )
      from ezstay.deliveries x
      where x.hotel_id = h.id
    ), '[]'::jsonb),
    'auditEvents', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'hotelId', x.hotel_id,
          'actorKind', x.actor_kind,
          'category', x.category,
          'action', x.action,
          'createdAt', x.created_at,
          'effectiveAt', x.effective_at
        )
        order by x.created_at desc
      )
      from ezstay.audit_events x
      where x.hotel_id = h.id
    ), '[]'::jsonb)
  )
  into snapshot
  from ezstay.hotels h
  join platform.demo_sessions ds
    on ds.id = h.demo_session_id
  where h.id = target_hotel_id
    and ds.tenant_id = h.id
    and ds.status = 'active'
    and ds.expires_at > now();

  if snapshot is null then
    raise exception 'active_demo_tenant_not_found';
  end if;

  return snapshot;
end;
$$;

create or replace function private.ezstay_get_run(
  target_hotel_id uuid,
  target_run_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  run_record jsonb;
begin
  select jsonb_build_object(
    'id', r.id,
    'eventId', r.event_id,
    'ruleKey', r.rule_key,
    'result', r.result,
    'summary', r.summary,
    'input', r.input,
    'decision', r.decision,
    'changes', coalesce((
      select jsonb_agg(s.payload order by s.step_index)
      from ezstay.automation_run_steps s
      where s.hotel_id = r.hotel_id
        and s.run_id = r.id
        and s.stage = 'change'
    ), '[]'::jsonb),
    'delivery', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', d.id, 'status', d.status)
        order by d.created_at
      )
      from ezstay.deliveries d
      where d.hotel_id = r.hotel_id
        and d.run_id = r.id
    ), '[]'::jsonb),
    'audit', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'at', s.recorded_at,
          'effectiveAt', s.effective_at,
          'message', s.message
        )
        order by s.step_index
      )
      from ezstay.automation_run_steps s
      where s.hotel_id = r.hotel_id
        and s.run_id = r.id
        and s.stage = 'audit'
    ), '[]'::jsonb),
    'linkedRecords', coalesce((
      select jsonb_agg(
        jsonb_build_object('type', l.entity_type, 'id', l.entity_id, 'label', l.label)
        order by l.created_at
      )
      from ezstay.automation_run_links l
      where l.hotel_id = r.hotel_id
        and l.run_id = r.id
    ), '[]'::jsonb)
  )
  into run_record
  from ezstay.automation_runs r
  where r.hotel_id = target_hotel_id
    and r.id = target_run_id;

  if run_record is null then
    raise exception 'run_not_found';
  end if;

  return run_record;
end;
$$;

grant execute on function private.ezstay_active_demo_session(uuid) to ezstay_runtime;
grant execute on function private.create_ezstay_demo_session(uuid, timestamptz) to ezstay_runtime;
grant execute on function private.reset_ezstay_demo_session(uuid, uuid, integer) to ezstay_runtime;
grant execute on function private.ezstay_claim_inbound_events(text, integer) to ezstay_runtime;
grant execute on function private.ezstay_finish_inbound_event(uuid, text, text, integer) to ezstay_runtime;
grant execute on function private.ezstay_record_command(uuid, text, text, text, uuid, jsonb) to ezstay_runtime;
grant execute on function private.ezstay_apply_guest_request(uuid, text, text, text) to ezstay_runtime;
grant execute on function private.ezstay_apply_checkout(uuid, text, uuid) to ezstay_runtime;
grant execute on function private.ezstay_apply_low_stock(uuid, text, uuid) to ezstay_runtime;
grant execute on function private.ezstay_resolve_approval(uuid, text, uuid, text) to ezstay_runtime;
grant execute on function private.ezstay_retry_delivery(uuid, uuid, text) to ezstay_runtime;
grant execute on function private.ezstay_evaluate_overdue_tasks(uuid, timestamptz) to ezstay_runtime;
grant execute on function private.ezstay_snapshot(uuid) to ezstay_runtime;
grant execute on function private.ezstay_get_run(uuid, uuid) to ezstay_runtime;

do $$
begin
  if to_regnamespace('leadflow') is not null then
    execute 'revoke all on schema leadflow from ezstay_runtime';
  end if;

  if to_regnamespace('leadflow_api') is not null then
    execute 'revoke all on schema leadflow_api from ezstay_runtime';
  end if;
end;
$$;
