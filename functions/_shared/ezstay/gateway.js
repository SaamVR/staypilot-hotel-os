import { jsonResponse, requireIdempotencyKey } from "./http.js";
import { requestIdFrom } from "./request-id.js";

export async function delegateEzstayRequest({ request, env, mutation = false }) {
  const requestId = requestIdFrom(request);

  if (mutation) {
    try {
      requireIdempotencyKey(request);
    } catch (error) {
      return jsonResponse(
        { code:error?.message === "idempotency_key_invalid" ? "idempotency_key_invalid" : "idempotency_key_required" },
        { status:400, requestId },
      );
    }
  }

  if (!env?.EZSTAY_RUNTIME || typeof env.EZSTAY_RUNTIME.fetch !== "function") {
    return jsonResponse({ code:"ezstay_runtime_not_configured" }, { status:503, requestId });
  }

  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);
  const delegatedRequest = new Request(request, { headers });

  let response;
  try {
    response = await env.EZSTAY_RUNTIME.fetch(delegatedRequest);
  } catch {
    return jsonResponse({ code:"ezstay_runtime_unavailable" }, { status:502, requestId });
  }

  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("x-request-id", requestId);
  return new Response(response.body, {
    status:response.status,
    statusText:response.statusText,
    headers:responseHeaders,
  });
}
