# StayPilot Secure Team Onboarding Contract

This phase stages team membership onboarding without enabling it in the public portfolio deployment.

## Rollout gate

Server environment:

```
TEAM_ONBOARDING_ENABLED=false
```

All team-onboarding endpoints fail closed until:

- a dedicated StayPilot Supabase project exists
- the migrations are applied
- server credentials are configured
- `TEAM_ONBOARDING_ENABLED=true` is explicitly set

The current public deployment must remain disabled.

## Roles

Invitations can grant only:

- `manager`
- `staff`

Owner role is never accepted from invitation input.

The role used at acceptance comes from the server-stored invitation row.

## Invitation creation

Endpoint:

```
POST /api/team/invitations
Authorization: Bearer <confirmed Owner session>
Content-Type: application/json
```

Body:

```json
{
  "hotel_id": "<uuid>",
  "email": "manager@example.com",
  "role": "manager",
  "expires_in_hours": 72
}
```

Rules:

- authenticated user must be an Owner of the hotel
- Owner account must be confirmed
- email is normalized to lowercase
- role must be Manager or Staff
- lifetime is 1–168 hours
- raw token is generated with cryptographic randomness
- only SHA-256 token hash is persisted
- raw token is returned once to the authorized Owner
- current delivery is labeled `manual_demo`; production email delivery is a separate provider integration
- one non-expired pending invite per hotel + email
- already-member email is rejected
- creation writes a Governance audit event

## Listing

Endpoint:

```
GET /api/team/invitations?hotel_id=<uuid>
Authorization: Bearer <confirmed Owner session>
```

Only invitation metadata is returned. Token hashes are never exposed.

Expired pending invitations are normalized to `expired` server-side.

## Acceptance

Endpoint:

```
POST /api/team/invitations/accept
Authorization: Bearer <confirmed invitee session>
Content-Type: application/json

{
  "token": "<raw invitation token>"
}
```

Security rules:

- invitee must have a confirmed email specifically
- token is normalized and SHA-256 hashed before RPC
- invitation row is locked `FOR UPDATE`
- token must be pending, unrevoked and unexpired
- authenticated confirmed email must equal the invitation email
- hotel ID and role are ignored from client input
- membership role comes only from the invitation row
- existing hotel membership is rejected
- invitation is single-use
- membership insert + invitation acceptance + audit occur transactionally

## Revocation

Endpoint:

```
POST /api/team/invitations/revoke
Authorization: Bearer <confirmed Owner session>
Content-Type: application/json

{
  "hotel_id": "<uuid>",
  "invite_id": "<uuid>"
}
```

Only the hotel Owner may revoke.

Accepted invites cannot be revoked. Repeated revocation is idempotent. Expired invitations fail as expired.

Revocation writes a Governance audit event.

## Database authority

Migration:

```
supabase/migrations/20260924080000_team_onboarding.sql
```

The invitation table lives in the `private` schema.

Browser roles `anon` and `authenticated` have no direct table access.

All invitation lifecycle RPCs are executable by `service_role` only.

## Token handling

Persisted:

```
SHA-256(raw token)
```

Never persisted:

- raw invitation token
- invitation token in audit payload
- invitation token in public tables

The raw token is displayed once after creation in this portfolio-stage API. A commercial rollout should hand it directly to the email/message delivery provider instead of requiring manual Owner delivery.

## CI contract

`npm run verify:backend` verifies:

- feature remains fail-closed by default
- Owner authorization for create/list/revoke
- confirmed-email acceptance
- raw token is not passed to the database
- role comes from the stored invitation
- Manager/Staff-only role constraint
- private token-hash storage
- single-use row locking
- expiry/revoke/duplicate/member conflict handling
- audit requirements
- service-role-only RPC execution

## Current authority boundary

No dedicated StayPilot Supabase project is provisioned.

No team invite can create a real production membership in the current deployment.

Browser-local prototype roles remain demo-only until dedicated backend rollout is explicitly enabled.
