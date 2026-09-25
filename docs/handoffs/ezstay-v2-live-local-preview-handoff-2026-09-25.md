# EZStay V2 — Live Local-Preview Handoff — 2026-09-25

## Resume instruction

Continue EZStay V2 from this exact state. Do not restart the StayPilot audit or redo completed V2 architecture, shared-Supabase planning, Hyperdrive adapter, browser QA, or Cloudflare Pages creation.

Repository:

`SaamVR/staypilot-hotel-os`

Canonical branch:

`v2/ezstay`

Canonical head:

`49f1d38f8a6a589ee12068444dd498871f508e27`

Live public URL:

`https://ezstay.pages.dev/`

Cloudflare Pages project:

`ezstay`

The current live deployment is deliberately **local-preview mode**. No Supabase project, Hyperdrive binding, private runtime Worker, or Turnstile-backed backend mode has been enabled yet.

---

## Cloudflare authentication and deployment state

The remote device `samvr` is online and Wrangler OAuth authentication was verified successfully.

Wrangler can access the required Cloudflare account and has Pages/Workers-related permissions.

Do not copy or expose the local OAuth token.

The Pages project `ezstay` was created from `samvr`.

The first real Wrangler deployment exposed a build-only defect: ten EZStay Pages Function routes imported `functions/_shared/ezstay/gateway.js` with one extra `../`.

That deployment failed before publication.

The defect was fixed test-first on:

`feature/ezstay-pages-function-imports`

Regression test:

`scripts/test-ezstay-pages-functions-imports.mjs`

The test now verifies that every relative import under `functions/api/ezstay` resolves from its route file.

The fixed branch was promoted to canonical `v2/ezstay` at SHA `49f1d38f...`.

A second Wrangler deployment from `samvr` succeeded.

---

## Live HTTP verification

`https://ezstay.pages.dev/`

returns HTTP 200 with the expected document title:

`EZStay — Hotel Operations Automation`

`https://ezstay.pages.dev/api/ezstay/backend-health`

returns a valid Pages Function response with:

```json
{
  "ok": true,
  "app": "ezstay",
  "contractVersion": "ezstay-backend-v1",
  "mode": "not_configured",
  "authConfigured": false,
  "runtimeConfigured": false,
  "turnstileConfigured": false,
  "schedulerEnabled": false
}
```

This is the correct live state before Supabase/Hyperdrive activation.

---

## Final canonical GitHub verification

Canonical SHA:

`49f1d38f8a6a589ee12068444dd498871f508e27`

### Deploy/build gate

Run:

`36144684953` — **Deploy EZStay V2**

Result: **success**

The GitHub workflow still uses its artifact-only path because GitHub Cloudflare deployment secrets are not configured.

The live Pages deployment was performed directly through the already-authenticated `samvr` Wrangler session.

### Local-build browser QA

Run:

`36144685063` — **EZStay Visual QA**

Result: **success**

### Live Cloudflare browser QA

Run:

`36145102688` — **EZStay Live QA**

Result: **success**

Artifact:

`ezstay-live-qa`

Artifact ID:

`10867919150`

Digest:

`sha256:c0ae7d3a2be4505ceab78ea3b6981c234205b6bf6233c8d95cf2afa5a61342cb`

The live Playwright run exercised the deployed public URL, not a local build.

It verified the flagship automation story, reload persistence, reset restoration, desktop/mobile/tablet layouts, and zero browser/page errors.

---

## Current product/backend status

Completed and preserved:

- automation-first presentation entry;
- local-preview isolated workspace;
- Northstar Grand canonical fixture;
- Guest request -> assigned task;
- Checkout -> turnover -> room-ready release;
- Low stock -> approval -> purchase draft;
- Failure -> delivery-only recovery;
- deterministic demo clock;
- execution inspector;
- reset generations;
- persistence;
- backend-safe scenario targeting;
- browser anonymous-Auth bootstrap contract;
- restricted `ezstay_runtime` role;
- `pg` Hyperdrive adapter;
- private Worker with `workers_dev:false`;
- service-binding architecture;
- RLS helper ACL fixes;
- private-function deny-by-default ACLs;
- foreign-key lookup indexes;
- concurrent demo-start serialization;
- Pages Function import regression test;
- permanent local visual QA;
- successful live Cloudflare browser QA.

---

## Current authority boundary

The live site is intentionally truthful local-preview.

Do not describe Supabase, Hyperdrive, Turnstile, WhatsApp, Booking.com, payment, supplier, or messaging providers as live integrations yet.

External integrations remain simulated unless explicitly connected later.

No live shared Supabase project was modified during this Cloudflare deployment work.

---

## Next safe execution boundary

The next meaningful backend phase requires the user-selected shared Supabase project access.

Once access is supplied:

1. read current Supabase skill/docs before writes;
2. inspect the target shared project;
3. confirm it is the project the user intends for shared portfolio apps;
4. apply the reviewed `portfolio-backend` migrations in canonical order;
5. run live RLS/cross-tenant/cross-app/security tests;
6. run Supabase security/performance advisors;
7. configure anonymous Auth + Turnstile;
8. create/set the restricted `ezstay_runtime` password outside Git;
9. create Cloudflare Hyperdrive using that restricted DB identity;
10. deploy the private `ezstay-runtime` Worker;
11. bind it to Pages as `EZSTAY_RUNTIME`;
12. set browser-safe Supabase URL/publishable key/Turnstile site key;
13. enable backend mode only after all preceding gates pass;
14. rerun the complete Playwright story against live backend-sandbox mode;
15. only then call backend V2 production-ready.

---

## Do not redo

- do not recreate the `ezstay` Pages project;
- do not redeploy StayPilot V1 over EZStay;
- do not reintroduce the broken Pages Function import depths;
- do not expose the private runtime Worker on `workers.dev`;
- do not use Supabase service-role credentials in the browser or EZStay Worker;
- do not apply old dedicated StayPilot `public` migrations to the shared project;
- do not partially enable backend mode;
- do not migrate LeadFlow into the shared backend before EZStay proves the live pattern.

---

## Exact resume checkpoint

Canonical code:

`v2/ezstay @ 49f1d38f8a6a589ee12068444dd498871f508e27`

Live Pages:

`https://ezstay.pages.dev/`

Backend mode:

`not_configured` — intentional

Canonical GitHub deploy/build:

`36144684953` — success

Canonical local browser QA:

`36144685063` — success

Live Cloudflare browser QA:

`36145102688` — success

Docs handoff branch:

`docs/ezstay-v2-live-local-preview-20260925`
