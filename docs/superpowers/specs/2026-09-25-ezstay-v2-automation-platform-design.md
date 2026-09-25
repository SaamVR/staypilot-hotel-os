# EZStay V2 — Automation-First Hotel Operations Platform Design

Date: 2026-09-25  
Repository: `SaamVR/staypilot-hotel-os`  
Design branch: `v2/ezstay`  
Status: design freeze candidate — implementation must not begin until this written spec is reviewed and approved.

## 1. Product intent

EZStay V2 is the automation-first evolution of StayPilot.

It is not a broader PMS clone and not a cosmetic rebrand. The hotel domain exists to make business automation observable, testable, and credible.

Primary portfolio promise:

> A real interactive hotel-operations automation system where business events trigger policy-aware workflows, state changes, approvals, delivery/retry behavior, and auditable execution.

The visitor should leave understanding that the system can:

- receive or generate a business event;
- resolve contextual hotel state;
- evaluate an automation rule;
- apply autonomy/policy/approval boundaries;
- mutate durable business state;
- simulate or deliver an external side effect safely;
- preserve failures without undoing the business action;
- retry delivery without repeating the business action;
- expose a trace of what happened and why.

StayPilot V1 remains available as the broader predecessor. EZStay V2 gets a separate Cloudflare Pages deployment and a dedicated development line.

## 2. Scope and non-goals

### In scope for V2

1. automation-first presentation and workspace;
2. isolated public demo sandboxes;
3. durable backend state;
4. four flagship automation scenarios;
5. one advanced scheduled/escalation scenario;
6. approval and policy boundaries;
7. idempotency and duplicate-event protection;
8. failure/retry separation;
9. execution evidence and linked records;
10. shared Supabase portfolio backend compatibility;
11. strict cross-app and cross-tenant isolation;
12. Cloudflare control plane and scheduled execution;
13. deterministic demo reset and canonical sample data;
14. mobile-accessible, sellable portfolio presentation.

### Explicit non-goals for V2 launch

- replacing a commercial PMS;
- live OTA, payment, accounting, or WhatsApp credentials;
- making n8n/Make/Zapier part of the core runtime;
- adding Cloudflare Queues before the current Postgres queue proves insufficient;
- broad AI features before deterministic automation is complete;
- migrating every StayPilot screen unchanged;
- provisioning Supabase before project access is explicitly provided;
- merging stale PR #24 or #30 into V2 without commit-level proof of unique value.

## 3. Reuse boundary from StayPilot

The following StayPilot contracts are conceptually reusable:

- signed inbound event contract;
- Event-ID duplicate suppression;
- durable event queue;
- `FOR UPDATE SKIP LOCKED` worker claim pattern;
- bounded retries and dead-letter states;
- global automation pause semantics;
- autonomy modes: Auto / Policy / Approval / Suggest;
- durable outbox;
- failure-safe webhook dispatcher concepts;
- orchestration contract;
- audit/execution-history concepts;
- secure bootstrap and membership principles.

The following StayPilot implementation assumptions are not reusable unchanged:

- business tables in `public`;
- migrations that say “dedicated Supabase project only”;
- browser-local state as authority;
- a global Supabase REST key as the server runtime authority;
- generic `/rest/v1` access without app/schema boundaries;
- cross-tenant relationships protected only by application code;
- portfolio-facing screens that overemphasize backend-readiness scaffolding;
- inconsistent hardcoded demo metrics.

## 4. System architecture

### 4.1 High-level flow

```text
Browser
  |
  v
EZStay Cloudflare Pages
  |
  +--> safe browser reads through EZStay API surface + RLS
  |
  +--> /api/* Pages Functions
            |
            v
      private EZStay runtime Worker
            |
            +--> business commands
            +--> automation worker
            +--> scheduler entrypoint
            +--> delivery/retry
            +--> demo bootstrap/reset
            |
            v
         Hyperdrive
            |
            v
  Shared Supabase Postgres/Auth
```

Cloudflare owns ingress, presentation, abuse controls, orchestration, and external delivery behavior.

Supabase/Postgres owns durable identity, relational state, tenant boundaries, transactions, automation queue state, and audit data.

## 5. Shared Supabase model

One Supabase project is shared by portfolio applications.

The shared project is not treated as one shared application.

### Schemas

```text
auth             Supabase-managed identity
platform         shared internal portfolio services
private          non-exposed helper/security functions
ezstay           internal EZStay domain tables
ezstay_api       exposed, deliberate browser API surface
leadflow         internal LeadFlow domain tables
leadflow_api     exposed LeadFlow API surface
<future_app>     internal domain
<future_app>_api exposed app API surface
```

`public` is minimized and must not become the default home for portfolio business tables.

Internal schemas are not exposed through the Data API by default.

### Shared platform tables

Only genuinely shared concepts belong in `platform`, initially:

- `applications`;
- `app_memberships` where platform-level access is required;
- `demo_sessions`;
- `seed_versions`;
- `backend_releases`;
- optional app-scoped feature-flag metadata;
- optional secret-reference metadata, never raw provider secrets.

Do not create generic cross-product business tables such as `platform.tasks`, `platform.customers`, or `platform.events`.

## 6. Runtime authority and secrets

### Rejected model

EZStay runtime must not contain a global Supabase `service_role` key that can reach LeadFlow and future apps.

The service role bypasses RLS and therefore creates unacceptable cross-app blast radius in a shared portfolio project.

### Final model

Create a restricted database runtime role for EZStay, conceptually:

`ezstay_runtime`

It may:

- access only the EZStay internal objects required by server workflows;
- execute specifically granted routines;
- never reach LeadFlow business objects;
- never be shipped to the browser.

Normal browser data access uses Supabase Auth + publishable key + explicit grants + RLS against the `ezstay_api` surface.

Admin/project-level credentials are reserved for migration/admin CI only.

Provider secrets remain app-scoped in Cloudflare server secrets:

- `EZSTAY_...`
- `LEADFLOW_...`
- future-app namespaces.

Per-tenant integration secrets are represented by opaque references in Postgres, not raw secrets in browser-readable rows.

## 7. Authentication and demo identity

Landing-page visitors do not automatically create Supabase users.

Flow:

```text
visit marketing page
  -> no Auth user
  -> click Explore interactive demo
  -> Turnstile / abuse check
  -> anonymous Supabase Auth
  -> create or resume isolated EZStay demo session
```

Anonymous users receive real Auth identities but must be distinguishable from permanent users through authorization policy.

The public demo must never rely on client-provided role claims or editable user metadata for authority.

## 8. Demo-session model

`platform.demo_sessions` is first-class.

Required fields include the equivalent of:

- session ID;
- application ID;
- auth user ID;
- tenant ID;
- seed version;
- active persona;
- status;
- started time;
- expiry time;
- last activity time;
- demo business time;
- reset generation/count.

Each public visitor receives an isolated tenant.

One visitor cannot read or mutate another visitor’s tenant.

A LeadFlow identity cannot use the same session to access EZStay resources unless an explicit EZStay relationship exists.

### Expiry

Workspace access and Auth retention are separate concerns.

An expired demo session immediately becomes inaccessible even if the Auth identity still exists.

Expired sandbox data is cleaned up on a scheduled retention policy.

## 9. Canonical demo data

EZStay uses one versioned authoritative fixture:

`northstar-v2`

It contains internally consistent:

- hotel settings;
- rooms and room types;
- guests;
- reservations;
- guest requests;
- tasks;
- inventory;
- automation rules;
- approval policies;
- historical automation runs;
- one pending approval;
- one deliberately failed delivery.

Frontend metrics must be derived from fixture/domain rows, not separately hardcoded.

Seed integrity tests must prove:

- referenced rooms exist;
- reservation room types match room assignments;
- cross-hotel references cannot be created;
- occupancy-derived metrics reconcile;
- linked tasks/requests/runs exist;
- inventory never starts invalid;
- displayed dashboard KPIs reproduce from source records.

## 10. Dual-clock model

EZStay separates:

- actual execution/audit timestamp;
- effective hotel/demo business time.

This allows deterministic scheduled demonstrations without falsifying the audit record.

Example:

```text
demo time 10:30
task due 10:50
visitor advances demo clock to 11:00
overdue automation evaluates
manager exception created
audit records actual server execution time + effective demo time
```

## 11. Tenant integrity

Every EZStay business resource is hotel-scoped.

Tenant safety must be enforced in database structure, not only in code.

Where a child references a tenant-owned parent, use tenant-safe relationships such as:

```text
rooms UNIQUE (hotel_id, id)

reservations
  FOREIGN KEY (hotel_id, room_id)
  REFERENCES rooms(hotel_id, id)
```

Apply the same principle to:

- task -> reservation;
- task -> room;
- guest request -> reservation;
- approval -> purchase request;
- automation run -> inbound event/rule;
- delivery -> automation run/endpoint.

Index all foreign keys and columns used by membership/RLS predicates.

## 12. RLS and browser API

Browser-accessible objects live behind a deliberate `ezstay_api` surface.

Rules:

- grants and RLS are both explicit;
- no exposed table/view without RLS-equivalent protection;
- membership checks are indexed;
- `auth.uid()`/JWT helpers are used in performance-safe patterns;
- views must use invoker-safe behavior where appropriate;
- security-definer helpers live only in non-exposed schemas;
- security-definer functions set an explicit safe search path and use schema-qualified objects;
- client roles receive minimum grants;
- cross-app negative tests are mandatory.

Required authorization matrix includes:

| Actor | Own EZStay tenant | Other EZStay tenant | LeadFlow |
|---|---|---|---|
| signed out | deny | deny | deny |
| EZStay anonymous user | allowed scope | deny | deny |
| EZStay permanent member | role-based | deny | deny |
| LeadFlow user | deny | deny | own LeadFlow only |
| EZStay runtime role | required EZStay scope | controlled | deny |

## 13. Automation runtime

Canonical event lifecycle:

```text
event received
  -> validation/idempotency
  -> queued
  -> context resolution
  -> rule match
  -> policy/autonomy decision
  -> business transaction
  -> durable run evidence
  -> external/simulated delivery
  -> completion/retry/dead-letter
```

Database queue remains the initial durable work queue.

Worker claims use short transactions and `FOR UPDATE SKIP LOCKED`.

Do not hold database locks during outbound HTTP calls.

Cloudflare Queues are deferred until there is a measured reason to introduce another queueing system.

## 14. Idempotency model

Idempotency is required at multiple layers.

### Inbound events

Unique within tenant:

`(hotel_id, event_id)`

### Automation effects

Business effects use stable source-event references/unique constraints so replay cannot create duplicate tasks, approvals, or runs.

### User commands

Mutation endpoints accept a command/idempotency key.

Double-clicking or retrying:

- Approve;
- Checkout;
- Reset;
- Retry delivery;
- Start scenario

must not produce duplicate effects.

### Delivery retry

Retrying external delivery is separate from retrying the business transaction.

A successful task creation remains committed when notification delivery fails.

## 15. Core showcase scenarios

### Scenario A — Guest request -> assigned task

Trigger:
Guest requests towels/pillows/cleaning.

System proves:

- request validation;
- reservation/room lookup;
- category/team resolution;
- task creation;
- acknowledgement/delivery record;
- automation run;
- linked request/task/room evidence;
- refresh persistence;
- duplicate suppression.

### Scenario B — Checkout -> room ready

Trigger:
Guest checkout.

System proves:

- stay closure;
- room -> Vacant + Dirty;
- turnover task;
- housekeeping completion;
- room -> Clean;
- readiness/sellability recalculation;
- linked automation trace.

### Scenario C — Low stock -> approval -> purchase draft

Trigger:
Inventory below threshold.

System proves:

- threshold evaluation;
- recommended quantity;
- spend-policy decision;
- approval request;
- human resolution;
- purchase draft creation;
- no inventory increase until receipt.

### Scenario D — Failure -> safe recovery

Trigger:
Business action succeeds, external/demo delivery fails.

System proves:

- business action remains committed;
- delivery failure is visible;
- retry attempts only delivery;
- original task/reservation/event is not duplicated;
- final trace contains both failure and recovery.

### Advanced scenario — overdue escalation

Uses deterministic demo clock.

System proves scheduled evaluation and one-time escalation without waiting real time.

## 16. Automation evidence model

Persist first-class evidence rather than a single opaque JSON timeline.

Required concepts:

- `automation_runs`;
- `automation_run_steps`;
- `automation_run_links`;
- `deliveries`;
- `audit_events`.

Run inspector sections:

1. Summary
2. Input
3. Decision
4. Changes
5. Delivery
6. Audit
7. Linked records

Every visible “success” action should lead to the actual resulting record whenever practical.

## 17. Cloudflare responsibilities

### Pages

- static presentation and application assets;
- same-origin user experience.

### Pages Functions

Thin gateway only:

- parse request;
- validate Auth/session;
- Turnstile or abuse checks where needed;
- request size/type validation;
- request/trace ID;
- forward privileged commands through a Service Binding.

### Private EZStay runtime Worker

- business commands;
- automation processing;
- demo bootstrap/reset;
- scheduler entrypoint;
- delivery/retry;
- app-scoped database access.

### Cron

Invokes bounded scheduled processing.

No public scheduler secret endpoint is required when a private service binding can satisfy the execution path.

### Hyperdrive

Preferred connection layer for restricted Postgres runtime role once live backend access is provided.

## 18. Demo reset

Reset is transactional and version-aware.

Requirements:

- affects only current sandbox;
- cannot expose/reuse another visitor’s tenant;
- does not leave half-seeded state;
- preserves canonical seed integrity;
- increments/reset-generates the session;
- is idempotent for accidental retries;
- stale generation becomes inaccessible immediately;
- stale generation can be cleaned asynchronously.

A safer implementation is to seed the replacement tenant/generation successfully before switching the active session pointer.

## 19. Abuse and lifecycle controls

Public demo protections:

- Turnstile on sandbox creation and abuse-sensitive entrypoints;
- Cloudflare/app rate limits;
- per-demo quotas for events, runs, resets, and delivery retries;
- payload size limits;
- no real payment/card/provider credentials;
- sample-data-only guidance on free text;
- sandbox expiry;
- anonymous-user cleanup policy;
- scheduled stale-data cleanup.

## 20. Observability

Every server request receives a trace/request ID propagated through:

```text
gateway
 -> command
 -> inbound event
 -> automation run
 -> run steps
 -> delivery
 -> audit
```

The technical panel may expose safe identifiers such as:

- Request ID;
- Event ID;
- Run ID;
- delivery attempt ID;
- idempotency status.

No secret material appears in traces.

## 21. Frontend information architecture

Primary navigation:

- Command Center
- Operations
- Automations
- Approvals
- Activity
- Integrations

The Command Center emphasizes attention and causality instead of repeated KPIs.

Primary visual story:

```text
what happened
 -> what automation decided
 -> what changed
 -> what needs human attention
```

Persistent demo disclosure:

> Interactive demo · Sample data

External actions use labels such as:

- Simulated
- Demo delivery
- Preview
- Test scenario

Technical scaffolding and architecture details move under a Technical Details/About this demo surface.

## 22. Demo Control

Advanced demo drawer:

- current demo time;
- backend/sandbox status;
- seed version;
- scenario state;
- Advance +30 min;
- Trigger sample failure;
- Reset workspace;
- Technical details.

This control is secondary to normal operator flows and must not dominate the UI.

## 23. Deployment model

StayPilot V1 remains on its current Cloudflare Pages deployment.

EZStay V2 receives:

- separate Cloudflare Pages project;
- separate public URL;
- `v2/ezstay` development branch initially;
- independent production promotion after QA.

Do not overwrite the existing StayPilot deployment during V2 development.

## 24. Backend repository ownership

A shared backend database must have one migration authority.

Recommended canonical repository:

`SaamVR/portfolio-backend`

It will eventually own:

```text
supabase/
  migrations/
  tests/
  seed/
contracts/
  ezstay/
  leadflow/
docs/
```

StayPilot/EZStay and Portfolio/LeadFlow application repositories consume a versioned backend contract but do not independently push competing migration histories to the same Supabase project.

Until this repository is created, existing StayPilot migrations remain historical reference only and must not be applied to the future shared project unchanged.

## 25. Version/compatibility controls

Track:

- frontend version;
- backend contract version;
- seed version;
- database release/migration version.

If an application detects an incompatible backend contract, it must fail closed with a clear demo-unavailable state rather than attempt unsafe writes.

Feature flags may stage backend authority scenario-by-scenario.

## 26. Verification requirements

Before calling V2 production-ready, prove:

### Security

- own-tenant access succeeds;
- other-tenant access fails;
- cross-app access fails;
- anonymous vs permanent-user policies behave correctly;
- runtime role cannot access LeadFlow;
- no service-role key ships with EZStay runtime/browser;
- no security-definer helper is exposed unsafely.

### Automation

- guest request creates exactly one task;
- duplicate event creates no duplicate effect;
- checkout creates exactly one turnover task;
- housekeeping completion changes readiness correctly;
- approval creates one purchase draft;
- failed delivery does not undo business state;
- delivery retry does not repeat business action;
- overdue escalation happens once.

### Demo lifecycle

- refresh preserves session;
- reset restores canonical state;
- reset is tenant-local;
- expired session is denied;
- cleanup cannot delete permanent users or another app’s active session.

### Data integrity

- seed consistency suite passes;
- tenant-safe FKs reject cross-hotel links;
- all FK/RLS lookup columns have appropriate indexes.

### UX

- every flagship action shows actual resulting records;
- mobile and desktop navigation remain usable;
- technical disclosure is visible but secondary;
- simulated integrations are clearly labeled;
- no misleading “live integration” claim appears.

## 27. Rollout sequence

1. Freeze this design specification.
2. Create detailed implementation plan after spec approval.
3. Establish isolated development worktree/runtime.
4. Create EZStay V2 UI shell from verified StayPilot baseline.
5. Create separate Cloudflare Pages project only when deployment work begins.
6. Create `portfolio-backend` repository and local/test database contract.
7. Implement platform/EZStay schema, RLS, grants, runtime role, seed, and tests locally.
8. Implement public demo identity/session/reset lifecycle.
9. Implement guest-request vertical slice end-to-end.
10. Implement checkout/room-ready flow.
11. Implement stock/approval/purchase flow.
12. Implement delivery failure/recovery.
13. Implement demo-clock overdue escalation.
14. Redesign workspace around automation causality and evidence.
15. Run security, concurrency, idempotency, lifecycle, accessibility, and browser QA.
16. When the user supplies Supabase access, apply only the reviewed shared-backend migrations through the canonical backend repository.
17. Deploy EZStay production independently.
18. Migrate LeadFlow only after EZStay proves the shared-backend pattern.

## 28. Definition of done

EZStay V2 is complete when:

- it is a separate live Cloudflare Pages application;
- StayPilot V1 remains intact;
- public visitors receive isolated persistent sandboxes;
- four flagship automation stories are fully interactive;
- backend state persists through refresh;
- duplicate actions/events are idempotent;
- failure and retry behavior is demonstrably safe;
- RLS and database constraints enforce tenant boundaries;
- EZStay cannot access LeadFlow data through browser or runtime credentials;
- the automation inspector exposes real execution evidence;
- demo reset is reliable;
- sample data is internally consistent;
- external integrations are truthfully simulated unless explicitly connected;
- the architecture and implementation are credible as both automation and web-development portfolio work.

## 29. Frozen design decisions

The following choices are frozen unless implementation evidence requires a documented change:

- automation-first product positioning;
- new EZStay V2 deployment rather than replacing StayPilot V1;
- one shared Supabase project for portfolio apps;
- internal app schemas plus dedicated exposed API schemas;
- `platform` for only genuinely shared concepts;
- browser access through explicit grants + RLS;
- no global service-role key in EZStay runtime;
- app-specific restricted runtime authority;
- Cloudflare as gateway/orchestration layer;
- Postgres as durable automation source of truth;
- Postgres queue first, Cloudflare Queues deferred;
- isolated public demo tenants;
- canonical versioned fixture;
- dual real/demo clock;
- command + event idempotency;
- four flagship workflows plus overdue escalation;
- dedicated canonical shared-backend migration owner.

