export const EZSTAY_BACKEND_CONTRACT_VERSION = "ezstay-backend-v1";

function enabled(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

export function buildEzstayBackendHealth(env = {}) {
  const authConfigured = Boolean(
    String(env.SUPABASE_URL || "").trim() &&
    String(env.SUPABASE_PUBLISHABLE_KEY || "").trim()
  );
  const runtimeConfigured = Boolean(env.EZSTAY_RUNTIME && typeof env.EZSTAY_RUNTIME.fetch === "function");
  const requestedMode = String(env.EZSTAY_BACKEND_MODE || "").trim();

  return {
    ok:true,
    app:"ezstay",
    contractVersion:EZSTAY_BACKEND_CONTRACT_VERSION,
    mode:requestedMode === "configured" && authConfigured && runtimeConfigured
      ? "configured"
      : "not_configured",
    authConfigured,
    runtimeConfigured,
    schedulerEnabled:enabled(env.EZSTAY_SCHEDULER_ENABLED),
  };
}
