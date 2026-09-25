export function selectEzstayRuntimeMode(health) {
  return health?.mode === "configured" &&
    health?.authConfigured === true &&
    health?.runtimeConfigured === true
    ? "backend-sandbox"
    : "local-preview";
}

export async function fetchEzstayBackendHealth({
  fetchImpl = globalThis.fetch,
  url = "/api/ezstay/backend-health",
} = {}) {
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
