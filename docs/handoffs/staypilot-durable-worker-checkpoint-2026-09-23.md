# StayPilot Durable Worker Checkpoint — 2026-09-23

Repository: SaamVR/staypilot-hotel-os

## Verified deployed release

- application release: `cbc6acaee10d9dc2efb3de0da28b49f255108371`
- staged Cloudflare bundle: `31cc25f2cf4ff0b199cb451adbcc86bb710b7dca`
- preview: https://96edf118.staypilot-hotel-os.pages.dev
- canonical: https://staypilot-hotel-os.pages.dev/?v=cbc6acae
- CI: PASS — backend contracts, Vite build, artifact upload, Cloudflare staging

This release includes all prior state-coherence / approval-effect work plus the dormant durable server worker.

## Durable worker contract

Implemented:

- atomic inbound-event claim with `FOR UPDATE ... SKIP LOCKED`
- bounded retry lifecycle and dead-letter state
- 10-minute stale processing-lease recovery
- service-role-only claim / finish RPCs
- Event-ID idempotency on task, approval, audit and automation-run effects
- Failed automation runs may retry to a later terminal result
- terminal automation runs suppress duplicate business effects
- separate server worker authentication
- fail-closed worker endpoint: `POST /api/worker-run`

Safe server handlers staged:

1. `guest.request_received` → idempotent Housekeeping task
2. `review.negative` → idempotent Front Desk recovery task
3. `housekeeping.completed` → room housekeeping = Clean
4. `room.maintenance_blocked` → room maintenance = Out of order
5. `guest.checked_out` → room Vacant + Dirty + idempotent turnover task

Financial/revenue events remain unsupported server-side and are dead-lettered rather than guessed.

## Production safety QA — PASS

Preview and canonical production both verified:

- `GET /api/backend-health` → HTTP 200
- database = false
- inbound signature verification = false
- durable worker authentication = false
- `POST /api/events` → HTTP 503 `backend_not_configured`
- `POST /api/worker-run` → HTTP 503 `worker_not_configured`

Integration Hub QA:

- desktop readiness card visible
- 4 readiness signals
- Worker authentication = Not configured
- Event ingestion = Rejects requests
- 390px mobile: document width = viewport width
- no horizontal overflow
- zero console/page errors

## Authority boundary

The durable worker is deployed but intentionally dormant.

Current browser-local demo state remains the operational authority.

Do NOT:
- reuse the unrelated connected CMS Supabase project
- reuse the unrelated inactive Booking agent project
- add real database/server secrets without explicit provisioning approval
- claim server automation is live

A dedicated StayPilot Supabase project must be provisioned before server authority can be enabled.

## Next commercial-backend sequence

1. confirm Supabase organization and quoted project cost with user
2. provision a dedicated StayPilot project
3. apply migrations 001 and 002
4. run Supabase security advisors
5. bootstrap test hotel + Owner membership server-side
6. validate Owner / Manager / Staff RLS and cross-hotel denial
7. configure encrypted server environment values
8. test signed Event-ID ingestion
9. test worker claim → execute → audit → complete
10. test retry and dead-letter paths
11. mirror browser/server runs before moving frontend authority
12. migrate auth and hotel state only after parity checks

Do not restart architecture planning from scratch.
