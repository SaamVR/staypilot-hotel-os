# StayPilot OS

**Interactive hotel operations command center — Portfolio Work #2**

**Live demo:** https://staypilot-hotel-os.pages.dev/

StayPilot OS is a high-fidelity hotel business automation prototype that brings reservations, room inventory, OTA/channel sync, direct booking, marketing attribution, payments, housekeeping, maintenance, and AI-assisted operations into one interface.

## What the prototype demonstrates

- Real-time style hotel KPI dashboard with occupancy, ADR, RevPAR and revenue
- Unified reservation ledger for Direct Website, Booking.com, Airbnb, Expedia and Agoda
- Shared room inventory with Available, Occupied, Reserved, Cleaning and Maintenance states
- Channel manager with synchronized rates and sellable-room inventory
- Direct booking engine that creates a reservation and immediately updates room inventory
- Meta Ads + Google campaign attribution tied to bookings and revenue
- Operations center for housekeeping, maintenance, payments and system events
- Conversational assistant that can execute prototype actions such as:
  - `Show today's arrivals`
  - `Block room 207`
  - `Mark room 103 ready`
  - `Raise rates 8%`
  - `Sync all channels`
  - `Pause Meta ads`

## Portfolio interaction model

The prototype is intentionally connected rather than a collection of static screens. A visitor can create a booking in the guest-facing booking engine, then move to Reservations or Rooms and see the same state reflected there. The AI assistant operates that same shared state.

Demo state is stored in the browser with localStorage and can be restored with **Reset demo**.

## Stack

- React + Vite
- Recharts
- Lucide icons
- Cloudflare Pages

## Integration architecture

The visible Booking.com, Airbnb, Expedia, Agoda, Meta Ads, Google Ads and payment connections are realistic prototype integration surfaces. Production deployment would require approved provider APIs/webhooks, secure credentials, payment processing and a persistent backend/database.

A production architecture would typically place a normalized hotel inventory/reservation model behind channel adapters, idempotent webhook processing, payment events and an action-audited AI/operator layer.

## Deployment

Production build:

```bash
npm install
npm run build
```

Cloudflare Pages output directory: `dist`

---

Built as a product-focused portfolio demonstration of hotel automation, dashboard UX and conversational operations.
