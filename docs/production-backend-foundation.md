# StayPilot Production Backend Foundation

This directory documents the first server-side foundation for moving StayPilot from a browser-local portfolio prototype toward a commercial SaaS.

**Important:** no dedicated StayPilot Supabase project has been provisioned yet. The connected Supabase account currently contains unrelated projects; this migration must not be applied to them.

## What this phase adds

- multi-tenant hotel data model
- Supabase Auth membership model
- Owner / Manager / Staff roles enforced with Postgres RLS
- durable inbound Event IDs with database uniqueness
- automation run persistence model
- approvals, tasks, reservations, rooms and audit tables
- outgoing webhook endpoint/delivery tables
- Cloudflare Pages Function for signed inbound events
- HMAC SHA-256 signature verification
- five-minute replay-window protection
- duplicate-safe event insertion
- backend configuration health endpoint
- CI contract verification
- atomic durable-worker claim/lease lifecycle
- retry/backoff and dead-letter state
- stale processing lease recovery
- server-only worker authentication
- idempotent worker-side tasks, approvals and audit effects

## What this phase intentionally does not do

The current frontend still runs its hotel state and automation engine in browser localStorage.

The signed inbound endpoint stores verified events as queued records. A **dormant durable worker contract** now exists for a narrow safe event set, but it cannot execute until a dedicated StayPilot database, migrations and server worker secret are configured.

Production migration should happen in this order:

1. provision dedicated Supabase project
2. apply schema/RLS migration
3. configure Cloudflare server secrets
4. validate signed event ingestion and duplicate handling
5. validate the staged durable worker against the dedicated database
6. mirror browser automation runs to server for comparison
7. move authentication/roles to Supabase Auth
8. move hotel state reads/writes from localStorage to Supabase
9. enable server automation as the authority
10. remove localStorage as operational source of truth

This staged approach keeps the verified portfolio demo stable while backend authority is introduced.

## Files

- `supabase/migrations/20260923_001_staypilot_core.sql`
- `functions/_shared/webhook.js`
- `functions/api/events.js`
- `functions/api/backend-health.js`
- `supabase/migrations/20260923_002_durable_worker.sql`
- `functions/_shared/supabase.js`
- `functions/_shared/worker.js`
- `functions/api/worker-run.js`
- `scripts/verify-backend-contract.mjs`
- `.dev.vars.example`

## Data authority

The schema uses `hotel_id` on every tenant-owned table.

### Membership roles

- `owner`
- `manager`
- `staff`

Hotel creation and the first Owner membership are intentionally server-side bootstrap operations. An authenticated browser user cannot create a hotel and grant themselves Owner through exposed RLS policies.

### RLS model

All tables in the exposed `public` schema have RLS enabled.

Authenticated users may read only hotels where they have membership.

Typical write authority:

- Owner: hotel settings, team, automations, integrations and operational data
- Manager: rooms, reservations, operational tasks and approval requests
- Staff: operational task visibility/update
- Server/service role only: inbound events, automation runs, webhook delivery results and audit writes

The `private` schema contains security-definer membership helpers and is not intended as a Data API schema.

## Durable inbound event contract

Endpoint:

```
POST /api/events
```

Required headers:

```
X-StayPilot-Hotel-Id: <hotel UUID>
X-StayPilot-Event-Id: evt_provider_123
X-StayPilot-Event-Type: reservation.created
X-StayPilot-Timestamp: <unix seconds>
X-StayPilot-Signature: v1=<hex HMAC SHA-256>
Content-Type: application/json
```

Signature input:

```
<timestamp>.<raw request body>
```

The server computes:

```
HMAC-SHA256(WEBHOOK_SIGNING_SECRET, signature_input)
```

Security behavior:

- invalid/missing HMAC → 401
- timestamp outside ±5 minutes → 401
- invalid Event ID/type/hotel UUID → 400
- body > 256 KB → 413
- backend secrets missing → 503
- first valid Event ID → 202 and durable `queued` event
- same `hotel_id + event_id` again → 200 with `duplicate: true`

Database uniqueness is the authoritative idempotency boundary.

The browser-side Event-ID suppression remains useful for the portfolio demo but is not considered the production guarantee.

## Health endpoint

```
GET /api/backend-health
```

This endpoint never returns credentials. It exposes only whether the database and webhook-signing dependencies are configured.

Before server secrets exist, the expected response is similar to:

```json
{
  "ok": true,
  "mode": "not_configured",
  "configured": false
}
```

## Server environment variables

Configure as Cloudflare Pages encrypted secrets / environment variables:

```
SUPABASE_URL
SUPABASE_SECRET_KEY
WEBHOOK_SIGNING_SECRET
WORKER_SECRET
```

A legacy `SUPABASE_SERVICE_ROLE_KEY` is accepted as a compatibility fallback by the current function.

Never expose either Supabase server key or webhook-signing secret through Vite/client environment variables.

Do **not** prefix these with `VITE_`.

## Supabase provisioning

A dedicated StayPilot project should be created rather than reusing another application's database.

Creation may have account-dependent cost. Before provisioning through the connected Supabase tools, the organization and current quoted cost must be confirmed.

Once provisioned:

1. apply `20260923_001_staypilot_core.sql`
2. run Supabase security advisors
3. create a test Auth user
4. bootstrap one hotel + Owner membership server-side
5. validate RLS as Owner, Manager and Staff
6. configure Cloudflare server secrets
7. test signed event ingestion
8. verify duplicate Event ID response
9. verify cross-hotel access is denied

## Initial hotel bootstrap

Do not expose an unrestricted client-side `create hotel` RPC.

The first hotel and Owner membership should be created through an authenticated server onboarding path that verifies the account and performs both writes together.

Conceptually:

```
transaction:
  create hotels row
  create hotel_members row(role = owner)
  seed default automation_rules
commit
```

## Durable worker contract

`inbound_events.status = queued` is now backed by a staged service-role worker lifecycle.

### Atomic claim lifecycle

Migration `20260923_002_durable_worker.sql` adds:

- `next_attempt_at`
- processing lease fields
- attempt count timestamps
- dead-letter timestamp
- idempotency keys on task / approval / audit side effects
- `claim_inbound_events()` with `FOR UPDATE ... SKIP LOCKED`
- stale processing lease recovery after 10 minutes
- `finish_inbound_event()` for complete / retry / dead-letter outcomes
- service-role-only execution grants

Queued/failed events stop being newly claimed after five attempts. A stale `processing` lease is still reclaimable after the cap so a worker crash cannot permanently strand the row.

### Worker endpoint

```
POST /api/worker-run
X-StayPilot-Worker-Secret: <server-only secret>
```

The endpoint:

1. fails 503 until Supabase + `WORKER_SECRET` exist
2. constant-time verifies the worker secret
3. atomically claims a bounded batch
4. resolves an active automation rule
5. checks for an existing Event-ID run before mutation
6. respects `Suggest` and `Approval` autonomy without executing the business mutation
7. executes only the safe server handler set below
8. records automation run + audit
9. completes, retries or dead-letters the source event

### Safe server handler set

Currently staged:

- `guest.request_received` → idempotent Housekeeping task
- `review.negative` → idempotent Front Desk recovery task
- `housekeeping.completed` → room housekeeping = Clean
- `room.maintenance_blocked` → room maintenance = Out of order
- `guest.checked_out` → room Vacant + Dirty and idempotent turnover task

Room-scoped events must resolve a real room or fail safely.

Financial/revenue workflows such as payments, refunds and rate changes remain unsupported by the server worker until their policy/accounting semantics are migrated. Unsupported events are dead-lettered rather than guessed.

The worker is **not active in production yet** because the dedicated StayPilot Supabase project and server secrets have not been provisioned.

## Outbound webhooks next phase

`webhook_endpoints` stores routing metadata only; raw signing secrets should live in a managed secret store and be referenced by `secret_ref`.

`webhook_deliveries` is designed for:

- queued deliveries
- attempts
- HTTP result
- retry time
- dead-letter status
- delivery duration

## CI security contract

`npm run verify:backend` verifies:

- valid HMAC accepted
- tampered body rejected
- stale timestamp rejected
- SHA-256 payload hash format
- all exposed production tables have RLS enabled
- hotel/Event ID uniqueness exists
- role-aware RLS helper exists
- event ingestion uses duplicate-safe insert
- server endpoint fails closed when unconfigured

GitHub Actions runs this on every PR/push alongside the Vite production build.

## Production warning

The presence of these files does **not** mean StayPilot is already a production PMS or control plane.

Until a dedicated database, secrets, worker, authentication migration and provider certifications are completed, the canonical product remains a high-fidelity automation portfolio prototype with an intentionally dormant server foundation.
