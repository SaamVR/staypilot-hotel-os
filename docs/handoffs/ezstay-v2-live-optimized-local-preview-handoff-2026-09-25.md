# EZStay V2 — Live Optimized Local-Preview Handoff — 2026-09-25

## Resume instruction

Continue EZStay V2 from this exact checkpoint. Do not restart the StayPilot audit, redo completed EZStay architecture, redo Cloudflare Pages creation, or redo completed local/live browser QA.

Repository:

`SaamVR/staypilot-hotel-os`

Canonical branch:

`v2/ezstay`

Canonical head:

`d30f507cf733b833567d7060ce647bc13f2d1402`

Live URL:

`https://ezstay.pages.dev/`

Current backend mode:

`not_configured` — intentional local-preview mode.

No live Supabase project, Hyperdrive binding, private runtime Worker, or Turnstile-backed backend mode is enabled yet.

---

## Cloudflare state

Cloudflare Wrangler OAuth is verified on remote device `samvr`.

Pages project:

`ezstay`

Production branch:

`v2/ezstay`

Current production Pages deployment was uploaded directly from `samvr`.

Latest optimized deployment preview reported by Wrangler:

`https://414f57fa.ezstay.pages.dev`

Production alias:

`https://ezstay.pages.dev/`

Root returns HTTP 200 and title:

`EZStay — Hotel Operations Automation`

Backend health endpoint:

`https://ezstay.pages.dev/api/ezstay/backend-health`

returns:

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

This fail-closed state is correct until the shared backend is live.

---

## Pages Function deployment defect fixed

The first real Pages deployment revealed that ten EZStay Pages Function routes referenced:

`functions/_shared/ezstay/gateway.js`

with one extra `../`.

Wrangler refused to compile the Functions bundle, so the broken deployment did not publish.

The imports were fixed on:

`feature/ezstay-pages-function-imports`

and promoted into canonical V2.

Permanent regression test:

`scripts/test-ezstay-pages-functions-imports.mjs`

It verifies every relative import under `functions/api/ezstay` resolves from its route file.

Canonical import-fix SHA:

`49f1d38f8a6a589ee12068444dd498871f508e27`

---

## Initial-bundle performance optimization

The live local-preview product did not need the Supabase browser client on first load, but `src/ezstay/runtime/bootstrap.js` imported it eagerly through `supabaseAnonymousAuth.js`.

This was fixed by dynamically importing Supabase Auth only when `createBackendSandboxRuntime()` is actually requested.

Permanent regression test:

`scripts/test-ezstay-bundle-contract.mjs`

Before:

- main JS: **504.72 kB**
- main JS gzip: **143.50 kB**

After:

- main JS: **280.93 kB**
- main JS gzip: **84.86 kB**
- deferred Supabase Auth chunk: **224.46 kB / 58.76 kB gzip**

The optimized local-preview visitor therefore avoids the Supabase/Auth payload.

The performance branch passed the full Playwright browser story before promotion.

Canonical optimized SHA:

`d30f507cf733b833567d7060ce647bc13f2d1402`

Production HTML now references:

`assets/index-BwbHLzN6.js`

which confirms the optimized bundle is live.

---

## Final verification evidence

### Canonical GitHub deploy/build

Run:

`36145927616` — **Deploy EZStay V2**

Result: **success**

SHA:

`d30f507c...`

### Canonical local browser QA

Run:

`36145927628` — **EZStay Visual QA**

Result: **success**

SHA:

`d30f507c...`

### Live Cloudflare browser QA

Run:

`36145102688` — **EZStay Live QA**

Latest rerun attempt:

`run_attempt = 2`

Result: **success**

This rerun happened after the optimized production bundle was deployed.

It exercised the public Cloudflare URL in Chromium and verified:

- marketing entry;
- local-preview authority disclosure;
- Guest request -> assigned task;
- Checkout -> turnover -> housekeeping completion -> room ready;
- Low stock -> approval -> purchase draft;
- Failed delivery -> safe recovery;
- refresh persistence;
- deterministic reset restoration;
- desktop 1440px;
- mobile 390px;
- tablet 768px;
- no browser console errors;
- no uncaught page errors.

---

## Current completed product/backend foundation

Preserve all of the following:

- automation-first presentation;
- Northstar Grand canonical fixture;
- isolated/resettable local-preview workspace;
- event -> context -> policy -> action -> evidence storytelling;
- four flagship automation proofs;
- deterministic demo clock;
- run inspector;
- purchase-draft proof;
- delivery-only recovery;
- persistence and reset;
- backend-safe live entity targeting;
- guarded backend bootstrap;
- anonymous Supabase Auth contract;
- Turnstile entry contract;
- restricted `ezstay_runtime` DB role;
- `pg` Hyperdrive adapter;
- private Worker with `workers_dev:false`;
- Pages Service Binding architecture;
- RLS helper permissions;
- deny-by-default private function ACL;
- FK lookup indexes;
- concurrent start serialization;
- Pages Function import resolver regression;
- deferred Supabase/Auth bundle;
- canonical visual QA;
- successful live Cloudflare visual QA.

---

## samvr operational note

The deployment machine reached 100% disk usage during the optimized redeploy because npm caches and prior build dependencies accumulated.

Only disposable data was removed:

- npm cache / npx cache;
- the EZStay deployment workspace `node_modules`;
- EZStay temporary files.

The verified `dist` was retained and deployed successfully.

Do not interpret that ENOSPC event as a product/build failure.

---


## Turnstile provisioned, not activated

Cloudflare Turnstile widget:

`EZStay Demo`

Mode:

`managed`

Authorized hostnames:

- `ezstay.pages.dev` — Cloudflare hostname management also authorizes its subdomains / deployment previews;
- `localhost`;
- `127.0.0.1`.

Public sitekey:

`0x4AAAAAAFDbgiO7_Z4oNSz0`

The widget secret is **not** stored in Git or this handoff. It is retained only on `samvr` at:

`~/.config/ezstay/turnstile-widget.json`

with restrictive file permissions.

The Turnstile sitekey has deliberately **not** been wired into Pages/backend mode yet. Activation should happen together with Supabase anonymous Auth configuration so the system does not enter a partial backend state.

---

## Next execution boundary

Further meaningful production work requires the user-selected shared Supabase project access.

Once access is available:

1. read current Supabase skill/docs before writes;
2. inspect the intended shared portfolio project;
3. do not create a replacement project unless explicitly asked;
4. apply the reviewed `portfolio-backend` migrations in canonical order;
5. expose only `ezstay_api` as designed;
6. keep `platform`, `private`, and internal `ezstay` schemas hidden from the Data API;
7. enable anonymous Auth;
8. configure Turnstile/CAPTCHA;
9. run live own-tenant / cross-tenant / cross-app RLS proofs;
10. run Supabase security and performance advisors;
11. create/set a strong `ezstay_runtime` DB password outside Git;
12. create Cloudflare Hyperdrive using that restricted role;
13. deploy the private `ezstay-runtime` Worker;
14. verify `workers.dev` remains disabled;
15. bind Worker to Pages as `EZSTAY_RUNTIME`;
16. set browser-safe Supabase URL/publishable key/Turnstile site key;
17. enable backend mode only after every gate above passes;
18. rerun the complete live Playwright story in backend-sandbox mode;
19. only then mark EZStay V2 backend production-ready.

---

## Do not redo / do not regress

- Do not recreate the `ezstay` Pages project.
- Do not overwrite StayPilot V1.
- Do not restore eager Supabase/Auth imports.
- Do not reintroduce broken Pages Function relative imports.
- Do not expose the private runtime Worker publicly.
- Do not use service-role credentials in the browser or runtime.
- Do not apply old dedicated StayPilot `public` migrations to the shared project.
- Do not partially enable backend mode.
- Do not claim simulated providers are live integrations.
- Do not migrate LeadFlow to the shared backend before EZStay proves the live backend pattern.

---

## Exact resume checkpoint

Canonical code:

`v2/ezstay @ d30f507cf733b833567d7060ce647bc13f2d1402`

Live production:

`https://ezstay.pages.dev/`

Backend:

`not_configured` — intentional

Canonical deploy/build run:

`36145927616` — success

Canonical local visual QA:

`36145927628` — success

Live optimized visual QA:

`36145102688`, attempt 2 — success

Docs handoff branch:

`docs/ezstay-v2-live-optimized-local-preview-20260925`
