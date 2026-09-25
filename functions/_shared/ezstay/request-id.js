const REQUEST_ID_RE = /^[A-Za-z0-9._:-]{1,96}$/;

export function requestIdFrom(request) {
  const incoming = request?.headers?.get?.("x-request-id")?.trim() || "";
  if (REQUEST_ID_RE.test(incoming)) return incoming;
  return `req_${crypto.randomUUID()}`;
}
