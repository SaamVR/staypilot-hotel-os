import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const seed = readFileSync("supabase/seed/ezstay-northstar-v2.sql", "utf8").toLowerCase();
const lifecycle = readFileSync("supabase/migrations/20260925040000_ezstay_demo_lifecycle.sql", "utf8").toLowerCase();

test("Northstar seed declares the frozen seed and backend contract versions", () => {
  assert.match(seed, /northstar-v2/);
  assert.match(seed, /ezstay-backend-v1/);
});

test("Northstar seed includes internally linked hotel operating records", () => {
  for (const token of ["room_108","res_1047","inv_queen_sheets","guest-request-router","dlv-400"]) {
    assert.match(seed, new RegExp(token));
  }
});

test("demo lifecycle provides create and reset transactions", () => {
  assert.match(lifecycle, /function\s+private\.create_ezstay_demo_session/);
  assert.match(lifecycle, /function\s+private\.reset_ezstay_demo_session/);
  assert.match(lifecycle, /reset_generation/);
  assert.match(lifecycle, /northstar-v2/);
});

test("expired sessions are explicitly denied by lifecycle helpers", () => {
  assert.match(lifecycle, /status\s*=\s*'active'/);
  assert.match(lifecycle, /expires_at\s*>\s*now\(\)/);
});
