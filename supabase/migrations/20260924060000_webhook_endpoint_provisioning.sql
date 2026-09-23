-- StayPilot secure webhook endpoint provisioning and verification
-- Requires migrations 001-004.
-- Moves endpoint creation/update trust state behind authenticated server APIs.

alter table public.webhook_endpoints
  add column if not exists verification_status text not null default 'Pending'
    check (verification_status in ('Pending','Verified','Failed')),
  add column if not exists verification_attempted_at timestamptz,
  add column if not exists verification_error text;

-- Client sessions may read/delete Owner endpoints through RLS, but may no longer create
-- or update destination/trust/signing fields directly through PostgREST.
revoke insert, update on public.webhook_endpoints from authenticated;

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
    new.verification_status = 'Pending';
    new.verification_attempted_at = null;
    new.verification_error = null;
  end if;
  return new;
end;
$$;

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
      verified_host = normalized_host,
      verification_status = 'Verified',
      verification_attempted_at = now(),
      verification_error = null,
      status = 'Active'
  where endpoint.id = endpoint_uuid
  returning endpoint.* into updated;

  if updated.id is null then
    raise exception 'webhook_endpoint_not_found';
  end if;

  return updated;
end;
$$;

create or replace function public.mark_webhook_endpoint_verification_failed(
  endpoint_uuid uuid,
  error_text text
)
returns public.webhook_endpoints
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated public.webhook_endpoints;
begin
  update public.webhook_endpoints endpoint
  set verified_at = null,
      verified_host = null,
      verification_status = 'Failed',
      verification_attempted_at = now(),
      verification_error = left(coalesce(nullif(trim(error_text), ''), 'verification_failed'), 240),
      status = 'Paused'
  where endpoint.id = endpoint_uuid
  returning endpoint.* into updated;

  if updated.id is null then
    raise exception 'webhook_endpoint_not_found';
  end if;

  return updated;
end;
$$;

revoke all on function public.mark_webhook_endpoint_verified(uuid, text) from public;
revoke all on function public.mark_webhook_endpoint_verification_failed(uuid, text) from public;
revoke all on function public.mark_webhook_endpoint_verified(uuid, text) from anon, authenticated;
revoke all on function public.mark_webhook_endpoint_verification_failed(uuid, text) from anon, authenticated;
grant execute on function public.mark_webhook_endpoint_verified(uuid, text) to service_role;
grant execute on function public.mark_webhook_endpoint_verification_failed(uuid, text) to service_role;

-- Enqueue and dispatcher claims require server-verified status, not only non-null fields.
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
    and endpoint.verification_status = 'Verified'
    and endpoint.verified_at is not null
    and endpoint.verified_host is not null
    and endpoint.secret_ref is not null
    and source_event.event_type = any(endpoint.events)
  on conflict (hotel_id, endpoint_id, event_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

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
      and endpoint.verification_status = 'Verified'
      and endpoint.verified_at is not null
      and endpoint.verified_host is not null
      and endpoint.secret_ref is not null
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

revoke all on function public.enqueue_webhook_deliveries(uuid) from public;
revoke all on function public.claim_webhook_deliveries(text, integer) from public;
revoke all on function public.enqueue_webhook_deliveries(uuid) from anon, authenticated;
revoke all on function public.claim_webhook_deliveries(text, integer) from anon, authenticated;
grant execute on function public.enqueue_webhook_deliveries(uuid) to service_role;
grant execute on function public.claim_webhook_deliveries(text, integer) to service_role;
