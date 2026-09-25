import test from "node:test";
import assert from "node:assert/strict";
import { delegateEzstayRequest } from "../functions/_shared/ezstay/gateway.js";

test("gateway fails closed when the runtime binding is missing", async () => {
  const request = new Request("https://example.test/api/ezstay/demo/session");
  const response = await delegateEzstayRequest({ request, env:{}, mutation:false });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { code:"ezstay_runtime_not_configured" });
});

test("gateway rejects mutation without Idempotency-Key before delegation", async () => {
  let delegated = false;
  const env = { EZSTAY_RUNTIME:{ fetch:async () => { delegated = true; return new Response("{}"); } } };
  const request = new Request("https://example.test/api/ezstay/demo/reset", { method:"POST" });
  const response = await delegateEzstayRequest({ request, env, mutation:true });
  assert.equal(response.status, 400);
  assert.equal(delegated, false);
  assert.equal((await response.json()).code, "idempotency_key_required");
});

test("gateway preserves request id across a successful runtime delegation", async () => {
  let seenRequestId = null;
  const env = {
    EZSTAY_RUNTIME:{
      fetch:async request => {
        seenRequestId = request.headers.get("x-request-id");
        return new Response(JSON.stringify({ ok:true }), { headers:{ "content-type":"application/json" } });
      }
    }
  };
  const request = new Request("https://example.test/api/ezstay/demo/reset", {
    method:"POST",
    headers:{ "x-request-id":"req_demo_456", "Idempotency-Key":"cmd_reset_456" }
  });
  const response = await delegateEzstayRequest({ request, env, mutation:true });
  assert.equal(response.status, 200);
  assert.equal(seenRequestId, "req_demo_456");
  assert.equal(response.headers.get("x-request-id"), "req_demo_456");
});
