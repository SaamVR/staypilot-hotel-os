import test from "node:test";
import assert from "node:assert/strict";
import { createBackendSandboxRuntime, selectEzstayRuntimeMode } from "../src/ezstay/runtime/bootstrap.js";
import { createHttpRuntime } from "../src/ezstay/runtime/httpRuntime.js";

test("browser runtime stays local unless backend health is fully configured", () => {
  assert.equal(selectEzstayRuntimeMode(null), "local-preview");
  assert.equal(selectEzstayRuntimeMode({ mode:"not_configured" }), "local-preview");
  assert.equal(selectEzstayRuntimeMode({ mode:"configured", authConfigured:false, runtimeConfigured:true }), "local-preview");
  assert.equal(selectEzstayRuntimeMode({ mode:"configured", authConfigured:true, runtimeConfigured:true, turnstileConfigured:false }), "local-preview");
  assert.equal(selectEzstayRuntimeMode({ mode:"configured", authConfigured:true, runtimeConfigured:true, turnstileConfigured:true }), "backend-sandbox");
});

test("HTTP runtime attaches the current bearer token to protected requests", async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ session:{ id:"demo_1" }, snapshot:{} }), {
      status:200,
      headers:{ "content-type":"application/json" }
    });
  };
  const runtime = createHttpRuntime({
    fetchImpl,
    getAccessToken:async () => "access_demo_123",
  });
  await runtime.getSession();
  assert.equal(calls[0].options.headers.authorization, "Bearer access_demo_123");
});

test("HTTP runtime fails closed when backend auth token is unavailable", async () => {
  let called = false;
  const runtime = createHttpRuntime({
    fetchImpl:async () => { called = true; return new Response("{}"); },
    getAccessToken:async () => null,
  });
  await assert.rejects(() => runtime.getSession(), /backend_authentication_required/);
  assert.equal(called, false);
});

test("configured backend runtime is built only after anonymous Auth succeeds", async () => {
  const calls = [];
  const auth = {
    async ensureAnonymousSession({ captchaToken }) {
      calls.push(["ensure", captchaToken]);
      return { access_token:"access_1", user:{ is_anonymous:true } };
    },
    async getAccessToken() {
      calls.push(["token"]);
      return "access_1";
    },
  };
  const runtime = { kind:"http" };
  const result = await createBackendSandboxRuntime({
    config:{
      mode:"configured",
      supabaseUrl:"https://project.supabase.co",
      supabasePublishableKey:"publishable",
    },
    captchaToken:"turnstile_1",
    createAuthImpl:() => auth,
    createHttpRuntimeImpl:options => {
      assert.equal(typeof options.getAccessToken, "function");
      return runtime;
    },
  });
  assert.equal(result.runtime, runtime);
  assert.equal(result.auth, auth);
  assert.deepEqual(calls, [["ensure", "turnstile_1"]]);
});

test("backend runtime helper fails closed for incomplete public config", async () => {
  await assert.rejects(
    () => createBackendSandboxRuntime({
      config:{ mode:"not_configured" },
      captchaToken:"turnstile_1",
    }),
    /backend_not_configured/
  );
});
