import { constantTimeEqual, getBackendConfig, jsonResponse } from "../_shared/webhook.js";
import { runOrchestration } from "../_shared/orchestrator.js";

export async function onRequestPost({ request, env }) {
  const config = getBackendConfig(env);
  if (!config.supabaseUrl || !config.supabaseKey || !config.orchestratorSecret) {
    return jsonResponse({
      ok:false,
      error:"orchestrator_not_configured",
      message:"Dedicated Supabase and ORCHESTRATOR_SECRET are required before scheduled orchestration is enabled.",
    }, 503);
  }

  const providedSecret = request.headers.get("x-staypilot-orchestrator-secret") || "";
  if (!constantTimeEqual(providedSecret, config.orchestratorSecret)) {
    return jsonResponse({ ok:false, error:"orchestrator_unauthorized" }, 401);
  }

  let options = {};
  try {
    const body = await request.json();
    if (body && typeof body === "object") {
      options = {
        workerBatch:body.worker_batch,
        dispatcherBatch:body.dispatcher_batch,
        maxCycles:body.max_cycles,
      };
    }
  } catch {
    // Empty body uses bounded defaults.
  }

  const runId = crypto.randomUUID();
  try {
    const result = await runOrchestration(config, env, { ...options, runId });
    return jsonResponse({
      ok:true,
      orchestration_id:runId,
      ...result,
    });
  } catch (error) {
    return jsonResponse({
      ok:false,
      orchestration_id:runId,
      error:"orchestrator_unavailable",
      message:error?.message || "Scheduled orchestration could not run.",
    }, 502);
  }
}

export function onRequest() {
  return jsonResponse({ ok:false, error:"method_not_allowed" }, 405, { allow:"POST" });
}
