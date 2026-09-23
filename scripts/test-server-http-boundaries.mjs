import assert from "node:assert/strict";
import { hmacSha256Hex } from "../functions/_shared/webhook.js";
import { onRequestGet as healthGet } from "../functions/api/backend-health.js";
import {
  onRequestPost as eventsPost,
  onRequestOptions as eventsOptions,
  onRequest as eventsFallback,
} from "../functions/api/events.js";
import {
  onRequestPost as workerPost,
  onRequest as workerFallback,
} from "../functions/api/worker-run.js";
import {
  onRequestPost as dispatcherPost,
  onRequest as dispatcherFallback,
} from "../functions/api/webhook-dispatch-run.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

async function withMockFetch(fetchMock, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = fetchMock;
  try {
    return await fn();
  } finally {
    globalThis.fetch = original;
  }
}

function makeEventRequest({
  secret = "integration-signing-secret",
  hotelId = "11111111-1111-4111-8111-111111111111",
  eventId = "evt_http_001",
  eventType = "guest.request_received",
  payload = { request:"Extra towels", room_number:"204" },
  timestamp = String(Math.floor(Date.now() / 1000)),
  signature,
} = {}) {
  const body = JSON.stringify(payload);
  return Promise.resolve(
    signature ?? hmacSha256Hex(secret, `${timestamp}.${body}`)
  ).then(sig => new Request("https://staypilot.test/api/events", {
    method:"POST",
    headers:{
      "content-type":"application/json",
      "x-staypilot-hotel-id":hotelId,
      "x-staypilot-event-id":eventId,
      "x-staypilot-event-type":eventType,
      "x-staypilot-timestamp":timestamp,
      "x-staypilot-signature":`v1=${sig}`,
    },
    body,
  }));
}

const fullEnv = {
  SUPABASE_URL:"https://mock.supabase.test",
  SUPABASE_SECRET_KEY:"server-key",
  WEBHOOK_SIGNING_SECRET:"integration-signing-secret",
  WORKER_SECRET:"integration-worker-secret",
  DISPATCHER_SECRET:"integration-dispatcher-secret",
  WEBHOOK_ALLOWED_HOSTS:"hooks.example.com,workflow.example.com",
};

// 1. Health reports fail-closed dependencies truthfully when unconfigured.
{
  const response = await healthGet({ env:{} });
  assert.equal(response.status, 200);
  const body = await readJson(response);
  assert.equal(body.ok, true);
  assert.equal(body.configured, false);
  assert.equal(body.mode, "not_configured");
  assert.deepEqual(body.dependencies, {
    database:false,
    inbound_signature_verification:false,
    durable_worker_authentication:false,
    outbound_dispatcher_authentication:false,
    outbound_host_allowlist:false,
  });
}

// 2. Health becomes configured only when all three server dependencies exist.
{
  const response = await healthGet({ env:fullEnv });
  const body = await readJson(response);
  assert.equal(body.configured, true);
  assert.equal(body.mode, "configured");
  assert.deepEqual(body.dependencies, {
    database:true,
    inbound_signature_verification:true,
    durable_worker_authentication:true,
    outbound_dispatcher_authentication:true,
    outbound_host_allowlist:true,
  });
}

// 3. Inbound event endpoint fails closed before server dependencies exist.
{
  const request = await makeEventRequest();
  let fetched = false;
  const response = await withMockFetch(async () => {
    fetched = true;
    throw new Error("database should not be called");
  }, () => eventsPost({ request, env:{} }));
  assert.equal(response.status, 503);
  assert.equal((await readJson(response)).error, "backend_not_configured");
  assert.equal(fetched, false);
}

// 4. Invalid HMAC is rejected before any database access.
{
  const request = await makeEventRequest({ signature:"0".repeat(64) });
  let fetched = false;
  const response = await withMockFetch(async () => {
    fetched = true;
    throw new Error("database should not be called");
  }, () => eventsPost({ request, env:fullEnv }));
  assert.equal(response.status, 401);
  assert.equal((await readJson(response)).error, "invalid_signature");
  assert.equal(fetched, false);
}

// 5. A valid signed event is durably accepted and maps Supabase persistence correctly.
{
  const request = await makeEventRequest({ eventId:"evt_http_accept_001" });
  let persisted = null;
  const response = await withMockFetch(async (url, options = {}) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.pathname, "/rest/v1/inbound_events");
    assert.match(parsed.search, /on_conflict=hotel_id%2Cevent_id|on_conflict=hotel_id,event_id/);
    assert.equal(options.method, "POST");
    assert.match(options.headers.prefer, /ignore-duplicates/);
    persisted = JSON.parse(options.body);
    return new Response(JSON.stringify([{
      id:"inbound-http-1",
      event_id:persisted.event_id,
      event_type:persisted.event_type,
      status:"queued",
      received_at:"2026-09-24T00:00:00Z",
    }]), { status:201, headers:{ "content-type":"application/json" } });
  }, () => eventsPost({ request, env:fullEnv }));

  assert.equal(response.status, 202);
  const body = await readJson(response);
  assert.equal(body.accepted, true);
  assert.equal(body.duplicate, false);
  assert.equal(body.status, "queued");
  assert.equal(persisted.hotel_id, "11111111-1111-4111-8111-111111111111");
  assert.equal(persisted.event_id, "evt_http_accept_001");
  assert.equal(persisted.event_type, "guest.request_received");
  assert.equal(persisted.status, "queued");
  assert.match(persisted.payload_hash, /^[a-f0-9]{64}$/);
}

// 6. A database uniqueness collision returns duplicate success, not a repeated effect.
{
  const request = await makeEventRequest({ eventId:"evt_http_duplicate_001" });
  const response = await withMockFetch(async () => (
    new Response(JSON.stringify([]), {
      status:201,
      headers:{ "content-type":"application/json" },
    })
  ), () => eventsPost({ request, env:fullEnv }));

  assert.equal(response.status, 200);
  const body = await readJson(response);
  assert.equal(body.ok, true);
  assert.equal(body.duplicate, true);
  assert.equal(body.status, "already_recorded");
}

// 7. CORS preflight and unsupported methods expose narrow method contracts.
{
  const options = await eventsOptions();
  assert.equal(options.status, 204);
  assert.match(options.headers.get("access-control-allow-methods") || "", /POST/);

  const fallback = eventsFallback();
  assert.equal(fallback.status, 405);
  assert.equal(fallback.headers.get("allow"), "POST, OPTIONS");

  const worker = workerFallback();
  assert.equal(worker.status, 405);
  assert.equal(worker.headers.get("allow"), "POST");

  const dispatcher = dispatcherFallback();
  assert.equal(dispatcher.status, 405);
  assert.equal(dispatcher.headers.get("allow"), "POST");
}

// 8. Worker endpoint fails closed before database/worker secret configuration.
{
  const request = new Request("https://staypilot.test/api/worker-run", {
    method:"POST",
    headers:{ "content-type":"application/json" },
    body:JSON.stringify({ batch_size:3 }),
  });
  let fetched = false;
  const response = await withMockFetch(async () => {
    fetched = true;
    throw new Error("database should not be called");
  }, () => workerPost({ request, env:{} }));
  assert.equal(response.status, 503);
  assert.equal((await readJson(response)).error, "worker_not_configured");
  assert.equal(fetched, false);
}

// 9. Wrong worker secret is rejected before claiming anything.
{
  const request = new Request("https://staypilot.test/api/worker-run", {
    method:"POST",
    headers:{
      "content-type":"application/json",
      "x-staypilot-worker-secret":"wrong-secret",
    },
    body:JSON.stringify({ batch_size:3 }),
  });
  let fetched = false;
  const response = await withMockFetch(async () => {
    fetched = true;
    throw new Error("database should not be called");
  }, () => workerPost({ request, env:fullEnv }));
  assert.equal(response.status, 401);
  assert.equal((await readJson(response)).error, "worker_unauthorized");
  assert.equal(fetched, false);
}

// 10. Authorized worker requests atomically claim a bounded batch.
{
  const request = new Request("https://staypilot.test/api/worker-run", {
    method:"POST",
    headers:{
      "content-type":"application/json",
      "x-staypilot-worker-secret":"integration-worker-secret",
    },
    body:JSON.stringify({ batch_size:99 }),
  });

  let claimBody = null;
  const response = await withMockFetch(async (url, options = {}) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.pathname, "/rest/v1/rpc/claim_inbound_events");
    claimBody = JSON.parse(options.body);
    return new Response(JSON.stringify([]), {
      status:200,
      headers:{ "content-type":"application/json" },
    });
  }, () => workerPost({ request, env:fullEnv }));

  assert.equal(response.status, 200);
  const body = await readJson(response);
  assert.equal(body.ok, true);
  assert.equal(body.claimed, 0);
  assert.deepEqual(body.summary, {});
  assert.deepEqual(body.results, []);
  assert.equal(claimBody.batch_size, 10, "worker endpoint must cap requested batch size");
  assert.match(claimBody.worker_name, /^cf-[0-9a-f-]{36}$/i);
}

// 11. Dispatcher endpoint fails closed before database/auth/allowlist configuration.
{
  const request = new Request("https://staypilot.test/api/webhook-dispatch-run", {
    method:"POST",
    headers:{ "content-type":"application/json" },
    body:JSON.stringify({ batch_size:3 }),
  });
  let fetched = false;
  const response = await withMockFetch(async () => {
    fetched = true;
    throw new Error("database should not be called");
  }, () => dispatcherPost({ request, env:{} }));
  assert.equal(response.status, 503);
  assert.equal((await readJson(response)).error, "dispatcher_not_configured");
  assert.equal(fetched, false);
}

// 12. Wrong dispatcher secret is rejected before claiming deliveries.
{
  const request = new Request("https://staypilot.test/api/webhook-dispatch-run", {
    method:"POST",
    headers:{
      "content-type":"application/json",
      "x-staypilot-dispatcher-secret":"wrong-secret",
    },
    body:JSON.stringify({ batch_size:3 }),
  });
  let fetched = false;
  const response = await withMockFetch(async () => {
    fetched = true;
    throw new Error("database should not be called");
  }, () => dispatcherPost({ request, env:fullEnv }));
  assert.equal(response.status, 401);
  assert.equal((await readJson(response)).error, "dispatcher_unauthorized");
  assert.equal(fetched, false);
}

// 13. Authorized dispatcher requests atomically claim a bounded batch.
{
  const request = new Request("https://staypilot.test/api/webhook-dispatch-run", {
    method:"POST",
    headers:{
      "content-type":"application/json",
      "x-staypilot-dispatcher-secret":"integration-dispatcher-secret",
    },
    body:JSON.stringify({ batch_size:99 }),
  });

  let claimBody = null;
  const response = await withMockFetch(async (url, options = {}) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.pathname, "/rest/v1/rpc/claim_webhook_deliveries");
    claimBody = JSON.parse(options.body);
    return new Response(JSON.stringify([]), {
      status:200,
      headers:{ "content-type":"application/json" },
    });
  }, () => dispatcherPost({ request, env:fullEnv }));

  assert.equal(response.status, 200);
  const body = await readJson(response);
  assert.equal(body.ok, true);
  assert.equal(body.claimed, 0);
  assert.deepEqual(body.summary, {});
  assert.deepEqual(body.results, []);
  assert.equal(claimBody.batch_size, 10, "dispatcher endpoint must cap requested batch size");
  assert.match(claimBody.worker_name, /^cf-webhook-[0-9a-f-]{36}$/i);
}

console.log("StayPilot server HTTP boundary tests passed.");
