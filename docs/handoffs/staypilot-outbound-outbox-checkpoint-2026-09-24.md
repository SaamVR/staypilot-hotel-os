# StayPilot Outbound Outbox Checkpoint — 2026-09-24

Repository: SaamVR/staypilot-hotel-os

## Verified release

- application release: `eaa2795ff3341a5808957eb241b943e4aaf83cec`
- staged Cloudflare bundle: `9219c00dcaa76d56c95d09dfce2b96d8bbd17dd9`
- preview: https://6426336e.staypilot-hotel-os.pages.dev
- canonical: https://staypilot-hotel-os.pages.dev/?v=eaa2795f
- CI: PASS — backend contracts, executable worker suite, executable HTTP boundary suite, Vite build, artifact staging

## Durable outbound integration outbox

Implemented:

- migration `20260924_003_webhook_outbox.sql`
- `webhook_deliveries.inbound_event_id`
- unique `hotel_id + endpoint_id + event_id` delivery boundary
- service-role-only `enqueue_webhook_deliveries(event_uuid)`
- only Active endpoints subscribed to the event type are queued
- worker completion waits until subscribed deliveries are durably queued
- transient outbox failure retries the source event
- terminal automation result is preserved during outbox-only retry
- retry does not repeat the hotel business action
- duplicate/replayed Event IDs cannot fan out duplicate downstream deliveries

Architecture:

```
hotel event
  -> policy-aware automation
  -> durable run + audit
  -> durable outbound outbox
  -> future dispatcher
  -> optional n8n / Make / Zapier / custom webhook
```

n8n, Make and Zapier remain optional downstream consumers. StayPilot core does not depend on them.

## Production QA — PASS

Preview and canonical:

- `GET /api/backend-health` = HTTP 200, mode `not_configured`
- database = false
- inbound signature verification = false
- durable worker authentication = false
- `POST /api/events` = HTTP 503 `backend_not_configured`
- `POST /api/worker-run` = HTTP 503 `worker_not_configured`

No dedicated StayPilot Supabase project or real server secret is configured.

## Next lane

Build the outbound delivery dispatcher safely:

- service-role atomic delivery claims
- stale delivery lease recovery
- separate dispatcher authentication
- exact HTTPS host allowlist
- reject IP literals / localhost / internal names
- HMAC-sign exact outbound body
- strict request timeout
- 2xx = delivered
- 408 / 425 / 429 / 5xx / network = retry with backoff
- other 4xx = dead-letter
- max retry cap
- no arbitrary external destination fetches
- executable tests before merge
