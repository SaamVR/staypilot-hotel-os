import test from "node:test";
import assert from "node:assert/strict";
import { createLocalPreviewRuntime } from "../src/ezstay/runtime/localPreviewRuntime.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem:key => data.has(key) ? data.get(key) : null,
    setItem:(key,value) => data.set(key,String(value)),
    removeItem:key => data.delete(key),
  };
}

test("reset creates a fresh Northstar generation and restores the seeded failure", async () => {
  const runtime = createLocalPreviewRuntime({ storage:memoryStorage() });
  const before = await runtime.getSession();
  await runtime.retryDelivery({
    idempotencyKey:"cmd_retry_before_reset",
    deliveryId:"DLV-400",
    resetGeneration:before.session.resetGeneration,
  });
  const reset = await runtime.resetDemo({ idempotencyKey:"cmd_reset_once" });
  assert.equal(reset.session.resetGeneration, before.session.resetGeneration + 1);
  assert.equal(reset.snapshot.meta.seedVersion, "northstar-v2");
  assert.equal(reset.snapshot.deliveries.find(item => item.id === "DLV-400").status, "Dead-letter");
});

test("reset is idempotent for the same command key", async () => {
  const runtime = createLocalPreviewRuntime({ storage:memoryStorage() });
  const first = await runtime.resetDemo({ idempotencyKey:"cmd_same_reset" });
  const second = await runtime.resetDemo({ idempotencyKey:"cmd_same_reset" });
  assert.equal(second.duplicate, true);
  assert.equal(second.session.resetGeneration, first.session.resetGeneration);
});

test("commands from the previous generation are rejected after reset", async () => {
  const runtime = createLocalPreviewRuntime({ storage:memoryStorage() });
  const before = await runtime.getSession();
  await runtime.resetDemo({ idempotencyKey:"cmd_generation_reset" });
  await assert.rejects(
    () => runtime.runGuestRequest({
      idempotencyKey:"cmd_stale_after_reset",
      request:"Water",
      roomNumber:"108",
      resetGeneration:before.session.resetGeneration,
    }),
    /stale_demo_generation/
  );
});
