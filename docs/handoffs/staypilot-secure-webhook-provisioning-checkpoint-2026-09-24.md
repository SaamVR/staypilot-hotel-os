# StayPilot Secure Webhook Provisioning Checkpoint — 2026-09-24

Repository: SaamVR/staypilot-hotel-os

## Verified deployed release

- application release: `9bb79a408be81d4e2d7e7a13bd355b1788808813`
- staged Cloudflare bundle: `e50b9cdf691fb5cee9d14268efcf11186ac25c8d`
- preview: https://3fc28cef.staypilot-hotel-os.pages.dev
- canonical: https://staypilot-hotel-os.pages.dev/?v=9bb79a40
- CI: PASS — migration versions, backend contracts, worker integration, HTTP boundaries, dispatcher integration, endpoint provisioning integration, Vite build, artifact staging

## Secure endpoint onboarding

Implemented:

- `POST /api/webhook-endpoints/register`
- `POST /api/webhook-endpoints/verify`
- valid Supabase bearer session required
- Owner membership required for target hotel
- exact HTTPS allowlist / SSRF-safe destination validation
- registration creates only `Paused + Pending`
- browser `INSERT/UPDATE` privileges removed for webhook endpoints
- trust fields and `secret_ref` are server-owned
- per-endpoint HMAC credential is derived from `OUTBOUND_SIGNING_MASTER_SECRET`
- DB stores only a `DERIVED_V1_*` reference, never the raw endpoint secret
- Owner receives derived credential from the registration response
- verification sends signed, no-redirect challenge
- receiver must return same challenge + HMAC proof
- service-role RPC is the only path to `Verified + Active`
- failed challenge persists `Failed + Paused`
- URL/signing reference changes clear verification
- outbox enqueue + dispatcher claim require explicit `verification_status = Verified`

## Supabase migration correctness

Before any StayPilot database existed, migration filenames were normalized to unique Supabase timestamp versions:

- `20260923010000_staypilot_core.sql`
- `20260923020000_durable_worker.sql`
- `20260924030000_webhook_outbox.sql`
- `20260924040000_webhook_dispatcher.sql`
- `20260924050000_webhook_redrive.sql`
- `20260924060000_webhook_endpoint_provisioning.sql`

CI now runs `scripts/verify-migration-versions.mjs` and rejects non-14-digit or duplicate versions.

## Production safety QA — PASS

Both preview and canonical:

- `GET /api/backend-health` → HTTP 200 / `not_configured`
- database = false
- inbound signature = false
- worker auth = false
- dispatcher auth = false
- outbound host allowlist = false
- outbound signing master = false
- `POST /api/events` → 503 `backend_not_configured`
- `POST /api/worker-run` → 503 `worker_not_configured`
- `POST /api/webhook-dispatch-run` → 503 `dispatcher_not_configured`
- `POST /api/webhook-endpoints/register` → 503 `provisioning_not_configured`
- `POST /api/webhook-endpoints/verify` → 503 `provisioning_not_configured`

Integration Hub:

- 5 readiness signals
- staged copy mentions verified webhook provisioning
- outbound dispatcher = Not configured
- event ingestion = Rejects requests
- desktop 1280px no horizontal overflow
- mobile 390px document width = viewport width
- zero browser console/page errors

## Authority boundary

No dedicated StayPilot Supabase project or real server secrets are configured.
Browser-local demo state remains authoritative.
Do not claim live server automation, endpoint provisioning, or external dispatch.

Do not reuse unrelated Supabase projects.

## Next hardening sequence

1. scheduler/orchestration contract for worker + dispatcher
2. secure tenant bootstrap/onboarding contract
3. provision dedicated StayPilot Supabase only after explicit user approval
4. apply migrations + run security advisors
5. bootstrap test tenant/auth/RLS
6. controlled signed inbound + worker + outbound integration QA
7. shadow-mode parity before moving frontend authority

Do not restart architecture planning from scratch.
