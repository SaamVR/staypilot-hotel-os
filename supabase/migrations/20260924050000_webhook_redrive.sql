-- StayPilot outbound dead-letter redrive lifecycle
-- Requires migrations 001-004.
-- Redrives delivery records only. It never replays the source hotel event or business action.

alter table public.webhook_deliveries
  add column if not exists redrive_count integer not null default 0 check (redrive_count >= 0),
  add column if not exists last_redriven_at timestamptz;

create or replace function public.redrive_webhook_delivery(
  delivery_uuid uuid,
  reason_text text default null
)
returns public.webhook_deliveries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated public.webhook_deliveries;
  endpoint public.webhook_endpoints;
  safe_reason text := left(trim(coalesce(reason_text, 'Operator redrive')), 500);
begin
  select endpoint_row.*
  into endpoint
  from public.webhook_deliveries delivery
  join public.webhook_endpoints endpoint_row on endpoint_row.id = delivery.endpoint_id
  where delivery.id = delivery_uuid
  for update of delivery;

  if endpoint.id is null then
    raise exception 'webhook_delivery_not_found';
  end if;

  if endpoint.status <> 'Active'
     or endpoint.verified_at is null
     or endpoint.verified_host is null
     or endpoint.secret_ref is null then
    raise exception 'webhook_endpoint_not_dispatchable';
  end if;

  update public.webhook_deliveries delivery
  set status = 'queued',
      attempts = 0,
      next_retry_at = now(),
      http_status = null,
      duration_ms = null,
      last_error = null,
      locked_at = null,
      locked_by = null,
      last_attempt_at = null,
      delivered_at = null,
      redrive_count = delivery.redrive_count + 1,
      last_redriven_at = now()
  where delivery.id = delivery_uuid
    and delivery.status in ('dead_letter','failed')
  returning delivery.* into updated;

  if updated.id is null then
    raise exception 'delivery_not_redrivable';
  end if;

  insert into public.audit_events (
    hotel_id,
    actor_kind,
    category,
    action,
    detail,
    payload
  )
  values (
    updated.hotel_id,
    'system',
    'Integration',
    'Webhook delivery redriven',
    safe_reason,
    jsonb_build_object(
      'delivery_id', updated.id,
      'event_id', updated.event_id,
      'event_type', updated.event_type,
      'endpoint_id', updated.endpoint_id,
      'redrive_count', updated.redrive_count
    )
  );

  return updated;
end;
$$;

revoke all on function public.redrive_webhook_delivery(uuid, text) from public;
revoke all on function public.redrive_webhook_delivery(uuid, text) from anon, authenticated;
grant execute on function public.redrive_webhook_delivery(uuid, text) to service_role;

comment on function public.redrive_webhook_delivery(uuid, text)
  is 'Service-role only. Resets a failed/dead-letter outbound delivery to queued without replaying the source hotel event.';
