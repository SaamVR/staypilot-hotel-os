import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const migrationPath = "supabase/migrations/20260925234500_ezstay_maintenance_approval_followup.sql";
const sql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8").toLowerCase() : "";

test("maintenance approval authorizes linked work without creating an inventory purchase", () => {
  assert.ok(sql, "maintenance approval follow-up migration must exist");
  assert.match(sql, /function\s+private\.ezstay_resolve_approval/);
  assert.match(sql, /approval_row\.type\s*=\s*'maintenance'/);
  assert.match(sql, /room_fixture_key/);
  assert.match(sql, /update\s+ezstay\.tasks[\s\S]*status\s*=\s*'in progress'/);
  assert.match(sql, /authorization/);
  assert.match(sql, /maintenance approved/);
  assert.match(sql, /ezstay_record_run_step/);
  assert.match(sql, /ezstay_record_run_link/);
});

test("inventory approval path still creates a purchase draft and never receives stock", () => {
  assert.match(sql, /approval_row\.inventory_item_id\s+is\s+not\s+null/);
  assert.match(sql, /insert\s+into\s+ezstay\.purchase_requests/);
  assert.doesNotMatch(sql, /update\s+ezstay\.inventory_items\s+set\s+stock/i);
});
