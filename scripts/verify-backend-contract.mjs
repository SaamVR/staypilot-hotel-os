import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  constantTimeEqual,
  hmacSha256Hex,
  sha256Hex,
  verifyWebhookSignature,
} from "../functions/_shared/webhook.js";
import { normalizeGuestRequest, planDomainEvent, WorkerExecutionError } from "../functions/_shared/worker.js";

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

const workerMigration = await readFile(
  new URL("../supabase/migrations/20260923_002_durable_worker.sql", import.meta.url),
  "utf8",
);
assert.match(workerMigration, /for update of e skip locked/i, "worker claim must use SKIP LOCKED");
assert.match(workerMigration, /interval '10 minutes'/i, "worker must reclaim stale processing leases");
assert.match(workerMigration, /attempt_count\s*<\s*5/i, "worker claim must cap retry attempts");
assert.match(workerMigration, /dead_letter/i, "worker lifecycle must support dead-letter state");
assert.match(workerMigration, /grant execute on function public\.claim_inbound_events\(text, integer\) to service_role/i, "claim RPC must be service-role only");
assert.match(workerMigration, /grant execute on function public\.finish_inbound_event\(uuid, text, text, integer\) to service_role/i, "finish RPC must be service-role only");
assert.match(workerMigration, /tasks_hotel_source_event_uidx/i, "task side effects need Event-ID idempotency");
assert.match(workerMigration, /approvals_hotel_source_event_uidx/i, "approval side effects need Event-ID idempotency");

assert.equal(normalizeGuestRequest("Can I get two towels please?"), "Extra towels requested");
assert.equal(normalizeGuestRequest("Need another pillow"), "Extra pillows requested");
const guestPlan = planDomainEvent({
  event_type:"guest.request_received",
  payload:{ request:"Please send towels", room_number:"108" },
});
assert.equal(guestPlan.kind, "create_task");
assert.equal(guestPlan.team, "Housekeeping");
assert.equal(guestPlan.roomNumber, "108");
const checkoutPlan = planDomainEvent({
  event_type:"guest.checked_out",
  payload:{ room_number:"204" },
});
assert.equal(checkoutPlan.kind, "checkout_turnover");
const unsupportedPlan = planDomainEvent({ event_type:"payment.failed", payload:{} });
assert.equal(unsupportedPlan.kind, "unsupported");
assert.throws(
  () => planDomainEvent({ event_type:"housekeeping.completed", payload:{} }),
  error => error instanceof WorkerExecutionError && error.code === "invalid_payload",
  "room-scoped worker events must require a room number",
);

const workerEndpoint = await readFile(new URL("../functions/api/worker-run.js", import.meta.url), "utf8");
const workerModule = await readFile(new URL("../functions/_shared/worker.js", import.meta.url), "utf8");
assert.match(sharedConfig, /WORKER_SECRET/, "shared config must read worker secret");
assert.match(workerEndpoint, /x-staypilot-worker-secret/i, "worker endpoint must require server worker header");
assert.match(workerEndpoint, /constantTimeEqual/, "worker endpoint must compare secret in constant time");
assert.match(workerEndpoint, /worker_not_configured/, "worker endpoint must fail closed before backend configuration");
assert.match(workerEndpoint, /claimInboundEvents/, "worker endpoint must atomically claim events");
assert.match(workerEndpoint, /processClaimedEvent/, "worker endpoint must process claimed events");
assert.match(workerModule, /resolution=ignore-duplicates/i, "worker side effects must use duplicate-safe inserts");
assert.match(workerModule, /resolution=merge-duplicates/i, "failed automation runs must be able to merge into a later terminal retry result");
assert.match(workerModule, /findExistingRun/, "worker must check for an existing Event-ID run before mutation");
assert.match(workerModule, /existing && existing\.result !== "Failed"/, "a prior Failed run must not suppress a retry");

const outboxMigration = await readFile(
  new URL("../supabase/migrations/20260924_003_webhook_outbox.sql", import.meta.url),
  "utf8",
);
assert.match(outboxMigration, /webhook_deliveries_endpoint_event_uidx/i, "outbound deliveries need endpoint + Event-ID uniqueness");
assert.match(outboxMigration, /on conflict \(hotel_id, endpoint_id, event_id\) do nothing/i, "outbox enqueue must be duplicate safe");
assert.match(outboxMigration, /source_event\.event_type = any\(endpoint\.events\)/i, "outbox must honor endpoint event subscriptions");
assert.match(outboxMigration, /endpoint\.status = 'Active'/i, "outbox must ignore inactive endpoints");
assert.match(outboxMigration, /grant execute on function public\.enqueue_webhook_deliveries\(uuid\) to service_role/i, "outbox enqueue RPC must be service-role only");
assert.match(workerModule, /enqueueOutboundDeliveries/, "worker must durably enqueue outbound deliveries");
assert.match(workerModule, /completeWithOutbox/, "worker completion must include outbox persistence");
assert.match(workerModule, /terminalRunRecorded/, "outbox retry must preserve terminal business results");

const dispatcherMigration = await readFile(
  new URL("../supabase/migrations/20260924_004_webhook_dispatcher.sql", import.meta.url),
  "utf8",
);
const dispatcherModule = await readFile(new URL("../functions/_shared/dispatcher.js", import.meta.url), "utf8");
const dispatcherEndpoint = await readFile(new URL("../functions/api/webhook-dispatch-run.js", import.meta.url), "utf8");
assert.match(dispatcherMigration, /verified_at timestamptz/i, "webhook endpoints need server verification state");
assert.match(dispatcherMigration, /revoke insert, update on public\.webhook_endpoints from authenticated/i, "clients must not be able to forge verification columns");
assert.match(dispatcherMigration, /grant\s+insert\s*\(hotel_id,\s*name,\s*url,\s*events,\s*status\)/i, "endpoint client insert must be column-scoped");
assert.doesNotMatch(dispatcherMigration, /grant\s+(?:insert|update)[^;]*secret_ref/i, "authenticated clients must not control webhook secret references");
assert.match(dispatcherMigration, /endpoint\.secret_ref is not null/i, "dispatcher must only claim endpoints with server-provisioned secret references");
assert.match(dispatcherMigration, /endpoint\.verified_at is not null/i, "unverified endpoints must not enter the outbox/dispatcher");
assert.match(dispatcherMigration, /endpoint\.verified_host is not null/i, "dispatcher must require a verified destination host");
assert.match(dispatcherMigration, /join public\.inbound_events inbound on inbound\.id = claimed\.inbound_event_id/i, "dispatcher must require a durable source inbound event");
assert.match(dispatcherMigration, /for update of delivery skip locked/i, "dispatcher claims must use SKIP LOCKED");
assert.match(dispatcherMigration, /interval '10 minutes'/i, "dispatcher must recover stale leases");
assert.match(dispatcherMigration, /grant execute on function public\.claim_webhook_deliveries\(text, integer\) to service_role/i, "delivery claim RPC must be service-role only");
assert.match(dispatcherMigration, /grant execute on function public\.finish_webhook_delivery\(uuid, text, integer, integer, text, integer\) to service_role/i, "delivery finish RPC must be service-role only");
assert.match(sharedConfig, /DISPATCHER_SECRET/, "shared config must read dispatcher secret");
assert.match(sharedConfig, /WEBHOOK_ALLOWED_HOSTS/, "shared config must read outbound host allowlist");
assert.match(dispatcherEndpoint, /x-staypilot-dispatcher-secret/i, "dispatcher endpoint must require server dispatcher authentication");
assert.match(dispatcherEndpoint, /dispatcher_not_configured/i, "dispatcher endpoint must fail closed before configuration");
assert.match(dispatcherModule, /redirect:"manual"/i, "outbound fetches must not follow redirects");
assert.match(dispatcherModule, /destination_not_allowlisted/i, "dispatcher must enforce exact host allowlisting");
assert.match(dispatcherModule, /verified_host_mismatch/i, "dispatcher must bind URL host to verified host");
assert.match(dispatcherModule, /private_or_local_destination_forbidden/i, "dispatcher must reject local/IP destinations");
assert.match(dispatcherModule, /x-staypilot-signature/i, "dispatcher must HMAC-sign outbound bodies");

console.log("StayPilot backend contract verification passed.");
