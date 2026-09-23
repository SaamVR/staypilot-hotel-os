import { constantTimeEqual, getBackendConfig, jsonResponse } from "../_shared/webhook.js";
import { runOrchestration } from "../_shared/orchestrator.js";

export async function onRequestPost({ request, env }) {
  const config = getBackendConfig(env);

  if (!config.supabaseUrl || !config.supabaseKey || !config.orchestratorSecret) {
    return jsonResponse({
      ok:false,
      error:"orchestrator_not_configured",
      message:"Dedicated Supabase and ORCHESTRATOR_SECRET are required before scheduled orchestration can run.",
    }, 503);
  }

  if (!config.orchestratorEnabled) {
    return jsonResponse({
      ok:false,
      error:"orchestrator_disabled",
      message:"Server orchestration is staged but explicitly disabled. Set ORCHESTRATOR_ENABLED=true only during controlled rollout.",
    }, 503);
  }

  const provided = request.headers.get("x-staypilot-orchestrator-secret") || "";
  if (!constantTimeEqual(provided, config.orchestratorSecret)) {
    return jsonResponse({ ok:false, error:"orchestrator_unauthorized" }, 401);
  }

  let body = {};
  try { body = await request.json(); } catch {}

  const cycles = Math.max(1, Math.min(Number(body?.cycles) || 2, 3));
  const workerBatch = Math.max(1, Math.min(Number(body?.worker_batch) || 5, 10));
  const dispatcherBatch = Math.max(1, Math.min(Number(body?.dispatcher_batch) || 5, 10));

  try {
    const result = await runOrchestration(config, env, {
      cycles,
      workerBatch,
      dispatcherBatch,
      workerPrefix:"cf-orchestrator",
    });
    return jsonResponse({ ok:true, ...result });
  } catch (error) {
    return jsonResponse({
      ok:false,
      error:"orchestrator_unavailable",
      message:error?.message || "Scheduled orchestration could not run.",
    }, 502);
  }
}

export function onRequest() {
  return jsonResponse({ ok:false, error:"method_not_allowed" }, 405, { allow:"POST" });
}
