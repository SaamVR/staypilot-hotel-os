# EZStay V2 — Pre-Provisioning Durable Handoff — 2026-09-25

## Resume instruction

Continue EZStay V2 from this document. Do **not** restart the StayPilot audit, redo the shared-Supabase architecture, recreate the V2 UI, or redo completed Hyperdrive/browser QA work.

Repository:

`SaamVR/staypilot-hotel-os`

Canonical EZStay branch:

`v2/ezstay`

Canonical verified head at this handoff:

`fb23089ab7822ebbd75dda4b6c700e2dd7192983`

The user chose **one shared Supabase project for portfolio apps**, but no live Supabase project has been provisioned or connected yet. Do not substitute a new project or silently change that decision.

StayPilot V1 must remain intact. EZStay is the separate V2 automation-first portfolio product.

---

## Product intent

EZStay is an automation-first hotel operations platform prototype. The product should make the automation chain visible:

`event -> context -> policy -> action -> evidence`

The demo property is **Northstar Grand**.

The public portfolio experience must be truthful:

- working interactive prototype;
- sample hotel data;
- internal hotel state changes are real within the sandbox;
- external booking/payment/messaging/supplier systems remain simulated unless explicitly connected;
- no fake live-integration claims.

The four flagship proofs are:

1. Guest request -> assigned task
2. Checkout -> turnover -> room ready
3. Low stock -> approval -> purchase draft
4. Failed delivery -> safe recovery without replaying the business action

Advanced proof:

- deterministic demo-clock overdue escalation

---

## Canonical verification evidence

### Final canonical deploy/build gate

GitHub Actions run:

`36139040044` — **Deploy EZStay V2**

Result: **success**

On final SHA `fb23089a...` the workflow passed:

- install;
- legacy StayPilot backend verification;
- EZStay UI/runtime verification;
- shared backend contract verification;
- production build;
- verified Pages artifact upload.

Cloudflare deployment steps were intentionally skipped because Cloudflare credentials are not configured in this GitHub environment.

No Worker, Pages backend mode, Hyperdrive, or Supabase project was provisioned.

### Final canonical browser gate

GitHub Actions run:

`36139040060` — **EZStay Visual QA**

Result: **success**

The permanent Playwright browser story verifies the exact built V2 bundle at:

- desktop 1440px;
- mobile 390px;
- tablet 768px.

It exercises:

- landing -> interactive demo;
- truthful local-preview authority label;
- guest request -> automation run evidence;
- checkout -> turnover task;
- housekeeping completion -> readiness result;
- low stock -> approval;
- human approval -> purchase draft;
- failed-delivery recovery;
- recovered state persistence through reload;
- demo reset -> canonical failed delivery restored;
- visible mobile navigation labels;
- no browser console errors;
- no uncaught page errors.

Permanent files:

`.github/workflows/ezstay-visual-qa.yml`

`scripts/run-ezstay-visual-qa.mjs`

---

## Backend architecture completed in code

### Shared schemas

The reviewed migration set uses:

- `platform` — genuinely shared portfolio concepts;
- `private` — internal helper/command functions;
- `ezstay` — internal EZStay domain data;
- `ezstay_api` — dedicated browser-facing API schema.

Do not move EZStay business tables back into `public`.

### Runtime authority

The private Cloudflare Worker uses the restricted Postgres role:

`ezstay_runtime`

The runtime does **not** use a global Supabase `service_role` key.

The Hyperdrive adapter:

`cloudflare/ezstay-runtime/hyperdriveBackend.js`

uses pinned:

`pg@8.23.0`

and parameterized calls to reviewed `private.*` functions.

The runtime Worker example explicitly sets:

`workers_dev:false`

Pages talks to the Worker through the `EZSTAY_RUNTIME` Service Binding.

### Browser Auth

The browser backend path is implemented as:

`backend-health -> public-config -> Turnstile -> Supabase anonymous Auth -> bearer token -> Pages API -> private runtime Worker`

The browser uses pinned:

`@supabase/supabase-js@2.117.1`

Permanent Supabase sessions are rejected for the public anonymous demo identity path.

Configured backend mode never silently falls back to local-preview after Auth/Turnstile failure.

### Demo lifecycle

Implemented:

- anonymous demo session;
- canonical `northstar-v2` seed;
- 72-hour session expiry contract;
- deterministic `demo_now`;
- reset generations;
- retry-safe start;
- retry-safe reset;
- retry-safe clock advancement;
- app/user command idempotency ledger;
- one active demo session per app/user;
- first-time session creation serialized with a transaction-scoped advisory lock to prevent multi-tab races.

---

## Supabase pre-provisioning fixes completed at final SHA

The final preflight review caught and fixed three issues before any live database was touched.

### 1. RLS helper execution

`private.ezstay_is_member` and `private.ezstay_has_role` are `SECURITY DEFINER`, use `search_path=''`, and are referenced by RLS policies.

Authenticated policy evaluation now has:

- `USAGE` on schema `private`;
- `EXECUTE` only on those two RLS helpers.

It does **not** receive automation command execution.

### 2. Private function deny-by-default ACL

Because PostgreSQL functions default to executable by `PUBLIC`, the security migration now:

- revokes execute on all current `private` functions from `public, anon, authenticated`;
- changes default privileges for future `private` functions to revoke execute from those roles;
- then explicitly regrants only the two RLS helpers to `authenticated`.

The `ezstay_runtime` role receives its separate explicit command allowlist later.

### 3. Foreign-key lookup indexes

Child-side indexes were added for nullable/composite foreign keys including:

- hotel -> demo session;
- reservation -> room;
- guest request -> reservation/room;
- task -> reservation/room;
- approval -> inventory/requested user/resolved user;
- purchase request -> approval/inventory;
- automation run -> rule/inbound event;
- delivery -> run/endpoint;
- audit event -> actor user;
- command idempotency -> run.

This addresses the frozen spec requirement that FK/RLS lookup paths have appropriate indexes before production.

---

## Northstar fixture parity

Local-preview and durable SQL now tell the same Northstar story.

Durable backend fixture contains:

- 24 rooms;
- 6 reservations;
- 4 tasks;
- 6 inventory records;
- 2 pending approvals;
- 12 automation rules;
- seeded failed delivery/recovery evidence.

Room types, the VIP Lobby task, approvals, reservation references, and guided-scenario targets were reconciled.

Frontend scenario targeting derives the current entity IDs from live snapshot state; it no longer assumes local-only IDs such as `res_1047` or `DLV-400` when backend UUIDs are in use.

---

## Deployment workflow state

Workflow:

`.github/workflows/deploy-ezstay-v2.yml`

Three intentional states exist:

1. **No Cloudflare credentials**
   - verify;
   - build;
   - upload artifact;
   - deploy nothing.

2. **Cloudflare credentials but backend gate incomplete**
   - deploy separate EZStay Pages project in truthful local-preview mode.

3. **Explicit backend promotion gate complete**
   - deploy private `ezstay-runtime` Worker first;
   - bind Hyperdrive;
   - deploy Pages with `EZSTAY_RUNTIME` Service Binding;
   - enable backend mode;
   - smoke-check backend health.

Current state is **#1**.

Required GitHub deployment values for backend promotion:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `EZSTAY_BACKEND_ENABLE=true`
- `EZSTAY_HYPERDRIVE_ID`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `TURNSTILE_SITE_KEY`

Do not commit those values to Git.

---

## What is still intentionally unproven

Do **not** call V2 production-ready until these are proved against live infrastructure:

### Supabase

- apply the reviewed shared-backend migrations to the user-selected shared project;
- expose `ezstay_api` only as intended;
- keep `platform`, `private`, and `ezstay` out of the Data API exposed-schema list;
- enable/configure anonymous Auth;
- configure Turnstile/CAPTCHA in Supabase Auth;
- prove own-tenant reads succeed;
- prove other-tenant reads fail;
- prove cross-app access fails;
- prove anonymous/permanent-user authorization behavior;
- prove expired demo session denial;
- prove reset is tenant-local;
- prove cleanup cannot affect permanent users or another app’s active session;
- run Supabase security/performance advisors after migration.

### Cloudflare

- create/configure the Hyperdrive connection using the restricted `ezstay_runtime` database role;
- provide the GitHub deployment credentials;
- deploy the separate EZStay Pages project;
- deploy the private runtime Worker;
- verify `workers.dev` stays disabled;
- verify the Pages Service Binding;
- verify Turnstile in the real browser;
- verify backend health reports `configured`.

### Live end-to-end

Repeat the browser story against the deployed backend sandbox and prove:

- anonymous sandbox survives refresh;
- each visitor is isolated;
- all four flagship workflows write durable state;
- approval creates exactly one purchase draft;
- retry does not replay the business mutation;
- reset creates a fresh canonical generation;
- overdue escalation happens once;
- no console/runtime errors;
- desktop/mobile/tablet remain usable.

---

## Exact next execution order once access is supplied

1. Reconcile `v2/ezstay` with this handoff. Do not re-audit from scratch.
2. Confirm canonical SHA has not drifted unexpectedly.
3. Read the Supabase skill/current docs before any database write.
4. Inspect the target shared Supabase project; do not create a replacement project without explicit instruction.
5. Apply the reviewed migration sequence through the canonical `portfolio-backend` migration authority.
6. Run database security/integrity/advisor checks before enabling public backend mode.
7. Configure anonymous Auth + Turnstile.
8. Create restricted-role Hyperdrive.
9. Add Cloudflare/GitHub deployment secrets.
10. Set `EZSTAY_BACKEND_ENABLE=true` only after database/security gates pass.
11. Let the guarded GitHub workflow deploy Worker first, then Pages.
12. Run live backend health.
13. Run full browser QA against the deployed URL.
14. Only after live proof, mark EZStay V2 production-ready.
15. Migrate LeadFlow to the shared backend only after EZStay proves the pattern.

---

## Do not redo / do not do

- Do not restart the StayPilot audit.
- Do not merge stale StayPilot PR #24/#30 blindly.
- Do not apply the old dedicated-project StayPilot `public` migrations to the shared Supabase project.
- Do not put a Supabase service-role/secret key in the browser or EZStay runtime.
- Do not expose `private`, `platform`, or internal `ezstay` schemas through the Data API.
- Do not enable backend mode partially.
- Do not describe simulated providers as live integrations.
- Do not overwrite the verified Northstar fixture with demo filler content.
- Do not migrate LeadFlow before EZStay’s live shared-backend pattern is proven.

---

## Resume checkpoint

Canonical branch:

`v2/ezstay`

Canonical SHA:

`fb23089ab7822ebbd75dda4b6c700e2dd7192983`

Canonical final build/deploy gate:

`36139040044` — success, artifact-only because Cloudflare credentials are absent.

Canonical final visual QA gate:

`36139040060` — success.

Docs-only handoff branch:

`docs/ezstay-v2-pre-provisioning-20260925`

At this checkpoint, further meaningful production execution requires the user-selected live Supabase project access and Cloudflare deployment credentials. Everything that can be safely completed without those credentials has been advanced to the pre-provisioning gate.
