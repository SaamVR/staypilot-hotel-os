# Shared Portfolio Supabase Architecture Plan — 2026-09-25

Repository context: SaamVR/staypilot-hotel-os

Status: architecture proposal only. No Supabase project is provisioned or connected by this change.

## 1. Scope and non-goals

This plan implements the decision to use one shared Supabase project for portfolio applications while preserving explicit application and tenant isolation.

In scope:

- StayPilot
- LeadFlow
- future portfolio applications
- shared Auth
- app and tenant membership boundaries
- RLS
- public demo sandboxing/reset
- Cloudflare responsibilities
- secret handling
- migration ownership
- staged rollout
- cost/limit guardrails
- future extraction of a portfolio app into its own Supabase project

Not in scope yet:

- provisioning or connecting a Supabase project
- applying migrations
- enabling StayPilot server authority
- configuring real secrets
- enabling the dormant scheduler
- merging stale PR #24 or #30
- connecting real external providers

## 2. Repository reconciliation

Live StayPilot main at planning start:

- 28220c1b12ffa12dbf1979344c027a13dfb721df — add shared Supabase portfolio planning handoff
- 4bd43c0657247d2b3652b45c15a18159a6d3bbaa — verified team access lifecycle checkpoint
- 632e2301526667a9e0e0b6168ed49e4eed0d28e4 — latest independently verified application release

The newest main commit is documentation-only. The latest verified application release remains 632e230....

PR #24 and PR #30 are still open and non-mergeable/diverged. Their feature families are already represented by newer main code:

- orchestration exists on main under functions/_shared/orchestrator.js
- team lifecycle exists on main under functions/_shared/team.js
- team onboarding migration exists on main as supabase/migrations/20260924080000_team_onboarding.sql
- team access lifecycle exists on main as supabase/migrations/20260924090000_team_access_lifecycle.sql

Do not merge either stale PR into the shared-backend work.

Important compatibility finding: the existing StayPilot core migration is explicitly written for a dedicated Supabase project and places application tables in public. It must not be applied unchanged to the shared project.

## 3. Chosen architecture

Use a hybrid schema model.

~~~text
Supabase project
├── auth                  # Supabase-managed user pool
├── platform              # shared portfolio control plane
├── staypilot             # StayPilot business data
├── leadflow              # LeadFlow business data
├── <future_app>          # one schema per future app
├── private               # shared authorization/helper routines, never browser API surface
├── storage               # Supabase-managed if later needed
└── public                # no portfolio business tables
~~~

Core rule:

- platform tables use app_id where the row is genuinely cross-application.
- StayPilot business tables do not get an app_id column just to prove they are StayPilot; their schema is the application boundary.
- LeadFlow business tables likewise use workspace_id rather than app_id.
- future apps define their own tenant concept rather than being forced into a generic global tenant table.

This avoids a fragile global app_id + tenant_id pattern on every business table.

## 4. Shared platform model

Recommended platform tables:

### platform.applications

Purpose: stable registry of portfolio applications.

Columns:

- id uuid primary key
- slug text unique, e.g. staypilot / leadflow
- display_name
- data_schema
- status
- demo_enabled
- contract_version
- created_at
- updated_at

### platform.app_memberships

Purpose: app admission gate above application-specific tenant membership.

Columns:

- app_id
- user_id -> auth.users
- membership_kind: permanent | demo
- status: active | disabled
- expires_at nullable
- created_at

Primary key: app_id + user_id.

This table does not store StayPilot Owner/Manager/Staff or LeadFlow roles. Those roles remain application-specific.

### platform.demo_sessions

Purpose: lifecycle of public portfolio sandboxes.

Columns:

- id
- app_id
- user_id
- seed_version
- status: active | resetting | expired | deleted
- expires_at
- reset_count
- last_reset_at
- created_at

Application-specific mapping tables attach the demo session to the actual tenant:

- staypilot.demo_sandboxes(demo_session_id, hotel_id)
- leadflow.demo_sandboxes(demo_session_id, workspace_id)

### platform.feature_flags

Server-only flags for staged activation, such as:

- staypilot.live_sandbox_enabled
- staypilot.server_authority_enabled
- staypilot.scheduler_enabled
- leadflow.live_sandbox_enabled
- leadflow.realtime_enabled

Cloudflare environment gates remain the final fail-closed boundary for privileged server features.

### platform.audit_events

Only shared-platform events belong here:

- demo sandbox create/reset/expire
- app-membership lifecycle
- platform admin operations
- backend contract/version changes

StayPilot operational audit remains in staypilot.audit_events. LeadFlow activity remains in leadflow.activity_events.

### platform.secret_references

Metadata only. Never raw credentials.

Suggested fields:

- id
- app_id
- tenant_ref
- provider
- secret_store
- external_ref
- status
- created_at
- rotated_at

For portfolio mode, real provider credentials should normally remain absent.

## 5. Auth model

Use one Supabase Auth user pool for all portfolio apps.

Identity model:

~~~text
auth.users
   |
   +--> platform.app_memberships
           |
           +--> StayPilot admission
           |       |
           |       +--> staypilot.hotel_members
           |               |
           |               +--> owner / manager / staff
           |
           +--> LeadFlow admission
                   |
                   +--> leadflow.workspace_members
                           |
                           +--> owner / operator / viewer
~~~

Rules:

1. Authentication never implies application access.
2. platform.app_memberships grants access to an application.
3. app-specific membership grants access to a tenant and determines the app role.
4. role authority is never accepted from client input.
5. user_metadata is never used for authorization.
6. app_metadata may be used only as a non-authoritative cache/hint; database membership remains source of truth.
7. a signed-in user with no active membership in the requested app receives no application data.
8. app membership and first tenant membership are created transactionally during bootstrap/invite/demo provisioning.

Because Auth configuration is project-global:

- OAuth/email providers are shared infrastructure.
- production redirect URLs must include each authorized app domain.
- every auth flow should pass an explicit redirectTo for the originating app.
- email templates must use RedirectTo semantics rather than assuming one Site URL.
- production redirects should use exact domains; avoid broad wildcard preview-domain allowlists.

## 6. Public demo strategy

Do not use one globally mutable demo tenant.

Use two presentation modes.

### Mode A — deterministic local showcase

The existing browser/local demo remains available and can render even when the backend is unavailable or intentionally disabled.

The UI must label this mode truthfully as local/demo state.

### Mode B — live isolated sandbox

A visitor explicitly launches the live sandbox.

Flow:

~~~text
visitor
 -> Cloudflare Turnstile
 -> Supabase anonymous sign-in
 -> authenticated anonymous user
 -> Cloudflare demo-bootstrap endpoint
 -> platform demo membership
 -> app-specific tenant + membership
 -> deterministic seed
 -> live sandbox
~~~

Anonymous Supabase users use the authenticated Postgres role, so RLS must check the JWT is_anonymous claim where demo users need stricter permissions.

Recommended demo defaults:

- sandbox TTL: 2 hours
- one active sandbox per anonymous user/app
- reset rate: at most once per minute
- deterministic seed_version per app
- cleanup job at least hourly for expired application data
- anonymous auth-user cleanup daily after a short grace period
- hard cap on new sandboxes per IP/session at Cloudflare
- Turnstile required before anonymous sign-in/bootstrap

Reset behavior:

1. verify caller JWT and active demo app membership
2. resolve only that caller's sandbox
3. transactionally clear/reseed application tenant data
4. keep or recreate tenant according to the app's reset contract
5. increment reset_count
6. write platform audit event
7. return new seed/version state

A demo visitor can never reset or mutate another visitor's sandbox.

## 7. RLS trust model

Every table reachable by the Data API has RLS enabled.

RLS is defense in depth even if some traffic is server-mediated.

Shared helper functions belong in private and are not exposed as general browser RPC endpoints.

Conceptual policies:

~~~text
StayPilot row access
 = active platform membership for app=staypilot
 AND active membership in row.hotel_id
 AND role/action allows operation
 AND demo session is not expired when user is anonymous

LeadFlow row access
 = active platform membership for app=leadflow
 AND active membership in row.workspace_id
 AND role/action allows operation
 AND demo session is not expired when user is anonymous
~~~

Security rules:

- TO authenticated alone is never treated as authorization.
- UPDATE policies require both USING and WITH CHECK.
- exposed views use security_invoker where supported.
- SECURITY DEFINER is reserved for narrow membership/bootstrap helpers only.
- SECURITY DEFINER routines use fixed search_path, explicit auth checks, and explicit EXECUTE grants.
- no SECURITY DEFINER routine is left callable by PUBLIC.
- membership mutation is server-only.
- application role changes are server-only and audited.
- no browser path can assign Owner.
- anonymous demo identities cannot use team invitation, webhook-secret, provider-secret, billing, or production-integration surfaces.
- schema names and table names are never derived from user input.

Recommended private helpers:

- private.has_app_access(app_slug)
- private.staypilot_is_hotel_member(hotel_id)
- private.staypilot_has_hotel_role(hotel_id, roles)
- private.leadflow_is_workspace_member(workspace_id)
- private.leadflow_has_workspace_role(workspace_id, roles)
- private.demo_session_active(app_slug)

The implementation should avoid recursive RLS by keeping the underlying control-plane tables server-only and using narrowly scoped helper functions.

## 8. Data API schema exposure

Recommended Data API posture:

- public contains no portfolio business tables.
- platform is exposed only as needed for trusted server Data API access; anon/authenticated receive no general table privileges.
- staypilot is exposed with explicit authenticated grants only for browser-safe operations.
- leadflow is exposed with explicit authenticated grants only for browser-safe operations.
- private is not exposed.
- future schemas are opt-in, never automatically assumed exposed.

Every new table/function requires explicit grants after RLS/policy review.

For client code use schema-aware Supabase clients or per-query schema selection.

StayPilot currently uses a hand-written REST helper that assumes public and reuses one key as both apikey and Bearer token. That helper must be replaced/refactored before connecting the shared project.

## 9. API-key strategy

Start on Supabase's publishable/secret key model.

Per app, use separately named keys where available:

- staypilot-web publishable key
- staypilot-server secret key
- leadflow-web publishable key
- leadflow-server secret key

Important: separate secret keys improve rotation and operational containment, but they all map to elevated service_role behavior and are not a database authorization boundary.

Therefore:

- browser calls use publishable key + user JWT so RLS remains active.
- Cloudflare user-scoped API calls should forward/use the user's access token whenever elevated privileges are not required.
- secret keys are used only for privileged server jobs/bootstrap/integration operations.
- privileged server code must use fixed app schemas and explicit tenant checks.

The current StayPilot helper must not send a new sb_secret key as Authorization: Bearer. New publishable/secret keys are API keys, not JWTs. User JWTs and API keys must be treated separately.

## 10. StayPilot schema adaptation

Do not apply the existing dedicated-project migration unchanged.

Shared-project StayPilot schema should preserve the verified domain model while moving it into staypilot:

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
- team invitations/access lifecycle structures
- durable worker lease/retry/dead-letter structures
- webhook outbox/dispatcher structures

Changes required for shared-project compatibility:

1. move business objects from public.* to staypilot.*
2. rename shared/private helpers with explicit StayPilot scope
3. add platform app-membership gating to RLS
4. add demo-sandbox mapping and expiry enforcement
5. retain hotel_id on all hotel-owned rows
6. keep Event-ID uniqueness scoped to hotel
7. keep Owner/Manager/Staff authority server-derived
8. preserve pause/queue/idempotency semantics
9. preserve webhook SSRF protections
10. tighten membership mutation so browser clients do not directly create/promote/remove members
11. adapt direct REST helpers to custom-schema access and the new API-key model

## 11. LeadFlow application model

LeadFlow currently has deterministic server qualification plus browser-persisted CRM/dashboard state.

Recommended schema:

### leadflow.workspaces

Tenant root.

### leadflow.workspace_members

Roles:

- owner
- operator
- viewer

For the portfolio sandbox, the anonymous user receives a bounded demo membership.

### leadflow.leads

Persist:

- identity/display fields used by the demo
- source
- budget/timeline/need inputs
- qualification score
- classification
- status
- created_at / updated_at

### leadflow.qualification_runs

Persist:

- lead_id
- scoring inputs snapshot
- score
- classification
- contract_version
- duration
- created_at

### leadflow.workflow_definitions

Persist editable workflow-builder state by workspace.

### leadflow.automation_settings

Persist CRM threshold and automation settings currently stored in the browser.

### leadflow.activity_events

Persist observable workflow/dashboard events.

Analytics should be derived from leads/runs/events where practical rather than maintaining mutable duplicate summary tables.

Initial LeadFlow rollout should not connect real CRM credentials. Existing provider selectors remain demonstrative until a real integration is intentionally enabled.

## 12. Cloudflare responsibilities

Cloudflare remains the application/API edge and integration boundary.

### Cloudflare should own

- static Pages delivery
- Pages Functions / Workers API routes
- exact-origin CORS
- Turnstile
- request validation
- HMAC verification for external inbound events
- timestamp/replay checks
- app-specific privileged server authorization
- outbound webhook SSRF/allowlist checks
- scheduled orchestration
- demo bootstrap/reset endpoints
- rate/abuse controls
- server secrets
- fail-closed runtime feature gates
- health/readiness surface

### Supabase should own

- Auth user identities/sessions
- durable Postgres state
- RLS
- tenant memberships
- queues/outbox state
- audit persistence
- demo-session metadata
- optional Realtime
- optional Storage
- optional Vault for tenant-scoped provider secrets later

### StayPilot server path

~~~text
external event
 -> Cloudflare /api/events
 -> signature/replay validation
 -> staypilot.inbound_events
 -> worker claim
 -> policy/action
 -> audit/run
 -> outbox
 -> Cloudflare dispatcher
~~~

n8n / Make / Zapier remain optional downstream consumers, never core dependencies.

### LeadFlow server path

~~~text
demo input
 -> Cloudflare /api/qualify
 -> deterministic qualification
 -> user/workspace authorization
 -> leadflow.leads + qualification_runs + activity_events
 -> dashboard/CRM reads
~~~

## 13. Secret model

### App/platform infrastructure secrets

Store in Cloudflare Secrets / Secrets Store, not plaintext vars and never Git:

- SUPABASE secret keys
- StayPilot event signing secret
- StayPilot worker secret
- StayPilot dispatcher secret
- StayPilot orchestrator secret
- LeadFlow server-only secrets if later introduced
- Turnstile secret where applicable
- any provider API keys shared at app level

Use app prefixes for every environment variable.

Examples:

- STAYPILOT_SUPABASE_SECRET_KEY
- STAYPILOT_EVENT_SIGNING_SECRET
- STAYPILOT_WORKER_SECRET
- STAYPILOT_DISPATCHER_SECRET
- STAYPILOT_ORCHESTRATOR_SECRET
- LEADFLOW_SUPABASE_SECRET_KEY

### Tenant provider credentials

If portfolio demos later connect tenant-owned providers, do not put raw credentials in normal application tables.

Preferred pattern:

- encrypted secret stored in Supabase Vault
- application table stores only secret_ref
- only privileged server code can resolve/decrypt it
- browser roles have no access to vault.decrypted_secrets
- rotation is audited

For the portfolio release, keep real tenant-provider credentials disabled unless needed for a specific demonstration.

## 14. Migration ownership

Create a dedicated repository after architecture approval:

SaamVR/portfolio-backend

It becomes the only canonical owner of remote shared-Supabase migrations.

Suggested structure:

~~~text
portfolio-backend/
  supabase/
    config.toml
    migrations/
    seed/
  tests/
    platform/
    staypilot/
    leadflow/
    cross-app/
  contracts/
    backend-version.json
    staypilot.json
    leadflow.json
  docs/
~~~

Rules:

1. create migrations with the Supabase CLI rather than inventing migration filenames manually.
2. platform migrations run before app migrations.
3. app repositories do not independently apply remote DB migrations.
4. StayPilot's existing supabase/migrations remain historical/staged source material until ported; they are not applied to the shared project.
5. local Supabase in CI is the primary migration/RLS test target before any remote apply.
6. only the backend repo owns the remote migration credential.
7. remote migration runs require a protected GitHub Environment/manual approval.
8. migration application is forward-only and recorded in the Supabase migration ledger.
9. app deployments declare a required backend contract version.
10. backend-health reports current contract version and app readiness.

Recommended CI order:

~~~text
lint SQL
 -> local Supabase boot
 -> apply all migrations
 -> seed deterministic fixtures
 -> platform RLS tests
 -> StayPilot RLS/contract tests
 -> LeadFlow RLS/contract tests
 -> cross-app leakage tests
 -> app API contract tests
 -> produce migration/contract artifact
 -> manual remote approval
~~~

## 15. Mandatory isolation test matrix

Before server authority can be enabled, automated tests must prove:

- StayPilot user cannot read any LeadFlow row.
- LeadFlow user cannot read any StayPilot row.
- StayPilot hotel A member cannot read hotel B.
- LeadFlow workspace A member cannot read workspace B.
- Staff cannot perform Owner-only operations.
- Manager cannot self-promote or create Owner authority.
- anonymous demo user cannot use permanent/team/provider-secret operations.
- expired demo user cannot read/write sandbox rows.
- one demo user cannot reset another user's sandbox.
- unauthenticated anon role has no business-table access.
- app_memberships cannot be forged from the browser.
- direct IDs from another tenant produce zero authorized rows, not data leakage.
- exposed views preserve RLS.
- privileged RPCs are not executable by PUBLIC.
- server endpoints fail closed when secrets/backend flags are missing.

## 16. Staged rollout

### Phase 0 — architecture freeze

Current phase.

Deliverables:

- approve this model
- no Supabase connection
- no migration apply
- no production secret changes

### Phase 1 — canonical backend repo + local-only proof

After approval:

- create portfolio-backend repo
- initialize Supabase locally
- implement platform schema
- implement StayPilot shared-schema port
- implement LeadFlow schema
- build RLS/cross-app tests
- build seed/reset tests
- no remote Supabase required

Exit gate: local test suite proves app/tenant isolation.

### Phase 2 — connect the one shared Supabase project

Only after user provides access:

- link the approved shared project
- create named publishable/secret keys
- configure exposed schemas/grants
- configure Auth redirects
- configure Turnstile/CAPTCHA
- apply platform + app migrations
- seed application registry
- keep all app server-authority feature flags OFF

Exit gate: remote schema/advisors/contract checks pass; public sites still operate in local demo mode.

### Phase 3 — StayPilot live sandbox

Order:

1. backend health only
2. anonymous Auth + isolated demo bootstrap
3. read-only live tenant load
4. rooms/reservations/tasks/approvals server authority inside sandbox
5. automation rules and audit/run persistence
6. signed event ingest
7. durable worker
8. webhook outbox/dispatcher
9. permanent auth + tenant bootstrap
10. team invitations/access lifecycle
11. scheduler only after all prior gates pass

Do not dual-write the same authoritative state indefinitely. Local demo and live sandbox are separate modes.

### Phase 4 — LeadFlow live sandbox

Order:

1. anonymous Auth + workspace sandbox
2. persist leads and qualification runs
3. CRM/dashboard reads from Supabase
4. persist thresholds/automation settings
5. persist workflow builder
6. persist activity events
7. optional Realtime only if it materially improves the demo
8. permanent auth only if portfolio presentation needs it
9. real external CRM/provider integration remains a separate opt-in

### Phase 5 — future portfolio-app onboarding contract

Every new app must supply:

- stable app slug
- dedicated Postgres schema
- tenant root table
- tenant membership table
- role model
- RLS helper/policy suite
- demo seed version
- demo reset/cleanup implementation
- app-prefixed Cloudflare secret namespace
- backend contract version
- cross-app isolation tests
- extraction plan

No future app may add unscoped business tables to public.

## 17. Cost and limit posture

### Supabase Free during build

Current documented Free limits include approximately:

- 500 MB database per project
- 5 GB egress
- 50,000 MAU
- 1 GB Storage
- 2 million Realtime messages
- 200 peak Realtime connections
- 500,000 Edge Function invocations

The important portfolio risk is inactivity pausing: Free projects can be paused after low activity over a 7-day period.

Therefore:

- Free is acceptable for build/validation.
- the static/local portfolio must continue to work if Supabase is paused.
- if the portfolio is being actively shown to clients and live sandbox uptime matters, move the shared project to Pro.

Current Pro starts at $25/month and includes one Micro compute credit, 8 GB database disk per project, 250 GB egress, 100,000 MAU and daily backups.

### Cloudflare

Current Workers Free limits include:

- 100,000 requests/day
- 10 ms CPU time per HTTP invocation
- 5 Cron Triggers/account
- 128 MB memory

Network wait time is not CPU time.

Workers Paid currently starts at $5/month and raises request/CPU allowances.

For portfolio traffic, begin on Free and measure. Upgrade only if authentication/crypto/server processing actually pushes CPU/request limits.

Turnstile Free supports unlimited challenges for typical portfolio use.

### Realtime

Do not enable Realtime everywhere by default.

Use it only where it improves the visible product experience, e.g. a live LeadFlow operations feed or StayPilot exception updates. Normal CRUD should not depend on Realtime.

## 18. One-project risk and graduation criteria

One shared project is appropriate for portfolio demonstrations, but not the permanent home of unrelated real client production systems.

Graduate an app to a dedicated Supabase project when any of these becomes true:

- it stores real client operational or sensitive data
- it requires independent uptime/SLA
- it requires app-specific Auth provider or email-branding control
- it needs independent billing/quotas
- it creates noisy-neighbor load
- it requires stronger server-secret isolation than one shared service_role trust boundary can provide
- it requires different region/compliance rules
- it consumes a material share of shared DB/egress/MAU capacity

The schema-per-app design makes this migration substantially easier: export the app schema, recreate Auth/membership mapping, move secrets, switch Cloudflare environment bindings, validate, then cut over.

## 19. Recommended decisions to freeze

1. One remote Supabase project for portfolio apps.
2. Hybrid schemas: platform + one schema per app + private.
3. One Auth user pool.
4. platform app membership plus application-specific tenant membership.
5. No app_id column on every business table.
6. No generic global tenant table.
7. Anonymous Auth only for explicit live demo sandboxes.
8. Deterministic local demo remains a fallback.
9. Turnstile before anonymous demo creation.
10. RLS on every Data-API reachable table.
11. No browser membership/role authority.
12. Cloudflare remains ingress/egress/scheduler/secret boundary.
13. New Supabase publishable/secret keys from day one.
14. Supabase Vault only for dynamic tenant provider secrets if/when required.
15. Dedicated portfolio-backend repository owns all shared DB migrations.
16. Existing StayPilot migrations are source material, not remote shared-project migrations.
17. StayPilot migrates first, LeadFlow second.
18. Realtime is opt-in, not foundational.
19. Public schema contains no portfolio business data.
20. Any real-client app graduates out of the shared portfolio project.

## 20. External references checked for this plan

Supabase:

- https://supabase.com/docs/guides/api/using-custom-schemas
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/auth-anonymous
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/database/vault
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://supabase.com/changelog?types=breaking-change

Cloudflare:

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.cloudflare.com/turnstile/plans/

## 21. Implementation gate

Do not connect or provision Supabase until this architecture is approved.

After approval, the next action is Phase 1 only: create the canonical portfolio-backend repository and prove the entire schema/RLS/demo-reset model against local Supabase before touching the remote shared project.
