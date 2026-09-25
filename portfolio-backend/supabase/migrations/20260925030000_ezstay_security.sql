revoke all on schema ezstay from public;
revoke all on schema ezstay from anon;
revoke all on schema ezstay from authenticated;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create or replace function private.ezstay_is_member(target_hotel_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from ezstay.hotel_members hm
      where hm.hotel_id = target_hotel_id
        and hm.user_id = (select auth.uid())
        and hm.status = 'active'
    );
$$;

create or replace function private.ezstay_has_role(target_hotel_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from ezstay.hotel_members hm
      where hm.hotel_id = target_hotel_id
        and hm.user_id = (select auth.uid())
        and hm.status = 'active'
        and hm.role = any(allowed_roles)
    );
$$;

revoke execute on function private.ezstay_is_member(uuid) from public;
revoke execute on function private.ezstay_is_member(uuid) from anon;
revoke execute on function private.ezstay_is_member(uuid) from authenticated;
revoke execute on function private.ezstay_has_role(uuid, text[]) from public;
revoke execute on function private.ezstay_has_role(uuid, text[]) from anon;
revoke execute on function private.ezstay_has_role(uuid, text[]) from authenticated;

alter table ezstay.hotels enable row level security;
alter table ezstay.hotel_members enable row level security;
alter table ezstay.rooms enable row level security;
alter table ezstay.reservations enable row level security;
alter table ezstay.guest_requests enable row level security;
alter table ezstay.tasks enable row level security;
alter table ezstay.inventory_items enable row level security;
alter table ezstay.purchase_requests enable row level security;
alter table ezstay.approvals enable row level security;
alter table ezstay.automation_rules enable row level security;
alter table ezstay.inbound_events enable row level security;
alter table ezstay.automation_runs enable row level security;
alter table ezstay.automation_run_steps enable row level security;
alter table ezstay.automation_run_links enable row level security;
alter table ezstay.delivery_endpoints enable row level security;
alter table ezstay.deliveries enable row level security;
alter table ezstay.audit_events enable row level security;
alter table ezstay.command_idempotency enable row level security;

create policy hotels_member_select on ezstay.hotels
for select to authenticated
using ((select private.ezstay_is_member(id)));

create policy hotel_members_member_select on ezstay.hotel_members
for select to authenticated
using ((select private.ezstay_is_member(hotel_id)));

create policy rooms_member_select on ezstay.rooms
for select to authenticated
using ((select private.ezstay_is_member(hotel_id)));

create policy reservations_member_select on ezstay.reservations
for select to authenticated
using ((select private.ezstay_is_member(hotel_id)));

create policy guest_requests_member_select on ezstay.guest_requests
for select to authenticated
using ((select private.ezstay_is_member(hotel_id)));

create policy tasks_member_select on ezstay.tasks
for select to authenticated
using ((select private.ezstay_is_member(hotel_id)));

create policy inventory_items_member_select on ezstay.inventory_items
for select to authenticated
using ((select private.ezstay_is_member(hotel_id)));

create policy purchase_requests_member_select on ezstay.purchase_requests
for select to authenticated
using ((select private.ezstay_is_member(hotel_id)));

create policy approvals_member_select on ezstay.approvals
for select to authenticated
using ((select private.ezstay_is_member(hotel_id)));

create policy automation_rules_member_select on ezstay.automation_rules
for select to authenticated
using ((select private.ezstay_is_member(hotel_id)));

create policy inbound_events_member_select on ezstay.inbound_events
for select to authenticated
using ((select private.ezstay_is_member(hotel_id)));

create policy automation_runs_member_select on ezstay.automation_runs
for select to authenticated
using ((select private.ezstay_is_member(hotel_id)));

create policy automation_run_steps_member_select on ezstay.automation_run_steps
for select to authenticated
using ((select private.ezstay_is_member(hotel_id)));

create policy automation_run_links_member_select on ezstay.automation_run_links
for select to authenticated
using ((select private.ezstay_is_member(hotel_id)));

create policy delivery_endpoints_member_select on ezstay.delivery_endpoints
for select to authenticated
using ((select private.ezstay_is_member(hotel_id)));

create policy deliveries_member_select on ezstay.deliveries
for select to authenticated
using ((select private.ezstay_is_member(hotel_id)));

create policy audit_events_member_select on ezstay.audit_events
for select to authenticated
using ((select private.ezstay_is_member(hotel_id)));

grant select on
  ezstay.hotels,
  ezstay.hotel_members,
  ezstay.rooms,
  ezstay.reservations,
  ezstay.guest_requests,
  ezstay.tasks,
  ezstay.inventory_items,
  ezstay.purchase_requests,
  ezstay.approvals,
  ezstay.automation_rules,
  ezstay.automation_runs,
  ezstay.automation_run_steps,
  ezstay.automation_run_links,
  ezstay.deliveries,
  ezstay.audit_events
to authenticated;

grant usage on schema ezstay_api to authenticated;

create or replace view ezstay_api.hotels
with (security_invoker = true)
as
select id, slug, name, timezone, currency, automation_paused, settings, created_at, updated_at
from ezstay.hotels;

create or replace view ezstay_api.rooms
with (security_invoker = true)
as
select id, hotel_id, number, room_type, occupancy, housekeeping, maintenance, metadata, created_at, updated_at
from ezstay.rooms;

create or replace view ezstay_api.reservations
with (security_invoker = true)
as
select id, hotel_id, external_ref, guest_name, source, room_id, room_type, check_in, check_out, guests, total, paid, status, metadata, created_at, updated_at
from ezstay.reservations;

create or replace view ezstay_api.guest_requests
with (security_invoker = true)
as
select id, hotel_id, reservation_id, room_id, request, category, urgency, status, created_at, updated_at
from ezstay.guest_requests;

create or replace view ezstay_api.tasks
with (security_invoker = true)
as
select id, hotel_id, reservation_id, room_id, title, team, status, due_at, escalated_at, automated, created_at, updated_at
from ezstay.tasks;

create or replace view ezstay_api.inventory_items
with (security_invoker = true)
as
select id, hotel_id, item, category, stock, par, unit, unit_cost, supplier, created_at, updated_at
from ezstay.inventory_items;

create or replace view ezstay_api.approvals
with (security_invoker = true)
as
select id, hotel_id, inventory_item_id, type, title, detail, amount, quantity, status, requested_by_actor, created_at, resolved_at
from ezstay.approvals;

create or replace view ezstay_api.purchase_requests
with (security_invoker = true)
as
select id, hotel_id, approval_id, inventory_item_id, quantity, amount, supplier, status, created_at, updated_at
from ezstay.purchase_requests;

create or replace view ezstay_api.automation_rules
with (security_invoker = true)
as
select id, hotel_id, rule_key, name, event_type, status, autonomy, config, created_at, updated_at
from ezstay.automation_rules;

create or replace view ezstay_api.automation_runs
with (security_invoker = true)
as
select id, hotel_id, event_id, event_type, rule_key, result, summary, input, decision, created_at
from ezstay.automation_runs;

create or replace view ezstay_api.automation_run_steps
with (security_invoker = true)
as
select id, hotel_id, run_id, step_index, stage, message, payload, recorded_at, effective_at
from ezstay.automation_run_steps;

create or replace view ezstay_api.automation_run_links
with (security_invoker = true)
as
select id, hotel_id, run_id, entity_type, entity_id, label, created_at
from ezstay.automation_run_links;

create or replace view ezstay_api.deliveries
with (security_invoker = true)
as
select id, hotel_id, run_id, status, attempts, next_retry_at, last_error, created_at, delivered_at
from ezstay.deliveries;

create or replace view ezstay_api.audit_events
with (security_invoker = true)
as
select id, hotel_id, actor_kind, category, action, detail, source_event_id, request_id, effective_at, created_at
from ezstay.audit_events;

grant select on
  ezstay_api.hotels,
  ezstay_api.rooms,
  ezstay_api.reservations,
  ezstay_api.guest_requests,
  ezstay_api.tasks,
  ezstay_api.inventory_items,
  ezstay_api.approvals,
  ezstay_api.purchase_requests,
  ezstay_api.automation_rules,
  ezstay_api.automation_runs,
  ezstay_api.automation_run_steps,
  ezstay_api.automation_run_links,
  ezstay_api.deliveries,
  ezstay_api.audit_events
to authenticated;
