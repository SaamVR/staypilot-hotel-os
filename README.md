# StayPilot Automation OS

**Policy-aware hotel automation and operations layer — Portfolio Work #2**

**Live demo:** https://staypilot-hotel-os.pages.dev/

StayPilot is a high-fidelity prototype for independent hotels that connects operational context, automates repetitive hotel work, escalates exceptions, and keeps Owners in control of sensitive actions.

The commercial wedge is intentionally **not “replace every hotel system.”** StayPilot can sit above an existing PMS/channel stack, normalize its events, execute hotel workflows, and route only the decisions that require a human.

> One hotel state. Every person, integration and automation works from it.

## Product model

StayPilot is built around this execution loop:

```
Domain event
  → hotel context
  → automation rule
  → authority / policy check
  → action(s)
  → result
  → audit + execution trace
```

The prototype has two demo roles:

- **Owner** — property health, exception queue, approvals, automation authority, finance, integrations, revenue controls and audit.
- **Property Manager** — front desk, room readiness, guest requests, supplies, operational automations and Owner-routed requests.

The Operations Assistant uses the same permissions and thresholds as the rest of the product. Restricted Manager actions are escalated rather than silently executed.

## Automation Engine

The Automation Center operates on the same shared hotel state as reservations, rooms, tasks, approvals, inventory and rate controls. “Run workflow” therefore changes product state; it is not a counter-only demo.

Each automation exposes:

- event / trigger
- actions
- autonomy mode
- run count and failures
- estimated staff time saved
- execution trace
- duration
- audit actor
- clickable run inspector with Run ID, Event ID, scope, autonomy and step-by-step execution trace
- contextual routing from the run inspector to Exceptions, Approval Center or Guest Inbox

### Autonomy modes

Owners can choose how far a workflow may act:

- **Auto** — execute automatically
- **Policy** — execute within configured limits; escalate above them
- **Approval** — create a human decision before the sensitive action
- **Suggest** — recommend only

Manager financial authority is independently configurable for rate changes, refunds and purchasing.

### Global automation safety pause

The Owner can pause all automation execution without destroying hotel state or rule configuration.

While paused:

- discrete inbound and operational hotel events are queued for replay
- state-driven triggers are deferred and re-evaluate when automation resumes
- manual **Run workflow** actions are blocked rather than queued
- checkout and cancellation do not bypass the safety boundary with fallback mutations
- the UI exposes the queued-event count and the global paused state

When the Owner resumes automation, queued events are replayed through the same rule, policy, autonomy and audit path as normal execution.

The browser prototype keeps this queue in `localStorage` and caps it for demonstration. A production implementation requires a durable server-side queue, transactional/idempotent handlers, concurrency control and dead-letter/retry handling.

## 12 commercial workflow templates

### 1. Reservation intake — `reservation.created`

Stateful in the prototype.

- holds room-type inventory
- records distribution reconciliation
- records guest confirmation
- opens the arrival workflow
- writes automation trace and audit event

New direct and front-desk reservations emit this event.

### 2. Checkout turnover — `guest.checked_out`

Stateful in the prototype.

- occupancy → Vacant
- housekeeping → Dirty
- creates a persistent checkout-turnover task
- recalculates sellability
- writes automation trace and audit event

### 3. Pre-arrival messaging — `prearrival.due`

Stateful internal action; the portfolio build includes a one-time state trigger for the seeded Sep 24 arrival, but does **not** include a production scheduler or live messaging provider.

- detects the upcoming seeded arrival
- marks the guest pre-arrival workflow sent
- records delivery/tracking state
- writes execution history

### 4. Occupancy rate guard — `occupancy.threshold`

Stateful in the prototype.

- detects the configured occupancy threshold
- creates a rate recommendation
- checks Owner policy
- applies an in-policy adjustment or creates an Owner approval
- records downstream rate reconciliation

The demo also includes a one-time state-triggered occupancy check.

### 5. Failed payment recovery — `payment.failed`

Stateful exception workflow; no real processor retry occurs in the portfolio build.

- marks the reservation payment-at-risk
- models a retry attempt
- creates a persistent payment exception
- routes attention to the front desk

### 6. Low-stock replenishment — `inventory.low_stock`

Stateful and automatically detected from shared stock state.

- detects below-par inventory
- calculates reorder quantity and cost
- checks purchasing authority
- creates an approved PO inside policy or an Owner approval above policy
- prevents duplicate open purchase actions

### 7. Cancellation recovery — `reservation.cancelled`

Stateful in the prototype.

- releases the assigned room
- releases room-type inventory
- records channel reconciliation
- restores resale availability

### 8. Room-ready release — `housekeeping.completed`

Stateful in the prototype.

- marks housekeeping Clean
- closes matching housekeeping work
- recalculates sellability
- records availability reconciliation

### 9. Room conflict guard — `room.maintenance_blocked`

Stateful in the prototype.

- checks whether an active stay depends on the blocked room
- searches compatible sellable alternatives
- creates a high-priority conflict exception
- records suggested replacement rooms

### 10. Guest request router — `guest.request_received`

Stateful internal workflow; live message classification/provider intake is not connected.

- classifies the demo request
- selects the operating team
- creates a service task
- starts an SLA-style response record

### 11. Approval executor — `approval.approved`

Stateful in the prototype.

- releases the approved action
- closes the human-in-the-loop handoff
- writes an automation trace

Existing approval handlers also execute supported rate, marketing and refund state changes.

### 12. Review recovery — `review.negative`

Stateful internal exception workflow; no live review provider is connected.

- creates a service-recovery exception
- routes follow-up to the Manager
- records the escalation

## Exception-first Owner experience

The Owner dashboard is now a **Property command center**, led by:

- human attention required
- automation actions handled
- estimated staff time saved
- automation failures

Traditional revenue, expense, occupancy and distribution analytics remain available underneath. The design goal is:

> Routine work disappears into automation; exceptions remain visible.

## Manager shift experience

The Manager sees operating priorities instead of an Owner analytics clone:

- arrivals
- rooms not ready
- maintenance
- guest requests
- low stock
- Owner instructions
- operational automation state

## Shared hotel operating state

Rooms keep independent dimensions:

- **Occupancy:** Vacant / Reserved / Occupied
- **Housekeeping:** Clean / Dirty / Cleaning
- **Maintenance:** Clear / Out of order
- **Sellability:** derived

Other shared state includes:

- reservations and folios
- approvals
- housekeeping / maintenance / guest-service tasks
- supplies
- expenses
- guest conversations
- automation rules and run history
- policy
- activity / audit events

This separation is important: a housekeeping or maintenance automation cannot accidentally overwrite reservation occupancy.

## Human-in-the-loop governance

The Owner can configure Manager permission for:

- room / housekeeping / maintenance controls
- channel reconciliation
- supply inventory
- guest messaging
- operational automations
- marketing control

The Owner can configure:

- maximum Manager rate adjustment
- Manager refund limit
- unapproved purchase limit

Actions above limits become Owner approvals.

## Integration Hub

StayPilot treats integrations as adapters around the automation engine rather than dependencies inside every workflow.

Current portfolio surfaces include:

- existing PMS bridge
- Booking.com
- Airbnb
- Stripe
- QuickBooks / accounting
- WhatsApp Business
- guest email/messaging
- marketing platforms
- **Webhooks & REST API**

### Built-in webhook model

The Integration Hub demonstrates:

- subscribed events
- delivery history
- status / success rate
- replay
- event-oriented endpoint configuration
- an inbound-event test console for PMS/payment/guest/reputation-style events
- the same normalized inbound events executing through StayPilot's policy-aware automation engine
- visible Event IDs / idempotency keys
- **Send new event** versus **Replay same ID** duplicate-suppression proof
- paused-event queue dedupe so the same Event ID is stored only once

Production architecture is designed around:

- HMAC signatures
- event IDs
- atomic idempotency storage / uniqueness constraints
- idempotency keys
- retries
- delivery replay
- secure credential storage

**n8n, Make, Zapier and custom scripts are optional webhook/API consumers. They are not required for StayPilot’s internal automations.**

Provider connection tests, webhook delivery and external API outcomes are explicitly modeled/simulated in this browser prototype. The application does not claim to be calling live OTA, accounting, payment, WhatsApp or ad APIs.

The browser demo persists up to 120 processed inbound Event IDs in localStorage. This demonstrates the behavior only; production exactly-once business effects require transactional server-side idempotency and durable queue semantics.

## Property setup

Owner onboarding is designed to minimize migration friction:

1. property profile
2. connect existing PMS / booking source
3. connect guest messaging
4. connect finance
5. invite operating team
6. choose automation authority

The prototype includes safe default approval thresholds and setup progress.

## Demo scenarios

The sidebar contains three deterministic sales/demo scenarios:

- **Normal** — creates a Booking.com-style reservation and runs Reservation Intake
- **Problem** — blocks an assigned room and runs Room Conflict Guard
- **Approval** — requests a +14% rate change, exceeds the default +10% Manager limit and escalates it to the Owner

These scenarios are intended to demonstrate outcomes rather than require a prospect to manually manufacture hotel state.

## Existing hotel operations

StayPilot still includes the operational surfaces needed to give automations context:

- front-desk tape chart
- reservation drawer / assignment / check-in / check-out / cancellation
- folio, balance capture and refund workflow
- room board
- guest inbox
- supplies and purchasing
- expenses
- channel manager
- marketing controls
- team instructions
- audit log
- exception center
- deterministic Operations Assistant

## Demo persistence

Interactive state is stored in browser `localStorage`.

Use **Reset demo** to restore seeded state. Reset also clears automation sentinels, webhook demo state, onboarding progress, the global automation safety pause and any queued demo events.

## Stack

- React 19
- Vite
- Recharts
- Lucide React
- Cloudflare Pages
- browser localStorage for prototype persistence
- GitHub Actions production-build verification

## Verification

`.github/workflows/verify.yml` runs on pull requests and relevant pushes:

- Node 22
- `npm ci`
- `npm run build`

This provides a durable build guardrail independent of the development machine.

## Production backend foundation

The repository now contains a **dormant server-side foundation** for the next commercial phase:

- Supabase multi-tenant schema with RLS
- Owner / Manager / Staff membership model
- durable inbound Event IDs and database-level idempotency
- automation-run, audit and webhook-delivery persistence models
- Cloudflare Pages Functions for signed inbound event ingestion and backend health
- HMAC/timestamp replay protection
- CI security-contract verification
- dormant durable worker with atomic SKIP LOCKED claims, retries/dead-lettering and stale-lease recovery
- durable outbound webhook outbox with endpoint/Event-ID dedupe for optional n8n, Make, Zapier or custom consumers
- Owner-authenticated webhook endpoint registration + signed challenge verification with server-derived per-endpoint credentials
- verified-host outbound dispatcher with exact HTTPS allowlisting, server-managed signing secrets, HMAC delivery signatures and bounded retry/dead-letter handling
- audited delivery-only dead-letter redrive that never replays the source hotel action
- staged server orchestration contract with a separate Cloudflare Cron Worker, bounded worker→dispatcher draining and double enable gates
- secure tenant bootstrap contract: confirmed session → transactional hotel + first Owner + safe automation defaults + audit, idempotent and disabled by default
- secure team onboarding contract: Owner-issued hashed single-use Manager/Staff invites, confirmed-email acceptance, revoke/expiry handling and Governance audit, disabled by default

No dedicated StayPilot Supabase project has been provisioned yet, and no unrelated Supabase project is reused. Until server secrets and a dedicated database are explicitly configured, `/api/events` fails closed and the verified portfolio frontend remains local-first.

The staged `/api/worker-run` endpoint also fails closed until a separate server-only `WORKER_SECRET` and the dedicated database exist. Its current safe server-handler set is deliberately limited to non-financial hotel operations.

See `docs/production-backend-foundation.md` for the staged rollout contract.

See `docs/server-orchestration-contract.md` for the scheduler/control-plane split and rollout gates.

See `docs/tenant-bootstrap-contract.md` for the first-tenant transaction, idempotency and safe onboarding rollout gate.

See `docs/team-onboarding-contract.md` for Owner invite, acceptance, revocation and membership authority rules.

## Production boundary

StayPilot Automation OS remains a portfolio prototype, not a production hotel control plane.

A commercial implementation still requires:

- multi-tenant backend/database
- authentication and server-enforced RBAC
- durable event bus / queue
- deployed/enabled scheduled job service (the fail-closed Cron Worker contract is staged in-repo)
- transactional/idempotent action execution
- live PMS / OTA partner adapters
- real payment processor integration
- real WhatsApp/email provider integration
- secure secrets vault / KMS
- verified inbound and signed outbound webhooks
- immutable server-side audit log
- production observability, retry queues and dead-letter handling
- tenant isolation, rate limiting and operational safeguards

The internal hotel workflows in this demo mutate real shared prototype state. External provider calls remain clearly modeled until approved APIs and backend infrastructure exist.

---

Built as a product-focused demonstration of **hotel operations automation, policy-aware execution, human approvals, exception handling and integration architecture**.
