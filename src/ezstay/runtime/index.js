import { createDemoAuthClient } from "./authClient.js";
import { createHttpRuntime } from "./httpRuntime.js";
import { createLocalPreviewRuntime } from "./localPreviewRuntime.js";

export function createBackendSandboxRuntime({
  supabaseUrl,
  publishableKey,
  createClientImpl,
  fetchImpl = globalThis.fetch,
} = {}) {
  const auth = createDemoAuthClient({
    supabaseUrl,
    publishableKey,
    createClientImpl,
  });
  const http = createHttpRuntime({
    fetchImpl,
    getAccessToken:() => auth.getAccessToken(),
  });

  return {
    ...http,
    async startDemo({ captchaToken, idempotencyKey = `cmd_start_${Date.now()}` } = {}) {
      await auth.signInDemo({ captchaToken });
      return http.startDemo({ captchaToken, idempotencyKey });
    },
    signOut:() => auth.signOut(),
  };
}

export function createRuntime({ mode = "local-preview", ...options } = {}) {
  if (mode === "backend-sandbox") return createBackendSandboxRuntime(options);
  return createLocalPreviewRuntime(options);
}

export { createDemoAuthClient, createHttpRuntime, createLocalPreviewRuntime };
