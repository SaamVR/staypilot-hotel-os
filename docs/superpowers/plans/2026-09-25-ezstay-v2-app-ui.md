# EZStay V2 Application/UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the V2 branch's broad StayPilot screen with a focused EZStay automation workspace that works immediately in a deterministic local-preview sandbox and is ready to switch to backend-sandbox mode without UI rewrites.

**Architecture:** Keep `src/App.jsx` as a tiny root and move EZStay into focused modules under `src/ezstay`. Domain transitions stay pure/testable; persistence and backend calls sit behind a runtime adapter; React components consume the same runtime contract in local-preview and backend-sandbox modes.

**Tech Stack:** React 19, Vite 7, Lucide React, Recharts, browser localStorage for preview persistence only, Node's built-in `node:test` for pure-domain verification.

**Spec:** `docs/superpowers/specs/2026-09-25-ezstay-v2-automation-platform-design.md`

## Global Constraints

- Canonical seed: `northstar-v2`.
- Backend contract: `ezstay-backend-v1`.
- Preview persistence is clearly labeled local-preview and is not represented as server-backed.
- External actions are labeled Simulated, Demo delivery, Preview, or Test scenario.
- StayPilot V1 production is not modified.
- Primary navigation: Command Center, Operations, Automations, Approvals, Activity, Integrations.
- Four flagship scenarios plus demo-clock overdue escalation must be discoverable.
- No real guest/provider credentials are requested.

## Review Focus

1. Corrupted or older localStorage snapshot must fall back to a clean `northstar-v2` state instead of crashing.
2. Repeating the same idempotency key must return the original run/effect with no duplicate entity.
3. A flow referencing a missing reservation/room/item must return a visible failure run rather than mutate unrelated state.
4. Reset while a previous scenario result is open must close stale inspector links and show the new generation.
5. Small-screen navigation must keep all primary destinations reachable with keyboard and pointer input.

---

### Task A1: Establish the EZStay module boundary and verification command

**Files:**
- Create: `src/ezstay/index.js`
- Create: `src/ezstay/EZStayApp.jsx`
- Create: `src/ezstay/domain/constants.js`
- Create: `scripts/test-ezstay-contract.mjs`
- Modify: `src/App.jsx`
- Modify: `package.json`

**Interfaces:**
- Produces: `EZStayApp`, `BACKEND_CONTRACT_VERSION`, `SEED_VERSION`.
- Later tasks import these names exactly.

- [ ] **Step 1: Write the failing contract test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { BACKEND_CONTRACT_VERSION, SEED_VERSION } from "../src/ezstay/domain/constants.js";

test("EZStay freezes backend and seed contract identifiers", () => {
  assert.equal(BACKEND_CONTRACT_VERSION, "ezstay-backend-v1");
  assert.equal(SEED_VERSION, "northstar-v2");
});
```

- [ ] **Step 2: Run it and confirm failure**

Run:
```bash
node --test scripts/test-ezstay-contract.mjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Add constants and minimal app boundary**

```js
// src/ezstay/domain/constants.js
export const BACKEND_CONTRACT_VERSION = "ezstay-backend-v1";
export const SEED_VERSION = "northstar-v2";
export const DEFAULT_DEMO_NOW = "2026-09-25T10:30:00+06:00";
```

```jsx
// src/ezstay/EZStayApp.jsx
export default function EZStayApp() {
  return <main data-app="ezstay"><h1>EZStay</h1></main>;
}
```

```js
// src/ezstay/index.js
export { default as EZStayApp } from "./EZStayApp.jsx";
```

Replace `src/App.jsx` with a root wrapper that renders `EZStayApp`.

- [ ] **Step 4: Add `verify:ezstay`**

Package script:
```json
"verify:ezstay": "node --test scripts/test-ezstay-*.mjs"
```

- [ ] **Step 5: Verify**

```bash
npm run verify:ezstay
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/ezstay package.json scripts/test-ezstay-contract.mjs
git commit -m "feat: establish EZStay V2 application boundary"
```

### Task A2: Build canonical Northstar fixture and seed integrity tests

**Files:**
- Create: `src/ezstay/domain/seed.js`
- Create: `src/ezstay/domain/derive.js`
- Create: `scripts/test-ezstay-seed.mjs`

**Interfaces:**
- Produces: `createNorthstarSeed()`, `deriveHotelMetrics(snapshot)`, `findRoom(snapshot, roomNumber)`.

- [ ] **Step 1: Write tests for fixture consistency**

The test must assert at minimum:
```js
const state = createNorthstarSeed();
assert.equal(state.meta.seedVersion, "northstar-v2");
assert.ok(state.rooms.length >= 12);
assert.ok(state.reservations.every(r =>
  !r.roomId || state.rooms.some(room => room.id === r.roomId && room.hotelId === r.hotelId)
));
assert.ok(state.tasks.every(t =>
  !t.roomId || state.rooms.some(room => room.id === t.roomId && room.hotelId === t.hotelId)
));
assert.ok(state.inventory.every(i => i.stock >= 0 && i.par >= 0));
const metrics = deriveHotelMetrics(state);
assert.equal(metrics.totalRooms, state.rooms.length);
```

Also pin the known V1 contradiction so it cannot return: Olivia Martin's room assignment and room type must match the room record.

- [ ] **Step 2: Run test and confirm failure**

```bash
node --test scripts/test-ezstay-seed.mjs
```

- [ ] **Step 3: Implement deterministic fixture**

Use stable IDs such as:
```js
const HOTEL_ID = "hotel_northstar";
const rooms = [
  { id:"room_103", hotelId:HOTEL_ID, number:"103", type:"City Queen", occupancy:"Vacant", housekeeping:"Cleaning", maintenance:"Clear" },
  { id:"room_108", hotelId:HOTEL_ID, number:"108", type:"City Queen", occupancy:"Occupied", housekeeping:"Clean", maintenance:"Clear" },
  { id:"room_204", hotelId:HOTEL_ID, number:"204", type:"Deluxe King", occupancy:"Reserved", housekeeping:"Clean", maintenance:"Clear" },
  { id:"room_207", hotelId:HOTEL_ID, number:"207", type:"Deluxe King", occupancy:"Vacant", housekeeping:"Clean", maintenance:"Out of order" },
];
```

Expand to the complete fixture required by the spec, keeping all dashboard values derivable.

- [ ] **Step 4: Implement metric derivation**

At minimum derive:
```js
{
  totalRooms,
  occupiedRooms,
  reservedRooms,
  cleanVacantRooms,
  blockedRooms,
  openTasks,
  pendingApprovals,
  failedDeliveries
}
```

- [ ] **Step 5: Verify and commit**

```bash
npm run verify:ezstay
git add src/ezstay/domain scripts/test-ezstay-seed.mjs
git commit -m "feat: add canonical Northstar V2 demo fixture"
```

### Task A3: Implement pure automation transitions with idempotency

**Files:**
- Create: `src/ezstay/domain/automation.js`
- Create: `src/ezstay/domain/idempotency.js`
- Create: `scripts/test-ezstay-automation.mjs`

**Interfaces:**
- Produces:
```js
runGuestRequest(state, command)
runCheckout(state, command)
runLowStock(state, command)
retryDelivery(state, command)
advanceDemoClock(state, command)
```
Each returns `{ state, run, duplicate }`.

- [ ] **Step 1: Write failing tests for all five Review Focus behaviors owned by domain logic**

Include exact assertions:
- same key twice yields `duplicate === true` and identical entity IDs;
- unknown reservation produces `run.result === "Failed"`;
- delivery retry changes only delivery state;
- advancing clock creates one overdue escalation;
- reset-generation mismatch rejects stale command.

- [ ] **Step 2: Run failing test**

```bash
node --test scripts/test-ezstay-automation.mjs
```

- [ ] **Step 3: Implement command ledger**

```js
export function withIdempotency(state, key, execute) {
  const prior = state.commandLedger[key];
  if (prior) return { state, run: state.automationRuns.find(r => r.id === prior.runId), duplicate:true };
  const result = execute(state);
  return {
    ...result,
    state: {
      ...result.state,
      commandLedger: {
        ...result.state.commandLedger,
        [key]: { runId: result.run.id }
      }
    },
    duplicate:false
  };
}
```

- [ ] **Step 4: Implement each domain transition**

Business rules:
- guest request creates one request, one task, one run and one delivery;
- checkout closes reservation, marks room Vacant + Dirty and creates one turnover task;
- low stock creates approval and only creates purchase draft after approval transition represented in fixture flow;
- failed delivery retry never calls source business transition;
- overdue escalation is generated once per task/SLA crossing.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify:ezstay
git add src/ezstay/domain scripts/test-ezstay-automation.mjs
git commit -m "feat: add deterministic EZStay automation engine"
```

### Task A4: Add preview persistence and runtime adapter

**Files:**
- Create: `src/ezstay/runtime/localPreviewRuntime.js`
- Create: `src/ezstay/runtime/httpRuntime.js`
- Create: `src/ezstay/runtime/index.js`
- Create: `scripts/test-ezstay-runtime-adapter.mjs`

**Interfaces:**
- Produces the exact `ezstayRuntime` methods from the master plan.
- `createRuntime({ mode })` returns local or HTTP implementation.

- [ ] **Step 1: Write tests for corrupt persistence and contract parity**

Test a fake storage object containing invalid JSON and assert `getSession()` returns a clean seed rather than throwing.

- [ ] **Step 2: Implement local preview storage envelope**

Use:
```js
{
  schemaVersion: 1,
  session,
  snapshot
}
```

Storage key: `ezstay:v2:demo`.

- [ ] **Step 3: Implement HTTP adapter with explicit route map**

Use exactly:
```js
const ROUTES = {
  session: "/api/ezstay/demo/session",
  startDemo: "/api/ezstay/demo/start",
  resetDemo: "/api/ezstay/demo/reset",
  snapshot: "/api/ezstay/snapshot",
  guestRequest: "/api/ezstay/scenarios/guest-request",
  checkout: "/api/ezstay/scenarios/checkout",
  lowStock: "/api/ezstay/scenarios/low-stock",
  retryDelivery: "/api/ezstay/deliveries/retry",
  advanceClock: "/api/ezstay/demo/clock/advance",
  run: runId => `/api/ezstay/automation-runs/${encodeURIComponent(runId)}`
};
```

Every mutation sets:
```js
headers: {
  "content-type":"application/json",
  "Idempotency-Key": idempotencyKey
}
```

- [ ] **Step 4: Ensure incompatible persisted contract versions reset safely**

If stored `backendContractVersion !== "ezstay-backend-v1"`, discard the snapshot.

- [ ] **Step 5: Verify and commit**

```bash
npm run verify:ezstay
git add src/ezstay/runtime scripts/test-ezstay-runtime-adapter.mjs
git commit -m "feat: add EZStay runtime adapters and preview persistence"
```

### Task A5: Build shell, navigation, command center, and attention model

**Files:**
- Create: `src/ezstay/components/AppShell.jsx`
- Create: `src/ezstay/components/PrimaryNav.jsx`
- Create: `src/ezstay/pages/CommandCenter.jsx`
- Create: `src/ezstay/components/AttentionQueue.jsx`
- Create: `src/ezstay/components/AutomationFeed.jsx`
- Create: `src/ezstay/styles/tokens.css`
- Create: `src/ezstay/styles/app.css`
- Modify: `src/ezstay/EZStayApp.jsx`
- Modify: `src/main.jsx`

**Interfaces:**
- Consumes: runtime session/snapshot.
- Produces navigation state and selected linked-record navigation.

- [ ] **Step 1: Add semantic shell with six primary destinations**
- [ ] **Step 2: Add persistent banner**

Exact copy:
```text
Interactive demo · Sample data
```

Mode detail:
```text
Local preview sandbox
```
until backend mode is active.

- [ ] **Step 3: Build Command Center from derived snapshot data**
- [ ] **Step 4: Make attention queue prioritize failed delivery, overdue task, pending approval, blocked room**
- [ ] **Step 5: Add responsive navigation behavior at 768px and 430px**
- [ ] **Step 6: Build and browser-check**
- [ ] **Step 7: Commit**

```bash
git add src/ezstay src/main.jsx
git commit -m "feat: build EZStay automation command center"
```

### Task A6: Build Operations, Automations, Approvals, Activity, and Integrations pages

**Files:**
- Create: `src/ezstay/pages/Operations.jsx`
- Create: `src/ezstay/pages/Automations.jsx`
- Create: `src/ezstay/pages/Approvals.jsx`
- Create: `src/ezstay/pages/Activity.jsx`
- Create: `src/ezstay/pages/Integrations.jsx`
- Create: `src/ezstay/components/StatusBadge.jsx`
- Create: `src/ezstay/components/RecordLink.jsx`

**Interfaces:**
- Pages receive `snapshot`, runtime commands, and `openRun(runId)`.

- [ ] **Step 1: Operations shows rooms/requests/tasks without duplicate dashboard KPIs**
- [ ] **Step 2: Automations shows 12-rule catalog but visually spotlights four showcase flows**
- [ ] **Step 3: Approvals makes pending purchase approval actionable**
- [ ] **Step 4: Activity groups business events, automation runs, and delivery attempts**
- [ ] **Step 5: Integrations presents simulated provider surfaces without editable real secret forms**
- [ ] **Step 6: Build and commit**

```bash
npm run build
git add src/ezstay
git commit -m "feat: add EZStay operational workspaces"
```

### Task A7: Add guided scenarios and automation evidence inspector

**Files:**
- Create: `src/ezstay/components/ScenarioLauncher.jsx`
- Create: `src/ezstay/components/RunInspector.jsx`
- Create: `src/ezstay/components/LinkedRecords.jsx`
- Modify: `src/ezstay/pages/CommandCenter.jsx`

**Interfaces:**
- `ScenarioLauncher` calls runtime methods with generated stable per-attempt idempotency keys.
- `RunInspector` renders the master-plan automation run shape.

- [ ] **Step 1: Add four guided scenario cards**
- [ ] **Step 2: Guest request scenario pre-fills a sample request**
- [ ] **Step 3: Checkout scenario selects a valid checked-in reservation**
- [ ] **Step 4: Low-stock scenario selects a below-par item**
- [ ] **Step 5: Failure scenario creates/uses the fixture's failed delivery**
- [ ] **Step 6: Show Run Inspector sections exactly: Summary, Input, Decision, Changes, Delivery, Audit, Linked records**
- [ ] **Step 7: Clicking a linked record navigates to the resulting entity rather than showing only a toast**
- [ ] **Step 8: Commit**

### Task A8: Add Demo Control, reset, clock, accessibility, and visual QA

**Files:**
- Create: `src/ezstay/components/DemoControl.jsx`
- Create: `scripts/test-ezstay-reset.mjs`
- Modify: EZStay styles/components as required by QA.

**Interfaces:**
- DemoControl calls `resetDemo` and `advanceClock`.

- [ ] **Step 1: Write reset tests**

Assert:
- reset increments generation;
- reset restores seed counts;
- old run inspector ID is no longer active;
- stale-generation command is rejected.

- [ ] **Step 2: Implement drawer controls**

Controls:
```text
Demo time
Backend mode
Seed version
Advance +30 min
Trigger sample failure
Reset workspace
Technical details
```

- [ ] **Step 3: Verify keyboard focus, labels, contrast, reduced motion**
- [ ] **Step 4: Verify 1440/1280/768/430/390/360 layouts**
- [ ] **Step 5: Run all frontend gates**

```bash
npm run verify:ezstay
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/ezstay scripts package.json
git commit -m "feat: complete EZStay interactive demo controls"
```
