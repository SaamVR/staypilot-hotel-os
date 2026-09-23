import assert from "node:assert/strict";
import { onRequestPost, onRequest } from "../functions/api/hotels/bootstrap.js";

const env = {
  SUPABASE_URL:"https://mock.supabase.test",
  SUPABASE_SECRET_KEY:"server-key",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers:{ "content-type":"application/json" },
  });
}

async function readJson(response) {
  return JSON.parse(await response.text());
}

async function withMockFetch(fetchMock, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = fetchMock;
  try { return await fn(); }
  finally { globalThis.fetch = original; }
}

function request(body = {}, headers = {}) {
  return new Request("https://staypilot.test/api/hotels/bootstrap", {
    method:"POST",
    headers:{ "content-type":"application/json", ...headers },
    body:JSON.stringify({
      idempotency_key:"onboard_test_001",
      slug:"harbor-house",
      name:"Harbor House",
      timezone:"Asia/Dhaka",
      currency:"BDT",
      ...body,
    }),
  });
}

// 1. Backend absence fails closed before any auth/database call.
{
  let fetched = false;
  const response = await withMockFetch(async () => {
    fetched = true;
    throw new Error("must not fetch");
  }, () => onRequestPost({ request:request(), env:{} }));
  assert.equal(response.status, 503);
  assert.equal((await readJson(response)).error, "backend_not_configured");
  assert.equal(fetched, false);
}

// 2. Authenticated backend requires a bearer session.
{
  let fetched = false;
  const response = await withMockFetch(async () => {
    fetched = true;
    throw new Error("must not fetch without bearer");
  }, () => onRequestPost({ request:request(), env }));
  assert.equal(response.status, 401);
  assert.equal((await readJson(response)).error, "authentication_required");
  assert.equal(fetched, false);
}

// 3. Invalid idempotency keys are rejected before authentication.
{
  const response = await onRequestPost({
    request:request({ idempotency_key:"short" }),
    env,
  });
  assert.equal(response.status, 400);
  assert.equal((await readJson(response)).error, "invalid_idempotency_key");
}

// 4. Authenticated creation uses the session user, never spoofed client identity/role.
{
  const calls = [];
  const response = await withMockFetch(async (url, options = {}) => {
    const parsed = new URL(String(url));
    calls.push({ path:parsed.pathname, method:String(options.method || "GET").toUpperCase(), body:options.body ? JSON.parse(options.body) : null });

    if (parsed.pathname === "/auth/v1/user") {
      assert.equal(options.headers.authorization, "Bearer valid-session");
      return jsonResponse({ id:"11111111-1111-4111-8111-111111111111", email:"owner@example.com" });
    }

    if (parsed.pathname === "/rest/v1/rpc/bootstrap_hotel_owner") {
      const body = JSON.parse(options.body);
      assert.equal(body.user_uuid, "11111111-1111-4111-8111-111111111111");
      assert.equal(body.idempotency_key, "onboard_test_001");
      assert.equal(body.hotel_slug, "harbor-house");
      assert.equal(body.hotel_currency, "BDT");
      assert.equal(body.role, undefined);
      return jsonResponse({
        created:true,
        hotel:{ id:"22222222-2222-4222-8222-222222222222", slug:"harbor-house", name:"Harbor House", timezone:"Asia/Dhaka", currency:"BDT" },
        role:"owner",
        automation_rules_seeded:12,
      });
    }

    throw new Error("unexpected request "+parsed.pathname);
  }, () => onRequestPost({
    request:request(
      { user_id:"99999999-9999-4999-8999-999999999999", role:"owner" },
      { authorization:"Bearer valid-session" }
    ),
    env,
  }));

  assert.equal(response.status, 201);
  const body = await readJson(response);
  assert.equal(body.ok, true);
  assert.equal(body.created, true);
  assert.equal(body.replayed, false);
  assert.equal(body.role, "owner");
  assert.equal(body.automation_rules_seeded, 12);
  assert.equal(calls.filter(c => c.path === "/rest/v1/rpc/bootstrap_hotel_owner").length, 1);
}

// 5. Idempotent replay returns 200 and does not claim a second creation.
{
  const response = await withMockFetch(async (url, options = {}) => {
    const parsed = new URL(String(url));
    if (parsed.pathname === "/auth/v1/user") return jsonResponse({ id:"11111111-1111-4111-8111-111111111111" });
    if (parsed.pathname === "/rest/v1/rpc/bootstrap_hotel_owner") {
      return jsonResponse({
        created:false,
        hotel:{ id:"22222222-2222-4222-8222-222222222222", slug:"harbor-house", name:"Harbor House", timezone:"Asia/Dhaka", currency:"BDT" },
        role:"owner",
      });
    }
    throw new Error("unexpected request");
  }, () => onRequestPost({
    request:request({}, { authorization:"Bearer valid-session" }),
    env,
  }));

  assert.equal(response.status, 200);
  const body = await readJson(response);
  assert.equal(body.created, false);
  assert.equal(body.replayed, true);
}

// 6. Slug ownership conflict maps to a stable 409 response.
{
  const response = await withMockFetch(async (url) => {
    const parsed = new URL(String(url));
    if (parsed.pathname === "/auth/v1/user") return jsonResponse({ id:"11111111-1111-4111-8111-111111111111" });
    if (parsed.pathname === "/rest/v1/rpc/bootstrap_hotel_owner") {
      return jsonResponse({ message:"hotel_slug_taken" }, 400);
    }
    throw new Error("unexpected request");
  }, () => onRequestPost({
    request:request({}, { authorization:"Bearer valid-session" }),
    env,
  }));

  assert.equal(response.status, 409);
  assert.equal((await readJson(response)).error, "hotel_slug_taken");
}

// 7. Non-POST methods remain closed.
{
  const response = onRequest();
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
}

console.log("StayPilot tenant bootstrap HTTP tests passed.");
