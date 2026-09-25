import test from "node:test";
import assert from "node:assert/strict";
import { routeEzstayRuntimeRequest } from "../cloudflare/ezstay-runtime/router.js";
import { createBackendAdapter } from "../cloudflare/ezstay-runtime/backend.js";

function fakeBackend() {
  const calls = [];
  return {
    calls,
    async getSession(ctx) { calls.push(["getSession", ctx]); return { session:{ id:"demo_1" }, snapshot:{ ok:true } }; },
    async runGuestRequest(ctx) { calls.push(["runGuestRequest", ctx]); return { run:{ id:"RUN-1" }, snapshot:{ ok:true } }; },
  };
}

test("private runtime routes GET session to backend", async () => {
  const backend = fakeBackend();
  const request = new Request("https://runtime.internal/api/ezstay/demo/session", { headers:{ "x-request-id":"req_1" } });
  const response = await routeEzstayRuntimeRequest({ request, backend });
  assert.equal(response.status, 200);
  assert.equal(backend.calls[0][0], "getSession");
  assert.equal(response.headers.get("x-request-id"), "req_1");
});

test("private runtime parses guest request command and idempotency context", async () => {
  const backend = fakeBackend();
  const request = new Request("https://runtime.internal/api/ezstay/scenarios/guest-request", {
    method:"POST",
    headers:{
      "content-type":"application/json",
      "x-request-id":"req_2",
      "Idempotency-Key":"cmd_guest_2"
    },
    body:JSON.stringify({ request:"Extra pillows", roomNumber:"108" })
  });
  const response = await routeEzstayRuntimeRequest({ request, backend });
  assert.equal(response.status, 200);
  assert.equal(backend.calls[0][0], "runGuestRequest");
  assert.equal(backend.calls[0][1].idempotencyKey, "cmd_guest_2");
  assert.deepEqual(backend.calls[0][1].body, { request:"Extra pillows", roomNumber:"108" });
});

test("unknown private runtime route returns 404", async () => {
  const response = await routeEzstayRuntimeRequest({
    request:new Request("https://runtime.internal/api/ezstay/not-real"),
    backend:fakeBackend(),
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "route_not_found");
});

test("default backend adapter fails closed without a configured binding", async () => {
  const backend = createBackendAdapter({});
  await assert.rejects(() => backend.getSession({}), /backend_not_configured/);
});
