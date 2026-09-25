create table if not exists ezstay.hotels (
  id uuid primary key default gen_random_uuid(),
  demo_session_id uuid references platform.demo_sessions(id) on delete cascade,
  slug text not null,
  name text not null,
  timezone text not null default 'UTC',
  currency text not null default 'USD' check (char_length(currency) = 3),
  automation_paused boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id),
  unique (slug)
);

create table if not exists ezstay.hotel_members (
  hotel_id uuid not null references ezstay.hotels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','staff')),
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  created_at timestamptz not null default now(),
  primary key (hotel_id, user_id)
);

create table if not exists ezstay.rooms (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references ezstay.hotels(id) on delete cascade,
  number text not null,
  room_type text not null,
  occupancy text not null default 'Vacant' check (occupancy in ('Vacant','Reserved','Occupied')),
  housekeeping text not null default 'Clean' check (housekeeping in ('Clean','Dirty','Cleaning')),
  maintenance text not null default 'Clear' check (maintenance in ('Clear','Out of order')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, id),
  unique (hotel_id, number)
);

create table if not exists ezstay.reservations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references ezstay.hotels(id) on delete cascade,
  external_ref text not null,
  guest_name text not null,
  source text not null,
  room_id uuid,
  room_type text not null,
  check_in date not null,
  check_out date not null,
  guests integer not null default 1 check (guests > 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  paid numeric(12,2) not null default 0 check (paid >= 0),
  status text not null check (status in ('Confirmed','Checked in','Checked out','Cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, id),
  unique (hotel_id, external_ref),
  check (check_out > check_in),
  foreign key (hotel_id, room_id)
    references ezstay.rooms (hotel_id, id)
    on delete set null
);

create table if not exists ezstay.guest_requests (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references ezstay.hotels(id) on delete cascade,
  reservation_id uuid,
  room_id uuid,
  request text not null,
  category text not null,
  urgency text not null default 'Normal' check (urgency in ('Low','Normal','High','Urgent')),
  status text not null default 'Open' check (status in ('Open','Assigned','In progress','Done','Cancelled')),
  source_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, id),
  foreign key (hotel_id, reservation_id)
    references ezstay.reservations (hotel_id, id)
    on delete set null,
  foreign key (hotel_id, room_id)
    references ezstay.rooms (hotel_id, id)
    on delete set null
);

create table if not exists ezstay.tasks (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references ezstay.hotels(id) on delete cascade,
  reservation_id uuid,
  room_id uuid,
  title text not null,
  team text not null,
  status text not null default 'New' check (status in ('New','Queued','Assigned','In progress','Done')),
  due_at timestamptz,
  escalated_at timestamptz,
  automated boolean not null default false,
  source_event_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, id),
  foreign key (hotel_id, reservation_id)
    references ezstay.reservations (hotel_id, id)
    on delete set null,
  foreign key (hotel_id, room_id)
    references ezstay.rooms (hotel_id, id)
    on delete set null
);

create table if not exists ezstay.inventory_items (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references ezstay.hotels(id) on delete cascade,
  item text not null,
  category text not null,
  stock numeric(12,2) not null default 0 check (stock >= 0),
  par numeric(12,2) not null default 0 check (par >= 0),
  unit text not null,
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  supplier text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, id),
  unique (hotel_id, item)
);

create table if not exists ezstay.approvals (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references ezstay.hotels(id) on delete cascade,
  inventory_item_id uuid,
  type text not null,
  title text not null,
  detail text,
  amount numeric(12,2) check (amount is null or amount >= 0),
  quantity numeric(12,2) check (quantity is null or quantity > 0),
  status text not null default 'Pending' check (status in ('Pending','Approved','Rejected','Received')),
  requested_by_user uuid references auth.users(id) on delete set null,
  requested_by_actor text not null default 'EZStay automation',
  resolved_by uuid references auth.users(id) on delete set null,
  source_event_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (hotel_id, id),
  foreign key (hotel_id, inventory_item_id)
    references ezstay.inventory_items (hotel_id, id)
    on delete set null
);

create table if not exists ezstay.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references ezstay.hotels(id) on delete cascade,
  approval_id uuid,
  inventory_item_id uuid,
  quantity numeric(12,2) not null check (quantity > 0),
  amount numeric(12,2) not null check (amount >= 0),
  supplier text not null,
  status text not null default 'Draft' check (status in ('Draft','Submitted','Ordered','Received','Cancelled')),
  source_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, id),
  foreign key (hotel_id, approval_id)
    references ezstay.approvals (hotel_id, id)
    on delete set null,
  foreign key (hotel_id, inventory_item_id)
    references ezstay.inventory_items (hotel_id, id)
    on delete restrict
);

create table if not exists ezstay.automation_rules (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references ezstay.hotels(id) on delete cascade,
  rule_key text not null,
  name text not null,
  event_type text not null,
  status text not null default 'Active' check (status in ('Active','Paused')),
  autonomy text not null default 'Policy' check (autonomy in ('Auto','Policy','Approval','Suggest')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, id),
  unique (hotel_id, rule_key)
);

create table if not exists ezstay.inbound_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references ezstay.hotels(id) on delete cascade,
  event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  payload_hash text not null,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','dead_letter')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  claimed_by text,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  next_attempt_at timestamptz,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (hotel_id, id),
  unique (hotel_id, event_id)
);

create table if not exists ezstay.automation_runs (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references ezstay.hotels(id) on delete cascade,
  rule_id uuid,
  inbound_event_id uuid,
  event_id text,
  event_type text not null,
  rule_key text not null,
  result text not null check (result in ('Success','Approval','Failed','Suppressed')),
  summary text not null,
  input jsonb not null default '{}'::jsonb,
  decision jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (hotel_id, id),
  unique (hotel_id, event_id, rule_key),
  foreign key (hotel_id, rule_id)
    references ezstay.automation_rules (hotel_id, id)
    on delete set null,
  foreign key (hotel_id, inbound_event_id)
    references ezstay.inbound_events (hotel_id, id)
    on delete set null
);

create table if not exists ezstay.automation_run_steps (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references ezstay.hotels(id) on delete cascade,
  run_id uuid not null,
  step_index integer not null check (step_index >= 0),
  stage text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  effective_at timestamptz,
  unique (hotel_id, id),
  unique (hotel_id, run_id, step_index),
  foreign key (hotel_id, run_id)
    references ezstay.automation_runs (hotel_id, id)
    on delete cascade
);

create table if not exists ezstay.automation_run_links (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references ezstay.hotels(id) on delete cascade,
  run_id uuid not null,
  entity_type text not null,
  entity_id text not null,
  label text not null,
  created_at timestamptz not null default now(),
  unique (hotel_id, id),
  foreign key (hotel_id, run_id)
    references ezstay.automation_runs (hotel_id, id)
    on delete cascade
);

create table if not exists ezstay.delivery_endpoints (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references ezstay.hotels(id) on delete cascade,
  name text not null,
  channel text not null,
  status text not null default 'Active' check (status in ('Active','Paused','Disabled')),
  target_ref text,
  secret_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, id)
);

create table if not exists ezstay.deliveries (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references ezstay.hotels(id) on delete cascade,
  run_id uuid,
  endpoint_id uuid,
  status text not null default 'Queued' check (status in ('Queued','Delivered','Retrying','Failed','Dead-letter')),
  attempts integer not null default 0 check (attempts >= 0),
  next_retry_at timestamptz,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (hotel_id, id),
  foreign key (hotel_id, run_id)
    references ezstay.automation_runs (hotel_id, id)
    on delete set null,
  foreign key (hotel_id, endpoint_id)
    references ezstay.delivery_endpoints (hotel_id, id)
    on delete set null
);

create table if not exists ezstay.audit_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references ezstay.hotels(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_kind text not null default 'system' check (actor_kind in ('user','automation','integration','system')),
  category text not null,
  action text not null,
  detail text,
  source_event_id text,
  request_id text,
  effective_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (hotel_id, id)
);

create table if not exists ezstay.command_idempotency (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references ezstay.hotels(id) on delete cascade,
  idempotency_key text not null,
  command_type text not null,
  request_hash text not null,
  run_id uuid,
  response jsonb,
  created_at timestamptz not null default now(),
  unique (hotel_id, id),
  unique (hotel_id, idempotency_key),
  foreign key (hotel_id, run_id)
    references ezstay.automation_runs (hotel_id, id)
    on delete set null
);

create index if not exists hotel_members_user_id_idx
  on ezstay.hotel_members (user_id, hotel_id);

create index if not exists rooms_hotel_id_idx
  on ezstay.rooms (hotel_id, number);

create index if not exists reservations_hotel_id_status_idx
  on ezstay.reservations (hotel_id, status, check_in, check_out);

create index if not exists guest_requests_hotel_id_status_idx
  on ezstay.guest_requests (hotel_id, status, created_at);

create index if not exists tasks_hotel_id_status_idx
  on ezstay.tasks (hotel_id, status, due_at);

create index if not exists inventory_items_hotel_id_idx
  on ezstay.inventory_items (hotel_id, category);

create index if not exists approvals_hotel_id_status_idx
  on ezstay.approvals (hotel_id, status, created_at);

create index if not exists purchase_requests_hotel_id_status_idx
  on ezstay.purchase_requests (hotel_id, status, created_at);

create index if not exists automation_rules_hotel_id_event_idx
  on ezstay.automation_rules (hotel_id, event_type, status);

create index if not exists inbound_events_hotel_status_idx
  on ezstay.inbound_events (hotel_id, status, next_attempt_at, received_at);

create index if not exists automation_runs_hotel_created_idx
  on ezstay.automation_runs (hotel_id, created_at desc);

create index if not exists automation_run_steps_run_idx
  on ezstay.automation_run_steps (hotel_id, run_id, step_index);

create index if not exists automation_run_links_run_idx
  on ezstay.automation_run_links (hotel_id, run_id);

create index if not exists deliveries_hotel_status_idx
  on ezstay.deliveries (hotel_id, status, next_retry_at, created_at);

create index if not exists audit_events_hotel_created_idx
  on ezstay.audit_events (hotel_id, created_at desc);

create unique index if not exists tasks_source_event_once_idx
  on ezstay.tasks (hotel_id, source_event_id)
  where source_event_id is not null;

create unique index if not exists guest_requests_source_event_once_idx
  on ezstay.guest_requests (hotel_id, source_event_id)
  where source_event_id is not null;

create unique index if not exists approvals_source_event_once_idx
  on ezstay.approvals (hotel_id, source_event_id)
  where source_event_id is not null;

create unique index if not exists purchase_requests_source_event_once_idx
  on ezstay.purchase_requests (hotel_id, source_event_id)
  where source_event_id is not null;

-- Foreign-key support indexes. PostgreSQL does not automatically index the
-- referencing side of a foreign key; keep reset/cleanup and parent changes
-- from scanning unrelated tenant rows.
create index if not exists hotels_demo_session_idx
  on ezstay.hotels (demo_session_id)
  where demo_session_id is not null;

create index if not exists reservations_hotel_room_idx
  on ezstay.reservations (hotel_id, room_id)
  where room_id is not null;

create index if not exists guest_requests_hotel_reservation_idx
  on ezstay.guest_requests (hotel_id, reservation_id)
  where reservation_id is not null;

create index if not exists guest_requests_hotel_room_idx
  on ezstay.guest_requests (hotel_id, room_id)
  where room_id is not null;

create index if not exists tasks_hotel_reservation_idx
  on ezstay.tasks (hotel_id, reservation_id)
  where reservation_id is not null;

create index if not exists tasks_hotel_room_idx
  on ezstay.tasks (hotel_id, room_id)
  where room_id is not null;

create index if not exists approvals_hotel_inventory_idx
  on ezstay.approvals (hotel_id, inventory_item_id)
  where inventory_item_id is not null;

create index if not exists approvals_requested_by_user_idx
  on ezstay.approvals (requested_by_user)
  where requested_by_user is not null;

create index if not exists approvals_resolved_by_idx
  on ezstay.approvals (resolved_by)
  where resolved_by is not null;

create index if not exists purchase_requests_hotel_approval_idx
  on ezstay.purchase_requests (hotel_id, approval_id)
  where approval_id is not null;

create index if not exists purchase_requests_hotel_inventory_idx
  on ezstay.purchase_requests (hotel_id, inventory_item_id)
  where inventory_item_id is not null;

create index if not exists automation_runs_hotel_rule_idx
  on ezstay.automation_runs (hotel_id, rule_id)
  where rule_id is not null;

create index if not exists automation_runs_hotel_inbound_event_idx
  on ezstay.automation_runs (hotel_id, inbound_event_id)
  where inbound_event_id is not null;

create index if not exists deliveries_hotel_run_idx
  on ezstay.deliveries (hotel_id, run_id)
  where run_id is not null;

create index if not exists deliveries_hotel_endpoint_idx
  on ezstay.deliveries (hotel_id, endpoint_id)
  where endpoint_id is not null;

create index if not exists audit_events_actor_user_idx
  on ezstay.audit_events (actor_user_id)
  where actor_user_id is not null;

create index if not exists command_idempotency_hotel_run_idx
  on ezstay.command_idempotency (hotel_id, run_id)
  where run_id is not null;

