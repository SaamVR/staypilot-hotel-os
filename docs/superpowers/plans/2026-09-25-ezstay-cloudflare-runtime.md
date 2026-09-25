# EZStay Cloudflare Runtime and Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fail-closed Cloudflare gateway/runtime layer that implements the frozen EZStay HTTP contract, initially against mocked/local contract adapters and later against the restricted shared Postgres backend without changing frontend APIs.

**Architecture:** Pages Functions are thin same-origin gateways. Privileged commands are delegated to a private EZStay Worker through a Service Binding; the Worker talks to the future backend through an app-scoped database adapter/Hyperdrive and owns scheduler/delivery orchestration. No live binding is enabled until the user supplies Supabase access.

**Tech Stack:** Cloudflare Pages Functions, Workers, Service Bindings, Cron Triggers, Hyperdrive later, Node.js contract tests.

**Spec:** `docs/superpowers/specs/2026-09-25-ezstay-v2-automation-platform-design.md`

## Global Constraints

- Backend contract: `ezstay-backend-v1`.
- No live Supabase/Hyperdrive configuration before access is supplied.
- Missing runtime binding must fail closed with a clear 503 response.
- Mutation routes require `Idempotency-Key`.
- All responses include `x-request-id`.
- Pages gateway never holds a global Supabase service-role key.
- Scheduler defaults disabled.
- Delivery retry cannot invoke original business mutation.
- Turnstile is required for public demo creation when production mode is enabled.

## Review Focus

1. Missing Service Binding or DB configuration returns fail-closed 503 rather than falling back to unsafe authority.
2. Malformed/missing idempotency key returns 400 and never reaches runtime command execution.
3. Replayed mutation key returns the original command outcome.
4. Untrusted cross-tenant record identifiers do not alter error detail in a way that leaks existence.
5. Cron/scheduler invocation while disabled produces a skip result and no database claims.

---

### Task C1: Add shared HTTP response/request-ID utilities

**Files:**
- Create: `functions/_shared/ezstay/http.js`
- Create: `functions/_shared/ezstay/request-id.js`
- Create: `scripts/test-ezstay-http.mjs`

**Interfaces:**
- Produces: `jsonResponse(body,{status,requestId})`, `requireIdempotencyKey(request)`, `requestIdFrom(request)`.

- [ ] **Step 1: Write tests for request ID preservation/generation and missing idempotency key**
- [ ] **Step 2: Implement request ID validation as bounded printable token**
- [ ] **Step 3: Add `x-request-id` to every helper response**
- [ ] **Step 4: Verify and commit**

### Task C2: Add Pages gateway routes with fail-closed Service Binding

**Files:**
- Create: `functions/_shared/ezstay/gateway.js`
- Create: `functions/api/ezstay/demo/session.js`
- Create: `functions/api/ezstay/demo/start.js`
- Create: `functions/api/ezstay/demo/reset.js`
- Create: `functions/api/ezstay/snapshot.js`
- Create: `functions/api/ezstay/scenarios/guest-request.js`
- Create: `functions/api/ezstay/scenarios/checkout.js`
- Create: `functions/api/ezstay/scenarios/low-stock.js`
- Create: `functions/api/ezstay/deliveries/retry.js`
- Create: `functions/api/ezstay/demo/clock/advance.js`
- Create: `functions/api/ezstay/automation-runs/[runId].js`
- Create: `scripts/test-ezstay-gateway.mjs`

**Interfaces:**
- Gateway delegates to `env.EZSTAY_RUNTIME.fetch(request)`.

- [ ] **Step 1: Write tests with a fake Service Binding**
- [ ] **Step 2: Missing `EZSTAY_RUNTIME` returns `503 { code:"ezstay_runtime_not_configured" }`**
- [ ] **Step 3: Mutation routes reject missing idempotency key before delegation**
- [ ] **Step 4: Preserve request IDs across delegation**
- [ ] **Step 5: Verify and commit**

### Task C3: Add private runtime Worker and command router

**Files:**
- Create: `cloudflare/ezstay-runtime/worker.js`
- Create: `cloudflare/ezstay-runtime/router.js`
- Create: `cloudflare/ezstay-runtime/backend.js`
- Create: `cloudflare/wrangler.ezstay-runtime.jsonc.example`
- Create: `scripts/test-ezstay-runtime-worker.mjs`

**Interfaces:**
- Produces internal command functions:
```js
handleGetSession(ctx)
handleStartDemo(ctx)
handleResetDemo(ctx)
handleGuestRequest(ctx)
handleCheckout(ctx)
handleLowStock(ctx)
handleRetryDelivery(ctx)
handleAdvanceClock(ctx)
handleGetRun(ctx)
```

- [ ] **Step 1: Write router tests against an in-memory fake backend**
- [ ] **Step 2: Implement explicit method/path dispatch**
- [ ] **Step 3: Add backend adapter interface**
- [ ] **Step 4: Default adapter throws `backend_not_configured` unless test binding is supplied**
- [ ] **Step 5: Verify and commit**

### Task C4: Add demo-start abuse boundary and Turnstile verifier

**Files:**
- Create: `functions/_shared/ezstay/turnstile.js`
- Modify: `functions/api/ezstay/demo/start.js`
- Create: `scripts/test-ezstay-turnstile.mjs`

**Interfaces:**
- `verifyTurnstile({ token, secret, remoteIp, fetchImpl }) -> { success:boolean }`.

- [ ] **Step 1: Test missing production secret/token rejects demo creation**
- [ ] **Step 2: Test local-preview/dev mode does not pretend verification succeeded; it reports `turnstile_required:false` only under explicit development configuration**
- [ ] **Step 3: Implement server-side Siteverify call with no token logging**
- [ ] **Step 4: Verify and commit**

### Task C5: Add scheduler and delivery-only recovery

**Files:**
- Create: `cloudflare/ezstay-runtime/scheduler.js`
- Modify: `cloudflare/ezstay-runtime/worker.js`
- Create: `scripts/test-ezstay-scheduler.mjs`
- Create: `scripts/test-ezstay-delivery-retry.mjs`

**Interfaces:**
- `runScheduledTick(env, backend)` claims bounded work only when `EZSTAY_SCHEDULER_ENABLED === "true"`.

- [ ] **Step 1: Test disabled scheduler returns `{skipped:true,reason:"scheduler_disabled"}`**
- [ ] **Step 2: Test bounded worker batch**
- [ ] **Step 3: Test retry route calls `backend.retryDelivery` and never `backend.runGuestRequest/runCheckout/runLowStock`**
- [ ] **Step 4: Verify and commit**

### Task C6: Wire backend-mode frontend adapter and compatibility check

**Files:**
- Modify: `src/ezstay/runtime/httpRuntime.js`
- Create: `functions/api/ezstay/backend-health.js`
- Create: `scripts/test-ezstay-compatibility.mjs`

**Interfaces:**
- Health response:
```js
{
  ok:true,
  app:"ezstay",
  contractVersion:"ezstay-backend-v1",
  mode:"not_configured" | "configured",
  schedulerEnabled:false
}
```

- [ ] **Step 1: Test frontend refuses mismatched contract version**
- [ ] **Step 2: Add backend health route with no secret values**
- [ ] **Step 3: Switch runtime mode only when contract matches**
- [ ] **Step 4: Verify and commit**

### Task C7: Prepare separate Cloudflare deployment configuration

**Files:**
- Create: `docs/deployment/ezstay-cloudflare.md`
- Modify only deployment config needed for the new project after local QA.

**Interfaces:**
- Produces reproducible separate Pages + Worker deployment instructions.

- [ ] **Step 1: Document build command `npm run build` and output `dist`**
- [ ] **Step 2: Document required binding name `EZSTAY_RUNTIME`**
- [ ] **Step 3: Document disabled-by-default vars**
```text
EZSTAY_BACKEND_MODE=not_configured
EZSTAY_SCHEDULER_ENABLED=false
```
- [ ] **Step 4: Document production-only Turnstile secret and future Hyperdrive binding names without values**
- [ ] **Step 5: Verify no V1 Cloudflare project name appears as the target of V2 deployment**
- [ ] **Step 6: Commit**
