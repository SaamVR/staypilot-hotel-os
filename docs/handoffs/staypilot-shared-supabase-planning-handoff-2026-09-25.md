# StayPilot + Shared Portfolio Backend Planning Handoff — 2026-09-25

Repository: `SaamVR/staypilot-hotel-os`

This handoff is the canonical starting point for the **next planning chat**.

Do not restart the product audit from scratch.
Do not provision Supabase yet.
Do not reuse an existing unrelated Supabase project.

---

## 1. New user decision — shared Supabase portfolio backend

The user has decided that **one Supabase project will be used to showcase all portfolio projects/sites**.

This supersedes the earlier assumption that StayPilot would necessarily receive a dedicated Supabase project.

The user will provide access **after the architecture/plan is finalized**.

Until that planning is approved:

- do not create a Supabase project
- do not apply migrations to any existing project
- do not configure production secrets
- do not enable server authority
- do not reuse the existing CMS Supabase project
- do not reuse the inactive Booking Agent Supabase project
- keep all currently deployed server features fail-closed

### Planning implication

The next chat must design a **shared portfolio backend platform** that can host multiple demo products while preserving strict project/tenant isolation.

The architecture must distinguish at least:

1. portfolio project/application identity
2. hotel/business tenant identity inside an application
3. authenticated user identity
4. role/membership authority
5. application-specific tables/events
6. shared platform services such as auth, audit, demo reset, observability and secrets

Do not simply add a `project_id` column everywhere without auditing isolation and RLS semantics.

---

## 2. Exact StayPilot repository state

Current `main`:

```
4bd43c0657247d2b3652b45c15a18159a6d3bbaa
add verified team access lifecycle checkpoint
```

The current `main` commit is documentation-only.

Latest verified **application release**:

```
632e2301526667a9e0e0b6168ed49e4eed0d28e4
Merge secure team access lifecycle
```

Verified staged release from the latest application checkpoint:

```
35ac0049358291053a476e7bc1a153790ca69df1
```

Verified preview from that checkpoint:

```
https://405fcbf9.staypilot-hotel-os.pages.dev
```

Canonical:

```
https://staypilot-hotel-os.pages.dev/
```

Current `cloudflare-deploy` branch:

```
1cf11a2bdaa49765d6a8f622659c45dead5c47b8
stage Cloudflare bundle for 4bd43c0657247d2b3652b45c15a18159a6d3bbaa
```

Because `4bd43c0` is docs-only, do not confuse the current `main` SHA with the last independently browser-QA'd application code release.

---

## 3. Current Portfolio repository state

Repository:

```
SaamVR/Portfolio
```

Current `main` at handoff creation:

```
28250fdff0a26408c6dbfba4ffa3c5cc234f2da1
document full CRM operations dashboard release
```

This repo has continued evolving independently, including LeadFlow/CRM work.

StayPilot is Portfolio Work #2.

When planning the shared Supabase backend, treat `SaamVR/Portfolio` as the portfolio presentation shell, not as the only application requiring backend isolation.

---

## 4. StayPilot product position

StayPilot is now:

> A policy-aware hotel automation and operations OS for independent hotels.

Core proposition:

> One hotel state. Every person, channel and automation works from it.

Commercial wedge:

> Keep the hotel systems already in use, normalize their events, automate repetitive work between them, and surface only exceptions/approvals requiring human judgment.

It is not positioned as merely:
- an AI concierge
- a generic PMS dashboard
- an n8n dashboard
- an OTA clone

n8n / Make / Zapier remain **optional downstream integration consumers**, never core runtime dependencies.

---

## 5. Verified frontend/product capabilities

### Hotel state

Multi-dimensional room state:

- occupancy
- housekeeping
- maintenance

Derived sellability uses all three dimensions.

### Front desk

- 7-day room tape/calendar
- reservations
- assignment queue
- reservation drawer
- check-in / checkout guards
- cancellation recovery
- folio/payment modeling

### Owner / Manager authority

- Owner dashboard / command center
- Manager shift dashboard
- role-aware navigation
- Owner-configured Manager capabilities
- rate/refund/purchase authority thresholds
- Owner-only governance

### Automation

12 workflow catalog:

1. Reservation intake
2. Checkout turnover
3. Pre-arrival messaging
4. Occupancy rate guard
5. Failed payment recovery
6. Low-stock replenishment
7. Cancellation recovery
8. Room-ready release
9. Room conflict guard
10. Guest request router
11. Approval executor
12. Review recovery

Automation model:

```
hotel event
  -> shared hotel context
  -> automation rule
  -> autonomy/policy check
  -> stateful action
  -> exception/approval
  -> execution trace + audit
```

Autonomy modes:

- Auto
- Policy
- Approval
- Suggest

### Automation trust layer

Implemented and previously production-QA'd:

- global Owner automation pause
- discrete-event queueing while paused
- state-trigger defer/re-evaluate
- Event-ID duplicate suppression
- paused-queue dedupe
- execution history
- run inspector
- Run ID
- inbound Event ID
- scope/autonomy
- step trace
- idempotency proof
- contextual route to Exceptions / Approval Center / Guest Inbox

### Integration Hub

Portfolio surfaces for:

- PMS bridge
- OTA channels
- payments
- accounting
- WhatsApp/messaging
- marketing
- built-in Webhooks/REST
- inbound event lab
- Event-ID replay proof
- server readiness signals

---

## 6. Staged server-side foundation already implemented

Important: these are **deployed/staged contracts**, but server authority is intentionally fail-closed because no real Supabase backend/secrets are configured.

### Multi-tenant schema / RLS

Initial production schema includes:

- hotels
- hotel_members
- rooms
- reservations
- tasks
- approvals
- automation_rules
- inbound_events
- automation_runs
- webhook_endpoints
- webhook_deliveries
- audit_events

Security direction:

- RLS on exposed public tables
- authenticated hotel membership checks
- Owner / Manager / Staff separation
- service-role-only server-control functions
- browser cannot self-promote to Owner

### Signed inbound events

Endpoint:

```
POST /api/events
```

Contract includes:

- HMAC-SHA256 signature
- timestamp replay window
- Event ID
- hotel ID
- event type
- payload hash
- database uniqueness/idempotency
- fail-closed if backend is not configured

### Durable worker

Server-only:

```
POST /api/worker-run
```

Implemented design:

- `FOR UPDATE ... SKIP LOCKED`
- stale processing lease recovery
- bounded retries
- dead-letter lifecycle
- Event-ID idempotent effects
- separate `WORKER_SECRET`

Safe staged server handlers include non-financial operations such as:

- guest request → task
- negative review → recovery task
- housekeeping complete → room clean
- maintenance block → out-of-order
- checkout → Vacant + Dirty + turnover task

Financial/revenue events are intentionally not guessed server-side.

### Outbound webhook outbox

Architecture:

```
hotel event
 -> automation
 -> run/audit
 -> durable outbox
 -> dispatcher
 -> optional consumer
```

Outbox behavior includes:

- endpoint + Event-ID dedupe
- subscription filtering
- active endpoint filtering
- service-role-only enqueue

### Safe webhook dispatcher

Staged design includes:

- verified endpoints
- exact verified host
- server-managed signing secret reference
- HTTPS only
- no URL credentials
- no non-443 port
- no localhost/internal names
- no IP literals
- no redirects
- HMAC-signed body
- host allowlist
- `DISPATCHER_SECRET`
- atomic delivery claims
- bounded retry/backoff
- dead-letter behavior

Server endpoint:

```
POST /api/webhook-dispatch-run
```

### Server orchestration

Pages control plane:

```
POST /api/orchestrate-run
```

Separate Cloudflare Cron Worker template exists for future scheduling.

Double-enable safety:

- `ORCHESTRATOR_SECRET`
- `ORCHESTRATOR_ENABLED`
- `SCHEDULER_ENABLED`

Cron Worker itself is not deployed/enabled.

### Secure tenant bootstrap

Endpoints:

```
POST /api/tenant-bootstrap
POST /api/hotels/bootstrap
```

Contract:

- authenticated confirmed account
- server-derived user identity
- creates hotel + first Owner membership transactionally
- seeds default automations
- Governance audit
- idempotency/fingerprint
- automation starts paused
- server authority disabled by default
- no provider automatically activated

### Team onboarding

Staged endpoints:

```
GET  /api/team/invitations?hotel_id=<uuid>
POST /api/team/invitations
POST /api/team/invitations/accept
POST /api/team/invitations/revoke
```

Security:

- Owner-only create/list/revoke
- Manager/Staff only invite roles
- hashed single-use expiring tokens
- acceptance requires authenticated confirmed matching email
- role comes from server-side invitation
- transactional membership creation
- Governance audit

### Team access lifecycle

Staged endpoints:

```
GET  /api/team/members?hotel_id=<uuid>
POST /api/team/members/role
POST /api/team/members/remove
```

Rules:

- confirmed Owner required
- Manager <-> Staff mutable
- Owner role cannot be assigned through generic route
- Owner cannot mutate/remove own Owner authority
- Manager/Staff removal transactional + audited

---

## 7. Current production authority boundary

No live Supabase project is connected to StayPilot.

No real server secrets are configured.

The deployed backend remains intentionally fail-closed.

The latest verified checkpoints reported backend readiness similar to:

- dedicated database: not provisioned
- inbound HMAC: not configured
- worker auth: not configured
- dispatcher auth: not configured
- orchestration: not configured
- tenant bootstrap: staged/disabled
- team onboarding/access: staged/disabled
- event ingestion: rejects requests

Browser-local demo state remains authoritative.

Do not claim:
- live Supabase hotel state
- live production authentication
- live server worker execution
- live external webhook delivery
- live production team membership mutation

---

## 8. Stale/superseded open PR warning

Two old PRs are still open but are non-mergeable and their functionality is already represented by newer verified `main` work:

### PR #24

```
Add bounded scheduler orchestration
head: feature/scheduler-orchestration-20260924
```

Status at handoff:

- open
- mergeable: false
- stale/superseded by later orchestration/server work on main

Do not merge blindly.

### PR #30

```
Merge verified secure team invitations
head: release/team-invitations-verified-20260924
```

Status at handoff:

- open
- mergeable: false
- stale/superseded by later team-onboarding/access work on main

Do not merge blindly.

The next execution chat may close them after verifying no unique commits are missing.

---

## 9. Shared Supabase planning problem for the next chat

The next chat should be **planning-first**.

The user will provide Supabase access only after the architecture is agreed.

The plan must answer these questions before any provisioning:

### A. Shared-project isolation model

Decide how one Supabase project will host multiple portfolio applications.

Options to evaluate:

- one `portfolio_apps` registry + `app_id` on shared platform tables
- separate Postgres schemas per portfolio application
- hybrid: shared `platform` schema + app-specific schemas
- separate auth identities with app memberships
- how RLS prevents cross-app and cross-tenant leakage

Recommended direction to evaluate carefully:

```
auth.users
  -> platform.app_memberships
  -> portfolio application
  -> application tenant membership
  -> application-specific resources
```

StayPilot itself then retains:

```
app = staypilot
  -> hotel
  -> hotel_members
  -> hotel-owned records
```

A different portfolio app may use:

```
app = leadflow
  -> workspace/account
  -> workspace_members
  -> CRM-owned records
```

Do not assume every portfolio app has the same tenant model.

### B. Schema strategy

Plan whether to use:

- `platform` schema for shared services
- `staypilot` schema
- `leadflow` schema
- future app schemas

Consider Supabase Data API exposure, RLS ergonomics, migrations, Edge/Pages Functions, and maintainability.

### C. Authentication

Plan:

- one Supabase Auth user pool for all portfolio apps
- app-specific membership/role rows
- demo identities
- Owner/Manager/Staff for StayPilot
- CRM roles for LeadFlow
- no role trust from client input
- no accidental login into an app without membership

### D. Shared services

Candidates for central `platform` tables/services:

- applications registry
- app memberships
- demo reset/version
- audit envelope
- rate limits
- feature flags
- secret references (not raw secrets)
- demo/session telemetry
- shared webhook ingress registry if appropriate

Do not over-generalize application business data.

### E. Demo reset / portfolio safety

Critical requirement:

Public portfolio visitors must not permanently corrupt shared demo data.

Plan one or more of:

- per-session demo namespace
- resettable seeded tenant
- ephemeral demo tenant
- write sandbox
- periodic reset
- read-only default + explicit interactive sandbox

This is especially important when one Supabase project powers all portfolio demos.

### F. Cost / limits

Before provisioning, estimate:

- one shared Supabase project's database/storage/bandwidth/Auth limits
- expected traffic from all portfolio sites
- Cloudflare Pages/Workers request load
- realtime usage if any
- how free/paid limits affect the portfolio
- whether one project is still appropriate if a demo becomes a real client product

### G. Secrets

Shared Supabase does not mean shared provider secrets.

Plan server-side secret namespaces by app:

```
STAYPILOT_...
LEADFLOW_...
<future-app>_...
```

Per-tenant external-provider secrets should remain in a real secret manager/vault pattern or encrypted reference layer, not exposed to clients.

### H. Migration/repository ownership

Plan:

- where the canonical shared-platform migrations live
- how app-specific migrations are versioned
- whether to create a dedicated `portfolio-backend` repository or keep migrations in each app repo
- CI ordering
- backward compatibility between deployed demos and shared backend versions

Do not implement until this ownership model is agreed.

---

## 10. Recommended next-chat agenda

The next chat should begin by reading this handoff in full, then produce a concrete architecture/rollout plan.

Suggested sequence:

1. inventory every portfolio app that will use shared Supabase
2. define shared versus app-specific backend concerns
3. choose schema/isolation model
4. define Auth + app membership + tenant membership
5. define RLS trust boundaries
6. define demo/reset strategy
7. define migrations/repository ownership
8. define Cloudflare Pages/Worker to Supabase responsibilities
9. define secret/environment naming
10. define staged migration of StayPilot from localStorage to server authority
11. define LeadFlow migration
12. define future-app onboarding contract
13. estimate cost/limits
14. produce architecture diagram + migration roadmap
15. only then request/use Supabase access

---

## 11. Do not regress product principles

- StayPilot core automation must not depend on n8n/Make/Zapier.
- Keep provider/integration claims truthful.
- Keep Owner/Manager/Staff authority server-derived when backend authority is enabled.
- Keep Event-ID idempotency.
- Keep automation pause/queue semantics.
- Keep human approval boundaries.
- Keep webhook SSRF protections.
- Keep fail-closed rollout gates.
- Keep browser portfolio usable while server migration is incomplete.
- Keep application/tenant isolation explicit in the shared Supabase design.
- Do not turn a portfolio demo into a multi-app data-leak risk for convenience.

---

## 12. Exact prompt for the next chat

Use:

```
Continue planning the portfolio backend from this durable handoff:

Repository:
SaamVR/staypilot-hotel-os

Read in full:
docs/handoffs/staypilot-shared-supabase-planning-handoff-2026-09-25.md

Important new decision:
We will use ONE shared Supabase project to showcase all portfolio sites/apps.
Do NOT provision or connect Supabase yet. I will provide access only after the architecture plan is finalized.

Do not restart the StayPilot audit.
Do not redo already verified automation/backend/security work.
Do not merge stale PR #24 or #30 blindly.

First design the shared Supabase architecture for multiple portfolio applications with strict app/tenant isolation, Auth/RLS, demo reset strategy, migration ownership, Cloudflare responsibilities, secrets, cost/limits and staged rollout.

StayPilot current main:
4bd43c0657247d2b3652b45c15a18159a6d3bbaa

Latest verified StayPilot application release:
632e2301526667a9e0e0b6168ed49e4eed0d28e4

Portfolio repository:
SaamVR/Portfolio

Current Portfolio main at handoff:
28250fdff0a26408c6dbfba4ffa3c5cc234f2da1
```
