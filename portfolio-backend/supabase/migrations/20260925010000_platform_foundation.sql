create extension if not exists pgcrypto;

create schema if not exists platform;
create schema if not exists private;
create schema if not exists ezstay;
create schema if not exists ezstay_api;

revoke all on schema platform from public;
revoke all on schema private from public;
revoke all on schema ezstay from public;

create table if not exists platform.applications (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_-]{1,62}$'),
  name text not null,
  contract_version text not null,
  status text not null default 'active' check (status in ('active','paused','retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform.app_memberships (
  app_id uuid not null references platform.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member','admin','demo')),
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (app_id, user_id)
);

create table if not exists platform.seed_versions (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references platform.applications(id) on delete cascade,
  seed_version text not null,
  checksum text,
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now(),
  unique (app_id, seed_version)
);

create table if not exists platform.backend_releases (
  id uuid primary key default gen_random_uuid(),
  app_id uuid references platform.applications(id) on delete cascade,
  contract_version text not null,
  migration_version text not null,
  status text not null default 'active' check (status in ('active','superseded','rolled_back')),
  created_at timestamptz not null default now(),
  unique (app_id, contract_version, migration_version)
);

create table if not exists platform.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references platform.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null,
  seed_version text not null,
  reset_generation integer not null default 0 check (reset_generation >= 0),
  status text not null default 'active' check (status in ('active','expired','reset','revoked')),
  demo_now timestamptz not null,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (expires_at > started_at)
);

create index if not exists app_memberships_user_id_idx
  on platform.app_memberships (user_id);

create index if not exists demo_sessions_user_id_idx
  on platform.demo_sessions (user_id, status);

create index if not exists demo_sessions_tenant_id_idx
  on platform.demo_sessions (tenant_id);

create index if not exists demo_sessions_app_status_idx
  on platform.demo_sessions (app_id, status, expires_at);

create unique index if not exists demo_sessions_one_active_per_app_user_idx
  on platform.demo_sessions (app_id, user_id)
  where status = 'active';
