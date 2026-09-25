import { createHttpRuntime } from "./httpRuntime.js";
import { createSupabaseAnonymousAuth } from "./supabaseAnonymousAuth.js";

export function selectEzstayRuntimeMode(health) {
  return health?.mode === "configured" &&
    health?.authConfigured === true &&
    health?.runtimeConfigured === true &&
    health?.turnstileConfigured === true
    ? "backend-sandbox"
    : "local-preview";
}

async function fetchJson(url, fetchImpl) {
  if (typeof fetchImpl !== "function") return null;
  try {
    const response = await fetchImpl(url, {
      method:"GET",
      cache:"no-store",
      headers:{ accept:"application/json" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export function fetchEzstayBackendHealth({
  fetchImpl = globalThis.fetch,
  url = "/api/ezstay/backend-health",
} = {}) {
  return fetchJson(url, fetchImpl);
}

export function fetchEzstayPublicConfig({
  fetchImpl = globalThis.fetch,
  url = "/api/ezstay/public-config",
} = {}) {
  return fetchJson(url, fetchImpl);
}

export async function createBackendSandboxRuntime({
  config,
  captchaToken,
  createAuthImpl = createSupabaseAnonymousAuth,
  createHttpRuntimeImpl = createHttpRuntime,
} = {}) {
  if (
    config?.mode !== "configured" ||
    !String(config?.supabaseUrl || "").trim() ||
    !String(config?.supabasePublishableKey || "").trim()
  ) {
    throw new Error("backend_not_configured");
  }

  const auth = createAuthImpl({
    supabaseUrl:config.supabaseUrl,
    publishableKey:config.supabasePublishableKey,
  });
  await auth.ensureAnonymousSession({ captchaToken });
  const runtime = createHttpRuntimeImpl({
    getAccessToken:() => auth.getAccessToken(),
  });
  return { runtime, auth };
}
