export async function runScheduledTick(env = {}, backend) {
  const enabled = String(env.EZSTAY_SCHEDULER_ENABLED || "").trim().toLowerCase() === "true";
  if (!enabled) return { skipped:true, reason:"scheduler_disabled" };

  const requested = Number(env.EZSTAY_SCHEDULER_BATCH || 5);
  const batchSize = Math.max(1, Math.min(10, Number.isFinite(requested) ? Math.floor(requested) : 5));

  if (!backend || typeof backend.runScheduledWork !== "function") {
    throw new Error("backend_not_configured");
  }

  return backend.runScheduledWork({ batchSize });
}
