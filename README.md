# StayPilot OS

**Role-aware hotel operating system prototype — Portfolio Work #2**

**Live demo:** https://staypilot-hotel-os.pages.dev/

StayPilot OS is an interactive hotel-operations prototype for independent hotels. It demonstrates how reservations, physical rooms, housekeeping, maintenance, supplies, approvals, distribution, marketing, guest messaging, automations and an operator assistant can work from one shared property state.

## Product model

The prototype has two demo roles:

- **Owner** — business performance, finance, approval queue, inventory value, channel management, marketing, integrations, automation and property oversight.
- **Property Manager** — front desk, reservations, room readiness, housekeeping, maintenance, supply counts, purchase/expense requests, guest communication and operational automations.

The Operations Assistant uses the same role rules. Manager commands outside policy are routed to Owner approval rather than silently executed.

## Key interactive workflows

### Front desk and reservations

- 7-day room tape chart / reservation calendar
- Reservation assignment queue
- Reservation drawer with room assignment, check-in, check-out and cancellation
- Reservation folio with room charges, taxes/fees, deposits, balance capture and refunds
- Checkout is blocked until the folio balance is settled
- Manager refunds above the Owner-defined threshold become approval requests
- Internal walk-in / phone reservation entry
- Guest-facing direct booking engine
- Direct bookings reserve **room-type inventory first** and enter the assignment queue instead of immediately claiming a physical room

### Room state

Rooms use independent operational dimensions:

- **Occupancy:** Vacant / Reserved / Occupied
- **Housekeeping:** Clean / Dirty / Cleaning
- **Maintenance:** Clear / Out of order
- **Sellability:** derived from the dimensions above

This prevents housekeeping or maintenance actions from overwriting reservation/occupancy state.

### Owner ↔ Manager approval workflow

- Manager purchase, expense, refund, rate and marketing requests
- Owner approval / rejection
- Manager rate changes above the Owner-configured threshold are approval-gated
- Manager marketing commands are approval-gated
- Approved purchase orders become receivable stock; inventory does not increase until delivery is received

### Operations

- Persistent housekeeping and maintenance tasks
- Room-readiness controls
- Maintenance resolution updates the same room state used by Front Desk
- Shared owner/manager instructions and handoff notes
- Exception Center for payment, distribution, room-readiness, room-assignment and approval blockers
- Activity stream and audit history

### Guest communication

- Unified guest inbox
- Reservation context beside each conversation
- Quick response templates
- Interactive replies stored in demo state

### Roles & permissions

The Owner can configure Manager authority for:

- room / housekeeping / maintenance controls
- channel reconciliation
- supply inventory
- guest messaging
- operational automations
- marketing control

The Owner can also set configurable thresholds for rate changes, refunds and unapproved purchases. The same policy is consumed by Manager controls and the Operations Assistant.

### Automation Center

Role-aware rules demonstrate:

- Reservation intake
- Checkout → housekeeping turnover
- Pre-arrival messaging
- Occupancy-driven rate suggestions
- Failed-payment recovery
- Low-stock purchase requests

Rules can be enabled/paused and manually run in the prototype with an execution log.

### Distribution and growth

- Direct Website, Booking.com, Airbnb, Expedia and Agoda channel surfaces
- Inventory/rate reconciliation controls
- Google Hotel Ads, Google Search/PMax, Meta, TikTok and Microsoft Ads control surfaces
- Campaign budgets, target ROAS, campaign state and booking attribution

### Connections

Provider credential forms demonstrate the configuration required for OTA, payment, marketing and messaging integrations.

Connection tests and runtime health checks are **explicitly simulated** in this portfolio build. Credentials typed into the demo are not persisted.

## Shared demo state

Interactive state is stored in browser localStorage, including:

- rooms
- reservations
- approval requests
- tasks
- supplies
- expenses
- instructions
- guest messages
- automation rules/logs
- marketing/campaign controls
- activity/audit history

Use **Reset demo** to restore seeded data.

## Stack

- React 19
- Vite
- Recharts
- Lucide React
- Cloudflare Pages
- Browser localStorage for prototype persistence

The Vite production build separates React, charts and icon libraries into vendor chunks to keep the application bundle manageable.

## Production boundary

StayPilot OS is a high-fidelity prototype, not a live PMS.

A production implementation would require:

- persistent multi-tenant backend/database
- authentication and server-enforced RBAC
- payment processor integration
- approved OTA/channel partner APIs
- secure secrets vault / KMS
- webhook verification and idempotency
- real guest messaging providers
- rate/inventory adapter layer
- immutable server-side audit log
- production observability and retry queues

The prototype intentionally labels simulated provider checks and does not claim external integrations are live.

---

Built as a product-focused demonstration of hotel operations architecture, role-aware UX, automation and shared-state workflows.
