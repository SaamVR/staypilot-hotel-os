# StayPilot Server Orchestration Contract

Date: 2026-09-24

This is the scheduler/orchestration layer that connects StayPilot's durable inbound worker and outbound webhook dispatcher.

It is intentionally staged and disabled by default.

## Why orchestration is separate from Pages Functions

StayPilot's control plane is deployed as Cloudflare Pages Functions. File-routed Pages Functions handle HTTP requests, but the recurring Cron Trigger belongs to a separate Cloudflare Worker (or a future Cloudflare Workflow).

The architecture is therefore:

```
Cloudflare Cron Worker
       |
       | signed/authenticated POST
       v
Pages /api/orchestrate-run
       |
       +--> claim inbound events
       |      -> process safe hotel automation
       |      -> persist run/audit/outbox
       |
       +--> claim outbound webhook deliveries
              -> signed destination dispatch
              -> retry/dead-letter lifecycle
```

n8n, Make and Zapier remain optional downstream webhook consumers. They are not required to run StayPilot's own automation engine.

## Double enable gate

Two independent controls prevent accidental activation.

### Pages control-plane authority

Server environment:

```
ORCHESTRATOR_SECRET=<server-only random secret>
ORCHESTRATOR_ENABLED=false
```

`POST /api/orchestrate-run` requires:

- dedicated Supabase server configuration
- `ORCHESTRATOR_SECRET`
- `ORCHESTRATOR_ENABLED=true`
- matching `X-StayPilot-Orchestrator-Secret`

If the enable flag is false, the endpoint returns:

```
503 orchestrator_disabled
```

This means credentials can be staged without activating server automation.

### Cron Worker scheduling gate

The separate Worker uses:

```
SCHEDULER_ENABLED=false
STAYPILOT_ORIGIN=https://staypilot-hotel-os.pages.dev
ORCHESTRATOR_SECRET=<same control-plane secret>
```

When `SCHEDULER_ENABLED` is false, the scheduled handler performs no network call.

Only after both gates are true can the cron schedule execute server automation.

## Bounded orchestration

Each orchestration invocation is deliberately bounded:

- maximum cycles: 3
- worker batch: maximum 10
- dispatcher batch: maximum 10
- default cycles: 2
- default worker batch: 5
- default dispatcher batch: 5

Within every cycle:

1. claim inbound events atomically
2. execute claimed server-safe automations
3. persist automation/audit/outbox effects
4. claim outbound webhook deliveries
5. dispatch signed deliveries
6. stop early when both queues are empty

The worker runs before the dispatcher so deliveries created by the current worker pass can be eligible immediately.

Database `SKIP LOCKED` leases and Event-ID idempotency remain the concurrency authority if scheduled invocations overlap.

## Dispatcher behavior

The orchestration engine will still process inbound hotel events when outbound dispatch is not configured.

Outbound dispatch is skipped unless both exist:

- exact webhook host allowlist
- outbound signing master secret

This permits staged rollout:

1. database + worker
2. shadow worker validation
3. endpoint provisioning
4. dispatcher configuration
5. scheduled orchestration

## Files

- `functions/_shared/orchestrator.js`
- `functions/api/orchestrate-run.js`
- `cloudflare/orchestrator-worker.js`
- `cloudflare/wrangler.orchestrator.jsonc.example`
- `scripts/test-orchestration-integration.mjs`

## Scheduled Worker template

The repository ships a disabled example:

```json
{
  "name": "staypilot-orchestrator",
  "main": "cloudflare/orchestrator-worker.js",
  "triggers": {
    "crons": ["* * * * *"]
  },
  "vars": {
    "STAYPILOT_ORIGIN": "https://staypilot-hotel-os.pages.dev",
    "SCHEDULER_ENABLED": "false"
  }
}
```

The once-per-minute schedule is only a template. Do not deploy/enable it before the dedicated StayPilot backend is provisioned and shadow-mode parity is complete.

The orchestration secret must be configured as an encrypted Worker secret, not a plaintext `vars` value.

## CI contract

Backend verification proves:

- endpoint fails closed before configuration
- credentials do not activate authority by themselves
- wrong orchestration secret is rejected before queue access
- cycles and batch sizes are bounded
- worker executes before dispatcher
- dispatcher is skipped when outbound trust is unavailable
- orchestration stops when both queues are drained
- scheduled Worker is inert while disabled
- scheduled Worker uses the authenticated Pages endpoint when enabled
- scheduled Worker surfaces Pages failures instead of reporting false success

## Current production state

The contract may be deployed with the application, but it remains inactive until:

- dedicated StayPilot Supabase exists
- migrations are applied
- Pages secrets are configured
- `ORCHESTRATOR_ENABLED=true`
- separate Cron Worker is deployed
- Cron Worker secret is configured
- `SCHEDULER_ENABLED=true`

Until then, browser-local demo state remains authoritative.
