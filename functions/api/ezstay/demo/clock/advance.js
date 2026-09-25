import { delegateEzstayRequest } from "../../../../_shared/ezstay/gateway.js";

export function onRequestPost({ request, env }) {
  return delegateEzstayRequest({ request, env, mutation:true });
}
