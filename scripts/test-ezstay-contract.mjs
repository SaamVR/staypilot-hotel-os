import test from "node:test";
import assert from "node:assert/strict";
import { BACKEND_CONTRACT_VERSION, SEED_VERSION } from "../src/ezstay/domain/constants.js";

test("EZStay freezes backend and seed contract identifiers", () => {
  assert.equal(BACKEND_CONTRACT_VERSION, "ezstay-backend-v1");
  assert.equal(SEED_VERSION, "northstar-v2");
});
