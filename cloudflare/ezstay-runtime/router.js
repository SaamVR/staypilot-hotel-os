const JSON_HEADERS = { "content-type":"application/json; charset=utf-8" };

function json(body, status, requestId) {
  const headers = new Headers(JSON_HEADERS);
  if (requestId) headers.set("x-request-id", requestId);
  return new Response(JSON.stringify(body), { status, headers });
}

function requestIdOf(request) {
  return request.headers.get("x-request-id") || `req_${crypto.randomUUID()}`;
}

async function bodyOf(request) {
  if (request.method === "GET" || request.method === "HEAD") return null;
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("invalid_json");
  }
}

const staticRoutes = new Map([
  ["GET /api/ezstay/demo/session", "getSession"],
  ["POST /api/ezstay/demo/start", "startDemo"],
  ["POST /api/ezstay/demo/reset", "resetDemo"],
  ["GET /api/ezstay/snapshot", "getSnapshot"],
  ["POST /api/ezstay/scenarios/guest-request", "runGuestRequest"],
  ["POST /api/ezstay/scenarios/checkout", "runCheckout"],
  ["POST /api/ezstay/scenarios/housekeeping-complete", "completeHousekeeping"],
  ["POST /api/ezstay/scenarios/low-stock", "runLowStock"],
  ["POST /api/ezstay/approvals/resolve", "resolveApproval"],
  ["POST /api/ezstay/deliveries/retry", "retryDelivery"],
  ["POST /api/ezstay/demo/clock/advance", "advanceClock"],
]);

export async function routeEzstayRuntimeRequest({ request, backend }) {
  const requestId = requestIdOf(request);
  const url = new URL(request.url);
  const key = `${request.method.toUpperCase()} ${url.pathname}`;
  let methodName = staticRoutes.get(key);
  let runId = null;

  if (!methodName && request.method === "GET") {
    const match = url.pathname.match(/^\/api\/ezstay\/automation-runs\/([^/]+)$/);
    if (match) {
      methodName = "getRun";
      runId = decodeURIComponent(match[1]);
    }
  }

  if (!methodName || typeof backend?.[methodName] !== "function") {
    return json({ code:"route_not_found" }, 404, requestId);
  }

  const mutation = request.method !== "GET" && request.method !== "HEAD";
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() || null;
  if (mutation && !idempotencyKey) {
    return json({ code:"idempotency_key_required" }, 400, requestId);
  }

  let body;
  try {
    body = await bodyOf(request);
  } catch {
    return json({ code:"invalid_json" }, 400, requestId);
  }

  try {
    const result = await backend[methodName]({
      request,
      requestId,
      idempotencyKey,
      body,
      runId,
    });
    return json(result, 200, requestId);
  } catch (error) {
    if (error?.message === "backend_not_configured") {
      return json({ code:"backend_not_configured" }, 503, requestId);
    }
    if (error?.message === "not_found") {
      return json({ code:"not_found" }, 404, requestId);
    }
    return json({ code:"runtime_command_failed" }, 500, requestId);
  }
}
