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
  new URL("../supabase/migrations/20260923010000_staypilot_core.sql", import.meta.url),
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
  new URL("../supabase/migrations/20260923020000_durable_worker.sql", import.meta.url),
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
  new URL("../supabase/migrations/20260924030000_webhook_outbox.sql", import.meta.url),
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
  new URL("../supabase/migrations/20260924040000_webhook_dispatcher.sql", import.meta.url),
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

const redriveMigration = await readFile(
  new URL("../supabase/migrations/20260924050000_webhook_redrive.sql", import.meta.url),
  "utf8",
);
const redriveEndpoint = await readFile(new URL("../functions/api/webhook-redrive.js", import.meta.url), "utf8");
assert.match(redriveMigration, /redrive_count integer not null default 0/i, "delivery redrive count must be durable");
assert.match(redriveMigration, /delivery\.status in \('dead_letter','failed'\)/i, "redrive must only target exhausted delivery records");
assert.match(redriveMigration, /set status = 'queued'/i, "redrive must reset only the delivery lifecycle");
assert.match(redriveMigration, /redrive_count = delivery\.redrive_count \+ 1/i, "redrive must be counted");
assert.match(redriveMigration, /Webhook delivery redriven/i, "redrive must write an audit event");
assert.match(redriveMigration, /grant execute on function public\.redrive_webhook_delivery\(uuid, text\) to service_role/i, "redrive RPC must be service-role only");
assert.doesNotMatch(redriveMigration, /update public\.inbound_events/i, "redrive must never replay or mutate the source inbound event");
assert.match(redriveEndpoint, /x-staypilot-dispatcher-secret/i, "redrive endpoint must share the trusted dispatcher authentication boundary");
assert.match(redriveEndpoint, /dispatcher_not_configured/i, "redrive must fail closed before dispatcher configuration");
assert.match(redriveEndpoint, /invalid_delivery_id/i, "redrive endpoint must validate delivery UUIDs");

const provisioningMigration = await readFile(
  new URL("../supabase/migrations/20260924060000_webhook_endpoint_provisioning.sql", import.meta.url),
  "utf8",
);
const provisioningModule = await readFile(new URL("../functions/_shared/provisioning.js", import.meta.url), "utf8");
const provisioningAuth = await readFile(new URL("../functions/_shared/auth.js", import.meta.url), "utf8");
const registerEndpoint = await readFile(new URL("../functions/api/webhook-endpoints/register.js", import.meta.url), "utf8");
const verifyEndpoint = await readFile(new URL("../functions/api/webhook-endpoints/verify.js", import.meta.url), "utf8");

assert.match(provisioningMigration, /revoke insert, update on public\.webhook_endpoints from authenticated/i, "browser sessions must not create or update webhook endpoints directly");
assert.match(provisioningMigration, /verification_status text not null default 'Pending'/i, "endpoint verification state must be durable");
assert.match(provisioningMigration, /verification_status = 'Verified'/i, "verified RPC must persist verified state");
assert.match(provisioningMigration, /status = 'Active'/i, "successful verification must be the gate that activates the endpoint");
assert.match(provisioningMigration, /verification_status = 'Failed'/i, "failed verification must persist failed state");
assert.match(provisioningMigration, /grant execute on function public\.mark_webhook_endpoint_verified\(uuid, text\) to service_role/i, "only service role may mark endpoints verified");
assert.match(provisioningMigration, /grant execute on function public\.mark_webhook_endpoint_verification_failed\(uuid, text\) to service_role/i, "only service role may persist verification failure");
assert.match(provisioningMigration, /endpoint\.verification_status = 'Verified'/i, "outbox and dispatcher claims must require explicit Verified state");
assert.match(provisioningAuth, /owner_role_required/i, "endpoint provisioning must require Owner membership");
assert.match(provisioningModule, /DERIVED_V1_/i, "endpoint credentials must use non-secret derived references");
assert.match(provisioningModule, /staypilot:webhook:/i, "per-endpoint credentials must derive from the server master secret");
assert.match(registerEndpoint, /requireHotelOwner/i, "registration endpoint must enforce Owner authorization");
assert.match(registerEndpoint, /status:"Paused"/i, "new endpoints must start Paused");
assert.match(registerEndpoint, /verification_status:"Pending"/i, "new endpoints must start Pending");
assert.match(registerEndpoint, /signing_secret:signingSecret/i, "registration returns the derived credential to the Owner");
assert.match(verifyEndpoint, /redirect:"manual"/i, "verification must not follow redirects");
assert.match(verifyEndpoint, /verifyChallengeProof/i, "verification must require HMAC proof from the destination");
assert.match(verifyEndpoint, /mark_webhook_endpoint_verified/i, "successful challenge must persist trusted state through server RPC");
assert.match(verifyEndpoint, /mark_webhook_endpoint_verification_failed/i, "failed challenge must persist failure through server RPC");
assert.match(sharedConfig, /OUTBOUND_SIGNING_MASTER_SECRET/i, "server config must read the outbound signing master");
assert.match(dispatcherEndpoint, /config\.outboundSigningMasterSecret/i, "dispatcher must fail closed without the outbound signing master");

const orchestratorModule = await readFile(new URL("../functions/_shared/orchestrator.js", import.meta.url), "utf8");
const orchestratorEndpoint = await readFile(new URL("../functions/api/orchestrate-run.js", import.meta.url), "utf8");
const scheduledWorker = await readFile(new URL("../cloudflare/orchestrator-worker.js", import.meta.url), "utf8");
const scheduledConfig = await readFile(new URL("../cloudflare/wrangler.orchestrator.jsonc.example", import.meta.url), "utf8");

assert.match(sharedConfig, /ORCHESTRATOR_SECRET/i, "server config must read orchestrator secret");
assert.match(sharedConfig, /ORCHESTRATOR_ENABLED/i, "server config must expose explicit orchestration rollout gate");
assert.match(orchestratorEndpoint, /x-staypilot-orchestrator-secret/i, "orchestration endpoint must require separate server authentication");
assert.match(orchestratorEndpoint, /orchestrator_disabled/i, "orchestration endpoint must fail closed while rollout gate is disabled");
assert.match(orchestratorEndpoint, /Math\.min\(Number\(body\?\.cycles\) \|\| 2, 3\)/, "orchestration endpoint must cap cycles");
assert.match(orchestratorModule, /claimInboundEvents/, "orchestrator must drive durable worker claims");
assert.match(orchestratorModule, /claimWebhookDeliveries/, "orchestrator must drive durable dispatcher claims");
assert.match(orchestratorModule, /events\.length === 0 && deliveries\.length === 0/, "orchestrator must stop when both queues drain");
assert.match(scheduledWorker, /SCHEDULER_ENABLED/i, "scheduled Worker must have its own explicit enable gate");
assert.match(scheduledWorker, /\/api\/orchestrate-run/i, "scheduled Worker must call the Pages control-plane orchestration endpoint");
assert.match(scheduledWorker, /redirect:"manual"/i, "scheduled Worker must not follow redirects");
assert.match(scheduledWorker, /staypilot-hotel-os\.pages\.dev/i, "scheduler must pin the trusted Pages control-plane host");
assert.match(scheduledWorker, /untrusted_control_plane_origin/i, "scheduler must fail before sending secrets to foreign origins");
assert.match(scheduledConfig, /"crons": \["\* \* \* \* \*"\]/, "scheduler template must define an explicit once-per-minute cron");
assert.match(scheduledConfig, /"SCHEDULER_ENABLED": "false"/, "scheduler template must ship disabled by default");

const bootstrapMigration = await readFile(
  new URL("../supabase/migrations/20260924070000_tenant_bootstrap.sql", import.meta.url),
  "utf8",
);
const bootstrapEndpoint = await readFile(new URL("../functions/api/tenant-bootstrap.js", import.meta.url), "utf8");
const bootstrapAlias = await readFile(new URL("../functions/api/hotels/bootstrap.js", import.meta.url), "utf8");
const onboardingModule = await readFile(new URL("../functions/_shared/onboarding.js", import.meta.url), "utf8");
assert.match(bootstrapMigration, /create table if not exists private\.hotel_bootstrap_requests/i, "bootstrap idempotency state must stay in private schema");
assert.match(bootstrapMigration, /request_fingerprint text not null/i, "bootstrap idempotency must bind the key to request content");
assert.match(bootstrapMigration, /pg_advisory_xact_lock/i, "bootstrap must serialize duplicate idempotency keys");
assert.match(bootstrapMigration, /idempotency_key_reused/i, "bootstrap must reject key reuse with different property data");
assert.match(bootstrapMigration, /automation_paused,settings/i, "new tenants must explicitly set automation authority state");
assert.match(bootstrapMigration, /jsonb_build_object\('onboarding','server-bootstrap-v1','server_authority','disabled'\)/i, "new tenants must default server authority disabled");
assert.match(bootstrapMigration, /values\(\s*safe_slug,safe_name,safe_timezone,safe_currency,true,/i, "new tenants must start with global automation paused");
assert.match(bootstrapMigration, /'failed-payment-recovery'.*?'Paused','Auto'/is, "unsupported financial recovery must seed Paused");
assert.match(bootstrapMigration, /'occupancy-rate-guard'.*?'Paused','Policy'/is, "unsupported revenue mutation must seed Paused");
assert.match(bootstrapMigration, /'reservation-intake'.*?'Paused','Auto'/is, "unsupported reservation intake mutation must seed Paused");
assert.match(bootstrapMigration, /'checkout-turnover'.*?'Active','Auto'/is, "server-safe checkout turnover may seed Active");
assert.match(bootstrapMigration, /'guest-request-router'.*?'Active','Auto'/is, "server-safe guest request routing may seed Active");
assert.match(bootstrapMigration, /insert into public\.hotel_members\(hotel_id,user_id,role\)/i, "bootstrap must create first membership transactionally");
assert.match(bootstrapMigration, /values\(new_hotel\.id,user_uuid,'owner'\)/i, "bootstrap must assign Owner server-side");
assert.match(bootstrapMigration, /insert into public\.automation_rules/i, "bootstrap must seed default automation rules");
assert.match(bootstrapMigration, /Initial Owner tenant bootstrap completed/i, "bootstrap must write an audit event");
assert.match(bootstrapMigration, /revoke all on function public\.bootstrap_hotel_owner\(uuid,text,text,text,text,text\) from public, anon, authenticated/i, "browser sessions must not execute bootstrap RPC");
assert.match(bootstrapMigration, /grant execute on function public\.bootstrap_hotel_owner\(uuid,text,text,text,text,text\) to service_role/i, "bootstrap RPC must be service-role only");
assert.match(sharedConfig, /TENANT_BOOTSTRAP_ENABLED/i, "shared server config must read tenant bootstrap rollout gate");
assert.match(bootstrapEndpoint, /TENANT_BOOTSTRAP_ENABLED|tenantBootstrapEnabled/i, "tenant bootstrap must have an explicit rollout gate");
assert.match(bootstrapEndpoint, /hotel_already_exists/i, "existing owned hotel conflicts must be client-visible rather than generic server failures");
assert.match(bootstrapEndpoint, /requireAuthenticatedUser/i, "bootstrap endpoint must derive identity from authenticated session");
assert.match(bootstrapEndpoint, /requireConfirmedAccount/i, "bootstrap endpoint must require a confirmed account");
assert.match(bootstrapEndpoint, /user_uuid:user\.id/i, "bootstrap endpoint must pass authenticated user id to RPC");
assert.doesNotMatch(bootstrapEndpoint, /input\?\.user_id|input\?\.role/i, "bootstrap endpoint must ignore client identity/role fields");
assert.match(bootstrapAlias, /tenant-bootstrap\.js/i, "legacy hotel bootstrap route must delegate to hardened canonical endpoint");
assert.match(onboardingModule, /Intl\.DateTimeFormat/i, "timezone normalization must validate a real IANA timezone");
assert.match(onboardingModule, /Intl\.NumberFormat/i, "currency normalization must validate a real currency code");

const teamMigration = await readFile(
  new URL("../supabase/migrations/20260924080000_team_onboarding.sql", import.meta.url),
  "utf8",
);
const teamModule = await readFile(new URL("../functions/_shared/team.js", import.meta.url), "utf8");
const teamInvitesEndpoint = await readFile(new URL("../functions/api/team/invitations.js", import.meta.url), "utf8");
const teamAcceptEndpoint = await readFile(new URL("../functions/api/team/invitations/accept.js", import.meta.url), "utf8");
const teamRevokeEndpoint = await readFile(new URL("../functions/api/team/invitations/revoke.js", import.meta.url), "utf8");

assert.match(teamMigration, /create table if not exists private\.team_invitations/i, "team invitation tokens must stay in private schema");
assert.match(teamMigration, /token_hash text not null unique/i, "team invitations must persist only unique token hashes");
assert.match(teamMigration, /invited_role in \('manager','staff'\)/i, "invitation roles must be limited to Manager/Staff");
assert.match(teamMigration, /for update/i, "invite acceptance/revoke must lock the invitation row");
assert.match(teamMigration, /invite\.invited_email <> safe_email/i, "invite acceptance must bind authenticated email");
assert.match(teamMigration, /values\(invite\.hotel_id,user_uuid,invite\.invited_role\)/i, "accepted role must come from the stored invitation");
assert.match(teamMigration, /Team invitation created/i, "invitation creation must audit");
assert.match(teamMigration, /Team invitation accepted/i, "invitation acceptance must audit");
assert.match(teamMigration, /Team invitation revoked/i, "invitation revocation must audit");
assert.match(teamMigration, /revoke all on table private\.team_invitations from public, anon, authenticated/i, "browser sessions must not read invitation token hashes");
assert.match(teamMigration, /grant execute on function public\.create_team_invitation\(uuid,uuid,text,text,text,timestamptz\) to service_role/i, "invite creation RPC must be service-role only");
assert.match(teamMigration, /grant execute on function public\.accept_team_invitation\(uuid,text,text\) to service_role/i, "invite acceptance RPC must be service-role only");
assert.match(teamMigration, /grant execute on function public\.revoke_team_invitation\(uuid,uuid\) to service_role/i, "invite revoke RPC must be service-role only");
assert.match(sharedConfig, /TEAM_ONBOARDING_ENABLED/i, "shared config must expose explicit team onboarding rollout gate");
assert.match(teamModule, /crypto\.getRandomValues/i, "invite tokens must use cryptographic randomness");
assert.match(teamModule, /sha256Hex/i, "raw invite tokens must be hashed before persistence");
assert.match(teamModule, /email_confirmed_at/i, "invite acceptance must require confirmed email");
assert.match(teamInvitesEndpoint, /requireHotelOwner/i, "invite creation/listing must require hotel Owner");
assert.match(teamInvitesEndpoint, /delivery:"manual_demo"/i, "prototype must label invitation delivery truthfully");
assert.match(teamAcceptEndpoint, /requireConfirmedEmailAccount/i, "acceptance must require confirmed email account");
assert.doesNotMatch(teamAcceptEndpoint, /input\?\.role|input\?\.hotel_id/i, "acceptance must not trust client role/hotel identity");
assert.match(teamRevokeEndpoint, /requireHotelOwner/i, "invite revocation must require hotel Owner");

const teamAccessMigration = await readFile(
  new URL("../supabase/migrations/20260924090000_team_access_lifecycle.sql", import.meta.url),
  "utf8",
);
const teamMembersEndpoint = await readFile(new URL("../functions/api/team/members.js", import.meta.url), "utf8");
const teamRoleEndpoint = await readFile(new URL("../functions/api/team/members/role.js", import.meta.url), "utf8");
const teamRemoveEndpoint = await readFile(new URL("../functions/api/team/members/remove.js", import.meta.url), "utf8");

assert.match(teamAccessMigration, /perform private\.require_hotel_owner\(owner_uuid, hotel_uuid\)/i, "team membership mutations must require Owner");
assert.match(teamAccessMigration, /safe_role not in \('manager','staff'\)/i, "generic team role changes must never accept Owner");
assert.match(teamAccessMigration, /owner_uuid = member_user_uuid/i, "Owner must not mutate their own Owner authority through generic team route");
assert.match(teamAccessMigration, /member\.role = 'owner'/i, "existing Owner memberships must be immutable through generic team route");
assert.match(teamAccessMigration, /for update/i, "member mutations must lock current membership");
assert.match(teamAccessMigration, /Team member role changed/i, "team role changes must audit");
assert.match(teamAccessMigration, /Team member access removed/i, "team access removal must audit");
assert.match(teamAccessMigration, /grant execute on function public\.list_hotel_members\(uuid,uuid\) to service_role/i, "member list RPC must be service-role only");
assert.match(teamAccessMigration, /grant execute on function public\.update_team_member_role\(uuid,uuid,uuid,text\) to service_role/i, "member role RPC must be service-role only");
assert.match(teamAccessMigration, /grant execute on function public\.remove_team_member\(uuid,uuid,uuid\) to service_role/i, "member removal RPC must be service-role only");
assert.match(teamMembersEndpoint, /requireHotelOwner/i, "team roster endpoint must require Owner");
assert.match(teamRoleEndpoint, /normalizeMemberRole/i, "team role endpoint must restrict mutable roles");
assert.match(teamRoleEndpoint, /requireHotelOwner/i, "team role endpoint must require Owner");
assert.match(teamRemoveEndpoint, /requireHotelOwner/i, "team removal endpoint must require Owner");
assert.doesNotMatch(teamRoleEndpoint, /owner_uuid:input|new_role:input/i, "team role endpoint must use authenticated Owner and normalized role");

console.log("StayPilot backend contract verification passed.");
