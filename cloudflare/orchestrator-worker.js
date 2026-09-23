const DEFAULT_ORIGIN = "https://staypilot-hotel-os.pages.dev";

export async function runScheduledTick(env, fetchImpl = fetch) {
  const enabled = String(env?.SCHEDULER_ENABLED || "").trim().toLowerCase() === "true";
  if (!enabled) return { skipped:true, reason:"scheduler_disabled" };

  const secret = String(env?.ORCHESTRATOR_SECRET || "");
  if (!secret) throw new Error("orchestrator_secret_missing");

  const origin = String(env?.STAYPILOT_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, "");
  const response = await fetchImpl(`${origin}/api/orchestrate-run`, {
    method:"POST",
    redirect:"manual",
    cache:"no-store",
    headers:{
      "content-type":"application/json",
      "x-staypilot-orchestrator-secret":secret,
      "user-agent":"StayPilot-Orchestrator/1.0",
    },
    body:JSON.stringify({
      cycles:2,
      worker_batch:5,
      dispatcher_batch:5,
    }),
  });

  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw:text }; }

  if (!response.ok) {
    const error = new Error(`orchestration_http_${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

export default {
  async scheduled(controller, env, ctx) {
    try {
      await runScheduledTick(env);
    } catch (error) {
      console.error("StayPilot scheduled orchestration failed", {
        status:error?.status || null,
        message:error?.message || "unknown_error",
      });
      throw error;
    }
  },
};
