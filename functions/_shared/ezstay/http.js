export function jsonResponse(body, { status = 200, requestId } = {}) {
  const headers = new Headers({ "content-type":"application/json; charset=utf-8" });
  if (requestId) headers.set("x-request-id", requestId);
  return new Response(JSON.stringify(body), { status, headers });
}

export function requireIdempotencyKey(request) {
  const key = request?.headers?.get?.("Idempotency-Key")?.trim() || "";
  if (!key) throw new Error("idempotency_key_required");
  if (key.length > 128 || /\s/.test(key)) throw new Error("idempotency_key_invalid");
  return key;
}
