-- StayPilot durable worker lifecycle
-- Requires 20260923_001_staypilot_core.sql.
-- Safe to stage before provisioning; apply only to a dedicated StayPilot Supabase project.

alter table public.inbound_events
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists locked_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists dead_lettered_at timestamptz;

alter table public.tasks
  add column if not exists source_event_id text;

alter table public.approvals
  add column if not exists source_event_id text;

alter table public.audit_events
  add column if not exists source_event_id text;

create unique index if not exists tasks_hotel_source_event_uidx
  on public.tasks(hotel_id, source_event_id);

create unique index if not exists approvals_hotel_source_event_uidx
  on public.approvals(hotel_id, source_event_id);

create unique index if not exists audit_events_hotel_source_action_uidx
  on public.audit_events(hotel_id, source_event_id, action);

create index if not exists inbound_events_claim_idx
  on public.inbound_events(status, next_attempt_at, locked_at, received_at)
  where status in ('queued','failed','processing');

create or replace function public.claim_inbound_events(
  worker_name text,
  batch_size integer default 10
)
returns setof public.inbound_events
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
    select e.id
    from public.inbound_events e
    join public.hotels h on h.id = e.hotel_id
    where (
        (e.status in ('queued','failed') and e.next_attempt_at <= now())
        or
        (e.status = 'processing' and e.locked_at < now() - interval '10 minutes')
      )
      and e.attempt_count < 5
      and h.automation_paused = false
    order by e.received_at asc
    for update of e skip locked
    limit safe_batch
  )
  update public.inbound_events e
  set status = 'processing',
      attempt_count = e.attempt_count + 1,
      last_attempt_at = now(),
      locked_at = now(),
      locked_by = worker_name,
      last_error = null
  from claimable c
  where e.id = c.id
  returning e.*;
end;
$$;

create or replace function public.finish_inbound_event(
  event_uuid uuid,
  outcome text,
  error_message text default null,
  retry_delay_seconds integer default 60
)
returns public.inbound_events
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated public.inbound_events;
  normalized_outcome text := lower(coalesce(outcome, ''));
  safe_retry integer := greatest(5, least(coalesce(retry_delay_seconds, 60), 3600));
begin
  if normalized_outcome not in ('completed','failed','dead_letter') then
    raise exception 'invalid_event_outcome';
  end if;

  update public.inbound_events e
  set status = case
        when normalized_outcome = 'completed' then 'completed'
        when normalized_outcome = 'dead_letter' then 'dead_letter'
        when e.attempt_count >= 5 then 'dead_letter'
        else 'failed'
      end,
      processed_at = case when normalized_outcome = 'completed' then now() else e.processed_at end,
      dead_lettered_at = case
        when normalized_outcome = 'dead_letter' or (normalized_outcome = 'failed' and e.attempt_count >= 5) then now()
        else e.dead_lettered_at
      end,
      next_attempt_at = case
        when normalized_outcome = 'failed' and e.attempt_count < 5 then now() + make_interval(secs => safe_retry)
        else e.next_attempt_at
      end,
      last_error = nullif(error_message, ''),
      locked_at = null,
      locked_by = null
  where e.id = event_uuid
    and e.status = 'processing'
  returning e.* into updated;

  if updated.id is null then
    raise exception 'event_not_processing';
  end if;

  return updated;
end;
$$;

revoke all on function public.claim_inbound_events(text, integer) from public;
revoke all on function public.finish_inbound_event(uuid, text, text, integer) from public;
revoke all on function public.claim_inbound_events(text, integer) from anon, authenticated;
revoke all on function public.finish_inbound_event(uuid, text, text, integer) from anon, authenticated;
grant execute on function public.claim_inbound_events(text, integer) to service_role;
grant execute on function public.finish_inbound_event(uuid, text, text, integer) to service_role;

comment on function public.claim_inbound_events(text, integer)
  is 'Service-role only. Atomically claims due queued/failed or stale processing events with SKIP LOCKED.';
comment on function public.finish_inbound_event(uuid, text, text, integer)
  is 'Service-role only. Completes, retries, or dead-letters a processing event.';
