import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260925020000_ezstay_domain.sql", "utf8").toLowerCase();

const requiredIndexes = [
  ["hotels_demo_session_idx", "ezstay.hotels", "demo_session_id"],
  ["reservations_hotel_room_idx", "ezstay.reservations", "hotel_id, room_id"],
  ["guest_requests_hotel_reservation_idx", "ezstay.guest_requests", "hotel_id, reservation_id"],
  ["guest_requests_hotel_room_idx", "ezstay.guest_requests", "hotel_id, room_id"],
  ["tasks_hotel_reservation_idx", "ezstay.tasks", "hotel_id, reservation_id"],
  ["tasks_hotel_room_idx", "ezstay.tasks", "hotel_id, room_id"],
  ["approvals_hotel_inventory_idx", "ezstay.approvals", "hotel_id, inventory_item_id"],
  ["approvals_requested_by_user_idx", "ezstay.approvals", "requested_by_user"],
  ["approvals_resolved_by_idx", "ezstay.approvals", "resolved_by"],
  ["purchase_requests_hotel_approval_idx", "ezstay.purchase_requests", "hotel_id, approval_id"],
  ["purchase_requests_hotel_inventory_idx", "ezstay.purchase_requests", "hotel_id, inventory_item_id"],
  ["automation_runs_hotel_rule_idx", "ezstay.automation_runs", "hotel_id, rule_id"],
  ["automation_runs_hotel_inbound_event_idx", "ezstay.automation_runs", "hotel_id, inbound_event_id"],
  ["deliveries_hotel_run_idx", "ezstay.deliveries", "hotel_id, run_id"],
  ["deliveries_hotel_endpoint_idx", "ezstay.deliveries", "hotel_id, endpoint_id"],
  ["audit_events_actor_user_idx", "ezstay.audit_events", "actor_user_id"],
  ["command_idempotency_hotel_run_idx", "ezstay.command_idempotency", "hotel_id, run_id"],
];

test("every non-covered EZStay foreign key has a child-side lookup index", () => {
  for (const [name, table, columns] of requiredIndexes) {
    const escapedTable = table.replace(".", "\\.");
    const columnPattern = columns.split(",").map(value => value.trim()).join("\\s*,\\s*");
    assert.match(
      sql,
      new RegExp(`create\\s+index\\s+if\\s+not\\s+exists\\s+${name}\\s+on\\s+${escapedTable}\\s*\\(\\s*${columnPattern}\\s*\\)`),
      `missing index ${name} on ${table} (${columns})`,
    );
  }
});
