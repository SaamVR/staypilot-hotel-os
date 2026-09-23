# StayPilot Safe Webhook Dispatcher Checkpoint — 2026-09-24

Repository: SaamVR/staypilot-hotel-os

## Verified deployed application release

- application release: `145b6fde02f55160ed75ba380a55beed7eb0d360`
- staged Cloudflare bundle: `36e852947973a77b20c7c49272f79a11043d3792`
- preview: https://d3327e79.staypilot-hotel-os.pages.dev
- canonical: https://staypilot-hotel-os.pages.dev/?v=145b6fde
- CI: PASS — static backend contracts, worker integration, HTTP boundary tests, dispatcher security tests, Vite build, artifact staging

This release contains all prior state-coherence, approval-effect, durable worker and outbound-outbox work plus the safe outbound webhook dispatcher.

## Outbound architecture

```
hotel event
  -> policy-aware StayPilot automation
  -> durable run + audit
  -> durable outbound outbox
  -> safe delivery dispatcher
  -> optional n8n / Make / Zapier / custom consumer
```

n8n / Make / Zapier are optional consumers. StayPilot does not depend on them for core hotel automation.

## Dispatcher security boundary

Implemented:

- server-verified webhook endpoints
- exact server-recorded verified host
- server-managed signing-secret reference
- authenticated clients cannot write verification fields or secret references
- endpoint URL changes clear verification
- exact HTTPS host allowlist via `WEBHOOK_ALLOWED_HOSTS`
- HTTP destinations rejected
- URL credentials rejected
- non-443 ports rejected
- localhost / internal names rejected
- IP literals rejected
- redirects not followed
- exact outbound JSON body HMAC-SHA256 signed
- separate `DISPATCHER_SECRET`
- atomic `FOR UPDATE ... SKIP LOCKED` delivery claims
- stale lease recovery
- bounded retry/backoff
- 2xx = delivered
- 408 / 425 / 429 / 5xx / network = retry
- permanent 4xx = dead-letter
- retry cap enforced by database lifecycle

Server endpoint:

```
POST /api/webhook-dispatch-run
X-StayPilot-Dispatcher-Secret: <server-only secret>
```

This is a trusted worker/scheduler endpoint, not a public webhook.

## Production safety QA — PASS

Verified on both preview and canonical production.

`GET /api/backend-health`:

- HTTP 200
- mode = `not_configured`
- database = false
- inbound_signature_verification = false
- durable_worker_authentication = false
- outbound_dispatcher_authentication = false
- outbound_host_allowlist = false

Fail-closed mutations:

- `POST /api/events` -> HTTP 503 `backend_not_configured`
- `POST /api/worker-run` -> HTTP 503 `worker_not_configured`
- `POST /api/webhook-dispatch-run` -> HTTP 503 `dispatcher_not_configured`

No external webhook can be emitted from the public deployment because there is no dedicated StayPilot database, dispatcher secret, allowlist, or per-endpoint signing secret.

## Integration Hub UI QA — PASS

Desktop 1280px and mobile 390px:

- Commercial backend boundary visible
- 5 readiness signals
- Dedicated database = Not provisioned
- Inbound HMAC secret = Not configured
- Worker authentication = Not configured
- Outbound dispatcher = Not configured
- Event ingestion = Rejects requests
- mobile document width = viewport width
- no horizontal overflow
- zero console/page errors

## Authority boundary

Current frontend authority remains browser-local demo state.

Do not claim:

- live Supabase hotel state
- live durable worker execution
- live external webhook delivery
- live n8n / Make / Zapier runtime dependency

The server foundation is deployed and fail-closed.

## Next commercial backend sequence

Before server authority can be enabled:

1. confirm Supabase organization and quoted project cost with user
2. provision dedicated StayPilot Supabase project
3. apply migrations 001-004
4. run Supabase security advisors
5. bootstrap test hotel + Owner membership server-side
6. validate Owner / Manager / Staff RLS and cross-hotel denial
7. configure encrypted inbound / worker / dispatcher secrets
8. configure exact outbound host allowlist and per-endpoint signing secrets
9. verify endpoint ownership before marking an endpoint server-verified
10. test ingress -> worker -> audit -> outbox -> dispatcher with controlled test destination
11. test transient retry / dead-letter / redrive behavior
12. mirror browser/server runs before moving frontend authority

Do not reuse unrelated connected Supabase projects.
