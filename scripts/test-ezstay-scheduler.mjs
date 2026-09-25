import test from "node:test";
import assert from "node:assert/strict";
import { runScheduledTick } from "../cloudflare/ezstay-runtime/scheduler.js";

test("scheduler is disabled by default and claims no work", async () => {
  let called = false;
  const backend = { runScheduledWork:async () => { called = true; return {}; } };
  const result = await runScheduledTick({}, backend);
  assert.deepEqual(result, { skipped:true, reason:"scheduler_disabled" });
  assert.equal(called, false);
});

test("enabled scheduler caps a requested batch to ten", async () => {
  let received = null;
  const backend = {
    runScheduledWork:async input => {
      received = input;
      return { processed:input.batchSize };
    }
  };
  const result = await runScheduledTick({ EZSTAY_SCHEDULER_ENABLED:"true", EZSTAY_SCHEDULER_BATCH:"999" }, backend);
  assert.equal(received.batchSize, 10);
  assert.equal(result.processed, 10);
});
