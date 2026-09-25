import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260925020000_ezstay_domain.sql", "utf8").toLowerCase();

const tables = [
  "hotels","hotel_members","rooms","reservations","guest_requests","tasks",
  "inventory_items","purchase_requests","approvals","automation_rules",
  "inbound_events","automation_runs","automation_run_steps","automation_run_links",
  "delivery_endpoints","deliveries","audit_events","command_idempotency"
];

test("EZStay internal domain declares every required table", () => {
  for (const table of tables) {
    assert.match(sql, new RegExp(`create\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+ezstay\\.${table}\\b`));
  }
});

test("tenant-owned relationships use composite hotel scoped foreign keys", () => {
  assert.match(sql, /unique\s*\(hotel_id\s*,\s*id\)/);
  assert.match(sql, /foreign\s+key\s*\(hotel_id\s*,\s*room_id\)[\s\S]*references\s+ezstay\.rooms\s*\(hotel_id\s*,\s*id\)/);
  assert.match(sql, /foreign\s+key\s*\(hotel_id\s*,\s*reservation_id\)[\s\S]*references\s+ezstay\.reservations\s*\(hotel_id\s*,\s*id\)/);
});

test("events and commands have database uniqueness guards", () => {
  assert.match(sql, /unique\s*\(hotel_id\s*,\s*event_id\)/);
  assert.match(sql, /unique\s*\(hotel_id\s*,\s*idempotency_key\)/);
});

test("worker and tenant lookup indexes exist", () => {
  assert.match(sql, /create\s+index[^;]+inbound_events[^;]+status/);
  assert.match(sql, /create\s+index[^;]+tasks[^;]+hotel_id/);
  assert.match(sql, /create\s+index[^;]+reservations[^;]+hotel_id/);
});
