import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260925050000_ezstay_automation_runtime.sql", "utf8").toLowerCase();

test("worker claim uses skip locked and bounded queue state", () => {
  assert.match(sql, /function\s+private\.ezstay_claim_inbound_events/);
  assert.match(sql, /for\s+update\s+skip\s+locked/);
  assert.match(sql, /status\s*=\s*'processing'/);
});

test("automation runtime exposes the four showcase business operations", () => {
  for (const fn of [
    "ezstay_apply_guest_request",
    "ezstay_apply_checkout",
    "ezstay_complete_housekeeping",
    "ezstay_apply_low_stock",
    "ezstay_resolve_approval",
    "ezstay_retry_delivery",
    "ezstay_evaluate_overdue_tasks",
  ]) {
    assert.match(sql, new RegExp(`function\\s+private\\.${fn}`));
  }
});

test("room-ready completion marks housekeeping clean without clearing maintenance", () => {
  const fn = sql.match(/create\s+or\s+replace\s+function\s+private\.ezstay_complete_housekeeping[\s\S]*?\$\$;/)?.[0] || "";
  assert.match(fn, /set\s+status\s*=\s*'Done'/i);
  assert.match(fn, /housekeeping\s*=\s*'Clean'/i);
  assert.doesNotMatch(fn, /set\s+maintenance\s*=/i);
  assert.match(fn, /room-ready-release/);
});

test("business effects use source-event or command idempotency guards", () => {
  assert.match(sql, /command_idempotency/);
  assert.match(sql, /source_event_id/);
  assert.match(sql, /on\s+conflict/);
});

test("delivery retry updates delivery state without invoking business mutation functions", () => {
  const retry = sql.match(/create\s+or\s+replace\s+function\s+private\.ezstay_retry_delivery[\s\S]*?\$\$;/)?.[0] || "";
  assert.match(retry, /update\s+ezstay\.deliveries/);
  assert.doesNotMatch(retry, /ezstay_apply_guest_request|ezstay_apply_checkout|ezstay_apply_low_stock/);
});

test("overdue evaluation is once-only", () => {
  assert.match(sql, /escalated_at\s+is\s+null/);
  assert.match(sql, /set\s+escalated_at/);
});
