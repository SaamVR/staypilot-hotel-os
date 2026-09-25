# EZStay V2 Cloudflare Deployment

EZStay V2 must deploy as a separate Cloudflare application. Do not repoint or overwrite the existing StayPilot V1 project.

## Pages application

Build:

```bash
npm ci
npm run verify:backend
npm run verify:ezstay
npm run build
```

Output directory:

```text
dist
```

Required Pages Service Binding:

```text
EZSTAY_RUNTIME -> private ezstay-runtime Worker
```

Initial public environment:

```text
EZSTAY_BACKEND_MODE=not_configured
EZSTAY_AUTH_REQUIRED=false
EZSTAY_SCHEDULER_ENABLED=false
```

The public V2 remains a truthful local-preview sandbox until the backend enablement gate is complete.

Current disclosure contract:

- the marketing entry states that Northstar Grand uses sample hotel data;
- simulated external booking/payment/messaging/supplier boundaries are disclosed near the entry and in the footer;
- the workspace keeps a compact `Sandbox` environment control in normal product chrome;
- detailed runtime/seed/persistence boundaries live inside the environment drawer rather than dominating everyday operating screens.

Do not reintroduce large demo banners into normal operating chrome merely to satisfy disclosure; disclosure must remain explicit but secondary to the product experience.


## Manual / samvr Pages deployment invariant

Cloudflare Pages Functions are discovered from the repository's `functions/` directory relative to the Wrangler working directory.

When deploying a verified GitHub `ezstay-pages-dist` artifact manually from `samvr`:

1. checkout the exact canonical commit in the repository workspace;
2. download/extract the verified artifact;
3. copy the artifact contents into the repository's `dist/` directory;
4. run `wrangler pages deploy dist ...` **from the repository root**;
5. verify Wrangler reports `Compiled Worker successfully` / `Uploading Functions bundle`;
6. smoke-check `/api/ezstay/backend-health` and require JSON containing `contractVersion: ezstay-backend-v1`.

Do **not** run `wrangler pages deploy /tmp/<artifact>` from outside the repository root. That can publish the static SPA without the Pages Functions, causing `/api/ezstay/*` to fall through to `index.html`.

This failure mode was reproduced during the 2026-09-25 local-preview deployment and is now part of the operational handoff.

## Private runtime Worker

Source:

```text
cloudflare/ezstay-runtime/worker.js
```

Reference configuration:

```text
cloudflare/wrangler.ezstay-runtime.jsonc.example
```

The Worker has no public business URL requirement. Pages Functions call it through the `EZSTAY_RUNTIME` Service Binding.

Scheduled processing remains disabled unless:

```text
EZSTAY_SCHEDULER_ENABLED=true
```

is explicitly set after backend verification.

## Backend-sandbox enablement gate

Do not set `EZSTAY_BACKEND_MODE=configured` until all of the following are true:

1. the shared Supabase project has been supplied by the user;
2. canonical `portfolio-backend` migrations have been reviewed and applied;
3. the restricted `ezstay_runtime` database role exists;
4. the Hyperdrive connection uses only that role;
5. RLS/cross-app tests pass;
6. Supabase Auth anonymous sign-in is enabled;
7. Turnstile CAPTCHA is enabled for anonymous Auth;
8. the Pages environment contains only the public Supabase URL and publishable key;
9. the runtime has no Supabase `service_role` credential.

Backend-sandbox Pages variables:

```text
EZSTAY_BACKEND_MODE=configured
EZSTAY_AUTH_REQUIRED=true
SUPABASE_URL=<shared project URL>
SUPABASE_PUBLISHABLE_KEY=<publishable key>
TURNSTILE_SITE_KEY=<public Turnstile site key>
```

The GitHub deployment workflow additionally requires an explicit server-side promotion gate:

```text
EZSTAY_BACKEND_ENABLE=true
EZSTAY_HYPERDRIVE_ID=<Cloudflare Hyperdrive config id>
```

If any backend promotion value is missing, the workflow intentionally deploys or retains the local-preview experience instead of partially enabling the backend.

Do not place database passwords, service-role keys, Turnstile secrets, webhook secrets, or provider credentials in browser-visible variables.

## Turnstile

The browser supplies a Turnstile token to Supabase anonymous sign-in. Supabase Auth owns CAPTCHA verification for that sign-in flow. The Pages gateway then validates the resulting bearer identity against Supabase Auth before delegating to the private EZStay Worker.

## Hyperdrive runtime

The private Worker adapter is implemented in:

```text
cloudflare/ezstay-runtime/hyperdriveBackend.js
```

It uses the pinned `pg` driver and calls only the approved private database functions. The checked-in Worker example sets `workers_dev:false`, so the runtime is intended to be reachable only through the Pages Service Binding.

The private Worker receives its Hyperdrive binding only after the live backend gate. The connection identity must be the restricted `ezstay_runtime` database role, not the project owner, postgres role, or Supabase service role.

The migration creates `ezstay_runtime` with `LOGIN NOINHERIT` but deliberately does **not** commit a password. During live provisioning only:

1. generate a strong unique password outside Git;
2. set it with `ALTER ROLE ezstay_runtime WITH PASSWORD '<generated secret>'`;
3. copy the exact Supabase connection endpoint/username format from the project's Connect dialog;
4. create the Cloudflare Hyperdrive configuration with that connection string;
5. bind the resulting Hyperdrive ID to the private runtime Worker;
6. verify the connected database role is `ezstay_runtime` before enabling backend mode.

For the Supabase shared pooler, a custom role username is `ezstay_runtime.<project-ref>`; do not construct the host or project reference from memory. The database password belongs only in the secure provisioning path / Cloudflare Hyperdrive configuration, never in browser variables or the repository.

The Worker-side database adapter already uses Cloudflare's recommended `pg` driver with Hyperdrive. It remains operationally disabled until the Hyperdrive binding exists and the live migration/security gate passes.

## Production promotion

Before promotion:

- all GitHub Action gates are green;
- desktop/mobile runtime QA passes;
- all four flagship scenarios work;
- reset creates a fresh generation;
- delivery recovery does not repeat a business action;
- no copy implies that simulated third-party services are live;
- StayPilot V1 production remains unchanged.


## GitHub deployment states

The `Deploy EZStay V2` workflow has three intentionally separate outcomes:

1. **No Cloudflare credentials:** verify, build, and upload the `ezstay-pages-dist` artifact only.
2. **Cloudflare credentials, backend gate incomplete:** deploy the separate EZStay Pages project in truthful local-preview mode.
3. **Explicit backend gate complete:** deploy the private `ezstay-runtime` Worker first, then deploy Pages with the `EZSTAY_RUNTIME` Service Binding and browser-safe Supabase/Turnstile variables.

The backend-enabled Pages configuration is generated only inside GitHub Actions. Supabase URLs, publishable keys, Turnstile site keys, and Hyperdrive IDs are not committed into the repository.
