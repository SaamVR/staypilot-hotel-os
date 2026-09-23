-- StayPilot secure tenant bootstrap
-- Server-only hotel creation + first Owner membership + default automation catalog.
-- Requires core migration 001. Apply only to a dedicated StayPilot Supabase project.

create table if not exists private.hotel_bootstrap_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  request_fingerprint text not null check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);

revoke all on table private.hotel_bootstrap_requests from public, anon, authenticated;

create or replace function public.bootstrap_hotel_owner(
  user_uuid uuid,
  idempotency_key text,
  hotel_slug text,
  hotel_name text,
  hotel_timezone text default 'UTC',
  hotel_currency text default 'USD'
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  safe_key text := trim(coalesce(idempotency_key, ''));
  safe_slug text := lower(trim(coalesce(hotel_slug, '')));
  safe_name text := trim(regexp_replace(coalesce(hotel_name, ''), '\s+', ' ', 'g'));
  safe_timezone text := trim(coalesce(hotel_timezone, 'UTC'));
  safe_currency text := upper(trim(coalesce(hotel_currency, 'USD')));
  request_fingerprint text;
  existing_fingerprint text;
  existing_hotel public.hotels;
  new_hotel public.hotels;
begin
  if user_uuid is null then raise exception 'bootstrap_user_required'; end if;
  if safe_key !~ '^[A-Za-z0-9._:-]{8,120}$' then raise exception 'invalid_idempotency_key'; end if;
  if safe_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then raise exception 'invalid_hotel_slug'; end if;
  if char_length(safe_name) < 2 or char_length(safe_name) > 120 then raise exception 'invalid_hotel_name'; end if;
  if char_length(safe_timezone) < 1 or char_length(safe_timezone) > 64 or safe_timezone !~ '^[A-Za-z0-9_+./-]+$' then raise exception 'invalid_timezone'; end if;
  if safe_currency !~ '^[A-Z]{3}$' then raise exception 'invalid_currency'; end if;

  request_fingerprint := encode(
    digest(safe_slug || E'\n' || safe_name || E'\n' || safe_timezone || E'\n' || safe_currency, 'sha256'),
    'hex'
  );

  perform pg_advisory_xact_lock(hashtextextended(user_uuid::text || ':' || safe_key, 0));

  select r.request_fingerprint
  into existing_fingerprint
  from private.hotel_bootstrap_requests r
  where r.user_id = user_uuid and r.idempotency_key = safe_key;

  if existing_fingerprint is not null then
    if existing_fingerprint <> request_fingerprint then
      raise exception 'idempotency_key_reused';
    end if;

    select h.*
    into existing_hotel
    from private.hotel_bootstrap_requests r
    join public.hotels h on h.id = r.hotel_id
    where r.user_id = user_uuid and r.idempotency_key = safe_key;

    if existing_hotel.id is null then
      raise exception 'bootstrap_state_corrupt';
    end if;

    return jsonb_build_object(
      'created', false,
      'hotel', jsonb_build_object(
        'id',existing_hotel.id,'slug',existing_hotel.slug,'name',existing_hotel.name,
        'timezone',existing_hotel.timezone,'currency',existing_hotel.currency,
        'automation_paused',existing_hotel.automation_paused
      ),
      'role','owner',
      'automation_rules_seeded',0
    );
  end if;

  select h.* into existing_hotel from public.hotels h where h.slug = safe_slug;
  if existing_hotel.id is not null then
    if exists (
      select 1 from public.hotel_members hm
      where hm.hotel_id = existing_hotel.id and hm.user_id = user_uuid and hm.role = 'owner'
    ) then
      if existing_hotel.name <> safe_name
         or existing_hotel.timezone <> safe_timezone
         or existing_hotel.currency <> safe_currency then
        raise exception 'hotel_already_exists';
      end if;

      insert into private.hotel_bootstrap_requests(user_id,idempotency_key,request_fingerprint,hotel_id)
      values(user_uuid,safe_key,request_fingerprint,existing_hotel.id)
      on conflict do nothing;

      return jsonb_build_object(
        'created', false,
        'hotel', jsonb_build_object(
          'id',existing_hotel.id,'slug',existing_hotel.slug,'name',existing_hotel.name,
          'timezone',existing_hotel.timezone,'currency',existing_hotel.currency,
          'automation_paused',existing_hotel.automation_paused
        ),
        'role','owner',
        'automation_rules_seeded',0
      );
    end if;
    raise exception 'hotel_slug_taken';
  end if;

  insert into public.hotels(slug,name,timezone,currency,automation_paused,settings)
  values(
    safe_slug,safe_name,safe_timezone,safe_currency,true,
    jsonb_build_object('onboarding','server-bootstrap-v1','server_authority','disabled')
  )
  returning * into new_hotel;

  insert into public.hotel_members(hotel_id,user_id,role)
  values(new_hotel.id,user_uuid,'owner');

  insert into public.automation_rules(hotel_id,rule_key,name,scope,event_type,status,autonomy,config)
  values
    (new_hotel.id,'reservation-intake','Reservation intake','Operations','reservation.created','Paused','Auto','{"trigger":"Reservation received","action":"Hold inventory → reconcile channels → confirmation"}'),
    (new_hotel.id,'checkout-turnover','Checkout turnover','Operations','guest.checked_out','Active','Auto','{"trigger":"Guest checked out","action":"Room → Dirty → housekeeping task → sellability update"}'),
    (new_hotel.id,'pre-arrival-message','Pre-arrival message','Operations','prearrival.due','Paused','Auto','{"trigger":"24h before arrival","action":"Send arrival instructions → track delivery"}'),
    (new_hotel.id,'occupancy-rate-guard','Occupancy rate guard','Revenue','occupancy.threshold','Paused','Policy','{"trigger":"Occupancy > 80%","action":"BAR change → policy check → apply or approve"}'),
    (new_hotel.id,'failed-payment-recovery','Failed payment recovery','Finance','payment.failed','Paused','Auto','{"trigger":"Payment authorization fails","action":"Retry → flag folio → create exception"}'),
    (new_hotel.id,'low-stock-replenishment','Low-stock replenishment','Operations','inventory.low_stock','Paused','Policy','{"trigger":"Item falls below par","action":"Calculate reorder → policy check → PO / approval"}'),
    (new_hotel.id,'cancellation-recovery','Cancellation recovery','Operations','reservation.cancelled','Paused','Auto','{"trigger":"Reservation cancelled","action":"Release inventory → reconcile channels → resale"}'),
    (new_hotel.id,'room-ready-release','Room-ready release','Operations','housekeeping.completed','Active','Auto','{"trigger":"Housekeeping marks room ready","action":"Set Clean → recalculate sellability → channel release"}'),
    (new_hotel.id,'room-conflict-guard','Room conflict guard','Operations','room.maintenance_blocked','Active','Approval','{"trigger":"Assigned room goes out of order","action":"Find affected stay → alternatives → exception"}'),
    (new_hotel.id,'guest-request-router','Guest request router','Operations','guest.request_received','Active','Auto','{"trigger":"Guest service request received","action":"Classify → create task → route team"}'),
    (new_hotel.id,'approval-executor','Approval executor','Governance','approval.approved','Paused','Auto','{"trigger":"Owner approves an action","action":"Execute approved action → close handoff → audit"}'),
    (new_hotel.id,'review-recovery','Review recovery','Guest experience','review.negative','Active','Approval','{"trigger":"Low guest feedback detected","action":"Create recovery workflow → notify manager"}');

  insert into public.audit_events(hotel_id,actor_user_id,actor_kind,category,action,detail,payload)
  values(
    new_hotel.id,user_uuid,'user','Governance','Hotel bootstrapped',
    'Initial Owner tenant bootstrap completed',
    jsonb_build_object('slug',safe_slug,'automation_rules',12,'automation_paused',true)
  );

  insert into private.hotel_bootstrap_requests(user_id,idempotency_key,request_fingerprint,hotel_id)
  values(user_uuid,safe_key,request_fingerprint,new_hotel.id);

  return jsonb_build_object(
    'created',true,
    'hotel',jsonb_build_object(
      'id',new_hotel.id,'slug',new_hotel.slug,'name',new_hotel.name,
      'timezone',new_hotel.timezone,'currency',new_hotel.currency,
      'automation_paused',new_hotel.automation_paused
    ),
    'role','owner',
    'automation_rules_seeded',12
  );
end;
$$;

revoke all on function public.bootstrap_hotel_owner(uuid,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.bootstrap_hotel_owner(uuid,text,text,text,text,text) to service_role;

comment on function public.bootstrap_hotel_owner(uuid,text,text,text,text,text)
  is 'Service-role only. Transactionally creates a hotel, first Owner membership, safe default automation rules and audit record. Idempotent per authenticated user + key + request fingerprint.';
