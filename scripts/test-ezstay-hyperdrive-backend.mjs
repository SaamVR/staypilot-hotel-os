import test from "node:test";
import assert from "node:assert/strict";
import { createHyperdriveBackend } from "../cloudflare/ezstay-runtime/hyperdriveBackend.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const HOTEL_ID = "33333333-3333-4333-8333-333333333333";
const RUN_ID = "44444444-4444-4444-8444-444444444444";
const RESERVATION_ID = "55555555-5555-4555-8555-555555555555";
const TASK_ID = "66666666-6666-4666-8666-666666666666";
const INVENTORY_ID = "77777777-7777-4777-8777-777777777777";
const APPROVAL_ID = "88888888-8888-4888-8888-888888888888";
const DELIVERY_ID = "99999999-9999-4999-8999-999999999999";

function context({ body = {}, idempotencyKey = "cmd_test_1", anonymous = true, runId = null } = {}) {
  return {
    request:new Request("https://runtime.internal/api/ezstay/test", {
      headers:{
        "x-ezstay-user-id":USER_ID,
        "x-ezstay-user-anonymous":anonymous ? "true" : "false",
      }
    }),
    body,
    idempotencyKey,
    runId,
  };
}

function fakeClientFactory() {
  const instances = [];
  class FakeClient {
    constructor(config) {
      this.config = config;
      this.queries = [];
      this.connected = false;
      this.ended = false;
      instances.push(this);
    }
    async connect() { this.connected = true; }
    async end() { this.ended = true; }
    async query(text, values = []) {
      this.queries.push({ text, values });
      const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
      if (normalized.includes("create_ezstay_demo_session")) {
        return { rows:[{
          id:SESSION_ID, tenant_id:HOTEL_ID, seed_version:"northstar-v2",
          reset_generation:0, demo_now:"2026-09-25T04:30:00.000Z",
          expires_at:"2026-09-28T04:30:00.000Z",
        }] };
      }
      if (normalized.includes("ezstay_active_demo_session")) {
        return { rows:[{
          id:SESSION_ID, tenant_id:HOTEL_ID, seed_version:"northstar-v2",
          reset_generation:0, demo_now:"2026-09-25T04:30:00.000Z",
          expires_at:"2026-09-28T04:30:00.000Z",
        }] };
      }
      if (normalized.includes("ezstay_reset_demo_command")) {
        return { rows:[{
          id:"66666666-6666-4666-8666-666666666666", tenant_id:HOTEL_ID,
          seed_version:"northstar-v2", reset_generation:1,
          demo_now:"2026-09-25T04:30:00.000Z", expires_at:"2026-09-28T04:30:00.000Z",
        }] };
      }
      if (normalized.includes("ezstay_advance_demo_clock_command")) {
        return { rows:[{ result:{
          session_id:SESSION_ID, hotel_id:HOTEL_ID, reset_generation:0,
          demo_now:"2026-09-25T05:00:00.000Z", minutes:30,
          escalated_count:1, run_id:RUN_ID,
        } }] };
      }
      if (normalized.includes("ezstay_apply_guest_request")) {
        return { rows:[{ run_id:RUN_ID }] };
      }
      if (
        normalized.includes("ezstay_apply_checkout") ||
        normalized.includes("ezstay_complete_housekeeping") ||
        normalized.includes("ezstay_apply_low_stock") ||
        normalized.includes("ezstay_resolve_approval")
      ) {
        return { rows:[{ run_id:RUN_ID }] };
      }
      if (normalized.includes("ezstay_retry_delivery")) {
        return { rows:[{ ezstay_retry_delivery:{ delivery_id:DELIVERY_ID } }] };
      }
      if (normalized.includes("ezstay_run_scheduled_work")) {
        return { rows:[{ result:{ processed_sessions:2, escalated_tasks:1, batch_size:5 } }] };
      }
      if (normalized.includes("ezstay_get_run")) {
        return { rows:[{ run:{
          id:RUN_ID, eventId:"cmd_test_1", ruleKey:"guest-request-router",
          result:"Success", summary:"Done", input:{}, decision:{}, changes:[],
          delivery:[], audit:[], linkedRecords:[],
        } }] };
      }
      if (normalized.includes("ezstay_snapshot")) {
        return { rows:[{ snapshot:{
          meta:{ seedVersion:"northstar-v2", backendContractVersion:"ezstay-backend-v1", demoNow:"2026-09-25T04:30:00.000Z", resetGeneration:0 },
          hotel:{ id:HOTEL_ID, name:"Northstar Grand" },
          reservations:[], inventory:[], deliveries:[{ id:DELIVERY_ID, status:"Delivered" }],
          automationRuns:[{
            id:RUN_ID, eventId:"cmd_retry_1", ruleKey:"delivery-recovery",
            result:"Success", summary:"Delivery recovered", input:{}, decision:{},
            changes:[], delivery:[{ id:DELIVERY_ID, status:"Delivered" }], audit:[], linkedRecords:[],
          }],
        } }] };
      }
      throw new Error(`unexpected_query:${normalized}`);
    }
  }
  return { ClientImpl:FakeClient, instances };
}

test("Hyperdrive backend fails closed without a connection binding", () => {
  assert.throws(() => createHyperdriveBackend({}), /hyperdrive_not_configured/);
});

test("demo creation requires verified anonymous internal identity", async () => {
  const fake = fakeClientFactory();
  const backend = createHyperdriveBackend(
    { HYPERDRIVE:{ connectionString:"postgres://restricted@example/db" } },
    { ClientImpl:fake.ClientImpl }
  );
  await assert.rejects(
    () => backend.startDemo(context({ anonymous:false })),
    /anonymous_demo_identity_required/
  );
  assert.equal(fake.instances.length, 0);
});

test("start demo uses private session and snapshot functions and returns backend mode", async () => {
  const fake = fakeClientFactory();
  const backend = createHyperdriveBackend(
    { HYPERDRIVE:{ connectionString:"postgres://restricted@example/db" } },
    { ClientImpl:fake.ClientImpl }
  );
  const result = await backend.startDemo(context());
  assert.equal(result.session.mode, "backend-sandbox");
  assert.equal(result.session.hotelId, HOTEL_ID);
  assert.equal(result.snapshot.hotel.id, HOTEL_ID);
  const client = fake.instances[0];
  assert.equal(client.connected, true);
  assert.equal(client.ended, true);
  assert.match(client.queries[0].text, /private\.create_ezstay_demo_session/i);
  assert.match(client.queries[1].text, /private\.ezstay_snapshot/i);
});

test("guest request derives hotel from active session and uses parameterized private functions", async () => {
  const fake = fakeClientFactory();
  const backend = createHyperdriveBackend(
    { HYPERDRIVE:{ connectionString:"postgres://restricted@example/db" } },
    { ClientImpl:fake.ClientImpl }
  );
  const result = await backend.runGuestRequest(context({
    body:{ roomNumber:"108", request:"Extra pillows" },
    idempotencyKey:"cmd_guest_1",
  }));
  assert.equal(result.run.id, RUN_ID);
  const queries = fake.instances[0].queries;
  assert.match(queries[0].text, /private\.ezstay_active_demo_session/i);
  const mutation = queries.find(row => /ezstay_apply_guest_request/i.test(row.text));
  assert.deepEqual(mutation.values, [HOTEL_ID, "cmd_guest_1", "108", "Extra pillows"]);
  for (const query of queries) {
    assert.doesNotMatch(query.text, /\b(insert|update|delete)\b/i);
  }
});

test("checkout passes the opaque reservation UUID through a private command", async () => {
  const fake = fakeClientFactory();
  const backend = createHyperdriveBackend(
    { HYPERDRIVE:{ connectionString:"postgres://restricted@example/db" } },
    { ClientImpl:fake.ClientImpl }
  );
  await backend.runCheckout(context({
    body:{ reservationId:RESERVATION_ID },
    idempotencyKey:"cmd_checkout_1",
  }));
  const mutation = fake.instances[0].queries.find(row => /ezstay_apply_checkout/i.test(row.text));
  assert.deepEqual(mutation.values, [HOTEL_ID, "cmd_checkout_1", RESERVATION_ID]);
});

test("reset and clock use retry-safe command wrappers", async () => {
  const fake = fakeClientFactory();
  const backend = createHyperdriveBackend(
    { HYPERDRIVE:{ connectionString:"postgres://restricted@example/db" } },
    { ClientImpl:fake.ClientImpl }
  );
  await backend.resetDemo(context({ idempotencyKey:"cmd_reset_1" }));
  await backend.advanceClock(context({ idempotencyKey:"cmd_clock_1", body:{ minutes:30 } }));
  const texts = fake.instances.flatMap(client => client.queries.map(row => row.text));
  assert.ok(texts.some(text => /private\.ezstay_reset_demo_command/i.test(text)));
  assert.ok(texts.some(text => /private\.ezstay_advance_demo_clock_command/i.test(text)));
  assert.ok(texts.some(text => /private\.ezstay_get_run/i.test(text)));
});

test("scheduled work is the only adapter path that does not require a user identity", async () => {
  const fake = fakeClientFactory();
  const backend = createHyperdriveBackend(
    { HYPERDRIVE:{ connectionString:"postgres://restricted@example/db" } },
    { ClientImpl:fake.ClientImpl }
  );
  const result = await backend.runScheduledWork({ batchSize:5 });
  assert.deepEqual(result, { processed_sessions:2, escalated_tasks:1, batch_size:5 });
  assert.match(fake.instances[0].queries[0].text, /private\.ezstay_run_scheduled_work/i);
});

test("housekeeping, low-stock, and approval commands stay behind private parameterized functions", async () => {
  const fake = fakeClientFactory();
  const backend = createHyperdriveBackend(
    { HYPERDRIVE:{ connectionString:"postgres://restricted@example/db" } },
    { ClientImpl:fake.ClientImpl }
  );

  await backend.completeHousekeeping(context({
    body:{ taskId:TASK_ID },
    idempotencyKey:"cmd_housekeeping_1",
  }));
  await backend.runLowStock(context({
    body:{ inventoryItemId:INVENTORY_ID },
    idempotencyKey:"cmd_stock_1",
  }));
  await backend.resolveApproval(context({
    body:{ approvalId:APPROVAL_ID, decision:"Approved" },
    idempotencyKey:"cmd_approval_1",
  }));

  const queries = fake.instances.flatMap(client => client.queries);
  const housekeeping = queries.find(row => /ezstay_complete_housekeeping/i.test(row.text));
  const lowStock = queries.find(row => /ezstay_apply_low_stock/i.test(row.text));
  const approval = queries.find(row => /ezstay_resolve_approval/i.test(row.text));
  assert.deepEqual(housekeeping.values, [HOTEL_ID, "cmd_housekeeping_1", TASK_ID]);
  assert.deepEqual(lowStock.values, [HOTEL_ID, "cmd_stock_1", INVENTORY_ID]);
  assert.deepEqual(approval.values, [HOTEL_ID, "cmd_approval_1", APPROVAL_ID, "Approved"]);
  for (const query of queries) assert.doesNotMatch(query.text, /\b(insert|update|delete)\b/i);
});

test("delivery retry and run lookup remain hotel-scoped through the active session", async () => {
  const fake = fakeClientFactory();
  const backend = createHyperdriveBackend(
    { HYPERDRIVE:{ connectionString:"postgres://restricted@example/db" } },
    { ClientImpl:fake.ClientImpl }
  );

  const recovered = await backend.retryDelivery(context({
    body:{ deliveryId:DELIVERY_ID },
    idempotencyKey:"cmd_retry_1",
  }));
  assert.equal(recovered.run.ruleKey, "delivery-recovery");

  const fetched = await backend.getRun(context({ runId:RUN_ID }));
  assert.equal(fetched.run.id, RUN_ID);

  const queries = fake.instances.flatMap(client => client.queries);
  assert.ok(queries.some(row => /ezstay_retry_delivery/i.test(row.text)));
  const runQuery = queries.find(row => /ezstay_get_run/i.test(row.text));
  assert.deepEqual(runQuery.values, [HOTEL_ID, RUN_ID]);
});
