-- StayPilot outbound webhook delivery dispatcher lifecycle
-- Requires migrations 001-003.
-- Adds verified endpoint gating, atomic delivery leases and retry/dead-letter completion.

alter table public.webhook_endpoints
  add column if not exists verified_at timestamptz,
  add column if not exists verified_host text;

alter table public.webhook_deliveries
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists last_attempt_at timestamptz;

create or replace function public.clear_webhook_verification_on_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.url is distinct from old.url
     or new.secret_ref is distinct from old.secret_ref then
    new.verified_at = null;
    new.verified_host = null;
  end if;
  return new;
end;
$$;

drop trigger if exists webhook_endpoints_clear_verification on public.webhook_endpoints;
create trigger webhook_endpoints_clear_verification
before update on public.webhook_endpoints
for each row execute function public.clear_webhook_verification_on_change();

-- Remove broad client write privileges inherited from migration 001 so verification
-- columns cannot be forged through the Data API.
revoke insert, update on public.webhook_endpoints from authenticated;
grant insert (hotel_id, name, url, events, status)
  on public.webhook_endpoints to authenticated;
grant update (name, url, events, status)
  on public.webhook_endpoints to authenticated;

create or replace function public.mark_webhook_endpoint_verified(
  endpoint_uuid uuid,
  verified_host_text text
)
returns public.webhook_endpoints
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated public.webhook_endpoints;
  normalized_host text := lower(trim(coalesce(verified_host_text, '')));
begin
  if normalized_host = ''
     or normalized_host !~ '^[a-z0-9][a-z0-9.-]{0,252}[a-z0-9]$' then
    raise exception 'invalid_verified_host';
  end if;

  update public.webhook_endpoints endpoint
  set verified_at = now(),
      verified_host = normalized_host
  where endpoint.id = endpoint_uuid
  returning endpoint.* into updated;

  if updated.id is null then
    raise exception 'webhook_endpoint_not_found';
  end if;

  return updated;
end;
$$;

revoke all on function public.mark_webhook_endpoint_verified(uuid, text) from public;
revoke all on function public.mark_webhook_endpoint_verified(uuid, text) from anon, authenticated;
grant execute on function public.mark_webhook_endpoint_verified(uuid, text) to service_role;

-- Replace outbox enqueue so only server-verified endpoints receive new delivery rows.
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
    and endpoint.verified_at is not null
    and source_event.event_type = any(endpoint.events)
  on conflict (hotel_id, endpoint_id, event_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function public.enqueue_webhook_deliveries(uuid) from public;
revoke all on function public.enqueue_webhook_deliveries(uuid) from anon, authenticated;
grant execute on function public.enqueue_webhook_deliveries(uuid) to service_role;

create index if not exists webhook_deliveries_dispatch_idx
  on public.webhook_deliveries(status, next_retry_at, locked_at, created_at)
  where status in ('queued','retrying');

create or replace function public.claim_webhook_deliveries(
  worker_name text,
  batch_size integer default 10
)
returns table (
  delivery_id uuid,
  hotel_id uuid,
  endpoint_id uuid,
  inbound_event_id uuid,
  event_id text,
  event_type text,
  endpoint_url text,
  endpoint_verified_host text,
  secret_ref text,
  event_payload jsonb,
  event_received_at timestamptz,
  attempts integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  safe_batch integer := greatest(1, least(coalesce(batch_size, 10), 25));
begin
  if coalesce(length(trim(worker_name)), 0) < 3 then
    raise exception 'worker_name_required';
  end if;

  return query
  with claimable as (
    select delivery.id
    from public.webhook_deliveries delivery
    join public.webhook_endpoints endpoint on endpoint.id = delivery.endpoint_id
    where endpoint.status = 'Active'
      and endpoint.verified_at is not null
      and (
        (
          delivery.status in ('queued','retrying')
          and delivery.locked_at is null
          and coalesce(delivery.next_retry_at, delivery.created_at) <= now()
          and delivery.attempts < 5
        )
        or
        (
          delivery.status = 'retrying'
          and delivery.locked_at < now() - interval '10 minutes'
        )
      )
    order by delivery.created_at asc
    for update of delivery skip locked
    limit safe_batch
  ),
  claimed as (
    update public.webhook_deliveries delivery
    set status = 'retrying',
        attempts = delivery.attempts + 1,
        last_attempt_at = now(),
        locked_at = now(),
        locked_by = worker_name,
        last_error = null
    from claimable
    where delivery.id = claimable.id
    returning delivery.*
  )
  select
    claimed.id,
    claimed.hotel_id,
    claimed.endpoint_id,
    claimed.inbound_event_id,
    claimed.event_id,
    claimed.event_type,
    endpoint.url,
    endpoint.verified_host,
    endpoint.secret_ref,
    inbound.payload,
    inbound.received_at,
    claimed.attempts
  from claimed
  join public.webhook_endpoints endpoint on endpoint.id = claimed.endpoint_id
  join public.inbound_events inbound on inbound.id = claimed.inbound_event_id;
end;
$$;

create or replace function public.finish_webhook_delivery(
  delivery_uuid uuid,
  outcome text,
  response_status integer default null,
  elapsed_ms integer default null,
  error_message text default null,
  retry_delay_seconds integer default 60
)
returns public.webhook_deliveries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated public.webhook_deliveries;
  normalized_outcome text := lower(coalesce(outcome, ''));
  safe_retry integer := greatest(5, least(coalesce(retry_delay_seconds, 60), 3600));
begin
  if normalized_outcome not in ('delivered','retry','dead_letter') then
    raise exception 'invalid_delivery_outcome';
  end if;

  update public.webhook_deliveries delivery
  set status = case
        when normalized_outcome = 'delivered' then 'delivered'
        when normalized_outcome = 'dead_letter' then 'dead_letter'
        when delivery.attempts >= 5 then 'dead_letter'
        else 'retrying'
      end,
      http_status = response_status,
      duration_ms = case when elapsed_ms is null then null else greatest(0, elapsed_ms) end,
      last_error = nullif(error_message, ''),
      next_retry_at = case
        when normalized_outcome = 'retry' and delivery.attempts < 5
          then now() + make_interval(secs => safe_retry)
        else delivery.next_retry_at
      end,
      delivered_at = case
        when normalized_outcome = 'delivered' then now()
        else delivery.delivered_at
      end,
      locked_at = null,
      locked_by = null
  where delivery.id = delivery_uuid
    and delivery.status = 'retrying'
    and delivery.locked_at is not null
  returning delivery.* into updated;

  if updated.id is null then
    raise exception 'delivery_not_claimed';
  end if;

  return updated;
end;
$$;

revoke all on function public.claim_webhook_deliveries(text, integer) from public;
revoke all on function public.finish_webhook_delivery(uuid, text, integer, integer, text, integer) from public;
revoke all on function public.claim_webhook_deliveries(text, integer) from anon, authenticated;
revoke all on function public.finish_webhook_delivery(uuid, text, integer, integer, text, integer) from anon, authenticated;
grant execute on function public.claim_webhook_deliveries(text, integer) to service_role;
grant execute on function public.finish_webhook_delivery(uuid, text, integer, integer, text, integer) to service_role;

comment on function public.claim_webhook_deliveries(text, integer)
  is 'Service-role only. Atomically claims verified-endpoint webhook deliveries with stale-lease recovery.';
comment on function public.finish_webhook_delivery(uuid, text, integer, integer, text, integer)
  is 'Service-role only. Marks an outbound delivery delivered, retrying, or dead-lettered.';
