import { Client } from "pg";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BACKEND_CONTRACT_VERSION = "ezstay-backend-v1";

function connectionStringOf(env) {
  const value = String(env?.HYPERDRIVE?.connectionString || "").trim();
  if (!value) throw new Error("hyperdrive_not_configured");
  return value;
}

function requireUuid(value, code) {
  const normalized = String(value || "").trim();
  if (!UUID_RE.test(normalized)) throw new Error(code);
  return normalized;
}

function requireText(value, code, maxLength = 500) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maxLength) throw new Error(code);
  return normalized;
}

function identityOf(context, { anonymousOnly = false } = {}) {
  const headers = context?.request?.headers;
  const userId = requireUuid(headers?.get?.("x-ezstay-user-id"), "runtime_identity_required");
  const anonymous = String(headers?.get?.("x-ezstay-user-anonymous") || "").toLowerCase() === "true";
  if (anonymousOnly && !anonymous) throw new Error("anonymous_demo_identity_required");
  return { userId, anonymous };
}

function iso(value) {
  if (value instanceof Date) return value.toISOString();
  return value == null ? null : String(value);
}

function sessionEnvelope(row, snapshot) {
  if (!row?.id || !row?.tenant_id) throw new Error("not_found");
  return {
    id:String(row.id),
    appKey:"ezstay",
    hotelId:String(row.tenant_id),
    seedVersion:String(row.seed_version || snapshot?.meta?.seedVersion || "northstar-v2"),
    backendContractVersion:String(snapshot?.meta?.backendContractVersion || BACKEND_CONTRACT_VERSION),
    mode:"backend-sandbox",
    demoNow:iso(row.demo_now || snapshot?.meta?.demoNow),
    expiresAt:iso(row.expires_at),
    resetGeneration:Number(row.reset_generation ?? snapshot?.meta?.resetGeneration ?? 0),
  };
}

export function createHyperdriveBackend(env = {}, { ClientImpl = Client } = {}) {
  const connectionString = connectionStringOf(env);

  async function withClient(work) {
    const client = new ClientImpl({ connectionString });
    await client.connect();
    try {
      return await work(client);
    } finally {
      await client.end();
    }
  }

  async function activeSession(client, userId) {
    const result = await client.query(
      "select * from private.ezstay_active_demo_session($1::uuid)",
      [userId],
    );
    const row = result.rows?.[0];
    if (!row?.id) throw new Error("not_found");
    return row;
  }

  async function snapshotFor(client, hotelId) {
    const result = await client.query(
      "select private.ezstay_snapshot($1::uuid) as snapshot",
      [hotelId],
    );
    const snapshot = result.rows?.[0]?.snapshot;
    if (!snapshot) throw new Error("not_found");
    return snapshot;
  }

  async function runFor(client, hotelId, runId) {
    const result = await client.query(
      "select private.ezstay_get_run($1::uuid, $2::uuid) as run",
      [hotelId, requireUuid(runId, "run_id_invalid")],
    );
    const run = result.rows?.[0]?.run;
    if (!run) throw new Error("not_found");
    return run;
  }

  async function sessionResult(client, sessionRow) {
    const snapshot = await snapshotFor(client, sessionRow.tenant_id);
    return {
      session:sessionEnvelope(sessionRow, snapshot),
      snapshot,
    };
  }

  async function mutationResult(client, hotelId, runId) {
    const [run, snapshot] = await Promise.all([
      runFor(client, hotelId, runId),
      snapshotFor(client, hotelId),
    ]);
    return { run, snapshot };
  }

  async function executeHotelCommand(context, queryText, valuesBuilder) {
    const { userId } = identityOf(context);
    const idempotencyKey = requireText(context?.idempotencyKey, "idempotency_key_required", 160);
    return withClient(async client => {
      const session = await activeSession(client, userId);
      const values = valuesBuilder({ session, idempotencyKey });
      const result = await client.query(queryText, values);
      const runId = result.rows?.[0]?.run_id;
      if (!runId) throw new Error("runtime_command_failed");
      return mutationResult(client, session.tenant_id, runId);
    });
  }

  return {
    async getSession(context) {
      const { userId } = identityOf(context);
      return withClient(async client => sessionResult(client, await activeSession(client, userId)));
    },

    async startDemo(context) {
      const { userId } = identityOf(context, { anonymousOnly:true });
      return withClient(async client => {
        const idempotencyKey = requireText(context?.idempotencyKey, "idempotency_key_required", 160);
        const result = await client.query(
          "select * from private.ezstay_start_demo_command($1::uuid, $2::text)",
          [userId, idempotencyKey],
        );
        const session = result.rows?.[0];
        if (!session?.id) throw new Error("runtime_command_failed");
        return sessionResult(client, session);
      });
    },

    async resetDemo(context) {
      const { userId } = identityOf(context);
      const idempotencyKey = requireText(context?.idempotencyKey, "idempotency_key_required", 160);
      return withClient(async client => {
        const result = await client.query(
          "select * from private.ezstay_reset_demo_command($1::uuid, $2::text)",
          [userId, idempotencyKey],
        );
        const session = result.rows?.[0];
        if (!session?.id) throw new Error("runtime_command_failed");
        return sessionResult(client, session);
      });
    },

    async getSnapshot(context) {
      const { userId } = identityOf(context);
      return withClient(async client => {
        const session = await activeSession(client, userId);
        return { snapshot:await snapshotFor(client, session.tenant_id) };
      });
    },

    runGuestRequest(context) {
      const roomNumber = requireText(context?.body?.roomNumber, "room_number_required", 12);
      const request = requireText(context?.body?.request, "guest_request_required", 500);
      return executeHotelCommand(
        context,
        "select private.ezstay_apply_guest_request($1::uuid, $2::text, $3::text, $4::text) as run_id",
        ({ session, idempotencyKey }) => [session.tenant_id, idempotencyKey, roomNumber, request],
      );
    },

    runCheckout(context) {
      const reservationId = requireUuid(context?.body?.reservationId, "reservation_id_invalid");
      return executeHotelCommand(
        context,
        "select private.ezstay_apply_checkout($1::uuid, $2::text, $3::uuid) as run_id",
        ({ session, idempotencyKey }) => [session.tenant_id, idempotencyKey, reservationId],
      );
    },

    completeHousekeeping(context) {
      const taskId = requireUuid(context?.body?.taskId, "task_id_invalid");
      return executeHotelCommand(
        context,
        "select private.ezstay_complete_housekeeping($1::uuid, $2::text, $3::uuid) as run_id",
        ({ session, idempotencyKey }) => [session.tenant_id, idempotencyKey, taskId],
      );
    },

    runLowStock(context) {
      const inventoryItemId = requireUuid(context?.body?.inventoryItemId, "inventory_item_id_invalid");
      return executeHotelCommand(
        context,
        "select private.ezstay_apply_low_stock($1::uuid, $2::text, $3::uuid) as run_id",
        ({ session, idempotencyKey }) => [session.tenant_id, idempotencyKey, inventoryItemId],
      );
    },

    resolveApproval(context) {
      const approvalId = requireUuid(context?.body?.approvalId, "approval_id_invalid");
      const decision = requireText(context?.body?.decision, "approval_decision_required", 16);
      if (!["Approved","Rejected"].includes(decision)) throw new Error("approval_decision_invalid");
      return executeHotelCommand(
        context,
        "select private.ezstay_resolve_approval($1::uuid, $2::text, $3::uuid, $4::text) as run_id",
        ({ session, idempotencyKey }) => [session.tenant_id, idempotencyKey, approvalId, decision],
      );
    },

    async retryDelivery(context) {
      const { userId } = identityOf(context);
      const idempotencyKey = requireText(context?.idempotencyKey, "idempotency_key_required", 160);
      const deliveryId = requireUuid(context?.body?.deliveryId, "delivery_id_invalid");
      return withClient(async client => {
        const session = await activeSession(client, userId);
        await client.query(
          "select * from private.ezstay_retry_delivery($1::uuid, $2::uuid, $3::text)",
          [session.tenant_id, deliveryId, idempotencyKey],
        );
        const snapshot = await snapshotFor(client, session.tenant_id);
        const run = snapshot.automationRuns?.find(
          item => item.eventId === idempotencyKey && item.ruleKey === "delivery-recovery"
        );
        if (!run) throw new Error("runtime_command_failed");
        return { run, snapshot };
      });
    },

    async advanceClock(context) {
      const { userId } = identityOf(context);
      const idempotencyKey = requireText(context?.idempotencyKey, "idempotency_key_required", 160);
      const requested = Number(context?.body?.minutes ?? 30);
      const minutes = Number.isFinite(requested) ? Math.floor(requested) : 30;
      return withClient(async client => {
        const result = await client.query(
          "select private.ezstay_advance_demo_clock_command($1::uuid, $2::text, $3::integer) as result",
          [userId, idempotencyKey, minutes],
        );
        const command = result.rows?.[0]?.result;
        if (!command?.hotel_id || !command?.run_id) throw new Error("runtime_command_failed");
        return mutationResult(client, command.hotel_id, command.run_id);
      });
    },

    async getRun(context) {
      const { userId } = identityOf(context);
      const runId = requireUuid(context?.runId, "run_id_invalid");
      return withClient(async client => {
        const session = await activeSession(client, userId);
        return { run:await runFor(client, session.tenant_id, runId) };
      });
    },

    async runScheduledWork({ batchSize = 5 } = {}) {
      const requested = Number(batchSize);
      const bounded = Math.max(1, Math.min(10, Number.isFinite(requested) ? Math.floor(requested) : 5));
      return withClient(async client => {
        const result = await client.query(
          "select private.ezstay_run_scheduled_work($1::integer) as result",
          [bounded],
        );
        return result.rows?.[0]?.result || { processed_sessions:0, escalated_tasks:0, batch_size:bounded };
      });
    },
  };
}
