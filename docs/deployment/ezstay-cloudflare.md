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

The first V2 preview is therefore a truthful local-preview sandbox. It must continue to show:

> Interactive demo · Sample data

and:

> Local preview sandbox

until the backend enablement gate is complete.

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
```

Do not place database passwords, service-role keys, Turnstile secrets, webhook secrets, or provider credentials in browser-visible variables.

## Turnstile

The browser supplies a Turnstile token to Supabase anonymous sign-in. Supabase Auth owns CAPTCHA verification for that sign-in flow. The Pages gateway then validates the resulting bearer identity against Supabase Auth before delegating to the private EZStay Worker.

## Future Hyperdrive binding

The private Worker will receive a Hyperdrive binding after the live backend gate. The connection identity must be the restricted `ezstay_runtime` database role, not the project owner, postgres role, or Supabase service role.

The migration creates `ezstay_runtime` with `LOGIN NOINHERIT` but deliberately does **not** commit a password. During live provisioning only:

1. generate a strong unique password outside Git;
2. set it with `ALTER ROLE ezstay_runtime WITH PASSWORD '<generated secret>'`;
3. copy the exact Supabase connection endpoint/username format from the project's Connect dialog;
4. create the Cloudflare Hyperdrive configuration with that connection string;
5. bind the resulting Hyperdrive ID to the private runtime Worker;
6. verify the connected database role is `ezstay_runtime` before enabling backend mode.

For the Supabase shared pooler, a custom role username is `ezstay_runtime.<project-ref>`; do not construct the host or project reference from memory. The database password belongs only in the secure provisioning path / Cloudflare Hyperdrive configuration, never in browser variables or the repository.

The Worker-side database adapter should use Cloudflare's recommended `pg` driver with Hyperdrive. That adapter remains disabled until the binding exists and the live migration/security gate passes.

## Production promotion

Before promotion:

- all GitHub Action gates are green;
- desktop/mobile runtime QA passes;
- all four flagship scenarios work;
- reset creates a fresh generation;
- delivery recovery does not repeat a business action;
- no copy implies that simulated third-party services are live;
- StayPilot V1 production remains unchanged.
