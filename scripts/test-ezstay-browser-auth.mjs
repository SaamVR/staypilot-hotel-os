import test from "node:test";
import assert from "node:assert/strict";
import { createDemoAuthClient } from "../src/ezstay/runtime/authClient.js";
import { createHttpRuntime } from "../src/ezstay/runtime/httpRuntime.js";

function fakeSupabaseFactory(calls) {
  return (url, key, options) => {
    calls.push({ type:"create", url, key, options });
    let session = null;
    return {
      auth:{
        async signInAnonymously(args) {
          calls.push({ type:"signInAnonymously", args });
          session = { access_token:"access_demo_123", user:{ id:"user_demo_123", is_anonymous:true } };
          return { data:{ session, user:session.user }, error:null };
        },
        async getSession() {
          calls.push({ type:"getSession" });
          return { data:{ session }, error:null };
        },
        async signOut() {
          calls.push({ type:"signOut" });
          session = null;
          return { error:null };
        },
      },
    };
  };
}

test("browser demo Auth is inert until explicitly asked to sign in", async () => {
  const calls = [];
  const auth = createDemoAuthClient({
    supabaseUrl:"https://project.supabase.co",
    publishableKey:"sb_publishable_demo",
    createClientImpl:fakeSupabaseFactory(calls),
  });
  assert.equal(calls.length, 1);
  assert.equal(await auth.getAccessToken(), null);
  assert.equal(calls.some(call => call.type === "signInAnonymously"), false);
});

test("anonymous sign-in forwards Turnstile captchaToken and returns verified session fields", async () => {
  const calls = [];
  const auth = createDemoAuthClient({
    supabaseUrl:"https://project.supabase.co",
    publishableKey:"sb_publishable_demo",
    createClientImpl:fakeSupabaseFactory(calls),
  });
  const result = await auth.signInDemo({ captchaToken:"turnstile_token" });
  const signIn = calls.find(call => call.type === "signInAnonymously");
  assert.deepEqual(signIn.args, { options:{ captchaToken:"turnstile_token" } });
  assert.equal(result.accessToken, "access_demo_123");
  assert.equal(result.userId, "user_demo_123");
  assert.equal(result.isAnonymous, true);
});

test("HTTP runtime attaches the current bearer token without exposing a service role key", async () => {
  const calls = [];
  const runtime = createHttpRuntime({
    getAccessToken:async () => "access_demo_123",
    fetchImpl:async (url, options = {}) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ session:{}, snapshot:{} }), {
        status:200,
        headers:{ "content-type":"application/json" },
      });
    },
  });
  await runtime.getSession();
  assert.equal(calls[0].options.headers.authorization, "Bearer access_demo_123");
  assert.equal(JSON.stringify(calls[0]).includes("service_role"), false);
});

test("backend-sandbox start signs in anonymously before creating a demo session", async () => {
  const calls = [];
  const auth = createDemoAuthClient({
    supabaseUrl:"https://project.supabase.co",
    publishableKey:"sb_publishable_demo",
    createClientImpl:fakeSupabaseFactory(calls),
  });
  const http = createHttpRuntime({
    getAccessToken:() => auth.getAccessToken(),
    fetchImpl:async (url, options = {}) => {
      calls.push({ type:"fetch", url, options });
      return new Response(JSON.stringify({ session:{ id:"demo_backend" }, snapshot:{} }), {
        status:200,
        headers:{ "content-type":"application/json" },
      });
    },
  });
  await auth.signInDemo({ captchaToken:"turnstile_token" });
  await http.startDemo({ idempotencyKey:"cmd_start_demo", captchaToken:"turnstile_token" });
  const fetchCall = calls.find(call => call.type === "fetch");
  assert.equal(fetchCall.options.headers.authorization, "Bearer access_demo_123");
  assert.equal(fetchCall.options.headers["Idempotency-Key"], "cmd_start_demo");
});
