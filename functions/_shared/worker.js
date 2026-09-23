import { eq, selectQuery, supabaseRequest, supabaseRpc, SupabaseHttpError } from "./supabase.js";

export class WorkerExecutionError extends Error {
  constructor(message, { retryable = false, code = "worker_execution_error" } = {}) {
    super(message);
    this.name = "WorkerExecutionError";
    this.retryable = retryable;
    this.code = code;
  }
}

function cleanText(value, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 500) : fallback;
}

function requireRoomNumber(payload) {
  const roomNumber = cleanText(payload?.room_number || payload?.roomNumber);
  if (!roomNumber) throw new WorkerExecutionError("room_number_required", { code:"invalid_payload" });
  return roomNumber;
}

export function normalizeGuestRequest(value = "") {
  const raw = cleanText(value, "Guest service request");
  if (/towels?/i.test(raw)) return "Extra towels requested";
  if (/pillows?/i.test(raw)) return "Extra pillows requested";
  if (/blanket/i.test(raw)) return "Extra blanket requested";
  if (/clean/i.test(raw)) return "Room cleaning requested";
  return raw.slice(0, 180) || "Guest service request";
}

export function planDomainEvent(event) {
  const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
  switch (event?.event_type) {
    case "guest.request_received":
      return {
        kind:"create_task",
        team:"Housekeeping",
        title:normalizeGuestRequest(payload.request),
        roomNumber:cleanText(payload.room_number || payload.roomNumber) || null,
        steps:["Guest request normalized","Housekeeping task created","Event marked completed"],
        minutesSaved:3,
      };

    case "review.negative": {
      const score = Number(payload.score);
      const safeScore = Number.isFinite(score) && score >= 1 && score <= 5 ? score : null;
      const guest = cleanText(payload.guest, "Recent guest");
      return {
        kind:"create_task",
        team:"Front desk",
        title:`Guest recovery follow-up${safeScore ? ` · ${safeScore}★` : ""}`,
        roomNumber:null,
        metadata:{ guest, score:safeScore },
        steps:["Negative feedback normalized","Recovery task created","Manager follow-up queued"],
        minutesSaved:4,
      };
    }

    case "housekeeping.completed":
      return {
        kind:"update_room",
        roomNumber:requireRoomNumber(payload),
        patch:{ housekeeping:"Clean" },
        steps:["Housekeeping completion normalized","Room marked Clean","Sellability can be recalculated"],
        minutesSaved:3,
      };

    case "room.maintenance_blocked":
      return {
        kind:"update_room",
        roomNumber:requireRoomNumber(payload),
        patch:{ maintenance:"Out of order" },
        steps:["Maintenance block normalized","Room marked Out of order","Operational conflict review enabled"],
        minutesSaved:5,
      };

    case "guest.checked_out":
      return {
        kind:"checkout_turnover",
        roomNumber:requireRoomNumber(payload),
        steps:["Checkout normalized","Room marked Vacant + Dirty","Turnover task created"],
        minutesSaved:4,
      };

    default:
      return { kind:"unsupported", eventType:event?.event_type || "unknown" };
  }
}

async function fetchRoom(config, hotelId, roomNumber) {
  const query = selectQuery({
    hotel_id:eq(hotelId),
    number:eq(roomNumber),
    select:"id,number,occupancy,housekeeping,maintenance",
    limit:"1",
  });
  const { data } = await supabaseRequest(config, `/rest/v1/rooms?${query}`);
  return Array.isArray(data) ? data[0] || null : null;
}

async function resolveActiveRule(config, event) {
  const query = selectQuery({
    hotel_id:eq(event.hotel_id),
    event_type:eq(event.event_type),
    status:eq("Active"),
    select:"id,rule_key,name,scope,event_type,status,autonomy,config",
    limit:"1",
  });
  const { data } = await supabaseRequest(config, `/rest/v1/automation_rules?${query}`);
  return Array.isArray(data) ? data[0] || null : null;
}

async function findExistingRun(config, event, ruleId) {
  const query = selectQuery({
    hotel_id:eq(event.hotel_id),
    event_id:eq(event.event_id),
    rule_id:eq(ruleId),
    select:"id,result,created_at",
    limit:"1",
  });
  const { data } = await supabaseRequest(config, `/rest/v1/automation_runs?${query}`);
  return Array.isArray(data) ? data[0] || null : null;
}

async function createTask(config, event, plan) {
  let roomId = null;
  if (plan.roomNumber) {
    const room = await fetchRoom(config, event.hotel_id, plan.roomNumber);
    roomId = room?.id || null;
  }

  await supabaseRequest(
    config,
    "/rest/v1/tasks?on_conflict=hotel_id,source_event_id",
    {
      method:"POST",
      prefer:"resolution=ignore-duplicates,return=minimal",
      body:{
        hotel_id:event.hotel_id,
        room_id:roomId,
        title:plan.title,
        team:plan.team,
        status:"New",
        automated:true,
        source_event_id:event.event_id,
        metadata:{
          source:"server_worker",
          inbound_event_id:event.id,
          ...(plan.metadata || {}),
        },
      },
    },
  );
}

async function updateRoom(config, event, roomNumber, patch) {
  const query = selectQuery({
    hotel_id:eq(event.hotel_id),
    number:eq(roomNumber),
    select:"id,number",
  });
  const { data } = await supabaseRequest(config, `/rest/v1/rooms?${query}`, {
    method:"PATCH",
    prefer:"return=representation",
    body:patch,
  });
  if (!Array.isArray(data) || data.length === 0) {
    throw new WorkerExecutionError("room_not_found", { code:"room_not_found" });
  }
}

async function createApproval(config, event, rule) {
  await supabaseRequest(
    config,
    "/rest/v1/approvals?on_conflict=hotel_id,source_event_id",
    {
      method:"POST",
      prefer:"resolution=ignore-duplicates,return=minimal",
      body:{
        hotel_id:event.hotel_id,
        type:"Automation",
        title:`${rule.name} requires Owner approval`,
        detail:`${event.event_type} · ${event.event_id}`,
        status:"Pending",
        requested_by_actor:"StayPilot server worker",
        source_event_id:event.event_id,
        payload:{ inbound_event_id:event.id, event_type:event.event_type, payload:event.payload },
      },
    },
  );
}

async function recordRun(config, event, rule, {
  result,
  detail,
  steps = [],
  durationMs = 0,
  minutesSaved = 0,
}) {
  await supabaseRequest(
    config,
    "/rest/v1/automation_runs?on_conflict=hotel_id,event_id,rule_id",
    {
      method:"POST",
      prefer:"resolution=ignore-duplicates,return=minimal",
      body:{
        hotel_id:event.hotel_id,
        rule_id:rule?.id || null,
        inbound_event_id:event.id,
        event_id:event.event_id,
        event_type:event.event_type,
        result,
        detail,
        steps,
        duration_ms:Math.max(0, Math.round(durationMs)),
        minutes_saved:Math.max(0, Math.round(minutesSaved)),
      },
    },
  );
}

async function recordAudit(config, event, action, detail) {
  await supabaseRequest(
    config,
    "/rest/v1/audit_events?on_conflict=hotel_id,source_event_id,action",
    {
      method:"POST",
      prefer:"resolution=ignore-duplicates,return=minimal",
      body:{
        hotel_id:event.hotel_id,
        actor_kind:"automation",
        category:"Automation",
        action,
        detail,
        source_event_id:event.event_id,
        payload:{ inbound_event_id:event.id, event_type:event.event_type },
      },
    },
  );
}

async function finishEvent(config, eventId, outcome, errorMessage = null, retryDelaySeconds = 60) {
  const { data } = await supabaseRpc(config, "finish_inbound_event", {
    event_uuid:eventId,
    outcome,
    error_message:errorMessage,
    retry_delay_seconds:retryDelaySeconds,
  });
  return data;
}

async function executePlan(config, event, plan) {
  if (plan.kind === "create_task") {
    await createTask(config, event, plan);
    return;
  }
  if (plan.kind === "update_room") {
    await updateRoom(config, event, plan.roomNumber, plan.patch);
    return;
  }
  if (plan.kind === "checkout_turnover") {
    await updateRoom(config, event, plan.roomNumber, { occupancy:"Vacant", housekeeping:"Dirty" });
    await createTask(config, event, {
      kind:"create_task",
      team:"Housekeeping",
      title:"Full turnover",
      roomNumber:plan.roomNumber,
      metadata:{ trigger:"guest.checked_out" },
    });
    return;
  }
  throw new WorkerExecutionError("unsupported_event", { code:"unsupported_event" });
}

function classifyError(error) {
  if (error instanceof WorkerExecutionError) return error;
  if (error instanceof SupabaseHttpError) {
    return new WorkerExecutionError(error.message, {
      retryable:error.retryable,
      code:`supabase_${error.status}`,
    });
  }
  return new WorkerExecutionError(error?.message || "unknown_worker_error", {
    retryable:true,
    code:"unexpected_error",
  });
}

export async function claimInboundEvents(config, workerName, batchSize = 5) {
  const { data } = await supabaseRpc(config, "claim_inbound_events", {
    worker_name:workerName,
    batch_size:Math.max(1, Math.min(Number(batchSize) || 5, 10)),
  });
  return Array.isArray(data) ? data : [];
}

export async function processClaimedEvent(config, event) {
  const started = Date.now();
  let rule = null;
  let plan = null;
  try {
    rule = await resolveActiveRule(config, event);
    if (!rule) {
      await finishEvent(config, event.id, "dead_letter", "no_active_rule");
      return { eventId:event.event_id, status:"dead_letter", reason:"no_active_rule" };
    }

    const existing = await findExistingRun(config, event, rule.id);
    if (existing) {
      await finishEvent(config, event.id, "completed");
      return { eventId:event.event_id, status:"completed", duplicate:true, runId:existing.id };
    }

    plan = planDomainEvent(event);
    if (plan.kind === "unsupported") {
      await recordRun(config, event, rule, {
        result:"Failed",
        detail:`Unsupported server event: ${event.event_type}`,
        steps:["Event claimed","No safe server handler available","Event dead-lettered"],
        durationMs:Date.now() - started,
      });
      await finishEvent(config, event.id, "dead_letter", "unsupported_event");
      return { eventId:event.event_id, status:"dead_letter", reason:"unsupported_event" };
    }

    if (rule.autonomy === "Suggest") {
      await recordRun(config, event, rule, {
        result:"Suppressed",
        detail:"Owner configured suggest-only execution",
        steps:["Event claimed","Automation authority resolved: Suggest","No business mutation executed"],
        durationMs:Date.now() - started,
      });
      await recordAudit(config, event, "Automation suggestion recorded", rule.name);
      await finishEvent(config, event.id, "completed");
      return { eventId:event.event_id, status:"completed", result:"Suppressed" };
    }

    if (rule.autonomy === "Approval") {
      await createApproval(config, event, rule);
      await recordRun(config, event, rule, {
        result:"Approval",
        detail:"Owner approval required before business mutation",
        steps:["Event claimed","Automation authority resolved: Approval","Approval request persisted"],
        durationMs:Date.now() - started,
      });
      await recordAudit(config, event, "Automation approval requested", rule.name);
      await finishEvent(config, event.id, "completed");
      return { eventId:event.event_id, status:"completed", result:"Approval" };
    }

    await executePlan(config, event, plan);
    await recordRun(config, event, rule, {
      result:"Success",
      detail:`${rule.name} executed by durable worker`,
      steps:plan.steps,
      durationMs:Date.now() - started,
      minutesSaved:plan.minutesSaved,
    });
    await recordAudit(config, event, "Automation executed", `${rule.name} · ${event.event_id}`);
    await finishEvent(config, event.id, "completed");
    return { eventId:event.event_id, status:"completed", result:"Success" };
  } catch (rawError) {
    const error = classifyError(rawError);
    try {
      if (rule) {
        await recordRun(config, event, rule, {
          result:"Failed",
          detail:`${error.code}: ${error.message}`,
          steps:plan?.steps || ["Event claimed","Worker execution failed"],
          durationMs:Date.now() - started,
        });
      }
    } catch {
      // The source event remains the recovery authority if run logging also fails.
    }

    const outcome = error.retryable ? "failed" : "dead_letter";
    try {
      await finishEvent(config, event.id, outcome, `${error.code}: ${error.message}`, 60);
    } catch {
      // A processing event with its lease intact can be recovered by the database lease strategy later.
    }

    return {
      eventId:event.event_id,
      status:outcome === "failed" ? "retrying" : "dead_letter",
      error:error.code,
      retryable:error.retryable,
    };
  }
}
