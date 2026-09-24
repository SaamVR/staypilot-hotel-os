const encoder = new TextEncoder();

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

export function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bytesToHex(bytes) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export async function hmacSha256Hex(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function verifyWebhookSignature({
  secret,
  timestamp,
  signature,
  body,
  nowMs = Date.now(),
  toleranceSeconds = 300,
}) {
  if (!secret) return { ok: false, reason: "missing_server_secret" };
  if (!/^\d{10,13}$/.test(timestamp || "")) return { ok: false, reason: "invalid_timestamp" };
  if (!signature) return { ok: false, reason: "missing_signature" };

  const timestampNumber = Number(timestamp);
  const eventMs = timestamp.length === 13 ? timestampNumber : timestampNumber * 1000;
  if (!Number.isFinite(eventMs) || Math.abs(nowMs - eventMs) > toleranceSeconds * 1000) {
    return { ok: false, reason: "timestamp_outside_tolerance" };
  }

  const provided = signature.startsWith("v1=") ? signature.slice(3) : signature;
  if (!/^[a-f0-9]{64}$/i.test(provided)) return { ok: false, reason: "invalid_signature_format" };

  const expected = await hmacSha256Hex(secret, `${timestamp}.${body}`);
  return constantTimeEqual(expected.toLowerCase(), provided.toLowerCase())
    ? { ok: true }
    : { ok: false, reason: "signature_mismatch" };
}

export function getBackendConfig(env = {}) {
  const supabaseKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
  return {
    supabaseUrl: String(env.SUPABASE_URL || "").replace(/\/$/, ""),
    supabaseKey,
    webhookSigningSecret: String(env.WEBHOOK_SIGNING_SECRET || ""),
    workerSecret: String(env.WORKER_SECRET || ""),
    dispatcherSecret: String(env.DISPATCHER_SECRET || ""),
    webhookAllowedHosts: String(env.WEBHOOK_ALLOWED_HOSTS || ""),
    outboundSigningMasterSecret: String(env.OUTBOUND_SIGNING_MASTER_SECRET || ""),
    orchestratorSecret: String(env.ORCHESTRATOR_SECRET || ""),
    orchestratorEnabled: String(env.ORCHESTRATOR_ENABLED || "").trim().toLowerCase() === "true",
    tenantBootstrapEnabled: String(env.TENANT_BOOTSTRAP_ENABLED || "").trim().toLowerCase() === "true",
    teamOnboardingEnabled: String(env.TEAM_ONBOARDING_ENABLED || "").trim().toLowerCase() === "true",
  };
}
