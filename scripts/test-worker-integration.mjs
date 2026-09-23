import assert from "node:assert/strict";
import { processClaimedEvent } from "../functions/_shared/worker.js";

const config = {
  supabaseUrl: "https://mock.supabase.test",
  supabaseKey: "test-service-key",
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createHarness({
  rule,
  existingRun = null,
  room = { id:"room-204", number:"204", occupancy:"Occupied", housekeeping:"Clean", maintenance:"Clear" },
  failTaskOnce = false,
  failOutboxOnce = false,
  outboundQueued = 2,
} = {}) {
  const calls = [];
  let taskFailuresRemaining = failTaskOnce ? 1 : 0;
  let outboxFailuresRemaining = failOutboxOnce ? 1 : 0;
  let runState = existingRun;

  const fetchMock = async (url, options = {}) => {
    const parsed = new URL(String(url));
    const method = String(options.method || "GET").toUpperCase();
    const body = options.body ? JSON.parse(options.body) : null;
    const prefer = options.headers?.prefer || options.headers?.Prefer || "";
    calls.push({ path:parsed.pathname, search:parsed.search, method, body, prefer });

    if (parsed.pathname.endsWith("/automation_rules") && method === "GET") {
      return response(rule ? [rule] : []);
    }
    if (parsed.pathname.endsWith("/automation_runs") && method === "GET") {
      return response(runState ? [runState] : []);
    }
    if (parsed.pathname.endsWith("/automation_runs") && method === "POST") {
      runState = {
        id:runState?.id || "run-generated",
        result:body.result,
        created_at:"2026-09-24T00:00:00Z",
      };
      return response([]);
    }
    if (parsed.pathname.endsWith("/tasks") && method === "POST") {
      if (taskFailuresRemaining > 0) {
        taskFailuresRemaining -= 1;
        return response({ message:"temporary database outage" }, 503);
      }
      return response([]);
    }
    if (parsed.pathname.endsWith("/approvals") && method === "POST") {
      return response([]);
    }
    if (parsed.pathname.endsWith("/audit_events") && method === "POST") {
      return response([]);
    }
    if (parsed.pathname.endsWith("/rooms") && method === "GET") {
      return response(room ? [room] : []);
    }
    if (parsed.pathname.endsWith("/rooms") && method === "PATCH") {
      return response(room ? [{ id:room.id, number:room.number }] : []);
    }
    if (parsed.pathname.endsWith("/rpc/enqueue_webhook_deliveries") && method === "POST") {
      if (outboxFailuresRemaining > 0) {
        outboxFailuresRemaining -= 1;
        return response({ message:"temporary outbox outage" }, 503);
      }
      return response(outboundQueued);
    }
    if (parsed.pathname.endsWith("/rpc/finish_inbound_event") && method === "POST") {
      return response({ id:body.event_uuid, status:body.outcome });
    }

    throw new Error(`Unhandled mock request: ${method} ${parsed.pathname}${parsed.search}`);
  };

  return { calls, fetchMock };
}

async function withMockFetch(harness, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = harness.fetchMock;
  try {
    return await fn(harness.calls);
  } finally {
    globalThis.fetch = original;
  }
}

function event(overrides = {}) {
  return {
    id:"inbound-1",
    hotel_id:"hotel-1",
    event_id:"evt_test_001",
    event_type:"guest.request_received",
    payload:{ request:"Please send two towels" },
    attempt_count:1,
    ...overrides,
  };
}

function rule(overrides = {}) {
  return {
    id:"rule-1",
    rule_key:"guest-request-router",
    name:"Guest request router",
    scope:"Operations",
    event_type:"guest.request_received",
    status:"Active",
    autonomy:"Auto",
    config:{},
    ...overrides,
  };
}

function callsFor(calls, suffix, method = null) {
  return calls.filter(c => c.path.endsWith(suffix) && (!method || c.method === method));
}

// 1. Normal auto execution creates one idempotent task, run, audit and completion.
{
  const harness = createHarness({ rule:rule() });
  await withMockFetch(harness, async calls => {
    const result = await processClaimedEvent(config, event());
    assert.equal(result.status, "completed");
    assert.equal(result.result, "Success");
    assert.equal(result.outboundQueued, 2);

    const taskCalls = callsFor(calls, "/tasks", "POST");
    assert.equal(taskCalls.length, 1);
    assert.equal(taskCalls[0].body.title, "Extra towels requested");
    assert.equal(taskCalls[0].body.team, "Housekeeping");
    assert.equal(taskCalls[0].body.source_event_id, "evt_test_001");
    assert.match(taskCalls[0].prefer, /ignore-duplicates/);

    const runCalls = callsFor(calls, "/automation_runs", "POST");
    assert.equal(runCalls.length, 1);
    assert.equal(runCalls[0].body.result, "Success");
    assert.match(runCalls[0].prefer, /merge-duplicates/);

    assert.equal(callsFor(calls, "/audit_events", "POST").length, 1);
    assert.equal(callsFor(calls, "/rpc/enqueue_webhook_deliveries", "POST").length, 1);
    const finish = callsFor(calls, "/rpc/finish_inbound_event", "POST").at(-1);
    assert.equal(finish.body.outcome, "completed");
  });
}

// 2. A terminal Event-ID run short-circuits all business mutations.
{
  const harness = createHarness({
    rule:rule(),
    existingRun:{ id:"run-existing", result:"Success", created_at:"2026-09-23T00:00:00Z" },
  });
  await withMockFetch(harness, async calls => {
    const result = await processClaimedEvent(config, event());
    assert.equal(result.duplicate, true);
    assert.equal(result.runId, "run-existing");
    assert.equal(callsFor(calls, "/tasks", "POST").length, 0);
    assert.equal(callsFor(calls, "/automation_runs", "POST").length, 0);
    assert.equal(callsFor(calls, "/rpc/finish_inbound_event", "POST").at(-1).body.outcome, "completed");
  });
}

// 3. A prior Failed run does not suppress retry and is merged into a terminal result.
{
  const harness = createHarness({
    rule:rule(),
    existingRun:{ id:"run-failed", result:"Failed", created_at:"2026-09-23T00:00:00Z" },
  });
  await withMockFetch(harness, async calls => {
    const result = await processClaimedEvent(config, event({ attempt_count:2 }));
    assert.equal(result.result, "Success");
    assert.equal(callsFor(calls, "/tasks", "POST").length, 1);
    const runCall = callsFor(calls, "/automation_runs", "POST").at(-1);
    assert.equal(runCall.body.result, "Success");
    assert.match(runCall.prefer, /merge-duplicates/);
  });
}

// 4. Approval autonomy creates an idempotent approval and no business mutation.
{
  const harness = createHarness({ rule:rule({ autonomy:"Approval" }) });
  await withMockFetch(harness, async calls => {
    const result = await processClaimedEvent(config, event());
    assert.equal(result.result, "Approval");
    assert.equal(callsFor(calls, "/tasks", "POST").length, 0);
    const approvals = callsFor(calls, "/approvals", "POST");
    assert.equal(approvals.length, 1);
    assert.equal(approvals[0].body.source_event_id, "evt_test_001");
    assert.equal(approvals[0].body.status, "Pending");
    assert.equal(callsFor(calls, "/automation_runs", "POST").at(-1).body.result, "Approval");
  });
}

// 5. Suggest autonomy records suppression and performs no business mutation.
{
  const harness = createHarness({ rule:rule({ autonomy:"Suggest" }) });
  await withMockFetch(harness, async calls => {
    const result = await processClaimedEvent(config, event());
    assert.equal(result.result, "Suppressed");
    assert.equal(callsFor(calls, "/tasks", "POST").length, 0);
    assert.equal(callsFor(calls, "/approvals", "POST").length, 0);
    assert.equal(callsFor(calls, "/automation_runs", "POST").at(-1).body.result, "Suppressed");
  });
}

// 6. Unsupported financial events are dead-lettered instead of guessed.
{
  const harness = createHarness({
    rule:rule({
      id:"rule-payment",
      rule_key:"payment-recovery",
      name:"Failed payment recovery",
      scope:"Finance",
      event_type:"payment.failed",
    }),
  });
  await withMockFetch(harness, async calls => {
    const result = await processClaimedEvent(config, event({
      event_id:"evt_payment_001",
      event_type:"payment.failed",
      payload:{ reservation_id:"SP-TEST-01" },
    }));
    assert.equal(result.status, "dead_letter");
    assert.equal(result.reason, "unsupported_event");
    assert.equal(callsFor(calls, "/automation_runs", "POST").at(-1).body.result, "Failed");
    assert.equal(callsFor(calls, "/rpc/finish_inbound_event", "POST").at(-1).body.outcome, "dead_letter");
  });
}

// 7. A transient Supabase failure schedules retry and records a Failed run.
{
  const harness = createHarness({ rule:rule(), failTaskOnce:true });
  await withMockFetch(harness, async calls => {
    const result = await processClaimedEvent(config, event({ event_id:"evt_retry_001" }));
    assert.equal(result.status, "retrying");
    assert.equal(result.retryable, true);
    const runCall = callsFor(calls, "/automation_runs", "POST").at(-1);
    assert.equal(runCall.body.result, "Failed");
    const finish = callsFor(calls, "/rpc/finish_inbound_event", "POST").at(-1);
    assert.equal(finish.body.outcome, "failed");
    assert.equal(finish.body.retry_delay_seconds, 60);
  });
}

// 8. Checkout turnover mutates room state and creates one idempotent turnover task.
{
  const checkoutRule = rule({
    id:"rule-checkout",
    rule_key:"checkout-turnover",
    name:"Checkout turnover",
    event_type:"guest.checked_out",
  });
  const harness = createHarness({ rule:checkoutRule });
  await withMockFetch(harness, async calls => {
    const result = await processClaimedEvent(config, event({
      event_id:"evt_checkout_001",
      event_type:"guest.checked_out",
      payload:{ room_number:"204" },
    }));
    assert.equal(result.result, "Success");
    const patch = callsFor(calls, "/rooms", "PATCH");
    assert.equal(patch.length, 1);
    assert.deepEqual(patch[0].body, { occupancy:"Vacant", housekeeping:"Dirty" });
    const task = callsFor(calls, "/tasks", "POST").at(-1);
    assert.equal(task.body.title, "Full turnover");
    assert.equal(task.body.source_event_id, "evt_checkout_001");
  });
}

// 9. Unknown room references fail closed and dead-letter without an unbound task.
{
  const housekeepingRule = rule({
    id:"rule-hk",
    rule_key:"room-ready",
    name:"Room-ready release",
    event_type:"housekeeping.completed",
  });
  const harness = createHarness({ rule:housekeepingRule, room:null });
  await withMockFetch(harness, async calls => {
    const result = await processClaimedEvent(config, event({
      event_id:"evt_room_missing",
      event_type:"housekeeping.completed",
      payload:{ room_number:"999" },
    }));
    assert.equal(result.status, "dead_letter");
    assert.equal(result.error, "room_not_found");
    assert.equal(callsFor(calls, "/tasks", "POST").length, 0);
    assert.equal(callsFor(calls, "/rpc/finish_inbound_event", "POST").at(-1).body.outcome, "dead_letter");
  });
}

// 10. A transient outbox failure retries delivery preparation without repeating hotel effects.
{
  const harness = createHarness({ rule:rule(), failOutboxOnce:true, outboundQueued:1 });
  await withMockFetch(harness, async calls => {
    const retryEvent = event({ event_id:"evt_outbox_retry_001" });

    const first = await processClaimedEvent(config, retryEvent);
    assert.equal(first.status, "retrying");
    assert.equal(first.retryable, true);
    assert.equal(callsFor(calls, "/tasks", "POST").length, 1);
    assert.equal(callsFor(calls, "/automation_runs", "POST").length, 1);
    assert.equal(callsFor(calls, "/automation_runs", "POST")[0].body.result, "Success");
    assert.equal(callsFor(calls, "/rpc/enqueue_webhook_deliveries", "POST").length, 1);
    assert.equal(callsFor(calls, "/rpc/finish_inbound_event", "POST").at(-1).body.outcome, "failed");

    const second = await processClaimedEvent(config, { ...retryEvent, attempt_count:2 });
    assert.equal(second.status, "completed");
    assert.equal(second.duplicate, true);
    assert.equal(second.outboundQueued, 1);
    assert.equal(callsFor(calls, "/tasks", "POST").length, 1, "retry must not repeat the hotel task");
    assert.equal(callsFor(calls, "/automation_runs", "POST").length, 1, "retry must preserve the terminal automation run");
    assert.equal(callsFor(calls, "/rpc/enqueue_webhook_deliveries", "POST").length, 2);
    assert.equal(callsFor(calls, "/rpc/finish_inbound_event", "POST").at(-1).body.outcome, "completed");
  });
}

console.log("StayPilot durable worker integration tests passed.");
