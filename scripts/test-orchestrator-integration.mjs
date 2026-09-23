import assert from "node:assert/strict";
import { dispatcherConfigured, runOrchestration } from "../functions/_shared/orchestrator.js";
import { onRequestPost as orchestratorPost, onRequest as orchestratorFallback } from "../functions/api/orchestrator-run.js";

function baseConfig(overrides = {}) {
  return {
    supabaseUrl:"https://mock.supabase.test",
    supabaseKey:"server-key",
    dispatcherSecret:"dispatcher-secret",
    webhookAllowedHosts:"hooks.example.com",
    outboundSigningMasterSecret:"scheduler-test-signing-master-that-is-long-enough",
    orchestratorSecret:"orchestrator-secret",
    ...overrides,
  };
}

function makeEvent(id, status = "completed") {
  return { id:`inbound-${id}`, event_id:`evt-${id}`, status };
}
function makeDelivery(id) {
  return { delivery_id:`delivery-${id}`, event_id:`evt-${id}` };
}

assert.equal(dispatcherConfigured(baseConfig()), true);
assert.equal(dispatcherConfigured(baseConfig({ dispatcherSecret:"" })), false);
assert.equal(dispatcherConfigured(baseConfig({ webhookAllowedHosts:"" })), false);
assert.equal(dispatcherConfigured(baseConfig({ outboundSigningMasterSecret:"" })), false);

// 1. Worker + dispatcher execute in bounded cycles and aggregate statuses.
{
  let workerClaims = 0;
  let deliveryClaims = 0;
  const deps = {
    now:() => 1000,
    claimInboundEvents:async (_config, _name, batch) => {
      workerClaims += 1;
      assert.equal(batch, 2);
      return workerClaims === 1 ? [makeEvent(1), makeEvent(2)] : [];
    },
    processClaimedEvent:async (_config, event) => (
      event.event_id === "evt-1"
        ? { eventId:event.event_id, status:"completed" }
        : { eventId:event.event_id, status:"retrying" }
    ),
    claimWebhookDeliveries:async (_config, _name, batch) => {
      deliveryClaims += 1;
      assert.equal(batch, 2);
      return deliveryClaims === 1 ? [makeDelivery(1)] : [];
    },
    dispatchClaimedDelivery:async (_config, _env, delivery) => ({
      deliveryId:delivery.delivery_id,
      status:"delivered",
    }),
  };

  const result = await runOrchestration(baseConfig(), {}, {
    runId:"run-1",
    workerBatch:2,
    dispatcherBatch:2,
    maxCycles:3,
  }, deps);

  assert.equal(result.runId, "run-1");
  assert.equal(result.cycles, 2);
  assert.equal(result.stopped, "empty");
  assert.equal(result.worker.claimed, 2);
  assert.deepEqual(result.worker.summary, { completed:1, retrying:1 });
  assert.equal(result.dispatcher.configured, true);
  assert.equal(result.dispatcher.claimed, 1);
  assert.deepEqual(result.dispatcher.summary, { delivered:1 });
}

// 2. Dispatcher is optional; worker still runs when outbound delivery is not configured.
{
  let dispatcherTouched = false;
  const result = await runOrchestration(baseConfig({
    dispatcherSecret:"",
    webhookAllowedHosts:"",
    outboundSigningMasterSecret:"",
  }), {}, {
    runId:"run-worker-only",
    workerBatch:5,
    maxCycles:2,
  }, {
    now:() => 1000,
    claimInboundEvents:async () => [makeEvent(3)],
    processClaimedEvent:async (_config, event) => ({ eventId:event.event_id, status:"completed" }),
    claimWebhookDeliveries:async () => { dispatcherTouched = true; return []; },
  });

  assert.equal(result.worker.claimed, 1);
  assert.equal(result.dispatcher.configured, false);
  assert.equal(result.dispatcher.skipped, "dispatcher_not_configured");
  assert.equal(dispatcherTouched, false);
  assert.equal(result.stopped, "empty");
}

// 3. Full batches stop at the configured cycle cap instead of running unbounded.
{
  let eventNumber = 0;
  let deliveryNumber = 0;
  const result = await runOrchestration(baseConfig(), {}, {
    runId:"run-cycle-limit",
    workerBatch:2,
    dispatcherBatch:2,
    maxCycles:2,
  }, {
    now:() => 1000,
    claimInboundEvents:async () => [makeEvent(++eventNumber), makeEvent(++eventNumber)],
    processClaimedEvent:async (_config, event) => ({ eventId:event.event_id, status:"completed" }),
    claimWebhookDeliveries:async () => [makeDelivery(++deliveryNumber), makeDelivery(++deliveryNumber)],
    dispatchClaimedDelivery:async (_config, _env, delivery) => ({ deliveryId:delivery.delivery_id, status:"delivered" }),
  });

  assert.equal(result.cycles, 2);
  assert.equal(result.stopped, "cycle_limit");
  assert.equal(result.worker.claimed, 4);
  assert.equal(result.dispatcher.claimed, 4);
}

// 4. Time budget can stop before claiming another batch.
{
  const times = [0, 6000, 6000];
  let claims = 0;
  const result = await runOrchestration(baseConfig(), {}, {
    runId:"run-budget",
    maxDurationMs:5000,
    maxCycles:3,
  }, {
    now:() => times.shift() ?? 6000,
    claimInboundEvents:async () => { claims += 1; return []; },
  });
  assert.equal(result.stopped, "time_budget");
  assert.equal(result.cycles, 0);
  assert.equal(claims, 0);
}

// 5. Orchestrator endpoint fails closed before DB + scheduler auth configuration.
{
  const request = new Request("https://staypilot.test/api/orchestrator-run", {
    method:"POST",
    headers:{ "content-type":"application/json" },
    body:"{}",
  });
  const response = await orchestratorPost({ request, env:{} });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "orchestrator_not_configured");
}

// 6. Wrong scheduler secret is rejected before any database call.
{
  const original = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => { fetchCalls += 1; throw new Error("should not fetch"); };
  try {
    const request = new Request("https://staypilot.test/api/orchestrator-run", {
      method:"POST",
      headers:{
        "content-type":"application/json",
        "x-staypilot-orchestrator-secret":"wrong",
      },
      body:"{}",
    });
    const response = await orchestratorPost({
      request,
      env:{
        SUPABASE_URL:"https://mock.supabase.test",
        SUPABASE_SECRET_KEY:"server-key",
        ORCHESTRATOR_SECRET:"correct-secret",
      },
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "orchestrator_unauthorized");
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = original;
  }
}

// 7. Authorized HTTP tick caps requested batch/cycles and returns an empty successful run.
{
  const original = globalThis.fetch;
  const rpcCalls = [];
  globalThis.fetch = async (url, options = {}) => {
    const parsed = new URL(String(url));
    const body = options.body ? JSON.parse(options.body) : null;
    rpcCalls.push({ path:parsed.pathname, body });
    if (parsed.pathname.endsWith("/rpc/claim_inbound_events")) {
      return new Response("[]", { status:200, headers:{ "content-type":"application/json" } });
    }
    throw new Error(`unexpected fetch ${parsed.pathname}`);
  };
  try {
    const request = new Request("https://staypilot.test/api/orchestrator-run", {
      method:"POST",
      headers:{
        "content-type":"application/json",
        "x-staypilot-orchestrator-secret":"correct-secret",
      },
      body:JSON.stringify({ worker_batch:99, dispatcher_batch:99, max_cycles:99 }),
    });
    const response = await orchestratorPost({
      request,
      env:{
        SUPABASE_URL:"https://mock.supabase.test",
        SUPABASE_SECRET_KEY:"server-key",
        ORCHESTRATOR_SECRET:"correct-secret",
      },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.worker.batchSize, 10);
    assert.equal(body.worker.claimed, 0);
    assert.equal(body.dispatcher.configured, false);
    assert.equal(body.cycles, 1);
    assert.equal(body.stopped, "empty");
    assert.equal(rpcCalls.length, 1);
    assert.equal(rpcCalls[0].body.batch_size, 10);
  } finally {
    globalThis.fetch = original;
  }
}

const fallback = orchestratorFallback();
assert.equal(fallback.status, 405);
assert.equal(fallback.headers.get("allow"), "POST");

console.log("StayPilot scheduler orchestration tests passed.");
