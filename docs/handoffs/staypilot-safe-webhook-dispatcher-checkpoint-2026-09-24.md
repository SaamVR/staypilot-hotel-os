# StayPilot Safe Webhook Dispatcher Checkpoint — 2026-09-24

Repository: SaamVR/staypilot-hotel-os

## Verified release

- application release: `145b6fde02f55160ed75ba380a55beed7eb0d360`
- staged Cloudflare bundle: `36e852947973a77b20c7c49272f79a11043d3792`
- preview: https://577a9150.staypilot-hotel-os.pages.dev
- canonical: https://staypilot-hotel-os.pages.dev/?v=145b6fde
- CI: PASS — backend contracts, worker integration, HTTP boundary, dispatcher integration, Vite build, artifact staging

## Outbound dispatcher

Implemented:

- migration `20260924040000_webhook_dispatcher.sql`
- server-verified webhook endpoint state
- verification cleared when URL/signing reference changes
- authenticated browser clients cannot control verification fields or `secret_ref`
- enqueue/claim requires Active + verified host + server signing reference
- delivery claim uses `FOR UPDATE ... SKIP LOCKED`
- 10-minute stale delivery lease recovery
- 5-attempt retry cap and dead-letter lifecycle
- separate `DISPATCHER_SECRET`
- exact HTTPS host allowlist via `WEBHOOK_ALLOWED_HOSTS`
- URL host must exactly match server-recorded verified host
- HTTP URLs, userinfo, non-443 ports, localhost/internal names and IP literals rejected
- redirects are not followed
- per-endpoint HMAC signing secret resolved only from server environment
- exact JSON body signed as `HMAC-SHA256(timestamp.body)`
- 2xx = delivered
- 408 / 425 / 429 / 5xx / network / timeout = bounded retry
- permanent 4xx = dead-letter

Endpoint:

```
POST /api/webhook-dispatch-run
X-StayPilot-Dispatcher-Secret: <server-only secret>
```

This is a trusted worker/scheduler endpoint, not a public integration endpoint.

n8n / Make / Zapier / custom systems remain optional downstream consumers. StayPilot owns hotel state, policy, idempotency, audit, queueing and delivery reliability.

## Production safety QA — PASS

Both preview and canonical verified:

`GET /api/backend-health`
- HTTP 200
- mode = `not_configured`
- database = false
- inbound_signature_verification = false
- durable_worker_authentication = false
- outbound_dispatcher_authentication = false
- outbound_host_allowlist = false

`POST /api/events`
- HTTP 503 `backend_not_configured`

`POST /api/worker-run`
- HTTP 503 `worker_not_configured`

`POST /api/webhook-dispatch-run`
- HTTP 503 `dispatcher_not_configured`

Integration Hub:
- desktop: 5 readiness signals
- mobile 390px: 5 readiness signals
- Outbound dispatcher = Not configured
- Event ingestion = Rejects requests
- no horizontal overflow
- zero console/page errors

## Authority boundary

No dedicated StayPilot Supabase project or real server secrets are configured.
Browser-local demo state remains the operational source of truth.

Do not claim live server automation or live external dispatch until dedicated infrastructure is explicitly provisioned.

## Next hardening sequence

1. secure server-side endpoint provisioning / verification flow
2. scheduler/run orchestration for worker + dispatcher
3. dedicated StayPilot Supabase provisioning after explicit user approval
4. apply migrations + security advisors
5. bootstrap tenant/auth/RLS
6. signed inbound event QA
7. worker execution QA
8. outbound dispatch QA against a controlled test endpoint
9. shadow-mode parity before moving browser authority
