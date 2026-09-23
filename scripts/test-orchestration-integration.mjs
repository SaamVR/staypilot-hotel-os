import assert from "node:assert/strict";
import { runOrchestration } from "../functions/_shared/orchestrator.js";
import { onRequestPost as orchestratePost, onRequest as orchestrateFallback } from "../functions/api/orchestrate-run.js";
import { runScheduledTick } from "../cloudflare/orchestrator-worker.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

async function withMockFetch(fetchMock, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = fetchMock;
  try { return await fn(); }
  finally { globalThis.fetch = original; }
}

// 1. Orchestration runs worker first, dispatcher second, then stops when both queues are empty.
{
  const order = [];
  let workerClaims = 0;
  let dispatcherClaims = 0;
  const services = {
    async claimInboundEvents(_config, name, limit) {
      order.push(["claim-worker", name, limit]);
      workerClaims += 1;
      return workerClaims === 1 ? [{ id:"evt-1" }] : [];
    },
    async processClaimedEvent(_config, event) {
      order.push(["process-worker", event.id]);
      return { status:"completed", eventId:event.id };
    },
    async claimWebhookDeliveries(_config, name, limit) {
      order.push(["claim-dispatcher", name, limit]);
      dispatcherClaims += 1;
      return dispatcherClaims === 1 ? [{ delivery_id:"dlv-1" }] : [];
    },
    async dispatchClaimedDelivery(_config, _env, delivery) {
      order.push(["dispatch", delivery.delivery_id]);
      return { status:"delivered", deliveryId:delivery.delivery_id };
    },
  };

  const result = await runOrchestration(
    { webhookAllowedHosts:"hooks.example.com", outboundSigningMasterSecret:"master-secret" },
    {},
    { cycles:3, workerBatch:4, dispatcherBatch:6, workerPrefix:"test" },
    services,
  );

  assert.equal(result.cycles, 2);
  assert.equal(result.worker_claimed, 1);
  assert.equal(result.dispatcher_claimed, 1);
  assert.deepEqual(result.worker_summary, { completed:1 });
  assert.deepEqual(result.dispatcher_summary, { delivered:1 });
  assert.deepEqual(order.map(x => x[0]), [
    "claim-worker","process-worker","claim-dispatcher","dispatch",
    "claim-worker","claim-dispatcher",
  ]);
  assert.equal(order[0][2], 4);
  assert.equal(order[2][2], 6);
}

// 2. Dispatcher is skipped when its signing/allowlist contract is not configured.
{
  let dispatcherTouched = false;
  const result = await runOrchestration(
    {},
    {},
    { cycles:2 },
    {
      async claimInboundEvents() { return []; },
      async processClaimedEvent() { throw new Error("not expected"); },
      async claimWebhookDeliveries() { dispatcherTouched = true; return []; },
      async dispatchClaimedDelivery() { dispatcherTouched = true; },
    },
  );
  assert.equal(result.dispatcher_enabled, false);
  assert.equal(result.dispatcher_claimed, 0);
  assert.equal(dispatcherTouched, false);
  assert.equal(result.cycles, 1);
}

// 3. Cycles and batch sizes are hard bounded even if the caller requests extreme values.
{
  const workerLimits = [];
  const dispatcherLimits = [];
  let cycle = 0;
  const result = await runOrchestration(
    { webhookAllowedHosts:"hooks.example.com", outboundSigningMasterSecret:"master-secret" },
    {},
    { cycles:999, workerBatch:999, dispatcherBatch:999 },
    {
      async claimInboundEvents(_config, _name, limit) {
        workerLimits.push(limit);
        cycle += 1;
        return [{ id:`evt-${cycle}` }];
      },
      async processClaimedEvent(_config, event) { return { status:"completed", eventId:event.id }; },
      async claimWebhookDeliveries(_config, _name, limit) {
        dispatcherLimits.push(limit);
        return [];
      },
      async dispatchClaimedDelivery() { throw new Error("not expected"); },
    },
  );
  assert.equal(result.cycles, 3);
  assert.deepEqual(workerLimits, [10,10,10]);
  assert.deepEqual(dispatcherLimits, [10,10,10]);
}

// 4. HTTP orchestrator fails closed before database/auth configuration.
{
  const request = new Request("https://staypilot.test/api/orchestrate-run", {
    method:"POST",
    headers:{ "content-type":"application/json" },
    body:"{}",
  });
  let fetched = false;
  const response = await withMockFetch(async () => { fetched = true; throw new Error("unexpected fetch"); }, () =>
    orchestratePost({ request, env:{} })
  );
  assert.equal(response.status, 503);
  assert.equal((await readJson(response)).error, "orchestrator_not_configured");
  assert.equal(fetched, false);
}

// 5. Credentials alone do not activate automation; explicit rollout flag is required.
{
  const env = {
    SUPABASE_URL:"https://mock.supabase.test",
    SUPABASE_SECRET_KEY:"server-key",
    ORCHESTRATOR_SECRET:"orchestrator-secret",
    ORCHESTRATOR_ENABLED:"false",
  };
  const request = new Request("https://staypilot.test/api/orchestrate-run", {
    method:"POST",
    headers:{
      "content-type":"application/json",
      "x-staypilot-orchestrator-secret":"orchestrator-secret",
    },
    body:"{}",
  });
  let fetched = false;
  const response = await withMockFetch(async () => { fetched = true; throw new Error("unexpected fetch"); }, () =>
    orchestratePost({ request, env })
  );
  assert.equal(response.status, 503);
  assert.equal((await readJson(response)).error, "orchestrator_disabled");
  assert.equal(fetched, false);
}

// 6. Wrong orchestration secret is rejected before any queue claim.
{
  const env = {
    SUPABASE_URL:"https://mock.supabase.test",
    SUPABASE_SECRET_KEY:"server-key",
    ORCHESTRATOR_SECRET:"orchestrator-secret",
    ORCHESTRATOR_ENABLED:"true",
  };
  const request = new Request("https://staypilot.test/api/orchestrate-run", {
    method:"POST",
    headers:{
      "content-type":"application/json",
      "x-staypilot-orchestrator-secret":"wrong-secret",
    },
    body:"{}",
  });
  let fetched = false;
  const response = await withMockFetch(async () => { fetched = true; throw new Error("unexpected fetch"); }, () =>
    orchestratePost({ request, env })
  );
  assert.equal(response.status, 401);
  assert.equal((await readJson(response)).error, "orchestrator_unauthorized");
  assert.equal(fetched, false);
}

// 7. Authorized orchestration can run a bounded empty worker cycle while dispatcher stays unconfigured.
{
  const env = {
    SUPABASE_URL:"https://mock.supabase.test",
    SUPABASE_SECRET_KEY:"server-key",
    ORCHESTRATOR_SECRET:"orchestrator-secret",
    ORCHESTRATOR_ENABLED:"true",
  };
  const request = new Request("https://staypilot.test/api/orchestrate-run", {
    method:"POST",
    headers:{
      "content-type":"application/json",
      "x-staypilot-orchestrator-secret":"orchestrator-secret",
    },
    body:JSON.stringify({ cycles:99, worker_batch:99, dispatcher_batch:99 }),
  });

  let claimBody = null;
  const response = await withMockFetch(async (url, options = {}) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.pathname, "/rest/v1/rpc/claim_inbound_events");
    claimBody = JSON.parse(options.body);
    return new Response(JSON.stringify([]), { status:200, headers:{ "content-type":"application/json" } });
  }, () => orchestratePost({ request, env }));

  assert.equal(response.status, 200);
  const body = await readJson(response);
  assert.equal(body.ok, true);
  assert.equal(body.cycles, 1);
  assert.equal(body.worker_claimed, 0);
  assert.equal(body.dispatcher_enabled, false);
  assert.equal(claimBody.batch_size, 10);
}

// 8. Method contract remains POST-only.
{
  const response = orchestrateFallback();
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
}

// 9. Scheduled Worker is inert unless explicitly enabled.
{
  let fetched = false;
  const result = await runScheduledTick(
    { SCHEDULER_ENABLED:"false", ORCHESTRATOR_SECRET:"secret" },
    async () => { fetched = true; throw new Error("unexpected fetch"); },
  );
  assert.deepEqual(result, { skipped:true, reason:"scheduler_disabled" });
  assert.equal(fetched, false);
}

// 10. Enabled scheduled Worker calls the Pages control-plane endpoint without leaking the secret.
{
  let captured = null;
  const result = await runScheduledTick(
    {
      SCHEDULER_ENABLED:"true",
      ORCHESTRATOR_SECRET:"scheduler-secret",
      STAYPILOT_ORIGIN:"https://staypilot.example.com/",
    },
    async (url, options = {}) => {
      captured = { url, options };
      return new Response(JSON.stringify({ ok:true, orchestration_id:"run-1", worker_claimed:0, dispatcher_claimed:0 }), {
        status:200,
        headers:{ "content-type":"application/json" },
      });
    },
  );

  assert.equal(result.ok, true);
  assert.equal(captured.url, "https://staypilot.example.com/api/orchestrate-run");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.redirect, "manual");
  assert.equal(captured.options.headers["x-staypilot-orchestrator-secret"], "scheduler-secret");
  assert.deepEqual(JSON.parse(captured.options.body), {
    cycles:2,
    worker_batch:5,
    dispatcher_batch:5,
  });
}

// 11. Scheduled Worker surfaces control-plane failure so Cloudflare can mark the cron invocation failed.
{
  await assert.rejects(
    () => runScheduledTick(
      { SCHEDULER_ENABLED:"true", ORCHESTRATOR_SECRET:"scheduler-secret" },
      async () => new Response(JSON.stringify({ ok:false, error:"orchestrator_unavailable" }), {
        status:502,
        headers:{ "content-type":"application/json" },
      }),
    ),
    error => error?.status === 502 && error?.message === "orchestration_http_502",
  );
}

console.log("StayPilot orchestration integration tests passed.");
