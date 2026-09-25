import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  formatCurrency,
  formatHotelMoment,
  minutesBetween,
  shortReference,
} from "../src/ezstay/ui/format.js";

test("workspace references are compact but remain identifiable", () => {
  assert.equal(shortReference("RUN-2818"), "RUN-2818");
  assert.equal(
    shortReference("RUN-EST_651EF979-C062-4113-9DB9-66CEBBBE60D0", 12, 6),
    "RUN-EST_651…BE60D0",
  );
});

test("hotel time formatting is deterministic in the property timezone", () => {
  assert.match(formatHotelMoment("2026-09-25T10:30:00+06:00", "Asia/Dhaka"), /25 Sep 2026/);
  assert.match(formatHotelMoment("2026-09-25T10:30:00+06:00", "Asia/Dhaka"), /10:30/);
  assert.equal(minutesBetween("2026-09-25T10:30:00+06:00", "2026-09-25T09:56:00+06:00"), 34);
  assert.equal(formatCurrency(525, "USD"), "$525");
});

test("Command Center reads like an operating workspace rather than a marketing page", () => {
  const source = readFileSync("src/ezstay/pages/CommandCenter.jsx", "utf8");
  assert.match(source, />Command Center</);
  assert.match(source, /Arrivals today/);
  assert.match(source, /Departures today/);
  assert.doesNotMatch(source, /Automate the routine/);
});

test("sandbox workflow controls are visibly secondary to operating state", () => {
  const source = readFileSync("src/ezstay/components/ScenarioLauncher.jsx", "utf8");
  assert.match(source, /Controlled workflows/);
  assert.doesNotMatch(source, /Guided proof/);
});

test("Approvals expose operational context and every pending decision can be resolved", () => {
  const source = readFileSync("src/ezstay/pages/Approvals.jsx", "utf8");
  assert.match(source, /Pending value/);
  assert.match(source, /Stock \/ par/);
  assert.doesNotMatch(source, /item\.status === "Pending" && item\.inventoryItemId/);
});

test("Activity and run inspector prioritize human-readable references over raw UUID walls", () => {
  const activity = readFileSync("src/ezstay/pages/Activity.jsx", "utf8");
  const inspector = readFileSync("src/ezstay/components/RunInspector.jsx", "utf8");
  assert.match(activity, /shortReference/);
  assert.match(activity, /Delivery health/);
  assert.match(inspector, /Trace identifiers/);
  assert.match(inspector, /shortReference/);
  assert.doesNotMatch(inspector, /<h2>\{run\.id\}<\/h2>/);
});

test("Automations copy describes product controls rather than a portfolio showcase", () => {
  const source = readFileSync("src/ezstay/pages/Automations.jsx", "utf8");
  assert.doesNotMatch(source, /portfolio proof|Showcase workflow/i);
  assert.match(source, /Last run/);
});
