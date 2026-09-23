-- StayPilot production backend foundation
-- Apply to a dedicated Supabase project only. Do not apply to unrelated projects.
-- Browser prototype state remains unchanged until backend mode is explicitly enabled.

create extension if not exists pgcrypto;
create schema if not exists private;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  name text not null,
  timezone text not null default 'UTC',
  currency text not null default 'USD' check (char_length(currency) = 3),
  automation_paused boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hotel_members (
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','staff')),
  created_at timestamptz not null default now(),
  primary key (hotel_id, user_id)
);

create index hotel_members_user_id_idx on public.hotel_members(user_id);

create or replace function private.is_hotel_member(target_hotel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.hotel_members hm
      where hm.hotel_id = target_hotel_id
        and hm.user_id = (select auth.uid())
    );
$$;

create or replace function private.has_hotel_role(target_hotel_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.hotel_members hm
      where hm.hotel_id = target_hotel_id
        and hm.user_id = (select auth.uid())
        and hm.role = any(allowed_roles)
    );
$$;

revoke all on function private.is_hotel_member(uuid) from public;
revoke all on function private.has_hotel_role(uuid, text[]) from public;
grant execute on function private.is_hotel_member(uuid) to authenticated;
grant execute on function private.has_hotel_role(uuid, text[]) to authenticated;

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  number text not null,
  room_type text not null,
  occupancy text not null default 'Vacant' check (occupancy in ('Vacant','Reserved','Occupied')),
  housekeeping text not null default 'Clean' check (housekeeping in ('Clean','Dirty','Cleaning')),
  maintenance text not null default 'Clear' check (maintenance in ('Clear','Out of order')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, number)
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  external_ref text not null,
  guest_name text not null,
  source text not null,
  room_id uuid references public.rooms(id) on delete set null,
  room_type text not null,
  check_in date not null,
  check_out date not null,
  guests integer not null default 1 check (guests > 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  paid numeric(12,2) not null default 0 check (paid >= 0),
  status text not null check (status in ('Confirmed','Checked in','Checked out','Cancelled')),
  payment_risk text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, external_ref),
  check (check_out > check_in)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  room_id uuid references public.rooms(id) on delete set null,
  title text not null,
  team text not null,
  status text not null default 'New' check (status in ('New','Queued','Assigned','In progress','Done')),
  due_at timestamptz,
  automated boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  type text not null,
  title text not null,
  detail text,
  amount numeric(12,2),
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected','Received')),
  requested_by_user uuid references auth.users(id) on delete set null,
  requested_by_actor text not null default 'StayPilot automation',
  resolved_by uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  rule_key text not null,
  name text not null,
  scope text not null,
  event_type text not null,
  status text not null default 'Active' check (status in ('Active','Paused')),
  autonomy text not null default 'Policy' check (autonomy in ('Auto','Policy','Approval','Suggest')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, rule_key)
);

create table public.inbound_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  payload_hash text not null,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','dead_letter')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (hotel_id, event_id)
);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  rule_id uuid references public.automation_rules(id) on delete set null,
  inbound_event_id uuid references public.inbound_events(id) on delete set null,
  event_id text,
  event_type text not null,
  result text not null check (result in ('Success','Approval','Failed','Suppressed')),
  detail text,
  steps jsonb not null default '[]'::jsonb,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  minutes_saved integer not null default 0 check (minutes_saved >= 0),
  created_at timestamptz not null default now(),
  unique (hotel_id, event_id, rule_id)
);

create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  name text not null,
  url text not null check (url ~ '^https://'),
  events text[] not null default '{}',
  status text not null default 'Active' check (status in ('Active','Paused','Disabled')),
  secret_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event_id text not null,
  event_type text not null,
  status text not null default 'queued' check (status in ('queued','delivered','retrying','failed','dead_letter')),
  http_status integer,
  duration_ms integer,
  attempts integer not null default 0 check (attempts >= 0),
  next_retry_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_kind text not null default 'system' check (actor_kind in ('user','automation','integration','system')),
  category text not null,
  action text not null,
  detail text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index rooms_hotel_idx on public.rooms(hotel_id);
create index reservations_hotel_status_idx on public.reservations(hotel_id, status);
create index reservations_hotel_dates_idx on public.reservations(hotel_id, check_in, check_out);
create index tasks_hotel_status_idx on public.tasks(hotel_id, status);
create index approvals_hotel_status_idx on public.approvals(hotel_id, status);
create index automation_rules_hotel_event_idx on public.automation_rules(hotel_id, event_type);
create index inbound_events_hotel_status_idx on public.inbound_events(hotel_id, status, received_at);
create index automation_runs_hotel_created_idx on public.automation_runs(hotel_id, created_at desc);
create index webhook_deliveries_hotel_status_idx on public.webhook_deliveries(hotel_id, status, created_at);
create index audit_events_hotel_created_idx on public.audit_events(hotel_id, created_at desc);

create trigger hotels_touch_updated_at before update on public.hotels
for each row execute function public.set_updated_at();
create trigger rooms_touch_updated_at before update on public.rooms
for each row execute function public.set_updated_at();
create trigger reservations_touch_updated_at before update on public.reservations
for each row execute function public.set_updated_at();
create trigger tasks_touch_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
create trigger automation_rules_touch_updated_at before update on public.automation_rules
for each row execute function public.set_updated_at();
create trigger webhook_endpoints_touch_updated_at before update on public.webhook_endpoints
for each row execute function public.set_updated_at();

alter table public.hotels enable row level security;
alter table public.hotel_members enable row level security;
alter table public.rooms enable row level security;
alter table public.reservations enable row level security;
alter table public.tasks enable row level security;
alter table public.approvals enable row level security;
alter table public.automation_rules enable row level security;
alter table public.inbound_events enable row level security;
alter table public.automation_runs enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.audit_events enable row level security;

-- Hotels are created/bootstraped server-side. Authenticated clients may read member hotels;
-- only owners may modify hotel-level settings.
create policy hotels_member_select on public.hotels
for select to authenticated
using ((select private.is_hotel_member(id)));

create policy hotels_owner_update on public.hotels
for update to authenticated
using ((select private.has_hotel_role(id, array['owner']::text[])))
with check ((select private.has_hotel_role(id, array['owner']::text[])));

create policy hotel_members_member_select on public.hotel_members
for select to authenticated
using ((select private.is_hotel_member(hotel_id)));

create policy hotel_members_owner_insert on public.hotel_members
for insert to authenticated
with check ((select private.has_hotel_role(hotel_id, array['owner']::text[])));

create policy hotel_members_owner_update on public.hotel_members
for update to authenticated
using ((select private.has_hotel_role(hotel_id, array['owner']::text[])))
with check ((select private.has_hotel_role(hotel_id, array['owner']::text[])));

create policy hotel_members_owner_delete on public.hotel_members
for delete to authenticated
using ((select private.has_hotel_role(hotel_id, array['owner']::text[])));

create policy rooms_member_select on public.rooms
for select to authenticated
using ((select private.is_hotel_member(hotel_id)));
create policy rooms_manager_write on public.rooms
for all to authenticated
using ((select private.has_hotel_role(hotel_id, array['owner','manager']::text[])))
with check ((select private.has_hotel_role(hotel_id, array['owner','manager']::text[])));

create policy reservations_member_select on public.reservations
for select to authenticated
using ((select private.is_hotel_member(hotel_id)));
create policy reservations_manager_write on public.reservations
for all to authenticated
using ((select private.has_hotel_role(hotel_id, array['owner','manager']::text[])))
with check ((select private.has_hotel_role(hotel_id, array['owner','manager']::text[])));

create policy tasks_member_select on public.tasks
for select to authenticated
using ((select private.is_hotel_member(hotel_id)));
create policy tasks_member_write on public.tasks
for all to authenticated
using ((select private.is_hotel_member(hotel_id)))
with check ((select private.is_hotel_member(hotel_id)));

create policy approvals_member_select on public.approvals
for select to authenticated
using ((select private.is_hotel_member(hotel_id)));
create policy approvals_manager_insert on public.approvals
for insert to authenticated
with check ((select private.has_hotel_role(hotel_id, array['owner','manager']::text[])));
create policy approvals_owner_update on public.approvals
for update to authenticated
using ((select private.has_hotel_role(hotel_id, array['owner']::text[])))
with check ((select private.has_hotel_role(hotel_id, array['owner']::text[])));

create policy automation_rules_member_select on public.automation_rules
for select to authenticated
using ((select private.is_hotel_member(hotel_id)));
create policy automation_rules_owner_write on public.automation_rules
for all to authenticated
using ((select private.has_hotel_role(hotel_id, array['owner']::text[])))
with check ((select private.has_hotel_role(hotel_id, array['owner']::text[])));

create policy inbound_events_operator_select on public.inbound_events
for select to authenticated
using ((select private.has_hotel_role(hotel_id, array['owner','manager']::text[])));

create policy automation_runs_member_select on public.automation_runs
for select to authenticated
using ((select private.is_hotel_member(hotel_id)));

create policy webhook_endpoints_owner_select on public.webhook_endpoints
for select to authenticated
using ((select private.has_hotel_role(hotel_id, array['owner']::text[])));
create policy webhook_endpoints_owner_write on public.webhook_endpoints
for all to authenticated
using ((select private.has_hotel_role(hotel_id, array['owner']::text[])))
with check ((select private.has_hotel_role(hotel_id, array['owner']::text[])));

create policy webhook_deliveries_operator_select on public.webhook_deliveries
for select to authenticated
using ((select private.has_hotel_role(hotel_id, array['owner','manager']::text[])));

create policy audit_events_member_select on public.audit_events
for select to authenticated
using ((select private.is_hotel_member(hotel_id)));

grant usage on schema public to authenticated;
grant select, update on public.hotels to authenticated;
grant select, insert, update, delete on public.hotel_members to authenticated;
grant select, insert, update, delete on public.rooms to authenticated;
grant select, insert, update, delete on public.reservations to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update on public.approvals to authenticated;
grant select, insert, update, delete on public.automation_rules to authenticated;
grant select on public.inbound_events to authenticated;
grant select on public.automation_runs to authenticated;
grant select, insert, update, delete on public.webhook_endpoints to authenticated;
grant select on public.webhook_deliveries to authenticated;
grant select on public.audit_events to authenticated;

-- Server/service-role writes are intentionally not granted through client policies for:
-- inbound_events, automation_runs, webhook_deliveries and audit_events.
