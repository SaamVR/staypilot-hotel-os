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
    "RUN-EST_651E…BE60D0",
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
  assert.match(source, /Test automations/);
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

test("operations and environment use the hotel timezone instead of the viewer timezone", () => {
  const operations = readFileSync("src/ezstay/pages/Operations.jsx", "utf8");
  const control = readFileSync("src/ezstay/components/DemoControl.jsx", "utf8");
  assert.match(operations, /formatHotelClock/);
  assert.match(operations, /snapshot\.hotel\.timezone/);
  assert.doesNotMatch(operations, /toLocaleTimeString/);
  assert.match(control, /snapshot\?\.hotel\?\.timezone/);
});

test("workspace chrome contains no dead demo-information navigation", () => {
  const shell = readFileSync("src/ezstay/components/AppShell.jsx", "utf8");
  assert.doesNotMatch(shell, /About this demo/);
  assert.doesNotMatch(shell, /Demo property/);
  assert.match(shell, />Sandbox</);
});

test("public landing markets EZStay as a product while keeping the sandbox boundary explicit", () => {
  const landing = readFileSync("src/ezstay/components/MarketingLanding.jsx", "utf8");
  const entry = readFileSync("src/ezstay/domain/entry.js", "utf8");
  assert.doesNotMatch(landing, /Working interactive prototype|interactive proofs|dashboard theatre|The demo proves|prototype<\/small>/i);
  assert.match(landing, /Core workflows/);
  assert.match(landing, /Connect the systems you already use/);
  assert.match(entry, /Sample Northstar Grand workspace/);
  assert.match(entry, /simulated/i);
});


test("normal workspace chrome presents hotel context while sandbox disclosure stays behind environment controls", () => {
  const shell = readFileSync("src/ezstay/components/AppShell.jsx", "utf8");
  assert.match(shell, /formatHotelClock/);
  assert.match(shell, /hotel time/);
  assert.match(shell, />Sandbox</);
  assert.doesNotMatch(shell, /Interactive demo · Sample data|Local preview sandbox|Backend sandbox/);
});

test("test scenarios live in the sandbox environment rather than the operational Command Center", () => {
  const command = readFileSync("src/ezstay/pages/CommandCenter.jsx", "utf8");
  const control = readFileSync("src/ezstay/components/DemoControl.jsx", "utf8");
  const launcher = readFileSync("src/ezstay/components/ScenarioLauncher.jsx", "utf8");
  assert.doesNotMatch(command, /ScenarioLauncher/);
  assert.match(control, /ScenarioLauncher/);
  assert.match(launcher, /Test automations/);
});

test("public product copy no longer directs users to an internal Workflow Lab", () => {
  const landing = readFileSync("src/ezstay/components/MarketingLanding.jsx", "utf8");
  assert.doesNotMatch(landing, /Workflow Lab/);
});
