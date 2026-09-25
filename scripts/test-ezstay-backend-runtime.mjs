import test from "node:test";
import assert from "node:assert/strict";
import { createBackendSandboxRuntime } from "../src/ezstay/runtime/index.js";

test("backend sandbox runtime signs in anonymously before demo creation", async () => {
  const calls = [];
  const createClientImpl = () => {
    let session = null;
    return {
      auth:{
        async signInAnonymously({ options }) {
          calls.push({ type:"signIn", options });
          session = { access_token:"access_backend_demo", user:{ id:"user_backend_demo", is_anonymous:true } };
          return { data:{ session, user:session.user }, error:null };
        },
        async getSession() {
          return { data:{ session }, error:null };
        },
        async signOut() {
          session = null;
          return { error:null };
        },
      },
    };
  };
  const runtime = createBackendSandboxRuntime({
    supabaseUrl:"https://project.supabase.co",
    publishableKey:"sb_publishable_demo",
    createClientImpl,
    fetchImpl:async (url, options) => {
      calls.push({ type:"fetch", url, options });
      return new Response(JSON.stringify({ session:{ id:"demo_1" }, snapshot:{} }), {
        status:200,
        headers:{ "content-type":"application/json" },
      });
    },
  });

  await runtime.startDemo({
    captchaToken:"turnstile_token",
    idempotencyKey:"cmd_start_backend",
  });

  assert.equal(calls[0].type, "signIn");
  assert.deepEqual(calls[0].options, { captchaToken:"turnstile_token" });
  const fetchCall = calls.find(call => call.type === "fetch");
  assert.equal(fetchCall.url, "/api/ezstay/demo/start");
  assert.equal(fetchCall.options.headers.authorization, "Bearer access_backend_demo");
});
