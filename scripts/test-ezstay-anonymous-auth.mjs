import test from "node:test";
import assert from "node:assert/strict";
import { createSupabaseAnonymousAuth } from "../src/ezstay/runtime/supabaseAnonymousAuth.js";

function fakeClient({ session = null, signedSession = null } = {}) {
  const calls = [];
  return {
    calls,
    auth:{
      async getSession() {
        calls.push(["getSession"]);
        return { data:{ session }, error:null };
      },
      async signInAnonymously(options) {
        calls.push(["signInAnonymously", options]);
        return { data:{ session:signedSession, user:signedSession?.user || null }, error:null };
      },
    },
  };
}

test("existing anonymous session is reused without a new CAPTCHA signup", async () => {
  const session = { access_token:"anon_access", user:{ id:"u1", is_anonymous:true } };
  const client = fakeClient({ session });
  const auth = createSupabaseAnonymousAuth({
    supabaseUrl:"https://project.supabase.co",
    publishableKey:"publishable",
    createClientImpl:() => client,
  });
  const result = await auth.ensureAnonymousSession();
  assert.equal(result.access_token, "anon_access");
  assert.deepEqual(client.calls, [["getSession"]]);
});

test("new anonymous session requires a Turnstile token and passes it to Supabase", async () => {
  const signedSession = { access_token:"new_access", user:{ id:"u2", is_anonymous:true } };
  const client = fakeClient({ session:null, signedSession });
  const auth = createSupabaseAnonymousAuth({
    supabaseUrl:"https://project.supabase.co",
    publishableKey:"publishable",
    createClientImpl:() => client,
  });
  await assert.rejects(() => auth.ensureAnonymousSession(), /captcha_token_required/);
  const result = await auth.ensureAnonymousSession({ captchaToken:"turnstile_token" });
  assert.equal(result.access_token, "new_access");
  assert.deepEqual(client.calls.at(-1), [
    "signInAnonymously",
    { options:{ captchaToken:"turnstile_token" } },
  ]);
});

test("permanent Supabase sessions cannot become public demo identities", async () => {
  const session = { access_token:"member_access", user:{ id:"u3", is_anonymous:false } };
  const auth = createSupabaseAnonymousAuth({
    supabaseUrl:"https://project.supabase.co",
    publishableKey:"publishable",
    createClientImpl:() => fakeClient({ session }),
  });
  await assert.rejects(() => auth.ensureAnonymousSession(), /anonymous_demo_identity_required/);
  assert.equal(await auth.getAccessToken(), null);
});
