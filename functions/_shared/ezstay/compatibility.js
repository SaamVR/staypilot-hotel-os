export const EZSTAY_BACKEND_CONTRACT_VERSION = "ezstay-backend-v1";

function enabled(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

function safeText(value) {
  return String(value || "").trim();
}

export function buildEzstayBackendHealth(env = {}) {
  const authConfigured = Boolean(
    safeText(env.SUPABASE_URL) &&
    safeText(env.SUPABASE_PUBLISHABLE_KEY)
  );
  const runtimeConfigured = Boolean(env.EZSTAY_RUNTIME && typeof env.EZSTAY_RUNTIME.fetch === "function");
  const turnstileConfigured = Boolean(safeText(env.TURNSTILE_SITE_KEY));
  const requestedMode = safeText(env.EZSTAY_BACKEND_MODE);

  return {
    ok:true,
    app:"ezstay",
    contractVersion:EZSTAY_BACKEND_CONTRACT_VERSION,
    mode:requestedMode === "configured" && authConfigured && runtimeConfigured && turnstileConfigured
      ? "configured"
      : "not_configured",
    authConfigured,
    runtimeConfigured,
    turnstileConfigured,
    schedulerEnabled:enabled(env.EZSTAY_SCHEDULER_ENABLED),
  };
}

export function buildEzstayPublicConfig(env = {}) {
  const health = buildEzstayBackendHealth(env);
  if (health.mode !== "configured") {
    return {
      app:"ezstay",
      contractVersion:EZSTAY_BACKEND_CONTRACT_VERSION,
      mode:"not_configured",
    };
  }
  return {
    app:"ezstay",
    contractVersion:EZSTAY_BACKEND_CONTRACT_VERSION,
    mode:"configured",
    supabaseUrl:safeText(env.SUPABASE_URL),
    supabasePublishableKey:safeText(env.SUPABASE_PUBLISHABLE_KEY),
    turnstileSiteKey:safeText(env.TURNSTILE_SITE_KEY),
  };
}
