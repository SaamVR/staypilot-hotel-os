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

test("durable runtime has shared evidence writers", () => {
  for (const fn of [
    "ezstay_record_run_step",
    "ezstay_record_run_link",
    "ezstay_record_audit_event",
  ]) {
    assert.match(sql, new RegExp(`function\\s+private\\.${fn}`));
  }
  assert.match(sql, /insert\s+into\s+ezstay\.automation_run_steps/);
  assert.match(sql, /insert\s+into\s+ezstay\.automation_run_links/);
  assert.match(sql, /insert\s+into\s+ezstay\.audit_events/);
});

test("every flagship durable business function writes execution evidence", () => {
  for (const fnName of [
    "ezstay_apply_guest_request",
    "ezstay_apply_checkout",
    "ezstay_complete_housekeeping",
    "ezstay_apply_low_stock",
    "ezstay_resolve_approval",
  ]) {
    const start = sql.indexOf(`create or replace function private.${fnName}`);
    assert.ok(start >= 0, fnName);
    const next = sql.indexOf("create or replace function private.", start + 20);
    const body = sql.slice(start, next >= 0 ? next : sql.length);
    assert.match(body, /ezstay_record_run_step/, `${fnName} steps`);
    assert.match(body, /ezstay_record_run_link/, `${fnName} links`);
    assert.match(body, /ezstay_record_audit_event/, `${fnName} audit`);
  }
});

test("delivery recovery creates a durable recovery run without replaying source business functions", () => {
  const start = sql.indexOf("create or replace function private.ezstay_retry_delivery");
  const next = sql.indexOf("create or replace function private.", start + 20);
  const retry = sql.slice(start, next >= 0 ? next : sql.length);
  assert.match(retry, /delivery-recovery/);
  assert.match(retry, /insert\s+into\s+ezstay\.automation_runs/);
  assert.match(retry, /ezstay_record_run_step/);
  assert.match(retry, /ezstay_record_run_link/);
  assert.doesNotMatch(retry, /ezstay_apply_guest_request|ezstay_apply_checkout|ezstay_apply_low_stock/);
});

test("overdue escalation writes once-only automation runs and evidence", () => {
  const start = sql.indexOf("create or replace function private.ezstay_evaluate_overdue_tasks");
  const next = sql.indexOf("revoke execute", start);
  const overdue = sql.slice(start, next >= 0 ? next : sql.length);
  assert.match(overdue, /overdue-task-escalation/);
  assert.match(overdue, /insert\s+into\s+ezstay\.automation_runs/);
  assert.match(overdue, /ezstay_record_run_step/);
  assert.match(overdue, /ezstay_record_run_link/);
});
