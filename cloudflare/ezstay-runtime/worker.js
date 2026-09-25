import { createBackendAdapter } from "./backend.js";
import { routeEzstayRuntimeRequest } from "./router.js";
import { runScheduledTick } from "./scheduler.js";

export default {
  async fetch(request, env) {
    return routeEzstayRuntimeRequest({
      request,
      backend:createBackendAdapter(env),
    });
  },

  scheduled(controller, env, ctx) {
    const promise = runScheduledTick(env, createBackendAdapter(env));
    if (ctx?.waitUntil) {
      ctx.waitUntil(promise);
      return;
    }
    return promise;
  },
};
