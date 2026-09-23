import {
  getBackendConfig,
  jsonResponse,
  sha256Hex,
  verifyWebhookSignature,
} from "../_shared/webhook.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_ID_RE = /^[A-Za-z0-9._:-]{6,160}$/;
const EVENT_TYPE_RE = /^[a-z][a-z0-9_.-]{2,100}$/;

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      allow: "POST, OPTIONS",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, x-staypilot-event-id, x-staypilot-event-type, x-staypilot-hotel-id, x-staypilot-timestamp, x-staypilot-signature",
      "access-control-max-age": "86400",
    },
  });
}

export async function onRequestPost({ request, env }) {
  const config = getBackendConfig(env);
  if (!config.supabaseUrl || !config.supabaseKey || !config.webhookSigningSecret) {
    return jsonResponse({
      ok: false,
      error: "backend_not_configured",
      message: "Dedicated Supabase and webhook-signing secrets are required before inbound events are accepted.",
    }, 503);
  }

  const eventId = request.headers.get("x-staypilot-event-id") || "";
  const eventType = request.headers.get("x-staypilot-event-type") || "";
  const hotelId = request.headers.get("x-staypilot-hotel-id") || "";
  const timestamp = request.headers.get("x-staypilot-timestamp") || "";
  const signature = request.headers.get("x-staypilot-signature") || "";

  if (!UUID_RE.test(hotelId)) return jsonResponse({ ok: false, error: "invalid_hotel_id" }, 400);
  if (!EVENT_ID_RE.test(eventId)) return jsonResponse({ ok: false, error: "invalid_event_id" }, 400);
  if (!EVENT_TYPE_RE.test(eventType)) return jsonResponse({ ok: false, error: "invalid_event_type" }, 400);

  const rawBody = await request.text();
  if (rawBody.length > 256_000) return jsonResponse({ ok: false, error: "payload_too_large" }, 413);

  const verification = await verifyWebhookSignature({
    secret: config.webhookSigningSecret,
    timestamp,
    signature,
    body: rawBody,
  });
  if (!verification.ok) {
    return jsonResponse({ ok: false, error: "invalid_signature", reason: verification.reason }, 401);
  }

  let payload;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return jsonResponse({ ok: false, error: "payload_must_be_object" }, 400);
  }

  const payloadHash = await sha256Hex(rawBody);
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/inbound_events?on_conflict=hotel_id,event_id&select=id,event_id,event_type,status,received_at`,
    {
      method: "POST",
      headers: {
        apikey: config.supabaseKey,
        authorization: `Bearer ${config.supabaseKey}`,
        "content-type": "application/json",
        prefer: "resolution=ignore-duplicates,return=representation",
      },
      body: JSON.stringify({
        hotel_id: hotelId,
        event_id: eventId,
        event_type: eventType,
        payload,
        payload_hash: payloadHash,
        status: "queued",
      }),
    },
  );

  if (!response.ok) {
    return jsonResponse({
      ok: false,
      error: "event_store_unavailable",
      status: response.status,
    }, 502);
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return jsonResponse({
      ok: true,
      duplicate: true,
      event_id: eventId,
      event_type: eventType,
      status: "already_recorded",
    });
  }

  return jsonResponse({
    ok: true,
    duplicate: false,
    accepted: true,
    inbound_event_id: rows[0].id,
    event_id: eventId,
    event_type: eventType,
    status: rows[0].status,
  }, 202);
}

export function onRequest() {
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { allow: "POST, OPTIONS" });
}
