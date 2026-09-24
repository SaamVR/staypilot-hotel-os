# StayPilot Team Access Lifecycle Checkpoint — 2026-09-24

Repository: SaamVR/staypilot-hotel-os

## Verified deployed release

- application release: `632e2301526667a9e0e0b6168ed49e4eed0d28e4`
- staged Cloudflare bundle: `35ac0049358291053a476e7bc1a153790ca69df1`
- preview: https://405fcbf9.staypilot-hotel-os.pages.dev
- canonical: https://staypilot-hotel-os.pages.dev/?v=632e2301
- CI: PASS — migration guard, backend contracts, worker/dispatcher/provisioning/orchestration/bootstrap/team-onboarding/team-access tests, Vite build and staging

## Team access lifecycle

Staged endpoints:

- `GET /api/team/members?hotel_id=<uuid>`
- `POST /api/team/members/role`
- `POST /api/team/members/remove`

Authority:

- confirmed hotel Owner required
- generic mutable roles are Manager / Staff only
- Owner cannot mutate their own Owner authority
- no Owner membership can be changed/removed through generic team route
- Manager <-> Staff role changes are transactional
- Manager/Staff access removal is transactional
- member row is locked before mutation
- role changes/removals write Governance audit events
- service-role-only RPCs
- existing `TEAM_ONBOARDING_ENABLED` gate controls invite + access lifecycle together

## Production QA — PASS

Preview and canonical both verified:

- member roster -> 503 `backend_not_configured`
- role update -> 503 `backend_not_configured`
- access removal -> 503 `backend_not_configured`

Integration Hub:

- desktop readiness signals: 8
- mobile readiness signals: 8
- Team onboarding & access = Staged · disabled
- 390px document width = viewport width
- no horizontal overflow
- zero browser console/page errors

## Current authority boundary

No dedicated StayPilot Supabase project is provisioned.
No production team membership mutation is active.
Browser-local Owner/Manager switching remains demo-only.

## Next no-cost commercial slice

Authenticated session context:

- derive authenticated user from Supabase bearer session
- require confirmed account
- return only the user's hotel memberships
- include role per hotel from server membership rows
- expose active hotel context only from a membership-owned hotel
- no client-supplied role trust
- no cross-tenant membership leakage
- include feature/authority readiness needed for future frontend migration
- fail closed until dedicated backend exists

This is the bridge from demo role switching toward server-derived identity/authorization without enabling production backend authority yet.
