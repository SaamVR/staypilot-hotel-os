# EZStay V2 — Live Real-Product Handoff — 2026-09-25

## Resume instruction

Continue EZStay V2 from this exact checkpoint. Do not restart the StayPilot audit, redo completed shared-Supabase architecture, recreate the EZStay Pages project, or redo completed product-realism/browser QA work.

Repository:

`SaamVR/staypilot-hotel-os`

Canonical product branch:

`v2/ezstay`

Canonical live code SHA:

`64d7f3ef79e55f323b9a4dfe8cd92832b41c4e3e`

Live production:

`https://ezstay.pages.dev/`

Latest production deployment preview:

`https://747062d6.ezstay.pages.dev`

Current backend mode:

`not_configured` — intentional local-preview authority.

No shared Supabase project, Hyperdrive binding, private runtime Worker, or live third-party provider credential has been activated yet.

---

## Why this checkpoint matters

EZStay now presents as a real hotel-operations automation product rather than a portfolio mockup.

The product experience now includes:

- product-first public landing;
- Northstar Grand operating context;
- desktop operator identity (`Sam Rahman · Owner`);
- hotel-local time in chrome;
- operations-first Command Center;
- arrivals/departures/readiness/work summaries;
- exception-first attention queue;
- room readiness board;
- room-state filters;
- team/work filters;
- automation authority filters;
- human approval queue with operational context;
- purchase-draft output;
- execution/recovery activity;
- compact trace references with expandable exact IDs;
- inspectable integration adapter contracts;
- explicit credential state (`Not connected` / demo path);
- sandbox tools moved behind the environment control instead of normal operating chrome;
- mobile/tablet responsive navigation;
- deferred Supabase/Auth code split;
- product-grade title/meta/favicon/manifest identity.

Public disclosure remains explicit but secondary: sample Northstar data and simulated provider boundaries are disclosed without turning everyday workspace screens into demo banners.

---

## Final canonical verification

### Deploy/build gate

GitHub Actions:

`36167185398` — **Deploy EZStay V2**

Result: **success**

Canonical SHA:

`64d7f3ef...`

### Canonical local visual QA

GitHub Actions:

`36167185396` — **EZStay Visual QA**

Result: **success**

This run exercises the canonical built bundle in Chromium.

### Operator-depth branch QA before promotion

GitHub Actions:

`36166851269` — **EZStay Operator Depth Visual QA**

Result: **success**

It explicitly proved:

- desktop operator identity;
- room filter behavior;
- team filter behavior;
- automation Policy filter;
- integration adapter expansion;
- all four automation stories;
- approval -> purchase draft;
- delivery-only recovery;
- persistence;
- reset;
- mobile/tablet;
- zero browser/page errors.

### Live production operator QA

GitHub Actions:

`36167773147` — **EZStay Live Operator QA**

Result: **success**

The current product story ran against:

`https://ezstay.pages.dev`

Artifact:

`ezstay-live-operator-qa`

Artifact ID:

`10879185783`

Digest:

`sha256:b8c439e322c3851b6933e29e92505235e2c09b390b2154ad13cc83da05717915`

---

## Production fingerprint

Production HTML currently references:

`assets/index-DosKdBUM.js`

Pages Function health:

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

This is the correct authority state before Supabase activation.

---

## Cloudflare state

Cloudflare Wrangler OAuth is already authenticated on the remote device `samvr`.

Pages project:

`ezstay`

Turnstile widget:

`EZStay Demo`

Public sitekey:

`0x4AAAAAAFDbgiO7_Z4oNSz0`

Authorized hosts:

- `ezstay.pages.dev`
- `localhost`
- `127.0.0.1`

The Turnstile secret is not stored in Git or this document. It is retained only on `samvr` at:

`~/.config/ezstay/turnstile-widget.json`

with restrictive permissions.

Turnstile is provisioned but not wired into backend mode yet because Supabase anonymous Auth is not live.

---

## Important manual Pages deployment rule

Wrangler discovers Pages Functions from the repository `functions/` directory relative to the working directory.

When deploying a downloaded GitHub build artifact manually from `samvr`:

- checkout the exact canonical commit;
- place the artifact contents into the repo `dist/`;
- run `wrangler pages deploy dist ...` from the repo root;
- require Wrangler to report that the Functions bundle was compiled/uploaded;
- require `/api/ezstay/backend-health` to return the EZStay JSON contract.

Do not deploy `/tmp/<artifact>` from outside the repository root.

This exact failure mode was caught on 2026-09-25: static files published successfully but Pages Functions were omitted, causing `/api/ezstay/backend-health` to return SPA HTML. It was immediately corrected with the repo-root deployment that produced preview `747062d6.ezstay.pages.dev`.

The corrected deployment instructions live at:

`docs/deployment/ezstay-cloudflare.md`

on this handoff branch.

---

## Performance state

Supabase/Auth remains dynamically split from the initial local-preview bundle.

Current product-depth build:

- initial main JS: approximately **293 kB**
- initial main gzip: approximately **88 kB**
- deferred Supabase/Auth chunk: approximately **224 kB / 59 kB gzip**

The extra operator controls added only a small increase over the earlier optimized build and preserved the deferred backend chunk.

---

## Backend/security foundation already complete in code

Preserve:

- `platform`, `private`, `ezstay`, `ezstay_api` schema split;
- dedicated `ezstay_runtime` Postgres login role;
- no runtime/browser `service_role` dependency;
- parameterized Hyperdrive adapter;
- private Worker with `workers_dev:false`;
- Pages Service Binding architecture;
- RLS helper ACLs;
- deny-by-default private-function ACLs;
- child-side FK indexes;
- app/user command idempotency;
- retry-safe start/reset/clock;
- concurrent first-session advisory lock;
- durable execution evidence;
- delivery/business-mutation separation;
- Northstar seed parity;
- Pages Function import regression test.

---

## Next meaningful phase

Further meaningful production execution now requires the user-selected shared Supabase project access.

Once access is supplied:

1. read current Supabase skill/docs before writes;
2. inspect the intended shared portfolio project;
3. do not create a replacement Supabase project unless explicitly instructed;
4. apply the reviewed `portfolio-backend` migrations in canonical order;
5. expose only `ezstay_api` as designed;
6. keep `platform`, `private`, and internal `ezstay` schemas hidden from the Data API;
7. enable Supabase anonymous Auth;
8. configure Turnstile/CAPTCHA with the already-created EZStay widget;
9. prove own-tenant access succeeds;
10. prove cross-tenant and cross-app access fails;
11. run Supabase security/performance advisors;
12. set the `ezstay_runtime` database password outside Git;
13. create Cloudflare Hyperdrive using only that restricted role;
14. deploy the private `ezstay-runtime` Worker;
15. verify `workers.dev` remains disabled;
16. bind Worker to Pages as `EZSTAY_RUNTIME`;
17. set browser-safe Supabase URL/publishable key/Turnstile site key;
18. enable backend mode only after all preceding gates pass;
19. rerun the complete live operator-depth Playwright story in backend-sandbox mode;
20. only then mark EZStay backend production-ready.

---

## Do not regress

- do not recreate the `ezstay` Pages project;
- do not overwrite StayPilot V1;
- do not restore demo banners to normal operating chrome;
- do not restore eager Supabase/Auth imports;
- do not make integration cards claim live connections without credentials;
- do not remove room/team/automation filters;
- do not expose the runtime Worker publicly;
- do not use service-role credentials in browser/runtime;
- do not deploy a downloaded Pages artifact from outside repo root;
- do not partially enable backend mode;
- do not migrate LeadFlow to the shared backend until EZStay proves the live shared-backend pattern.

---

## Exact resume checkpoint

Canonical product code:

`v2/ezstay @ 64d7f3ef79e55f323b9a4dfe8cd92832b41c4e3e`

Live production:

`https://ezstay.pages.dev/`

Backend authority:

`not_configured` — intentional

Canonical build/deploy:

`36167185398` — success

Canonical local visual QA:

`36167185396` — success

Live production operator QA:

`36167773147` — success

Docs/handoff branch:

`docs/ezstay-live-real-product-20260925`

At this point the product presentation has crossed the intended “real project” threshold. The next blocker is live shared-backend provisioning, not frontend realism.
