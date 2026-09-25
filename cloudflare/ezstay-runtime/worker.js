import { createBackendAdapter } from "./backend.js";
import { routeEzstayRuntimeRequest } from "./router.js";

export default {
  async fetch(request, env) {
    return routeEzstayRuntimeRequest({
      request,
      backend:createBackendAdapter(env),
    });
  },
};
