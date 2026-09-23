# StayPilot Server Orchestration Checkpoint — 2026-09-24

Repository: SaamVR/staypilot-hotel-os

## Verified deployed release

- application release: `ab9806003edce0795cae28cfe2de7356ac740be5`
- staged Cloudflare bundle: `aae27c84739fd21c66c6af8692af02e4f6928d52`
- preview: https://b43f28c5.staypilot-hotel-os.pages.dev
- canonical: https://staypilot-hotel-os.pages.dev/?v=ab980600
- CI: PASS — migration versions, backend contracts, worker integration, HTTP boundaries, dispatcher integration, endpoint provisioning integration, orchestration integration, Vite build, artifact staging

## Orchestration architecture

StayPilot Pages Functions remain the HTTP control plane.

A separate Cloudflare Worker contract owns Cron scheduling because recurring Cron Triggers attach to Workers/Workflows rather than ordinary file-routed Pages Functions.

Flow:

```
Cloudflare Cron Worker
  -> POST /api/orchestrate-run
  -> durable inbound worker
  -> durable outbound dispatcher
```

n8n / Make / Zapier remain optional webhook consumers, not StayPilot runtime dependencies.

## Double enable gate

Pages control plane:
- `ORCHESTRATOR_SECRET`
- `ORCHESTRATOR_ENABLED=false` by default

Separate Cron Worker:
- `SCHEDULER_ENABLED=false` by default
- `ORCHESTRATOR_SECRET` as encrypted Worker secret
- `STAYPILOT_ORIGIN=https://staypilot-hotel-os.pages.dev`

Both gates must be enabled before scheduled server automation can run.

## Scheduler safety

Implemented and CI-tested:

- maximum 3 orchestration cycles per invocation
- max worker batch 10
- max dispatcher batch 10
- default 2 cycles / 5 worker / 5 dispatcher
- worker executes before dispatcher
- stops early when both queues are empty
- dispatcher skips when outbound trust config is absent
- DB SKIP LOCKED + Event-ID idempotency remains concurrency authority
- scheduled Worker refuses foreign control-plane origins before sending the orchestration secret
- redirects are disabled
- scheduler surfaces control-plane failures instead of reporting false success

## Production QA — PASS

Preview + canonical:

- `GET /api/backend-health` → HTTP 200 / `not_configured`
- `scheduler_orchestration_authentication=false`
- `scheduler_orchestration_enabled=false`
- `POST /api/orchestrate-run` → HTTP 503 `orchestrator_not_configured`

Integration Hub:

- 6 readiness signals
- Scheduled orchestration = Not configured
- Event ingestion = Rejects requests
- desktop 1280px: no horizontal overflow
- mobile 390px: document width = viewport width
- zero browser console/page errors

## Important deployment boundary

The Pages-side orchestration endpoint is deployed.

The separate Cron Worker template is **not deployed** and **not enabled**.

No dedicated StayPilot Supabase project or real server secrets are configured.

Browser-local demo state remains authoritative.

## Next hardening sequence

1. secure tenant bootstrap/onboarding contract
2. provision dedicated StayPilot Supabase only after explicit user approval
3. apply migrations + run Supabase security advisors
4. bootstrap test tenant/auth/RLS
5. controlled signed inbound -> worker -> outbound integration QA
6. shadow-mode parity before moving frontend authority

Do not restart architecture planning from scratch.
