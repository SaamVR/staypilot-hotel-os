import test from "node:test";
import assert from "node:assert/strict";
import { createNorthstarSeed } from "../src/ezstay/domain/seed.js";
import { resolveScenarioTargets } from "../src/ezstay/domain/scenarioTargets.js";

test("scenario targets are derived from business state, not fixture UUID conventions", () => {
  const snapshot = createNorthstarSeed();
  const targets = resolveScenarioTargets(snapshot);
  assert.equal(targets.checkoutReservationId, "res_1047");
  assert.equal(targets.lowStockInventoryItemId, "inv_queen_sheets");
  assert.equal(targets.failedDeliveryId, "DLV-400");
});

test("scenario target resolver works with backend-style opaque IDs", () => {
  const snapshot = {
    reservations:[{ id:"6e8d6cf4-9c7d-4e79-96a7-45cc75aa9c12", externalRef:"EZ-1047", status:"Checked in" }],
    inventory:[{ id:"92ab36d6-1e20-48c6-aafe-52cc3a181ed4", item:"Queen bed sheets", stock:34, par:42 }],
    deliveries:[{ id:"f570768d-3ee7-44d5-a981-a4be1b7a9e52", status:"Dead-letter" }],
  };
  assert.deepEqual(resolveScenarioTargets(snapshot), {
    checkoutReservationId:"6e8d6cf4-9c7d-4e79-96a7-45cc75aa9c12",
    lowStockInventoryItemId:"92ab36d6-1e20-48c6-aafe-52cc3a181ed4",
    failedDeliveryId:"f570768d-3ee7-44d5-a981-a4be1b7a9e52",
  });
});
