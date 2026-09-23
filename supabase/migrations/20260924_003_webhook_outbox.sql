-- StayPilot durable outbound webhook outbox
-- Requires 20260923_001_staypilot_core.sql and 20260923_002_durable_worker.sql.
-- Queues webhook deliveries only; it does not perform external network calls.

alter table public.webhook_deliveries
  add column if not exists inbound_event_id uuid references public.inbound_events(id) on delete set null;

create unique index if not exists webhook_deliveries_endpoint_event_uidx
  on public.webhook_deliveries(hotel_id, endpoint_id, event_id);

create index if not exists webhook_deliveries_queue_idx
  on public.webhook_deliveries(status, next_retry_at, created_at)
  where status in ('queued','retrying');

create or replace function public.enqueue_webhook_deliveries(event_uuid uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  source_event public.inbound_events;
  inserted_count integer := 0;
begin
  select *
  into source_event
  from public.inbound_events e
  where e.id = event_uuid
  for update;

  if source_event.id is null then
    raise exception 'inbound_event_not_found';
  end if;

  if source_event.status <> 'processing' then
    raise exception 'inbound_event_not_processing';
  end if;

  insert into public.webhook_deliveries (
    hotel_id,
    endpoint_id,
    inbound_event_id,
    event_id,
    event_type,
    status,
    attempts,
    next_retry_at
  )
  select
    source_event.hotel_id,
    endpoint.id,
    source_event.id,
    source_event.event_id,
    source_event.event_type,
    'queued',
    0,
    now()
  from public.webhook_endpoints endpoint
  where endpoint.hotel_id = source_event.hotel_id
    and endpoint.status = 'Active'
    and source_event.event_type = any(endpoint.events)
  on conflict (hotel_id, endpoint_id, event_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.enqueue_webhook_deliveries(uuid) from public;
revoke all on function public.enqueue_webhook_deliveries(uuid) from anon, authenticated;
grant execute on function public.enqueue_webhook_deliveries(uuid) to service_role;

comment on function public.enqueue_webhook_deliveries(uuid)
  is 'Service-role only. Queues idempotent outbound webhook deliveries for active endpoints subscribed to a processing inbound event.';
