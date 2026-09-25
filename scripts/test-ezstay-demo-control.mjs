import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_CONTROL_ACTIONS, describeDemoMode } from "../src/ezstay/domain/demoControl.js";

test("Demo Control exposes only safe deterministic actions", () => {
  assert.deepEqual(DEMO_CONTROL_ACTIONS.map(item => item.key), [
    "advance-clock",
    "sample-failure",
    "reset-workspace",
    "technical-details",
  ]);
});

test("Demo Control clearly distinguishes local and backend sandboxes", () => {
  assert.equal(describeDemoMode("local-preview"), "Local preview sandbox");
  assert.equal(describeDemoMode("backend-sandbox"), "Backend sandbox");
  assert.equal(describeDemoMode("unknown"), "Demo unavailable");
});
