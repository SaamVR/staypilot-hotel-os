# StayPilot Secure Tenant Bootstrap Contract

Date: 2026-09-24

This contract defines the first server-authoritative onboarding transaction for a commercial StayPilot tenant.

It is intentionally staged and disabled by default.

## Goal

Create the first hotel tenant without trusting the browser to assign ownership or enable automation.

One service-role transaction performs:

```
confirmed authenticated user
  -> validate property identity
  -> bind idempotency key to exact request payload
  -> create hotel
  -> create first Owner membership
  -> seed 12 automation rules with safe defaults
  -> write governance audit event
  -> persist bootstrap idempotency record
```

## Endpoint

Canonical:

```
POST /api/tenant-bootstrap
```

Compatibility alias:

```
POST /api/hotels/bootstrap
```

Both use the same hardened handler.

Required:

- valid Supabase bearer session
- confirmed email or phone account
- `X-StayPilot-Idempotency-Key`
- dedicated StayPilot backend configured
- `TENANT_BOOTSTRAP_ENABLED=true`

Client-supplied `user_id` and `role` are ignored. The server derives identity from the verified Supabase session and always creates the first membership as `owner`.

## Rollout gate

Server environment:

```
TENANT_BOOTSTRAP_ENABLED=false
```

Default is false.

Credentials or database availability alone do not enable tenant creation.

Until the flag is true:

```
503 tenant_bootstrap_disabled
```

This lets database/auth infrastructure be staged before any account can create a tenant.

## Transactional RPC

Migration:

```
supabase/migrations/20260924070000_tenant_bootstrap.sql
```

RPC:

```
public.bootstrap_hotel_owner(
  user_uuid,
  idempotency_key,
  hotel_slug,
  hotel_name,
  hotel_timezone,
  hotel_currency
)
```

The RPC is:

- `SECURITY DEFINER`
- revoked from public / anon / authenticated
- executable only by `service_role`
- serialized per user + idempotency key with a Postgres advisory transaction lock

All hotel, Owner membership, rule seed, audit and idempotency writes happen in the same transaction.

## Idempotency

Private table:

```
private.hotel_bootstrap_requests
```

Key:

```
(user_id, idempotency_key)
```

The stored request fingerprint is SHA-256 over the normalized:

- slug
- name
- timezone
- currency

Behavior:

- first request -> creates tenant
- same key + same normalized payload -> returns existing tenant
- same key + different payload -> `409 idempotency_key_reused`
- slug owned by another tenant -> `409 hotel_slug_taken`
- same owned slug with conflicting property fields -> `409 hotel_already_exists`

This prevents a retry key from silently creating or mutating a different property.

## Input normalization

HTTP validation performs:

- slug normalization to lowercase + strict safe pattern
- property name whitespace normalization
- control-character rejection
- real IANA timezone validation using `Intl.DateTimeFormat`
- real currency-code validation using `Intl.NumberFormat`
- idempotency key format validation

The database independently validates the normalized values as a second boundary.

## Safe automation defaults

A newly bootstrapped hotel is created with:

```
automation_paused = true
settings.server_authority = "disabled"
```

All server automation therefore remains globally paused even after the 12-rule catalog is seeded.

Only workflows already supported by the safe durable worker are seeded Active:

- checkout turnover
- room-ready release
- room-conflict guard
- guest-request router
- review recovery

Unsupported or financially sensitive workflows remain Paused, including:

- reservation intake
- pre-arrival messaging
- occupancy rate guard
- failed payment recovery
- low-stock replenishment
- cancellation recovery
- approval executor

An Owner must complete setup/policy review before any future server-authority enablement.

## Audit

The transaction writes a Governance audit event:

```
Hotel bootstrapped
```

with:

- acting authenticated user
- property slug
- 12 seeded automation rules
- `automation_paused=true`

## Production boundary

No dedicated StayPilot Supabase project currently exists.

The public application therefore must continue to report:

- Tenant onboarding: Staged · disabled
- browser-local demo state remains authoritative

Do not reuse unrelated connected Supabase projects.

## CI guarantees

Backend verification covers:

- private bootstrap idempotency state
- advisory transaction lock
- payload-bound fingerprint
- idempotency key reuse rejection
- service-role-only RPC
- authenticated session identity authority
- confirmed-account requirement
- client role/user fields ignored
- valid timezone/currency normalization
- safe automation-paused defaults
- unsupported workflows seeded Paused
- supported safe subset seeded Active
- 409 conflict mappings
- compatibility route delegates to hardened canonical handler
- tenant bootstrap endpoint/modules pass syntax checks

## Activation sequence

Only after explicit approval to provision dedicated infrastructure:

1. create dedicated StayPilot Supabase project
2. apply all migrations
3. run Supabase security advisors
4. create a confirmed test Auth user
5. set `TENANT_BOOTSTRAP_ENABLED=true` in a controlled environment
6. bootstrap one test hotel
7. verify Owner membership/RLS and cross-hotel denial
8. return gate to false if testing is complete
9. continue shadow-mode parity before enabling server automation authority
