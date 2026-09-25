import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/migrations/20260925010000_platform_foundation.sql", "utf8").toLowerCase();

test("platform foundation creates shared internal tables", () => {
  for (const name of ["applications","app_memberships","demo_sessions","seed_versions","backend_releases"]) {
    assert.match(sql, new RegExp(`create\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+platform\\.${name}\\b`));
  }
});

test("platform foundation records app, tenant, user, seed and lifecycle authority", () => {
  for (const token of ["app_id","user_id","tenant_id","seed_version","reset_generation","demo_now","expires_at","status"]) {
    assert.match(sql, new RegExp(`\\b${token}\\b`));
  }
});

test("platform internal schemas revoke broad public access", () => {
  assert.match(sql, /revoke\s+all\s+on\s+schema\s+platform\s+from\s+public/);
  assert.match(sql, /revoke\s+all\s+on\s+schema\s+private\s+from\s+public/);
});

test("platform lookup columns are indexed", () => {
  assert.match(sql, /create\s+index[^;]+demo_sessions[^;]+user_id/);
  assert.match(sql, /create\s+index[^;]+demo_sessions[^;]+tenant_id/);
});
