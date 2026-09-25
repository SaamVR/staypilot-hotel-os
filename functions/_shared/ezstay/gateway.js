import { requireAuthenticatedUser } from "./auth.js";
import { jsonResponse, requireIdempotencyKey } from "./http.js";
import { requestIdFrom } from "./request-id.js";

export async function delegateEzstayRequest({ request, env, mutation = false, anonymousOnly = false }) {
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

  let identity = null;
  const authRequired = String(env?.EZSTAY_AUTH_REQUIRED || "").trim().toLowerCase() === "true";
  if (authRequired) {
    try {
      identity = await requireAuthenticatedUser(request, env);
    } catch (error) {
      const code = error?.message || "authentication_invalid";
      const status = code === "auth_not_configured" ? 503 : 401;
      return jsonResponse({ code }, { status, requestId });
    }
    if (anonymousOnly && !identity.isAnonymous) {
      return jsonResponse({ code:"anonymous_demo_identity_required" }, { status:403, requestId });
    }
  }

  const headers = new Headers(request.headers);
  headers.set("x-request-id", requestId);
  if (identity) {
    headers.set("x-ezstay-user-id", identity.userId);
    headers.set("x-ezstay-user-anonymous", identity.isAnonymous ? "true" : "false");
  }
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
