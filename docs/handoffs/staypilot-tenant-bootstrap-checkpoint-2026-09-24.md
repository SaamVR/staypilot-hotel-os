# StayPilot Secure Tenant Bootstrap Checkpoint — 2026-09-24

Repository: SaamVR/staypilot-hotel-os

## Verified deployed release

- application release: `0ba97313f076af1369c507b99b0e309405977452`
- staged Cloudflare bundle: `748e7d5318789f073fbe148999f0c76ececda905`
- preview: https://713325ac.staypilot-hotel-os.pages.dev
- canonical: https://staypilot-hotel-os.pages.dev/?v=0ba97313
- CI: PASS — migration version guard, backend contracts, worker/dispatcher/provisioning/orchestration/bootstrap tests, Vite build, artifact upload, Cloudflare staging

## Tenant bootstrap contract

Canonical endpoint:
- `POST /api/tenant-bootstrap`

Compatibility alias:
- `POST /api/hotels/bootstrap`
- delegates to the same hardened handler

Security:
- requires dedicated Supabase backend
- requires explicit `TENANT_BOOTSTRAP_ENABLED=true`
- requires authenticated Supabase bearer session
- requires confirmed email/phone/account
- derives Owner user ID from the authenticated session
- ignores client-supplied user/role fields
- service-role-only bootstrap RPC
- idempotency key bound to a request SHA-256 fingerprint
- duplicate key + different property data -> conflict
- slug collisions map safely
- transaction advisory lock prevents concurrent duplicate bootstrap

Transaction:
1. create hotel
2. create first Owner membership
3. seed 12 default automation rules
4. write Governance audit event
5. persist idempotency record

Safe defaults:
- hotel starts `automation_paused=true`
- server authority setting = disabled
- provider/revenue/financial automations stay Paused until property setup/integrations/policy review
- safe operational workflows may be seeded Active
- no external integration is activated by tenant bootstrap

## Production QA — PASS

Preview and canonical both verified:

- `GET /api/backend-health` -> 200
- `tenant_bootstrap_enabled=false`
- `POST /api/tenant-bootstrap` -> 503 `backend_not_configured`
- `POST /api/hotels/bootstrap` -> same 503 contract
- `POST /api/orchestrate-run` remains fail-closed
- `POST /api/webhook-dispatch-run` remains fail-closed

Integration Hub:
- desktop: 7 readiness signals
- 390px mobile: same 7 signals
- Tenant onboarding = Staged · disabled
- Event ingestion = Rejects requests
- no horizontal overflow
- zero browser console/page errors

## Existing server-control foundation preserved

The release still includes:
- signed/idempotent inbound events
- durable worker
- outbound outbox
- verified endpoint provisioning
- HMAC dispatcher
- delivery redrive
- fail-closed orchestration
- dormant cron-worker template

## Current authority boundary

No dedicated StayPilot Supabase project is provisioned.
No production server secrets are configured.
Browser-local demo state remains the operational authority.

Do not reuse unrelated connected Supabase projects.
Do not enable tenant bootstrap, orchestrator, dispatcher, worker, or signed-event ingestion before dedicated infrastructure is provisioned and validated.

## Next no-cost commercial slice

Secure team onboarding:
- Owner creates manager/staff invitation
- invite token stored hashed, single-use, expiring
- invite acceptance requires authenticated confirmed account
- role comes from server-side invitation, never client input
- hotel membership is created transactionally
- Owner can revoke pending invites
- duplicate / expired / revoked invites fail safely
- audit events for invite / accept / revoke
- remains fail-closed until dedicated backend exists
