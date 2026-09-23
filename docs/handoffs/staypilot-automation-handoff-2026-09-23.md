# StayPilot Automation OS — Durable Handoff

Date: 2026-09-23
Repository: SaamVR/staypilot-hotel-os
Canonical demo: https://staypilot-hotel-os.pages.dev/

## Durable source state

- main source commit: `b7ab1f23fb3bc595c82b2df84c52bf2fb52577c4`
- verified Cloudflare bundle branch: `cloudflare-deploy`
- verified bundle commit: `54b7acf0828af16f4f57ccc30c295f52ae021881`
- bundle commit message ties it to source: `stage Cloudflare bundle for b7ab1f23fb3bc595c82b2df84c52bf2fb52577c4`
- verification workflow: `.github/workflows/verify.yml`
- Node 22 + npm ci + npm run build: PASS
- production artifact upload: PASS
- Cloudflare deployment branch staging: PASS

Do not restart architecture planning. Resume from this state.

## Product implemented

StayPilot is now positioned as a policy-aware hotel automation and operations layer rather than a generic PMS dashboard.

Core loop:

```
hotel event
  -> shared hotel context
  -> automation rule
  -> autonomy / policy check
  -> stateful action
  -> exception or approval when required
  -> execution trace + audit
```

### 12 workflow catalog

1. Reservation intake — reservation.created
2. Checkout turnover — guest.checked_out
3. Pre-arrival messaging — prearrival.due
4. Occupancy rate guard — occupancy.threshold
5. Failed payment recovery — payment.failed
6. Low-stock replenishment — inventory.low_stock
7. Cancellation recovery — reservation.cancelled
8. Room-ready release — housekeeping.completed
9. Room conflict guard — room.maintenance_blocked
10. Guest request router — guest.request_received
11. Approval executor — approval.approved
12. Review recovery — review.negative

### Real shared-state wiring

- new direct / front-desk reservation emits reservation.created
- checkout emits guest.checked_out and creates turnover task
- cancellation releases inventory through reservation.cancelled
- housekeeping Ready emits housekeeping.completed
- maintenance block emits room.maintenance_blocked
- inventory below par auto-emits inventory.low_stock
- Owner approval emits approval.approved
- guest inbox service requests emit guest.request_received
- common service requests normalize before task routing to avoid duplicate business actions
- occupancy threshold has one-time state-triggered automation
- payment retry and external provider behavior remain explicitly modeled, not falsely claimed live

### Owner experience

Owner dashboard is now a Property command center led by:

- Needs human attention
- Automation handled
- Estimated time saved
- Automation failures

Then normal revenue / occupancy / expense / distribution analytics.

### Manager experience

Manager workflow is shift-oriented and mobile-polished:

- arrivals
- room readiness
- maintenance
- guest requests
- low stock
- operational automations
- Owner instructions
- exceptions and approval handoff

### Governance

Automation autonomy modes:

- Auto
- Policy
- Approval
- Suggest

Owner-configurable Manager thresholds remain active for:

- rate %
- refund $
- unapproved purchase $

Audit now includes Governance category.

### Integration Hub

Added integration surfaces for:

- existing PMS bridge
- Booking.com / Airbnb / existing OTA surfaces
- payments
- QuickBooks / accounting
- WhatsApp Business
- messaging
- marketing
- built-in Webhooks & REST API

n8n / Make / Zapier are optional external consumers, not required internal dependencies.

The browser prototype models webhook replay and provider handshakes. Production requires signed HMAC webhooks, retries, idempotency, secure vault, backend queue and approved provider APIs.

### Sellable-demo layer

- Owner Property setup page
- safe automation defaults
- demo scenarios:
  - Normal
  - Problem
  - Approval
- dynamic exception badge
- channel sellable inventory / rate display derived from shared state
- Automation Center execution traces
- portfolio-truth labels tightened

## Portfolio integration

Repository: SaamVR/Portfolio

- backup branch: `backup/pre-staypilot-work2-20260923`
- merged Work #2 commit: `ba0d9eddb5c2edc86cfb98fdfd498e33b2cf5acb`
- LeadFlow remains the immersive Work #1 page
- near the end, a responsive/light-mode StayPilot Work #2 handoff was added
- primary CTA: verified StayPilot source
- secondary CTA: current Cloudflare demo

## Current deployment blocker

Remote Desktop Commander status at the end of this handoff:

- samvr `11c3dc37-590d-40d8-a174-b802ce2ae555` — OFFLINE
- samai `343458f8-1b17-40c2-ab01-d4246118d7d9` — OFFLINE
- shusmoy — OFFLINE

The Cloudflare Pages project is not GitHub-connected. Previous production deploys used the Cloudflare-authenticated samvr machine.

No source/build blocker remains.

## Resume deployment when samvr returns

Use only the staged deploy branch; do not rebuild on samvr.

Suggested minimal sequence:

```bash
rm -rf /tmp/staypilot-deploy
git clone --depth 1 --branch cloudflare-deploy https://github.com/SaamVR/staypilot-hotel-os.git /tmp/staypilot-deploy
cd /tmp/staypilot-deploy
npx --yes wrangler@2.20.1 pages publish dist \
  --project-name staypilot-hotel-os \
  --branch main \
  --commit-hash b7ab1f23fb3bc595c82b2df84c52bf2fb52577c4 \
  --commit-message "deploy StayPilot automation OS" \
  --commit-dirty=false
rm -rf /tmp/staypilot-deploy
```

Then verify:

1. deployment preview returns HTTP 200
2. canonical https://staypilot-hotel-os.pages.dev/ returns HTTP 200
3. served JS bundle contains:
   - `Property command center`
   - `Guest request router`
   - `Low-stock replenishment`
   - `Integration hub`
   - `Demo scenarios`
   - `Property setup`
4. verify cache-busted canonical URL using `?v=b7ab1f23`
5. clean any npx cache if samvr disk is again critically full

## Do not regress

- keep multidimensional room state
- keep Manager / Owner route and permission separation
- keep external integration language truthful
- do not reintroduce n8n as an internal requirement
- do not make Automation Center counters-only
- do not remove CI build verification
- do not use samvr as primary development machine
