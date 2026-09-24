# StayPilot Secure Team Onboarding Checkpoint — 2026-09-24

Repository: SaamVR/staypilot-hotel-os

## Verified deployed release

- application release: `b918893410aa179cb26b1732d71c953168925284`
- staged Cloudflare bundle: `9d60a129662c5a12a86db818b84312cc973536aa`
- preview: https://cc1d975e.staypilot-hotel-os.pages.dev
- canonical: https://staypilot-hotel-os.pages.dev/?v=b9188934
- CI: PASS — migration guard, backend contracts, worker/dispatcher/provisioning/orchestration/bootstrap/team tests, Vite build and Cloudflare staging

## Secure team onboarding contract

Staged endpoints:

- `GET /api/team/invitations?hotel_id=<uuid>`
- `POST /api/team/invitations`
- `POST /api/team/invitations/accept`
- `POST /api/team/invitations/revoke`

Security properties:

- explicit `TEAM_ONBOARDING_ENABLED` rollout gate
- Owner-only create/list/revoke
- Owner account must be confirmed
- invitation roles restricted to `manager` / `staff`
- cryptographically random raw token
- only SHA-256 token hash persisted
- invitation table lives in private schema
- browser roles have no direct invitation-table access
- single-use row locking
- 1–168 hour expiry
- pending duplicate invite rejection
- already-member rejection
- acceptance requires authenticated **confirmed email**
- authenticated email must match invitation email
- client-supplied role/hotel fields are ignored on acceptance
- membership role comes from the stored invitation
- membership insert + invite acceptance + audit are transactional
- pending invite revocation is Owner-controlled
- accepted invite cannot be revoked
- creation / acceptance / revocation write Governance audit events
- invitation lifecycle RPCs are service-role only

## Production QA — PASS

Preview and canonical both verified:

- `GET /api/backend-health` -> 200
- `team_onboarding_enabled=false`
- create invite -> 503 `backend_not_configured`
- list invites -> 503 `backend_not_configured`
- accept invite -> 503 `backend_not_configured`
- revoke invite -> 503 `backend_not_configured`

Integration Hub:

- desktop readiness signals: 8
- 390px mobile readiness signals: 8
- Team onboarding = Staged · disabled
- Event ingestion = Rejects requests
- no horizontal overflow
- zero browser console/page errors

## Truthful delivery boundary

The creation endpoint currently labels raw-token delivery as `manual_demo`.

No production email/WhatsApp invite sender is claimed.

A commercial rollout should deliver the raw token directly through an approved messaging provider instead of requiring Owner copy/paste.

## Existing backend foundation preserved

Release still includes:

- signed/idempotent inbound events
- durable worker
- outbound webhook outbox
- verified endpoint provisioning
- HMAC dispatcher
- delivery redrive
- scheduler/orchestration contract
- secure tenant bootstrap
- browser-local demo authority while production backend is absent

## Current authority boundary

No dedicated StayPilot Supabase project is provisioned.
No production server secrets are configured.
Team onboarding is staged but disabled.
Browser-local role switching remains demo-only.

Do not reuse unrelated connected Supabase projects.

## Next no-cost commercial slice

Secure team access lifecycle:

- Owner lists current hotel members
- Owner changes Manager <-> Staff role
- Owner removes Manager/Staff access
- server never accepts promotion to Owner through generic role update
- Owner cannot remove/change their own Owner authority through this route
- future multi-Owner support must protect the last Owner invariant
- membership mutation is transactional + audited
- invitation and membership states remain separate
- fail closed until dedicated backend exists
