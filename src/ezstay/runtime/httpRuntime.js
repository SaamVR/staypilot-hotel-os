export const EZSTAY_ROUTES = {
  session:"/api/ezstay/demo/session",
  startDemo:"/api/ezstay/demo/start",
  resetDemo:"/api/ezstay/demo/reset",
  snapshot:"/api/ezstay/snapshot",
  guestRequest:"/api/ezstay/scenarios/guest-request",
  checkout:"/api/ezstay/scenarios/checkout",
  housekeepingComplete:"/api/ezstay/scenarios/housekeeping-complete",
  lowStock:"/api/ezstay/scenarios/low-stock",
  resolveApproval:"/api/ezstay/approvals/resolve",
  retryDelivery:"/api/ezstay/deliveries/retry",
  advanceClock:"/api/ezstay/demo/clock/advance",
  run:runId => `/api/ezstay/automation-runs/${encodeURIComponent(runId)}`,
};

async function parseResponse(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const error = new Error(body?.code || `ezstay_http_${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

export function createHttpRuntime({ fetchImpl = globalThis.fetch, getAccessToken } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("fetch_required");

  async function authorizationHeader() {
    if (typeof getAccessToken !== "function") throw new Error("backend_authentication_required");
    const token = String(await getAccessToken() || "").trim();
    if (!token) throw new Error("backend_authentication_required");
    return `Bearer ${token}`;
  }

  async function get(url) {
    const authorization = await authorizationHeader();
    return parseResponse(await fetchImpl(url, {
      method:"GET",
      cache:"no-store",
      headers:{ accept:"application/json", authorization },
    }));
  }

  async function mutate(url, { idempotencyKey, ...body }) {
    if (!idempotencyKey) throw new Error("idempotency_key_required");
    const authorization = await authorizationHeader();
    return parseResponse(await fetchImpl(url, {
      method:"POST",
      cache:"no-store",
      headers:{
        "content-type":"application/json",
        accept:"application/json",
        authorization,
        "Idempotency-Key":idempotencyKey,
      },
      body:JSON.stringify(body),
    }));
  }

  return {
    getSession:() => get(EZSTAY_ROUTES.session),
    startDemo:({ captchaToken, idempotencyKey = `cmd_start_${Date.now()}` } = {}) =>
      mutate(EZSTAY_ROUTES.startDemo, { idempotencyKey, captchaToken }),
    resetDemo:args => mutate(EZSTAY_ROUTES.resetDemo, args),
    runGuestRequest:args => mutate(EZSTAY_ROUTES.guestRequest, args),
    runCheckout:args => mutate(EZSTAY_ROUTES.checkout, args),
    completeHousekeeping:args => mutate(EZSTAY_ROUTES.housekeepingComplete, args),
    runLowStock:args => mutate(EZSTAY_ROUTES.lowStock, args),
    resolveApproval:args => mutate(EZSTAY_ROUTES.resolveApproval, args),
    retryDelivery:args => mutate(EZSTAY_ROUTES.retryDelivery, args),
    advanceClock:args => mutate(EZSTAY_ROUTES.advanceClock, args),
    getRun:runId => get(EZSTAY_ROUTES.run(runId)),
  };
}
