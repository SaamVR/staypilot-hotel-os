import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260925060000_ezstay_runtime_role.sql", "utf8").toLowerCase();

test("EZStay runtime role is non-login and non-inheriting", () => {
  assert.match(sql, /create\s+role\s+ezstay_runtime\s+noinherit\s+nologin|create\s+role\s+ezstay_runtime\s+nologin\s+noinherit/);
});

test("runtime role receives no broad all-table grant", () => {
  assert.doesNotMatch(sql, /grant\s+all\s+(?:privileges\s+)?on\s+all\s+tables/);
  assert.doesNotMatch(sql, /grant\s+all\s+on\s+schema/);
});

test("runtime role can execute only the approved EZStay private operations", () => {
  for (const fn of [
    "ezstay_active_demo_session",
    "create_ezstay_demo_session",
    "reset_ezstay_demo_session",
    "ezstay_claim_inbound_events",
    "ezstay_finish_inbound_event",
    "ezstay_apply_guest_request",
    "ezstay_apply_checkout",
    "ezstay_apply_low_stock",
    "ezstay_resolve_approval",
    "ezstay_retry_delivery",
    "ezstay_evaluate_overdue_tasks",
  ]) {
    assert.match(sql, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+private\\.${fn}`));
  }
});

test("runtime role explicitly revokes access to LeadFlow if that schema exists", () => {
  assert.match(sql, /to_regnamespace\('leadflow'\)/);
  assert.match(sql, /revoke\s+all\s+on\s+schema\s+leadflow\s+from\s+ezstay_runtime/);
});
