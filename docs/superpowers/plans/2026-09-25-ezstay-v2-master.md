# EZStay V2 Implementation Master Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and ship EZStay V2 as a separate Cloudflare-hosted, automation-first hotel operations portfolio application while preserving StayPilot V1 and deferring all live Supabase provisioning until access is supplied.

**Architecture:** Work proceeds in three coordinated lanes: the EZStay application/UI, the shared portfolio backend contract, and the Cloudflare runtime/integration layer. The lanes share a frozen HTTP/domain contract and converge only at defined integration gates, allowing parallel progress without mixing migration ownership or backend credentials.

**Tech Stack:** React 19, Vite 7, Lucide React, Recharts, Node.js 22+, Cloudflare Pages/Workers, PostgreSQL/Supabase Auth/RLS, Hyperdrive when live credentials are available, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-25-ezstay-v2-automation-platform-design.md`

## Global Constraints

- StayPilot V1 remains untouched on its current production deployment.
- EZStay V2 develops on `v2/ezstay` and deploys to a separate Cloudflare Pages project.
- Do not provision, connect, or mutate a live Supabase project until the user supplies access.
- One future shared Supabase project hosts portfolio apps, but app business schemas and runtime authority remain isolated.
- No EZStay browser or runtime bundle may contain a global Supabase `service_role` key.
- Postgres remains the durable automation source of truth; Cloudflare Queues are not a V2 dependency.
- External hotel/payment/messaging integrations stay explicitly simulated unless separately connected.
- Public demo mutations must be idempotent and tenant-local.
- The four flagship flows are Guest Request, Checkout/Room Ready, Low Stock/Approval/Purchase Draft, and Failure/Safe Recovery.
- The advanced scheduled flow is Overdue Escalation driven by the demo clock.
- The canonical fixture identifier is `northstar-v2`.
- The backend compatibility identifier is `ezstay-backend-v1`.
- Existing stale PR #24 and #30 are not merge sources for V2.

## Frozen cross-lane interfaces

### Frontend runtime adapter

```js
export const ezstayRuntime = {
  getSession: async () => ({ session, snapshot }),
  startDemo: async ({ captchaToken }) => ({ session, snapshot }),
  resetDemo: async ({ idempotencyKey }) => ({ session, snapshot }),
  runGuestRequest: async ({ idempotencyKey, request, roomNumber }) => ({ run, snapshot }),
  runCheckout: async ({ idempotencyKey, reservationId }) => ({ run, snapshot }),
  runLowStock: async ({ idempotencyKey, inventoryItemId }) => ({ run, snapshot }),
  retryDelivery: async ({ idempotencyKey, deliveryId }) => ({ run, snapshot }),
  advanceClock: async ({ idempotencyKey, minutes }) => ({ run, snapshot }),
  getRun: async (runId) => ({ run }),
};
```

### Session shape

```js
{
  id: "demo_...",
  appKey: "ezstay",
  hotelId: "hotel_...",
  seedVersion: "northstar-v2",
  backendContractVersion: "ezstay-backend-v1",
  mode: "local-preview" | "backend-sandbox",
  demoNow: "2026-09-25T10:30:00+06:00",
  expiresAt: "2026-09-28T10:30:00+06:00",
  resetGeneration: 0
}
```

### Automation run shape

```js
{
  id: "RUN-...",
  eventId: "evt_...",
  ruleKey: "guest-request-router",
  result: "Success" | "Approval" | "Failed" | "Suppressed",
  summary: "...",
  input: {},
  decision: { autonomy: "Auto", reason: "..." },
  changes: [{ entityType: "task", entityId: "TASK-...", action: "created" }],
  delivery: [{ id: "DLV-...", status: "Delivered" | "Failed" | "Queued" }],
  audit: [{ at: "...", effectiveAt: "...", message: "..." }],
  linkedRecords: [{ type: "task", id: "TASK-...", label: "..." }]
}
```

### HTTP contract for backend mode

```text
GET  /api/demo/session
POST /api/demo/start
POST /api/demo/reset
GET  /api/snapshot
POST /api/scenarios/guest-request
POST /api/scenarios/checkout
POST /api/scenarios/low-stock
POST /api/deliveries/retry
POST /api/demo/clock/advance
GET  /api/automation-runs/:runId
```

All mutation routes require `Idempotency-Key`. Every response includes `x-request-id`.

## Parallel execution map

### Lane A — EZStay application/UI
Plan: `docs/superpowers/plans/2026-09-25-ezstay-v2-app-ui.md`

Can start immediately from the current repository without Supabase access.

Produces:
- new EZStay shell and design system;
- canonical local fixture and pure domain model;
- runtime adapter abstraction;
- four flagship interactive flows in local-preview mode;
- automation evidence inspector;
- demo control/deterministic clock UI;
- responsive and accessible workspace.

### Lane B — Shared backend contract
Plan: `docs/superpowers/plans/2026-09-25-ezstay-shared-backend.md`

Can start immediately as code/storage work, but must not connect to live Supabase.

Produces:
- `SaamVR/portfolio-backend`;
- schema/migration source for platform + EZStay;
- tenant-safe constraints;
- RLS/grant tests;
- seed contract;
- restricted runtime-role contract;
- idempotent automation/data functions.

### Lane C — Cloudflare runtime/integration
Plan: `docs/superpowers/plans/2026-09-25-ezstay-cloudflare-runtime.md`

Can scaffold immediately after Lane A's adapter and Lane B's SQL/command interfaces are frozen. Live Hyperdrive/Supabase bindings remain disabled until access exists.

Produces:
- Pages gateway;
- private runtime Worker;
- runtime command handlers;
- scheduled orchestration;
- request/trace propagation;
- Turnstile boundary;
- backend-mode adapter.

## Integration gates

### Gate 1 — Local product proof
Requires Lane A only.

Acceptance:
```bash
npm ci
npm run build
npm run verify:ezstay
```

Manual/browser proof:
- all four showcase flows work in local-preview mode;
- refresh preserves local preview state;
- reset restores `northstar-v2`;
- demo clock triggers overdue escalation;
- each action opens linked evidence.

### Gate 2 — Backend contract proof
Requires Lane B.

Acceptance:
```bash
npm run verify
```

or the backend repository equivalent:

```bash
npm run verify:schema
npm run verify:contracts
npm run verify:seed
```

Must prove cross-app/tenant deny cases in test fixtures even before live provisioning.

### Gate 3 — Runtime contract proof
Requires Lane C + mocked Lane B adapter.

Acceptance:
```bash
npm run verify:runtime
```

Must prove:
- missing backend configuration fails closed;
- missing/duplicate idempotency keys are handled deterministically;
- request IDs propagate;
- scheduler cannot execute when disabled;
- retry route never calls the original business command.

### Gate 4 — Live shared-backend enablement
Blocked until the user supplies Supabase access.

Only then:
1. create/apply reviewed shared backend migrations through `portfolio-backend`;
2. run advisors and RLS tests;
3. create restricted EZStay runtime DB role;
4. configure Hyperdrive and Cloudflare secrets;
5. enable backend-sandbox mode behind feature flag;
6. verify one session end-to-end before public rollout.

### Gate 5 — New Cloudflare production project
Create only after local product proof is stable.

Deployment requirements:
- separate Pages project;
- production branch points to V2 release branch;
- no overwrite of StayPilot V1;
- backend mode shows `local-preview` until Gate 4 completes;
- public copy states “Interactive demo · Sample data”.

## Commit/review strategy

Parallel workers may work on separate branches/worktrees, but each lane owns disjoint paths until an integration gate.

Recommended ownership:

```text
Lane A
  src/ezstay/**
  src/App.jsx
  src/main.jsx
  src/styles.css
  scripts/test-ezstay-*.mjs

Lane B
  SaamVR/portfolio-backend/**
  no writes to StayPilot migrations

Lane C
  functions/api/ezstay/**
  functions/_shared/ezstay/**
  cloudflare/ezstay-runtime/**
  scripts/test-ezstay-runtime*.mjs
```

Do not allow two lanes to edit `package.json` concurrently. Lane A owns package/script edits first; Lane C rebases after Gate 1.

## Review Focus

1. **Double submission:** repeated clicks or retries with the same idempotency key must return the same effect, not duplicate tasks, purchase drafts, resets, or deliveries.
2. **Cross-tenant identifiers:** a valid record ID from a different hotel must behave as not found/forbidden and must not leak existence through response detail.
3. **Expired demo session:** an otherwise-valid auth identity with an expired session must be denied immediately and offered a fresh demo, not silently continue.
4. **Partial delivery failure:** business state must remain committed when simulated/external delivery fails; retry must address delivery only.
5. **Clock/reset race:** advancing the demo clock while a reset occurs must not create an escalation in the replacement generation from stale state.

---

## Orchestration Task 1: Freeze interfaces and lane ownership

**Files:**
- Existing: `docs/superpowers/specs/2026-09-25-ezstay-v2-automation-platform-design.md`
- Existing: this master plan
- Create/Use: three lane plans listed above

**Interfaces:**
- Produces the frozen adapter, session, automation-run, and HTTP contracts in this document.

- [ ] **Step 1: Verify all lane plans use the exact contract names from this master plan**

Run:
```bash
grep -R "ezstay-backend-v1\|northstar-v2\|runGuestRequest\|Idempotency-Key" docs/superpowers/plans
```

Expected: each relevant contract appears with no conflicting version/key names.

- [ ] **Step 2: Verify path ownership does not overlap except documented integration files**

Expected: Lane A owns frontend paths, Lane B owns the backend repository, Lane C owns EZStay function/runtime paths.

- [ ] **Step 3: Commit planning artifacts**

```bash
git add docs/superpowers/plans
git commit -m "docs: add EZStay V2 parallel implementation plans"
```

## Orchestration Task 2: Execute Lane A and Lane B in parallel

**Files:** lane-owned paths only.

**Interfaces:**
- Consumes: frozen master contracts.
- Produces: local-preview product + backend contract repository.

- [ ] **Step 1: Start isolated worktrees/branches for Lane A and Lane B**
- [ ] **Step 2: Execute each plan task-by-task with tests before implementation**
- [ ] **Step 3: Run Lane A Gate 1 and Lane B Gate 2 independently**
- [ ] **Step 4: Review both lane heads before integration**

Expected: both lanes pass without live Supabase credentials.

## Orchestration Task 3: Execute Lane C against frozen interfaces

**Files:** `functions/api/ezstay/**`, `functions/_shared/ezstay/**`, `cloudflare/ezstay-runtime/**`, runtime tests.

- [ ] **Step 1: Rebase Lane C on the accepted Lane A script/package baseline**
- [ ] **Step 2: Implement gateway/runtime using mocked backend adapter first**
- [ ] **Step 3: Run Gate 3**
- [ ] **Step 4: Integrate frontend backend-mode adapter with fail-closed configuration**

Expected: backend mode is structurally complete but disabled without live bindings.

## Orchestration Task 4: Browser QA and separate Cloudflare preview

**Files:** deployment configuration and any fixes arising from QA.

- [ ] **Step 1: Run production build locally**
- [ ] **Step 2: Verify desktop widths 1440 and 1280**
- [ ] **Step 3: Verify tablet/mobile widths 768, 430, 390, and 360**
- [ ] **Step 4: Run all four flagship scenarios plus overdue escalation**
- [ ] **Step 5: Verify labels never imply live third-party integrations**
- [ ] **Step 6: Deploy a separate EZStay preview/Pages project**
- [ ] **Step 7: Re-run public URL QA before promotion**

Expected: StayPilot V1 URL remains unaffected.

## Orchestration Task 5: Live backend enablement after access

**Files:** owned by `portfolio-backend` plus Cloudflare environment configuration.

- [ ] **Step 1: Review current live project state before any migration**
- [ ] **Step 2: Apply only migrations from canonical backend repository**
- [ ] **Step 3: Run Supabase advisors and RLS test matrix**
- [ ] **Step 4: Configure app-scoped runtime database role and Hyperdrive**
- [ ] **Step 5: Enable backend mode for one private test session**
- [ ] **Step 6: Verify persistence, reset, duplicate suppression, failure/retry, cross-app denial**
- [ ] **Step 7: Gradually enable public backend sandbox**

Expected: no global service-role credential exists in the EZStay browser or normal runtime.
