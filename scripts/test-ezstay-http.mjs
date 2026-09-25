import test from "node:test";
import assert from "node:assert/strict";
import { jsonResponse, requireIdempotencyKey } from "../functions/_shared/ezstay/http.js";
import { requestIdFrom } from "../functions/_shared/ezstay/request-id.js";

test("requestIdFrom preserves a valid caller request id", () => {
  const request = new Request("https://example.test", { headers:{ "x-request-id":"req_demo_123" } });
  assert.equal(requestIdFrom(request), "req_demo_123");
});

test("jsonResponse includes x-request-id", async () => {
  const response = jsonResponse({ ok:true }, { requestId:"req_demo_123" });
  assert.equal(response.headers.get("x-request-id"), "req_demo_123");
  assert.deepEqual(await response.json(), { ok:true });
});

test("requireIdempotencyKey rejects a missing key", () => {
  const request = new Request("https://example.test");
  assert.throws(() => requireIdempotencyKey(request), /idempotency_key_required/);
});
