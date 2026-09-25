import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const platform = readFileSync("supabase/migrations/20260925010000_platform_foundation.sql", "utf8").toLowerCase();
const lifecycle = readFileSync("supabase/migrations/20260925040000_ezstay_demo_lifecycle.sql", "utf8").toLowerCase();
const automation = readFileSync("supabase/migrations/20260925050000_ezstay_automation_runtime.sql", "utf8").toLowerCase();
const runtimeRole = readFileSync("supabase/migrations/20260925060000_ezstay_runtime_role.sql", "utf8").toLowerCase();

test("platform has app/user scoped demo command idempotency", () => {
  assert.match(platform, /create\s+table\s+if\s+not\s+exists\s+platform\.demo_command_idempotency/);
  assert.match(platform, /unique\s*\(app_id,\s*user_id,\s*idempotency_key\)/);
  assert.match(platform, /response\s+jsonb/);
});

test("start command is retry-safe and delegates to the transactional session creator", () => {
  assert.match(lifecycle, /function\s+private\.ezstay_start_demo_command/);
  const start = lifecycle.indexOf("create or replace function private.ezstay_start_demo_command");
  const next = lifecycle.indexOf("create or replace function private.", start + 20);
  const fn = lifecycle.slice(start, next >= 0 ? next : lifecycle.length);
  assert.match(fn, /demo_command_idempotency/);
  assert.match(fn, /create_ezstay_demo_session/);
  assert.match(fn, /command_type[^\n]*demo\.start|demo\.start/);
  assert.match(fn, /session_id/);
});

test("reset command replays a stored generation instead of resetting again", () => {
  assert.match(lifecycle, /function\s+private\.ezstay_reset_demo_command/);
  const start = lifecycle.indexOf("create or replace function private.ezstay_reset_demo_command");
  const next = lifecycle.indexOf("create or replace function private.", start + 20);
  const fn = lifecycle.slice(start, next >= 0 ? next : lifecycle.length);
  assert.match(fn, /demo_command_idempotency/);
  assert.match(fn, /reset_ezstay_demo_session/);
  assert.match(fn, /response/);
  assert.match(fn, /session_id/);
});

test("clock command is bounded, retry-safe, and evaluates overdue work at new demo time", () => {
  assert.match(automation, /function\s+private\.ezstay_advance_demo_clock_command/);
  const start = automation.indexOf("create or replace function private.ezstay_advance_demo_clock_command");
  const next = automation.indexOf("revoke execute", start);
  const fn = automation.slice(start, next >= 0 ? next : automation.length);
  assert.match(fn, /demo_command_idempotency/);
  assert.match(fn, /greatest\s*\(1/);
  assert.match(fn, /least\s*\(/);
  assert.match(fn, /demo_now/);
  assert.match(fn, /ezstay_evaluate_overdue_tasks/);
  assert.match(fn, /response/);
});

test("restricted runtime role can execute command wrappers but has no platform table grant", () => {
  assert.match(runtimeRole, /grant\s+execute\s+on\s+function\s+private\.ezstay_start_demo_command/);
  assert.match(runtimeRole, /grant\s+execute\s+on\s+function\s+private\.ezstay_reset_demo_command/);
  assert.match(runtimeRole, /grant\s+execute\s+on\s+function\s+private\.ezstay_advance_demo_clock_command/);
  assert.doesNotMatch(runtimeRole, /grant\s+execute\s+on\s+function\s+private\.create_ezstay_demo_session/);
  assert.doesNotMatch(runtimeRole, /grant\s+execute\s+on\s+function\s+private\.reset_ezstay_demo_session/);
  assert.doesNotMatch(runtimeRole, /grant\s+(?:select|insert|update|delete|all)[^;]*platform\.demo_command_idempotency/);
});

test("clock command creates an inspectable demo-clock run", () => {
  const start = automation.indexOf("create or replace function private.ezstay_advance_demo_clock_command");
  const next = automation.indexOf("create or replace function private.ezstay_run_scheduled_work", start);
  const fn = automation.slice(start, next);
  assert.match(fn, /demo-clock/);
  assert.match(fn, /insert\s+into\s+ezstay\.automation_runs/);
  assert.match(fn, /ezstay_materialize_run_evidence/);
  assert.match(fn, /run_id/);
});

test("scheduled work is bounded and concurrency-safe", () => {
  const start = automation.indexOf("create or replace function private.ezstay_run_scheduled_work");
  const next = automation.indexOf("revoke execute", start);
  const fn = automation.slice(start, next >= 0 ? next : automation.length);
  assert.match(fn, /greatest\s*\(1/);
  assert.match(fn, /least\s*\(/);
  assert.match(fn, /for\s+update\s+skip\s+locked/);
  assert.match(fn, /ezstay_evaluate_overdue_tasks/);
  assert.match(runtimeRole, /grant\s+execute\s+on\s+function\s+private\.ezstay_run_scheduled_work/);
});
