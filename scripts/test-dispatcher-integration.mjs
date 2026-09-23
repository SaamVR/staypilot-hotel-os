import assert from "node:assert/strict";
import { hmacSha256Hex } from "../functions/_shared/webhook.js";
import {
  buildWebhookEnvelope,
  classifyHttpStatus,
  dispatchClaimedDelivery,
  parseAllowedHosts,
  resolveWebhookSecret,
  retryDelaySeconds,
  validateWebhookDestination,
  DispatcherError,
} from "../functions/_shared/dispatcher.js";

const config = {
  supabaseUrl:"https://mock.supabase.test",
  supabaseKey:"server-key",
  webhookAllowedHosts:"hooks.example.com,workflow.example.com",
};

const env = {
  WEBHOOK_SECRET_DEMO_OUTBOUND:"per-endpoint-secret",
};

function response(body, status = 200, headers = {}) {
  const bodyless = status === 204 || status === 205 || status === 304;
  return new Response(
    bodyless ? null : (typeof body === "string" ? body : JSON.stringify(body)),
    { status, headers:{ "content-type":"application/json", ...headers } },
  );
}

function delivery(overrides = {}) {
  return {
    delivery_id:"delivery-1",
    hotel_id:"hotel-1",
    endpoint_id:"endpoint-1",
    inbound_event_id:"inbound-1",
    event_id:"evt_dispatch_001",
    event_type:"guest.checked_out",
    endpoint_url:"https://hooks.example.com/staypilot",
    endpoint_verified_host:"hooks.example.com",
    secret_ref:"DEMO_OUTBOUND",
    event_payload:{ room_number:"204" },
    event_received_at:"2026-09-24T00:00:00Z",
    attempts:1,
    ...overrides,
  };
}

function createSupabaseHarness() {
  const calls = [];
  const fetchMock = async (url, options = {}) => {
    const parsed = new URL(String(url));
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ path:parsed.pathname, method:String(options.method || "GET").toUpperCase(), body });
    if (parsed.pathname.endsWith("/rpc/finish_webhook_delivery")) {
      return response({ id:body.delivery_uuid, status:body.outcome });
    }
    throw new Error(`Unhandled Supabase mock request: ${parsed.pathname}`);
  };
  return { calls, fetchMock };
}

async function withGlobalFetch(fetchMock, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = fetchMock;
  try { return await fn(); }
  finally { globalThis.fetch = original; }
}

// 1. Exact allowlist parsing is normalized and deduplicated.
{
  assert.deepEqual(
    parseAllowedHosts(" Hooks.Example.com,workflow.example.com,hooks.example.com "),
    ["hooks.example.com","workflow.example.com"],
  );
}

// 2. Destination validation accepts only the verified, allowlisted HTTPS host.
{
  const url = validateWebhookDestination(
    "https://hooks.example.com/staypilot",
    "hooks.example.com",
    ["hooks.example.com"],
  );
  assert.equal(url.hostname, "hooks.example.com");

  const invalidCases = [
    ["http://hooks.example.com/staypilot","hooks.example.com",["hooks.example.com"],"https_required"],
    ["https://user:pass@hooks.example.com/staypilot","hooks.example.com",["hooks.example.com"],"url_credentials_forbidden"],
    ["https://hooks.example.com:8443/staypilot","hooks.example.com",["hooks.example.com"],"nonstandard_port_forbidden"],
    ["https://127.0.0.1/staypilot","127.0.0.1",["127.0.0.1"],"private_or_local_destination_forbidden"],
    ["https://localhost/staypilot","localhost",["localhost"],"private_or_local_destination_forbidden"],
    ["https://hooks.example.com/staypilot","other.example.com",["hooks.example.com"],"verified_host_mismatch"],
    ["https://hooks.example.com/staypilot","hooks.example.com",["workflow.example.com"],"destination_not_allowlisted"],
  ];
  for (const [urlValue, verifiedHost, allowedHosts, code] of invalidCases) {
    assert.throws(
      () => validateWebhookDestination(urlValue, verifiedHost, allowedHosts),
      error => error instanceof DispatcherError && error.code === code,
      `expected ${code}`,
    );
  }
}

// 3. Endpoint secret resolution never exposes or guesses missing secret material.
{
  assert.equal(resolveWebhookSecret(env, "DEMO_OUTBOUND"), "per-endpoint-secret");
  assert.throws(
    () => resolveWebhookSecret(env, "MISSING"),
    error => error instanceof DispatcherError && error.code === "webhook_secret_missing",
  );
  assert.throws(
    () => resolveWebhookSecret(env, "../../bad"),
    error => error instanceof DispatcherError && error.code === "invalid_secret_ref",
  );
}

// 4. Payload envelope preserves the domain Event ID/type/hotel and event data.
{
  assert.deepEqual(buildWebhookEnvelope(delivery()), {
    id:"evt_dispatch_001",
    type:"guest.checked_out",
    hotel_id:"hotel-1",
    received_at:"2026-09-24T00:00:00Z",
    data:{ room_number:"204" },
  });
}

// 5. HTTP and backoff classification is deterministic.
{
  assert.deepEqual(classifyHttpStatus(204), { outcome:"delivered", retryable:false });
  assert.deepEqual(classifyHttpStatus(429), { outcome:"retry", retryable:true });
  assert.deepEqual(classifyHttpStatus(503), { outcome:"retry", retryable:true });
  assert.deepEqual(classifyHttpStatus(400), { outcome:"dead_letter", retryable:false });
  assert.equal(retryDelaySeconds(1), 30);
  assert.equal(retryDelaySeconds(3), 120);
  assert.equal(retryDelaySeconds(2, "600"), 600);
  assert.equal(retryDelaySeconds(2, "99999"), 3600);
}

// 6. Successful outbound delivery signs the exact body and completes once.
{
  const supabase = createSupabaseHarness();
  let externalCalls = 0;
  await withGlobalFetch(supabase.fetchMock, async () => {
    const result = await dispatchClaimedDelivery(config, env, delivery(), {
      nowMs:Date.UTC(2026,8,24,0,0,0),
      fetchImpl:async (url, options) => {
        externalCalls += 1;
        assert.equal(url, "https://hooks.example.com/staypilot");
        assert.equal(options.method, "POST");
        assert.equal(options.redirect, "manual");
        assert.equal(options.headers["x-staypilot-event-id"], "evt_dispatch_001");
        assert.equal(options.headers["x-staypilot-event-type"], "guest.checked_out");
        assert.equal(options.headers["x-staypilot-timestamp"], "1790208000");
        const expected = await hmacSha256Hex(
          "per-endpoint-secret",
          `${options.headers["x-staypilot-timestamp"]}.${options.body}`,
        );
        assert.equal(options.headers["x-staypilot-signature"], `v1=${expected}`);
        assert.deepEqual(JSON.parse(options.body), buildWebhookEnvelope(delivery()));
        return response("", 204);
      },
    });
    assert.equal(result.status, "delivered");
    assert.equal(result.httpStatus, 204);
  });
  assert.equal(externalCalls, 1);
  const finish = supabase.calls.at(-1);
  assert.equal(finish.path, "/rest/v1/rpc/finish_webhook_delivery");
  assert.equal(finish.body.outcome, "delivered");
  assert.equal(finish.body.response_status, 204);
}

// 7. Retryable HTTP responses schedule bounded retry and do not dead-letter.
{
  const supabase = createSupabaseHarness();
  await withGlobalFetch(supabase.fetchMock, async () => {
    const result = await dispatchClaimedDelivery(config, env, delivery({ attempts:2 }), {
      fetchImpl:async () => response("", 429, { "retry-after":"120" }),
    });
    assert.equal(result.status, "retrying");
    assert.equal(result.httpStatus, 429);
    assert.equal(result.retryDelay, 120);
  });
  const finish = supabase.calls.at(-1);
  assert.equal(finish.body.outcome, "retry");
  assert.equal(finish.body.retry_delay_seconds, 120);
}

// 8. Permanent 4xx responses dead-letter instead of retrying forever.
{
  const supabase = createSupabaseHarness();
  await withGlobalFetch(supabase.fetchMock, async () => {
    const result = await dispatchClaimedDelivery(config, env, delivery(), {
      fetchImpl:async () => response("", 400),
    });
    assert.equal(result.status, "dead_letter");
    assert.equal(result.httpStatus, 400);
  });
  assert.equal(supabase.calls.at(-1).body.outcome, "dead_letter");
}

// 9. Network/timeout-style failures retry with backoff.
{
  const supabase = createSupabaseHarness();
  await withGlobalFetch(supabase.fetchMock, async () => {
    const result = await dispatchClaimedDelivery(config, env, delivery({ attempts:3 }), {
      fetchImpl:async () => { throw new TypeError("network down"); },
    });
    assert.equal(result.status, "retrying");
    assert.equal(result.retryable, true);
    assert.equal(result.retryDelay, 120);
  });
  assert.equal(supabase.calls.at(-1).body.outcome, "retry");
}

// 10. Invalid destination or missing endpoint secret never reaches external fetch.
{
  for (const variant of [
    delivery({ endpoint_url:"https://127.0.0.1/hook", endpoint_verified_host:"127.0.0.1" }),
    delivery({ endpoint_url:"https://evil.example.com/hook", endpoint_verified_host:"evil.example.com" }),
    delivery({ secret_ref:"MISSING" }),
  ]) {
    const supabase = createSupabaseHarness();
    let externalCalls = 0;
    await withGlobalFetch(supabase.fetchMock, async () => {
      const result = await dispatchClaimedDelivery(config, env, variant, {
        fetchImpl:async () => { externalCalls += 1; return response("", 204); },
      });
      assert.equal(result.status, "dead_letter");
      assert.equal(result.retryable, false);
    });
    assert.equal(externalCalls, 0);
    assert.equal(supabase.calls.at(-1).body.outcome, "dead_letter");
  }
}

console.log("StayPilot outbound dispatcher integration tests passed.");
