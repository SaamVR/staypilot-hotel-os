# StayPilot Secure Team Access Lifecycle

This phase extends secure team onboarding into day-to-day membership administration.

It uses the existing:

```
TEAM_ONBOARDING_ENABLED=false
```

rollout gate. Invitations and member administration activate together only after the dedicated StayPilot backend is provisioned and validated.

## Endpoints

Current-member roster:

```
GET /api/team/members?hotel_id=<uuid>
Authorization: Bearer <confirmed Owner session>
```

Role change:

```
POST /api/team/members/role
Authorization: Bearer <confirmed Owner session>
Content-Type: application/json

{
  "hotel_id": "<uuid>",
  "user_id": "<member uuid>",
  "role": "manager"
}
```

Access removal:

```
POST /api/team/members/remove
Authorization: Bearer <confirmed Owner session>
Content-Type: application/json

{
  "hotel_id": "<uuid>",
  "user_id": "<member uuid>"
}
```

## Member roster

Only a confirmed Owner of the hotel can retrieve the roster.

The service-role RPC returns:

- user ID
- current role
- joined timestamp
- normalized account email
- optional auth profile display name

The browser does not query `auth.users` directly.

## Role changes

Generic role mutation is deliberately narrow.

Allowed target roles:

- `manager`
- `staff`

Not allowed:

- `owner`

The current membership row is locked before mutation.

Owner authority is immutable through this endpoint:

- the acting Owner cannot demote themselves
- another Owner cannot be changed through the generic route
- a Manager/Staff member cannot be promoted to Owner through request input

If multi-Owner transfer is added later, it requires a separate explicit ownership-transfer contract with last-Owner protection.

An unchanged Manager/Staff role is idempotent and produces no audit event.

A real role change writes a Governance audit event with previous/new role.

## Access removal

Only Manager/Staff memberships can be deleted.

The current membership row is locked before deletion.

The route rejects:

- acting Owner removal
- any Owner membership removal
- missing member
- concurrent membership changes

A successful removal writes a Governance audit event with the removed member ID and previous role.

## Database authority

Migration:

```
supabase/migrations/20260924090000_team_access_lifecycle.sql
```

Service-role RPCs:

```
list_hotel_members(owner_uuid, hotel_uuid)
update_team_member_role(owner_uuid, hotel_uuid, member_user_uuid, new_role)
remove_team_member(owner_uuid, hotel_uuid, member_user_uuid)
```

All three RPCs:

- require the authenticated Owner identity passed by the server
- are revoked from `public`, `anon` and `authenticated`
- are executable only by `service_role`

## CI contract

`npm run verify:backend` proves:

- team routes fail closed while rollout is disabled
- non-Owners cannot list/change/remove
- only Manager/Staff roles are mutable
- client Owner promotion is rejected before RPC
- Owner memberships are immutable server-side
- role/remove RPC bodies use authenticated Owner identity
- missing/concurrent membership states map safely
- role change/removal audit requirements exist
- service-role-only execution grants exist

## Current production state

The public StayPilot deployment has:

```
TEAM_ONBOARDING_ENABLED=false
```

Therefore member listing, role mutation and access removal remain staged and fail closed until the dedicated backend rollout is explicitly enabled.

Browser-local Owner/Manager switching remains demo state and is not production identity/authorization.
