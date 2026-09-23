import assert from "node:assert/strict";
import { hmacSha256Hex } from "../functions/_shared/webhook.js";
import {
  DispatcherError,
  buildWebhookEnvelope,
  claimWebhookDeliveries,
  classifyHttpStatus,
  dispatchClaimedDelivery,
  parseAllowedHosts,
  resolveWebhookSecret,
  retryDelaySeconds,
  validateWebhookDestination,
} from "../functions/_shared/dispatcher.js";

const config = {
  supabaseUrl:"https://mock.supabase.test",
  supabaseKey:"service-key",
  webhookAllowedHosts:"hooks.example.com, workflow.example.com",
};

const env = {
  WEBHOOK_SECRET_DEMO_OUTBOUND:"outbound-signing-secret",
};

function delivery(overrides = {}) {
  return {
    delivery_id:"delivery-1",
    hotel_id:"hotel-1",
    endpoint_id:"endpoint-1",
    inbound_event_id:"inbound-1",
    event_id:"evt_dispatch_001",
    event_type:"guest.request_received",
    endpoint_url:"https://hooks.example.com/staypilot",
    endpoint_verified_host:"hooks.example.com",
    secret_ref:"DEMO_OUTBOUND",
    event_payload:{ request:"Extra towels", room_number:"204" },
    event_received_at:"2026-09-24T00:00:00Z",
    attempts:1,
    ...overrides,
  };
}

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers:{ "content-type":"application/json", ...headers },
  });
}

async function withMockSupabase(fn) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(String(url));
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ path:parsed.pathname, body, method:options.method || "GET" });

    if (parsed.pathname.endsWith("/rpc/finish_webhook_delivery")) {
      return jsonResponse({ id:body.delivery_uuid, status:body.outcome });
    }
    if (parsed.pathname.endsWith("/rpc/claim_webhook_deliveries")) {
      return jsonResponse([]);
    }
    throw new Error(`Unhandled Supabase request: ${parsed.pathname}`);
  };
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = original;
  }
}

// 1. Exact host allowlist parsing is normalized and deduplicated.
{
  assert.deepEqual(
    parseAllowedHosts(" Hooks.Example.com,workflow.example.com,hooks.example.com ,, "),
    ["hooks.example.com","workflow.example.com"],
  );
}

// 2. Destination validation accepts only exact verified HTTPS hosts.
{
  const allowed = parseAllowedHosts(config.webhookAllowedHosts);
  const url = validateWebhookDestination(
    "https://hooks.example.com/staypilot",
    "hooks.example.com",
    allowed,
  );
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "hooks.example.com");

  const rejected = [
    ["http://hooks.example.com/staypilot","hooks.example.com","https_required"],
    ["https://user:pass@hooks.example.com/staypilot","hooks.example.com","url_credentials_forbidden"],
    ["https://hooks.example.com:8443/staypilot","hooks.example.com","nonstandard_port_forbidden"],
    ["https://127.0.0.1/hook","127.0.0.1","private_or_local_destination_forbidden"],
    ["https://localhost/hook","localhost","private_or_local_destination_forbidden"],
    ["https://hooks.example.com/hook","workflow.example.com","verified_host_mismatch"],
    ["https://evil.example.com/hook","evil.example.com","destination_not_allowlisted"],
  ];
  for (const [urlValue, verifiedHost, code] of rejected) {
    assert.throws(
      () => validateWebhookDestination(urlValue, verifiedHost, allowed),
      error => error instanceof DispatcherError && error.code === code,
      `${urlValue} should fail with ${code}`,
    );
  }
}

// 3. Signing secrets are server-only and referenced indirectly.
{
  assert.equal(resolveWebhookSecret(env, "demo-outbound"), "outbound-signing-secret");
  assert.throws(
    () => resolveWebhookSecret(env, "../../bad"),
    error => error instanceof DispatcherError && error.code === "invalid_secret_ref",
  );
  assert.throws(
    () => resolveWebhookSecret(env, "MISSING"),
    error => error instanceof DispatcherError && error.code === "webhook_secret_missing",
  );
}

// 4. Envelope and retry classification are deterministic.
{
  const envelope = buildWebhookEnvelope(delivery());
  assert.equal(envelope.id, "evt_dispatch_001");
  assert.equal(envelope.type, "guest.request_received");
  assert.deepEqual(envelope.data, { request:"Extra towels", room_number:"204" });

  assert.deepEqual(classifyHttpStatus(204), { outcome:"delivered", retryable:false });
  assert.deepEqual(classifyHttpStatus(429), { outcome:"retry", retryable:true });
  assert.deepEqual(classifyHttpStatus(503), { outcome:"retry", retryable:true });
  assert.deepEqual(classifyHttpStatus(400), { outcome:"dead_letter", retryable:false });
  assert.equal(retryDelaySeconds(1), 30);
  assert.equal(retryDelaySeconds(3), 120);
  assert.equal(retryDelaySeconds(2, "300"), 300);
  assert.equal(retryDelaySeconds(8), 1800);
}

// 5. Successful delivery sends exact signed body then marks delivery delivered.
{
  await withMockSupabase(async calls => {
    const fixedNow = Date.UTC(2026, 8, 24, 0, 0, 0);
    let outbound = null;
    const fetchImpl = async (url, options) => {
      outbound = { url:String(url), options };
      return new Response("", { status:204 });
    };

    const result = await dispatchClaimedDelivery(config, env, delivery(), {
      fetchImpl,
      nowMs:fixedNow,
      timeoutMs:2000,
    });

    assert.equal(result.status, "delivered");
    assert.equal(result.httpStatus, 204);
    assert.equal(outbound.url, "https://hooks.example.com/staypilot");
    assert.equal(outbound.options.method, "POST");
    assert.equal(outbound.options.redirect, "manual");
    assert.equal(outbound.options.headers["x-staypilot-event-id"], "evt_dispatch_001");

    const timestamp = String(Math.floor(fixedNow / 1000));
    const expected = await hmacSha256Hex(
      "outbound-signing-secret",
      `${timestamp}.${outbound.options.body}`,
    );
    assert.equal(outbound.options.headers["x-staypilot-signature"], `v1=${expected}`);

    const finish = calls.find(call => call.path.endsWith("/rpc/finish_webhook_delivery"));
    assert.equal(finish.body.outcome, "delivered");
    assert.equal(finish.body.response_status, 204);
  });
}

// 6. Retryable HTTP responses respect Retry-After and persist retry state.
{
  await withMockSupabase(async calls => {
    const result = await dispatchClaimedDelivery(config, env, delivery({ attempts:2 }), {
      fetchImpl:async () => new Response("busy", {
        status:429,
        headers:{ "retry-after":"180" },
      }),
      timeoutMs:2000,
    });
    assert.equal(result.status, "retrying");
    assert.equal(result.retryDelay, 180);
    const finish = calls.find(call => call.path.endsWith("/rpc/finish_webhook_delivery"));
    assert.equal(finish.body.outcome, "retry");
    assert.equal(finish.body.response_status, 429);
    assert.equal(finish.body.retry_delay_seconds, 180);
  });
}

// 7. Non-retryable 4xx responses dead-letter immediately.
{
  await withMockSupabase(async calls => {
    const result = await dispatchClaimedDelivery(config, env, delivery(), {
      fetchImpl:async () => new Response("bad request", { status:400 }),
      timeoutMs:2000,
    });
    assert.equal(result.status, "dead_letter");
    const finish = calls.find(call => call.path.endsWith("/rpc/finish_webhook_delivery"));
    assert.equal(finish.body.outcome, "dead_letter");
    assert.equal(finish.body.response_status, 400);
  });
}

// 8. Local/private destinations are rejected before any outbound network call.
{
  await withMockSupabase(async calls => {
    let outboundCalled = false;
    const result = await dispatchClaimedDelivery(
      { ...config, webhookAllowedHosts:"localhost" },
      env,
      delivery({
        endpoint_url:"https://localhost/hook",
        endpoint_verified_host:"localhost",
      }),
      {
        fetchImpl:async () => {
          outboundCalled = true;
          throw new Error("must not fetch");
        },
      },
    );
    assert.equal(outboundCalled, false);
    assert.equal(result.status, "dead_letter");
    assert.equal(result.error, "private_or_local_destination_forbidden");
    assert.equal(calls.at(-1).body.outcome, "dead_letter");
  });
}

// 9. Network/timeout failures retry with backoff.
{
  await withMockSupabase(async calls => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    const result = await dispatchClaimedDelivery(config, env, delivery({ attempts:3 }), {
      fetchImpl:async () => { throw abort; },
      timeoutMs:2000,
    });
    assert.equal(result.status, "retrying");
    assert.equal(result.error, "delivery_timeout");
    assert.equal(result.retryDelay, 120);
    assert.equal(calls.at(-1).body.outcome, "retry");
  });
}

// 10. Missing per-endpoint signing secret fails closed without outbound fetch.
{
  await withMockSupabase(async calls => {
    let outboundCalled = false;
    const result = await dispatchClaimedDelivery(config, {}, delivery(), {
      fetchImpl:async () => {
        outboundCalled = true;
        throw new Error("must not fetch");
      },
    });
    assert.equal(outboundCalled, false);
    assert.equal(result.status, "dead_letter");
    assert.equal(result.error, "webhook_secret_missing");
    assert.equal(calls.at(-1).body.outcome, "dead_letter");
  });
}

// 11. Delivery claiming is service-RPC backed and batch bounded.
{
  const original = globalThis.fetch;
  let claimBody = null;
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.pathname, "/rest/v1/rpc/claim_webhook_deliveries");
    claimBody = JSON.parse(options.body);
    return jsonResponse([delivery()]);
  };
  try {
    const claimed = await claimWebhookDeliveries(config, "dispatcher-test", 99);
    assert.equal(claimed.length, 1);
    assert.equal(claimBody.batch_size, 10);
    assert.equal(claimBody.worker_name, "dispatcher-test");
  } finally {
    globalThis.fetch = original;
  }
}

console.log("StayPilot webhook dispatcher tests passed.");
