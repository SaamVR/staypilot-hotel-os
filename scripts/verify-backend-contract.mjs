import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  constantTimeEqual,
  hmacSha256Hex,
  sha256Hex,
  verifyWebhookSignature,
} from "../functions/_shared/webhook.js";

const secret = "staypilot-test-secret";
const nowMs = Date.UTC(2026, 8, 23, 17, 45, 0);
const timestamp = String(Math.floor(nowMs / 1000));
const body = JSON.stringify({ reservation_id: "SP-TEST-01", action: "created" });
const signature = await hmacSha256Hex(secret, `${timestamp}.${body}`);

const valid = await verifyWebhookSignature({
  secret,
  timestamp,
  signature: `v1=${signature}`,
  body,
  nowMs,
});
assert.equal(valid.ok, true, "valid HMAC signature should pass");

const tampered = await verifyWebhookSignature({
  secret,
  timestamp,
  signature: `v1=${signature}`,
  body: body.replace("created", "cancelled"),
  nowMs,
});
assert.equal(tampered.ok, false, "tampered payload must fail signature verification");
assert.equal(tampered.reason, "signature_mismatch");

const stale = await verifyWebhookSignature({
  secret,
  timestamp,
  signature: `v1=${signature}`,
  body,
  nowMs: nowMs + 301_000,
});
assert.equal(stale.ok, false, "stale webhook must be rejected");
assert.equal(stale.reason, "timestamp_outside_tolerance");

assert.equal(constantTimeEqual("abcdef", "abcdef"), true);
assert.equal(constantTimeEqual("abcdef", "abcdeg"), false);
assert.equal((await sha256Hex(body)).length, 64, "payload hash should be SHA-256 hex");

const migration = await readFile(
  new URL("../supabase/migrations/20260923_001_staypilot_core.sql", import.meta.url),
  "utf8",
);
const exposedTables = [
  "hotels",
  "hotel_members",
  "rooms",
  "reservations",
  "tasks",
  "approvals",
  "automation_rules",
  "inbound_events",
  "automation_runs",
  "webhook_endpoints",
  "webhook_deliveries",
  "audit_events",
];

for (const table of exposedTables) {
  assert.match(
    migration,
    new RegExp(`alter table public\\.${table} enable row level security;`, "i"),
    `${table} must have RLS enabled`,
  );
}
assert.match(migration, /unique\s*\(hotel_id,\s*event_id\)/i, "inbound Event ID must be unique per hotel");
assert.match(migration, /private\.has_hotel_role/i, "role-aware RLS helper must exist");
assert.match(migration, /grant usage on schema private to authenticated/i, "authenticated users need helper schema usage");

const endpoint = await readFile(new URL("../functions/api/events.js", import.meta.url), "utf8");
const sharedConfig = await readFile(new URL("../functions/_shared/webhook.js", import.meta.url), "utf8");
assert.match(endpoint, /resolution=ignore-duplicates/i, "event endpoint must use duplicate-safe insert");
assert.match(sharedConfig, /WEBHOOK_SIGNING_SECRET/, "shared server config must read webhook signing secret");
assert.match(endpoint, /config\.webhookSigningSecret/, "event endpoint must verify with configured signing secret");
assert.match(endpoint, /backend_not_configured/, "event endpoint must fail closed before secrets are configured");

console.log("StayPilot backend contract verification passed.");
