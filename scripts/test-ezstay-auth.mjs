import test from "node:test";
import assert from "node:assert/strict";
import { requireAuthenticatedUser } from "../functions/_shared/ezstay/auth.js";

function token(payload) {
  const header = Buffer.from(JSON.stringify({ alg:"RS256", typ:"JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

test("auth boundary rejects a missing bearer token before network access", async () => {
  let called = false;
  await assert.rejects(
    () => requireAuthenticatedUser(
      new Request("https://example.test"),
      { SUPABASE_URL:"https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY:"sb_publishable_demo" },
      async () => { called = true; }
    ),
    /authentication_required/
  );
  assert.equal(called, false);
});

test("auth boundary validates caller token through Supabase Auth using publishable key", async () => {
  const jwt = token({ sub:"user_123", is_anonymous:true });
  let seen = null;
  const fetchImpl = async (url, options) => {
    seen = { url, options };
    return new Response(JSON.stringify({ id:"user_123" }), {
      status:200,
      headers:{ "content-type":"application/json" }
    });
  };
  const result = await requireAuthenticatedUser(
    new Request("https://example.test", { headers:{ authorization:`Bearer ${jwt}` } }),
    { SUPABASE_URL:"https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY:"sb_publishable_demo" },
    fetchImpl
  );
  assert.equal(result.userId, "user_123");
  assert.equal(result.isAnonymous, true);
  assert.equal(seen.url, "https://project.supabase.co/auth/v1/user");
  assert.equal(seen.options.headers.apikey, "sb_publishable_demo");
  assert.equal(seen.options.headers.authorization, `Bearer ${jwt}`);
});

test("auth boundary rejects a token whose verified user does not match the JWT subject", async () => {
  const jwt = token({ sub:"user_123", is_anonymous:true });
  await assert.rejects(
    () => requireAuthenticatedUser(
      new Request("https://example.test", { headers:{ authorization:`Bearer ${jwt}` } }),
      { SUPABASE_URL:"https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY:"sb_publishable_demo" },
      async () => new Response(JSON.stringify({ id:"different_user" }), { status:200 })
    ),
    /authentication_subject_mismatch/
  );
});

test("auth boundary never requires a service role key", async () => {
  const jwt = token({ sub:"user_123", is_anonymous:false });
  const result = await requireAuthenticatedUser(
    new Request("https://example.test", { headers:{ authorization:`Bearer ${jwt}` } }),
    { SUPABASE_URL:"https://project.supabase.co", SUPABASE_PUBLISHABLE_KEY:"sb_publishable_demo" },
    async () => new Response(JSON.stringify({ id:"user_123" }), { status:200 })
  );
  assert.equal(result.isAnonymous, false);
});
