import test from "node:test";
import assert from "node:assert/strict";
import { PRIMARY_NAV } from "../src/ezstay/domain/navigation.js";

test("EZStay primary navigation stays automation-focused", () => {
  assert.deepEqual(PRIMARY_NAV.map(item => item.key), [
    "command","operations","automations","approvals","activity","integrations"
  ]);
});

test("primary navigation labels remain concise and distinct", () => {
  const labels = PRIMARY_NAV.map(item => item.label);
  assert.equal(new Set(labels).size, labels.length);
  assert.ok(labels.every(label => label.length <= 24));
});
