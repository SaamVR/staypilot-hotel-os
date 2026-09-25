import test from "node:test";
import assert from "node:assert/strict";
import { createLocalPreviewRuntime } from "../src/ezstay/runtime/localPreviewRuntime.js";
import { createHttpRuntime, EZSTAY_ROUTES } from "../src/ezstay/runtime/httpRuntime.js";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem:key => data.has(key) ? data.get(key) : null,
    setItem:(key, value) => data.set(key, String(value)),
    removeItem:key => data.delete(key),
    dump:() => Object.fromEntries(data),
  };
}

test("corrupt preview persistence falls back to a clean Northstar session", async () => {
  const storage = memoryStorage({ "ezstay:v2:demo":"{broken" });
  const runtime = createLocalPreviewRuntime({ storage });
  const { session, snapshot } = await runtime.getSession();
  assert.equal(session.mode, "local-preview");
  assert.equal(session.seedVersion, "northstar-v2");
  assert.equal(session.backendContractVersion, "ezstay-backend-v1");
  assert.equal(snapshot.meta.seedVersion, "northstar-v2");
});

test("incompatible preview contract is discarded", async () => {
  const storage = memoryStorage({
    "ezstay:v2:demo":JSON.stringify({
      schemaVersion:1,
      session:{ backendContractVersion:"old-contract", seedVersion:"old-seed" },
      snapshot:{ meta:{ seedVersion:"old-seed" } }
    })
  });
  const { session, snapshot } = await createLocalPreviewRuntime({ storage }).getSession();
  assert.equal(session.backendContractVersion, "ezstay-backend-v1");
  assert.equal(snapshot.meta.seedVersion, "northstar-v2");
});

test("local preview runtime exposes the frozen adapter surface", () => {
  const runtime = createLocalPreviewRuntime({ storage:memoryStorage() });
  for (const name of ["getSession","startDemo","resetDemo","runGuestRequest","runCheckout","completeHousekeeping","runLowStock","resolveApproval","retryDelivery","advanceClock","getRun"]) {
    assert.equal(typeof runtime[name], "function", name);
  }
});

test("HTTP runtime exposes the namespaced housekeeping completion route", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ run:{ id:"RUN-READY" }, snapshot:{} }), {
      status:200,
      headers:{ "content-type":"application/json" }
    });
  };
  const runtime = createHttpRuntime({ fetchImpl });
  await runtime.completeHousekeeping({ idempotencyKey:"cmd_ready_1", taskId:"task_turnover_1" });
  assert.equal(calls[0].url, EZSTAY_ROUTES.housekeepingComplete);
  assert.equal(calls[0].options.headers["Idempotency-Key"], "cmd_ready_1");
});

test("HTTP runtime uses namespaced route and Idempotency-Key", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ run:{ id:"RUN-HTTP" }, snapshot:{} }), {
      status:200,
      headers:{ "content-type":"application/json" }
    });
  };
  const runtime = createHttpRuntime({ fetchImpl });
  await runtime.runGuestRequest({ idempotencyKey:"cmd_http_1", request:"Pillows", roomNumber:"108" });
  assert.equal(calls[0].url, EZSTAY_ROUTES.guestRequest);
  assert.equal(calls[0].options.headers["Idempotency-Key"], "cmd_http_1");
});
