import { delegateEzstayRequest } from "../../_shared/ezstay/gateway.js";

export function onRequestGet({ request, env }) {
  return delegateEzstayRequest({ request, env, mutation:false });
}
