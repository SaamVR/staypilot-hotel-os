import assert from "node:assert/strict";
import { hmacSha256Hex } from "../functions/_shared/webhook.js";
import {
  endpointSecretRef,
  verificationProof,
} from "../functions/_shared/provisioning.js";
import { onRequestPost as registerEndpoint } from "../functions/api/webhook-endpoints/register.js";
import { onRequestPost as verifyEndpoint } from "../functions/api/webhook-endpoints/verify.js";

const HOTEL_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const env = {
  SUPABASE_URL:"https://mock.supabase.test",
  SUPABASE_SECRET_KEY:"server-key",
  WEBHOOK_ALLOWED_HOSTS:"hooks.example.com,workflow.example.com",
  OUTBOUND_SIGNING_MASTER_SECRET:"endpoint-provisioning-master-secret-that-is-long-enough",
};

function response(body, status = 200, headers = {}) {
  return new Response(
    typeof body === "string" ? body : JSON.stringify(body),
    { status, headers:{ "content-type":"application/json", ...headers } },
  );
}

function makeRequest(url, body, token = "owner-token") {
  return new Request(url, {
    method:"POST",
    headers:{
      "content-type":"application/json",
      ...(token ? { authorization:`Bearer ${token}` } : {}),
    },
    body:JSON.stringify(body),
  });
}

function createHarness({ owner = true } = {}) {
  const calls = [];
  let endpointRow = null;
  let externalHandler = null;
  let failedVerification = null;
  let verifiedCall = null;

  const fetchMock = async (url, options = {}) => {
    const parsed = new URL(String(url));
    const method = String(options.method || "GET").toUpperCase();
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ host:parsed.host, path:parsed.pathname, search:parsed.search, method, body, headers:options.headers || {} });

    if (parsed.host === "mock.supabase.test") {
      if (parsed.pathname === "/auth/v1/user") {
        return response({ id:USER_ID, email:"owner@example.com" });
      }
      if (parsed.pathname.endsWith("/hotel_members") && method === "GET") {
        return response(owner ? [{ hotel_id:HOTEL_ID, user_id:USER_ID, role:"owner" }] : []);
      }
      if (parsed.pathname.endsWith("/webhook_endpoints") && method === "POST") {
        endpointRow = {
          ...body,
          created_at:"2026-09-24T00:00:00Z",
          verified_host:null,
          verified_at:null,
        };
        return response([endpointRow], 201);
      }
      if (parsed.pathname.endsWith("/webhook_endpoints") && method === "GET") {
        return response(endpointRow ? [endpointRow] : []);
      }
      if (parsed.pathname.endsWith("/rpc/mark_webhook_endpoint_verified") && method === "POST") {
        verifiedCall = body;
        endpointRow = {
          ...endpointRow,
          status:"Active",
          verification_status:"Verified",
          verified_host:body.verified_host_text,
          verified_at:"2026-09-24T00:01:00Z",
        };
        return response(endpointRow);
      }
      if (parsed.pathname.endsWith("/rpc/mark_webhook_endpoint_verification_failed") && method === "POST") {
        failedVerification = body;
        endpointRow = {
          ...endpointRow,
          status:"Paused",
          verification_status:"Failed",
          verified_host:null,
          verified_at:null,
          verification_error:body.error_text,
        };
        return response(endpointRow);
      }
      throw new Error(`Unhandled Supabase request: ${method} ${parsed.pathname}${parsed.search}`);
    }

    if (parsed.host === "hooks.example.com") {
      if (!externalHandler) throw new Error("External webhook handler not configured");
      return externalHandler(parsed, options, body);
    }

    throw new Error(`Unexpected network destination: ${parsed.host}`);
  };

  return {
    calls,
    fetchMock,
    get endpointRow() { return endpointRow; },
    set endpointRow(value) { endpointRow = value; },
    setExternalHandler(fn) { externalHandler = fn; },
    get failedVerification() { return failedVerification; },
    get verifiedCall() { return verifiedCall; },
  };
}

async function withFetch(harness, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = harness.fetchMock;
  try { return await fn(); }
  finally { globalThis.fetch = original; }
}

// 1. Registration fails closed before server provisioning dependencies exist.
{
  const request = makeRequest("https://staypilot.test/api/webhook-endpoints/register", {
    hotel_id:HOTEL_ID,
    name:"Operations sink",
    url:"https://hooks.example.com/staypilot",
    events:["guest.checked_out"],
  });
  const res = await registerEndpoint({ request, env:{} });
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, "provisioning_not_configured");
}

// 2. Registration requires an authenticated Owner.
{
  const harness = createHarness({ owner:false });
  await withFetch(harness, async () => {
    const request = makeRequest("https://staypilot.test/api/webhook-endpoints/register", {
      hotel_id:HOTEL_ID,
      name:"Operations sink",
      url:"https://hooks.example.com/staypilot",
      events:["guest.checked_out"],
    });
    const res = await registerEndpoint({ request, env });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error, "owner_role_required");
  });
}

// 3. Registration enforces exact allowlisting before any endpoint insert.
{
  const harness = createHarness();
  await withFetch(harness, async () => {
    const request = makeRequest("https://staypilot.test/api/webhook-endpoints/register", {
      hotel_id:HOTEL_ID,
      name:"Blocked destination",
      url:"https://evil.example.com/staypilot",
      events:["guest.checked_out"],
    });
    const res = await registerEndpoint({ request, env });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "destination_not_allowlisted");
    assert.equal(harness.calls.filter(c => c.path.endsWith("/webhook_endpoints") && c.method === "POST").length, 0);
  });
}

// 4. Owner registration creates only a Paused/Pending endpoint with a non-secret reference.
let registered = null;
let signingSecret = null;
const harness = createHarness();
await withFetch(harness, async () => {
  const request = makeRequest("https://staypilot.test/api/webhook-endpoints/register", {
    hotel_id:HOTEL_ID,
    name:"  Operations   automation  ",
    url:"https://hooks.example.com/staypilot",
    events:["guest.checked_out","guest.checked_out","room.maintenance_blocked"],
  });
  const res = await registerEndpoint({ request, env });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.endpoint.status, "Paused");
  assert.equal(body.endpoint.verification_status, "Pending");
  assert.equal(body.endpoint.name, "Operations automation");
  assert.deepEqual(body.endpoint.events, ["guest.checked_out","room.maintenance_blocked"]);
  assert.match(body.signing_secret, /^spwh_[a-f0-9]{64}$/);
  signingSecret = body.signing_secret;
  registered = body.endpoint;

  const insert = harness.calls.find(c => c.path.endsWith("/webhook_endpoints") && c.method === "POST");
  assert.ok(insert);
  assert.equal(insert.body.status, "Paused");
  assert.equal(insert.body.verification_status, "Pending");
  assert.match(insert.body.secret_ref, /^DERIVED_V1_[A-F0-9]{32}$/);
  assert.equal(insert.body.secret_ref, endpointSecretRef(insert.body.id));
  assert.equal("signing_secret" in insert.body, false, "raw secret must never be stored in endpoint row");
});

// 5. Verification sends a signed no-redirect challenge and activates only after HMAC proof succeeds.
await withFetch(harness, async () => {
  harness.setExternalHandler(async (_url, options, body) => {
    assert.equal(options.method, "POST");
    assert.equal(options.redirect, "manual");
    assert.equal(body.type, "staypilot.webhook.verify");
    assert.equal(body.endpoint_id, registered.id);

    const timestamp = options.headers["x-staypilot-timestamp"];
    const expectedRequestSignature = await hmacSha256Hex(signingSecret, `${timestamp}.${options.body}`);
    assert.equal(options.headers["x-staypilot-signature"], `v1=${expectedRequestSignature}`);

    const proof = await verificationProof(signingSecret, body.challenge);
    return response({ challenge:body.challenge, proof }, 200);
  });

  const request = makeRequest("https://staypilot.test/api/webhook-endpoints/verify", {
    hotel_id:HOTEL_ID,
    endpoint_id:registered.id,
  });
  const res = await verifyEndpoint({ request, env });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.status, "Active");
  assert.equal(body.verification_status, "Verified");
  assert.equal(body.verified_host, "hooks.example.com");
  assert.equal(harness.verifiedCall.endpoint_uuid, registered.id);
  assert.equal(harness.verifiedCall.verified_host_text, "hooks.example.com");
});

// 6. Verification proof mismatch persists Failed/Paused state and never marks trusted.
{
  const badHarness = createHarness();
  badHarness.endpointRow = {
    id:"33333333-3333-4333-8333-333333333333",
    hotel_id:HOTEL_ID,
    name:"Bad proof endpoint",
    url:"https://hooks.example.com/staypilot",
    events:["guest.checked_out"],
    status:"Paused",
    verification_status:"Pending",
    verified_host:null,
    verified_at:null,
    secret_ref:"DERIVED_V1_33333333333343338333333333333333",
  };
  badHarness.setExternalHandler(async (_url, _options, body) => (
    response({ challenge:body.challenge, proof:"0".repeat(64) }, 200)
  ));

  await withFetch(badHarness, async () => {
    const request = makeRequest("https://staypilot.test/api/webhook-endpoints/verify", {
      hotel_id:HOTEL_ID,
      endpoint_id:badHarness.endpointRow.id,
    });
    const res = await verifyEndpoint({ request, env });
    assert.equal(res.status, 422);
    assert.equal((await res.json()).error, "verification_proof_mismatch");
    assert.equal(badHarness.endpointRow.status, "Paused");
    assert.equal(badHarness.endpointRow.verification_status, "Failed");
    assert.equal(badHarness.verifiedCall, null);
    assert.equal(badHarness.failedVerification.endpoint_uuid, "33333333-3333-4333-8333-333333333333");
  });
}

// 7. Missing Authorization is rejected before endpoint lookup.
{
  const authHarness = createHarness();
  await withFetch(authHarness, async () => {
    const request = makeRequest("https://staypilot.test/api/webhook-endpoints/verify", {
      hotel_id:HOTEL_ID,
      endpoint_id:"33333333-3333-4333-8333-333333333333",
    }, "");
    const res = await verifyEndpoint({ request, env });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error, "authentication_required");
    assert.equal(authHarness.calls.length, 0);
  });
}

console.log("StayPilot webhook endpoint provisioning tests passed.");
