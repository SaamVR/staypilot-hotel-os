# StayPilot Automation OS — Durable Handoff

Date: 2026-09-23
Repository: SaamVR/staypilot-hotel-os
Canonical demo: https://staypilot-hotel-os.pages.dev/

## Durable source state

- verified application release commit: `e300fd38af719e34f57dee39dcae0df85f52251d`
- verified Cloudflare bundle branch: `cloudflare-deploy`
- verified bundle commit: `43d0d606fe0e80a5090546945d6f60dd823625a7`
- bundle commit message: `stage Cloudflare bundle for 9de867d90b407b377f435565324443a3857b9d7e`
- latest deployment preview: https://3a917355.staypilot-hotel-os.pages.dev
- canonical deployment: https://staypilot-hotel-os.pages.dev/?v=e300fd38
- verification workflow: `.github/workflows/verify.yml`
- Node 22 + npm ci + npm run build: PASS
- production artifact upload: PASS
- Cloudflare deployment branch staging: PASS
- Wrangler Pages deploy: PASS

Do not restart architecture planning or re-audit from scratch. Resume from this exact state.

## Product position

StayPilot is a policy-aware hotel automation and operations layer rather than a generic PMS dashboard.

Core execution loop:

```
hotel event
  -> shared hotel context
  -> automation rule
  -> autonomy / Owner policy check
  -> stateful action
  -> exception or approval when required
  -> execution trace + audit
```

The commercial wedge is: keep the hotel systems already in use, normalize their events, automate the repetitive work between them, and show humans only the exceptions and approvals that need judgment.

## 12 workflow catalog

1. Reservation intake — `reservation.created`
2. Checkout turnover — `guest.checked_out`
3. Pre-arrival messaging — `prearrival.due`
4. Occupancy rate guard — `occupancy.threshold`
5. Failed payment recovery — `payment.failed`
6. Low-stock replenishment — `inventory.low_stock`
7. Cancellation recovery — `reservation.cancelled`
8. Room-ready release — `housekeeping.completed`
9. Room conflict guard — `room.maintenance_blocked`
10. Guest request router — `guest.request_received`
11. Approval executor — `approval.approved`
12. Review recovery — `review.negative`

## Stateful automation wiring

- direct/front-desk reservation emits `reservation.created`
- checkout emits `guest.checked_out` and creates a persistent turnover task
- cancellation emits `reservation.cancelled` and releases inventory
- housekeeping Ready emits `housekeeping.completed`
- maintenance block emits `room.maintenance_blocked`
- below-par stock state auto-emits `inventory.low_stock`
- occupancy threshold has a one-time state trigger
- Sep 24 seeded arrival has a one-time `prearrival.due` state trigger
- Owner approval emits `approval.approved`
- Guest Inbox service requests emit `guest.request_received`
- towel/pillow/blanket/cleaning intent is normalized before task creation to avoid duplicate business actions
- payment retry remains explicitly modeled; no processor call is falsely claimed live

## Global automation safety control

Owner can pause all automation execution from Automation Center.

While paused:

- discrete hotel/integration events queue for replay
- state-driven triggers defer and re-evaluate after resume
- manual **Run workflow** actions are blocked rather than queued
- checkout/cancellation do not bypass the pause through fallback state mutations
- queue length is visible in Automation Center/sidebar
- pause/resume produces Governance audit activity

When Owner resumes:

- queued events replay through the same event engine
- state triggers re-evaluate
- normal rule status/autonomy/policy gates still apply

Prototype queue is browser-local and capped. Production requires durable server-side queue, idempotency, transaction/concurrency control, retry/DLQ and observability.

## Automation Center

Each rule exposes:

- event/trigger
- action chain
- active/paused state
- autonomy: Auto / Policy / Approval / Suggest
- runs/failures
- estimated staff minutes saved
- execution duration and steps

Current UX:
- scope filter: All / Operations / Revenue / Finance / Governance / Guest experience as available
- run-history filter: All / Failures / Approvals
- execution history follows the selected workflow scope

## Owner experience

Owner dashboard is a **Property command center** led by:

- Needs human attention
- Automation handled
- Estimated time saved
- Automation failures

Then revenue, occupancy, expenses, approvals, distribution and business metrics.

## Manager experience

Manager dashboard is shift-oriented:

- arrivals
- rooms ready / attention
- maintenance
- guest requests
- low stock
- Owner instructions
- operations activity
- permitted automations

Mobile 390px browser QA previously passed with no horizontal overflow.

## Governance

Automation autonomy modes:
- Auto
- Policy
- Approval
- Suggest

Owner-configurable Manager controls include:
- room/housekeeping/maintenance
- channel reconciliation
- supply inventory
- guest messaging
- operational automation
- marketing

Thresholds:
- rate adjustment %
- refund $
- unapproved purchase $

Audit includes Governance.

## Integration Hub

Current portfolio surfaces:
- Existing PMS bridge
- Booking.com / Airbnb / OTA architecture
- Stripe / payments
- QuickBooks / accounting
- WhatsApp Business
- guest messaging
- marketing providers
- Webhooks & REST API

### Inbound event lab

Integration Hub can simulate normalized inbound events and feed them into the same automation engine:

- `guest.request_received`
- `payment.failed`
- `review.negative`
- `prearrival.due`
- `occupancy.threshold`

The event lab is a browser simulation. Production inbound webhooks require signature verification, tenant resolution, replay/idempotency protection and durable queueing.

### Webhook model

The UI demonstrates:
- endpoint subscriptions
- delivery history
- status/success rate
- replay
- event configuration

Production design:
- HMAC signatures
- event IDs
- idempotency keys
- retries
- replay
- KMS/secrets vault

n8n / Make / Zapier are optional external consumers, not internal dependencies.

## Sellable-demo layer

- Owner Property Setup onboarding
- safe automation defaults
- Normal / Problem / Approval one-click scenarios
- dynamic exception badge
- channel inventory/ADR derived from shared hotel state
- Integration Hub event lab
- Event-ID idempotency / duplicate-suppression proof
- paused-event queue dedupe
- Owner automation master safety pause
- automation ROI/time-saved framing
- truth labels for simulated external providers

## QA already completed before the final safety release

Live browser QA on the automation/integration release immediately before the safety control:
- Owner desktop render: clean
- Automation Center: 12 workflows visible
- Manager 390px: clean, no horizontal overflow
- Integration Hub: clean
- zero console/page errors
- pre-arrival trigger executed
- `review.negative` inbound event created Guest recovery exception and automation run
- exception badge updated

## Final safety-release QA — PASS

The deployed application source `12cb4d22` was tested against canonical production with a fresh headless Chrome session.

Verified sequence:

1. Owner opened Automation Center and clicked **Pause all automations**
2. `sp-automation-master` became `"Paused"`
3. Sep 24 pre-arrival state was re-armed while paused
4. reload kept Liam unsent, wrote no pre-arrival sentinel, and queued no state-trigger event
5. Integration Hub sent `review.negative`
6. `sp-automation-queue` contained exactly that discrete event
7. no Guest recovery exception existed before resume
8. Automation Center displayed **1 queued event**
9. Owner clicked **Resume automations**
10. queue returned to zero
11. Review recovery created its Guest recovery exception
12. `review.negative` appeared in automation history
13. deferred `prearrival.due` re-evaluated and executed
14. Liam became `preArrivalStatus: "Sent"`
15. automation master returned to `"Active"`
16. browser reported zero console/page errors
17. no horizontal overflow was detected

This confirms the browser prototype's pause → queue/defer → resume → replay semantics are working on canonical production.

## Idempotency reliability release QA — PASS

Verified on canonical production for application release `9de867d9` at a 1280px viewport.

- Integration Hub rendered with no horizontal overflow.
- **Send new event** created one `review.negative` automation run.
- **Replay same ID** left the run count unchanged and displayed **Duplicate suppressed**.
- With the global automation pause active, a new `guest.request_received` Event ID produced exactly one queued item.
- Replaying that same queued Event ID kept queue length at one and displayed **Duplicate already queued**.
- Resuming automations drained the queue to zero and produced exactly one guest-request automation run.
- automation master returned to `Active`.
- browser reported zero console/page errors.

This verifies duplicate delivery protection for both immediate execution and paused-event queueing in the browser prototype.

## Portfolio integration

Repository: SaamVR/Portfolio

- backup branch: `backup/pre-staypilot-work2-20260923`
- current Portfolio main commit: `c9aa0847c746094ecf7211013d026199221c85cb`
- LeadFlow remains the immersive Work #1 page
- StayPilot Work #2 handoff is responsive and light-mode aware
- source CTA points to StayPilot repo
- Cloudflare CTA points to canonical demo
- live Portfolio preview: https://ecfbdf1d.leadflow-ai-bhy.pages.dev
- primary Portfolio alias: https://leadflow-ai-bhy.pages.dev/

Portfolio Work #2 displays `Verified main · 12cb4d22` and is synchronized with the deployed application release.

## Deployment environment

Current usable Remote Desktop Commander deployment device:
- samvr: `cb5e4d5b-acff-4751-91a2-3d6d730f8a38`

Installed:
- Wrangler: `~/.local/wrangler-cli/node_modules/.bin/wrangler` (4.136.3)
- Google Chrome: `/usr/bin/google-chrome`
- Puppeteer: `/home/ubuntu/.local/share/desktop-commander-pinned/node_modules/puppeteer`

Disk is tight. Do not install heavy dependencies.

Deployment pattern:

```bash
rm -rf /tmp/staypilot-deploy
git clone --depth 1 --single-branch --branch cloudflare-deploy \
  https://github.com/SaamVR/staypilot-hotel-os.git /tmp/staypilot-deploy
cd /tmp/staypilot-deploy

~/.local/wrangler-cli/node_modules/.bin/wrangler pages deploy dist \
  --project-name staypilot-hotel-os \
  --branch main \
  --commit-hash 9de867d90b407b377f435565324443a3857b9d7e \
  --commit-message "deploy StayPilot idempotency reliability release" \
  --commit-dirty=false

rm -rf /tmp/staypilot-deploy
```

Current deployed preview:
https://3980d10b.staypilot-hotel-os.pages.dev

## Production boundary

This remains a portfolio prototype.

Still required for commercial SaaS:
- multi-tenant backend/database
- authentication and server-enforced RBAC
- durable queue/event bus and scheduler
- transactional/idempotent actions
- provider-certified PMS/OTA/payment/messaging/accounting connectors
- KMS/secrets vault
- verified signed webhooks
- immutable server audit
- observability, retries and DLQ
- tenant isolation/rate limiting
- production billing/support/ops

## Do not regress

- keep multidimensional room state
- keep Owner/Manager route and permission separation
- keep automation master pause as an execution boundary
- keep discrete paused events queued and state triggers deferred
- keep external integration claims truthful
- do not make n8n required
- do not reduce Automation Center to counter-only simulation
- do not remove CI build verification
- do not use samvr as primary development machine


## Automation run inspector production QA — PASS

Verified on canonical production for release `4f289274`.

- New Reservation opens without runtime errors.
- New Reservation contains no stray automation inspector.
- seeded Failed Payment Recovery trace opens the inspector with 3 execution steps.
- failed run action routes to Exception Center.
- fresh `review.negative` Event-ID run opens with Event ID and **Idempotency protected** proof.
- Review Recovery action routes to Unified Guest Inbox.
- mobile 390px inspector width equals viewport width with no horizontal overflow.
- desktop run inspector has no horizontal overflow.
- browser reported zero console/page errors.

This closes the accidental duplicate-inspector JSX issue and verifies the run-trace trust layer end-to-end.


## Public repository metadata

StayPilot GitHub description was updated to:

> Policy-aware hotel automation OS prototype with event-driven workflows, human approvals, idempotent integrations, exceptions and audit traces.

Repository homepage points to:
https://staypilot-hotel-os.pages.dev/

This replaces the obsolete “AI concierge dashboard” positioning.


## Production backend foundation QA — PASS

Verified on canonical production for application release `e300fd38`.

Server contract:
- `GET /api/backend-health` returns `ok: true`, `mode: not_configured`, database=false, signature=false.
- `POST /api/events` returns HTTP 503 `backend_not_configured` while dedicated Supabase/signing secrets are absent.
- both fresh preview and canonical alias expose the Pages Functions.
- no unrelated Supabase project was reused.

Integration Hub:
- desktop shows **Foundation staged · fail-closed**.
- 390px mobile opens Integration Hub successfully.
- mobile document width = viewport width = 390px.
- webhook table remains horizontally scrollable inside a 360px container instead of widening the page.
- inbound endpoint URL wraps safely.
- zero browser console/page errors.

Backend source:
- multi-tenant Supabase migration with RLS.
- Owner / Manager / Staff membership model.
- durable `hotel_id + event_id` uniqueness.
- HMAC SHA-256 + timestamp verification.
- duplicate-safe inbound event insert.
- automation-run/audit/webhook persistence models.
- CI backend security contract on every PR/push.

The server foundation is deployed but intentionally dormant. The verified frontend remains browser-local authority until a dedicated StayPilot Supabase project and server secrets are explicitly provisioned.
