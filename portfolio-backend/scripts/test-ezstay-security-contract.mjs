import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260925030000_ezstay_security.sql", "utf8").toLowerCase();

test("security helpers live in private schema with an empty search path", () => {
  assert.match(sql, /create\s+or\s+replace\s+function\s+private\.ezstay_is_member/);
  assert.match(sql, /security\s+definer/);
  assert.match(sql, /set\s+search_path\s*=\s*''/);
});

test("internal EZStay tables enable row level security", () => {
  for (const table of ["hotels","hotel_members","rooms","reservations","guest_requests","tasks","inventory_items","approvals","purchase_requests","automation_rules","automation_runs","deliveries","audit_events"]) {
    assert.match(sql, new RegExp(`alter\\s+table\\s+ezstay\\.${table}\\s+enable\\s+row\\s+level\\s+security`));
  }
});

test("browser API views use security invoker semantics", () => {
  assert.match(sql, /create\s+(?:or\s+replace\s+)?view\s+ezstay_api\.rooms[\s\S]*security_invoker\s*=\s*true/);
  assert.match(sql, /create\s+(?:or\s+replace\s+)?view\s+ezstay_api\.tasks[\s\S]*security_invoker\s*=\s*true/);
});

test("anonymous and authenticated roles receive no direct internal schema grants", () => {
  assert.match(sql, /revoke\s+all\s+on\s+schema\s+ezstay\s+from\s+anon/);
  assert.match(sql, /revoke\s+all\s+on\s+schema\s+ezstay\s+from\s+authenticated/);
});

test("private helper execution is revoked from public client roles", () => {
  assert.match(sql, /revoke\s+execute\s+on\s+function\s+private\.ezstay_is_member\(uuid\)\s+from\s+public/);
  assert.match(sql, /revoke\s+execute\s+on\s+function\s+private\.ezstay_is_member\(uuid\)\s+from\s+anon/);
});
