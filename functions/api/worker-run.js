import { constantTimeEqual, getBackendConfig, jsonResponse } from "../_shared/webhook.js";
import { claimInboundEvents, processClaimedEvent } from "../_shared/worker.js";

export async function onRequestPost({ request, env }) {
  const config = getBackendConfig(env);
  if (!config.supabaseUrl || !config.supabaseKey || !config.workerSecret) {
    return jsonResponse({
      ok:false,
      error:"worker_not_configured",
      message:"Dedicated Supabase and WORKER_SECRET are required before durable automation execution is enabled.",
    }, 503);
  }

  const providedSecret = request.headers.get("x-staypilot-worker-secret") || "";
  if (!constantTimeEqual(providedSecret, config.workerSecret)) {
    return jsonResponse({ ok:false, error:"worker_unauthorized" }, 401);
  }

  let batchSize = 5;
  try {
    const body = await request.json();
    if (body && typeof body === "object" && body.batch_size !== undefined) {
      batchSize = Math.max(1, Math.min(Number(body.batch_size) || 5, 10));
    }
  } catch {
    // Empty body is valid and uses default batch size.
  }

  const workerId = `cf-${crypto.randomUUID()}`;

  try {
    const events = await claimInboundEvents(config, workerId, batchSize);
    const results = [];
    for (const event of events) {
      results.push(await processClaimedEvent(config, event));
    }

    const summary = results.reduce((acc, result) => {
      const key = result.status || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return jsonResponse({
      ok:true,
      worker_id:workerId,
      claimed:events.length,
      summary,
      results,
    });
  } catch (error) {
    return jsonResponse({
      ok:false,
      error:"worker_unavailable",
      message:error?.message || "Durable worker could not claim events.",
    }, 502);
  }
}

export function onRequest() {
  return jsonResponse({ ok:false, error:"method_not_allowed" }, 405, { allow:"POST" });
}
