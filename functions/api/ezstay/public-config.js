import { buildEzstayPublicConfig } from "../../_shared/ezstay/compatibility.js";
import { jsonResponse } from "../../_shared/ezstay/http.js";
import { requestIdFrom } from "../../_shared/ezstay/request-id.js";

export function onRequestGet({ request, env }) {
  const requestId = requestIdFrom(request);
  return jsonResponse(buildEzstayPublicConfig(env), { requestId });
}
