import { requireAuthenticatedUser, AuthzError } from "../../_shared/auth.js";
import { getBackendConfig, jsonResponse } from "../../_shared/webhook.js";
import { supabaseRpc } from "../../_shared/supabase.js";

function rpcMessage(error) {
  const body = error?.body;
  if (typeof body?.message === "string") return body.message;
  if (typeof body === "string") return body;
  return "";
}

export async function onRequestPost({ request, env }) {
  const config = getBackendConfig(env);
  if (!config.supabaseUrl || !config.supabaseKey) {
    return jsonResponse({
      ok:false,
      error:"backend_not_configured",
      message:"A dedicated StayPilot Supabase backend is required before tenant onboarding is enabled.",
    }, 503);
  }

  let input;
  try { input = await request.json(); }
  catch { return jsonResponse({ ok:false, error:"invalid_json" }, 400); }

  const idempotencyKey = String(
    request.headers.get("idempotency-key") ||
    input?.idempotency_key ||
    ""
  ).trim();
  const slug = String(input?.slug || "").trim();
  const name = String(input?.name || "").trim();
  const timezone = String(input?.timezone || "UTC").trim();
  const currency = String(input?.currency || "USD").trim().toUpperCase();

  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(idempotencyKey)) {
    return jsonResponse({ ok:false, error:"invalid_idempotency_key" }, 400);
  }

  try {
    const user = await requireAuthenticatedUser(config, request);
    const { data } = await supabaseRpc(config, "bootstrap_hotel_owner", {
      user_uuid:user.id,
      idempotency_key:idempotencyKey,
      hotel_slug:slug,
      hotel_name:name,
      hotel_timezone:timezone,
      hotel_currency:currency,
    });

    const created = Boolean(data?.created);
    return jsonResponse({
      ok:true,
      created,
      replayed:!created,
      hotel:data?.hotel || null,
      role:"owner",
      automation_rules_seeded:Number(data?.automation_rules_seeded || (created ? 12 : 0)),
    }, created ? 201 : 200);
  } catch (error) {
    if (error instanceof AuthzError) {
      return jsonResponse({ ok:false, error:error.code }, error.status);
    }

    const message = rpcMessage(error);
    if (/hotel_slug_taken/i.test(message)) return jsonResponse({ ok:false, error:"hotel_slug_taken" }, 409);
    if (/invalid_hotel_slug/i.test(message)) return jsonResponse({ ok:false, error:"invalid_hotel_slug" }, 400);
    if (/invalid_hotel_name/i.test(message)) return jsonResponse({ ok:false, error:"invalid_hotel_name" }, 400);
    if (/invalid_timezone/i.test(message)) return jsonResponse({ ok:false, error:"invalid_timezone" }, 400);
    if (/invalid_currency/i.test(message)) return jsonResponse({ ok:false, error:"invalid_currency" }, 400);
    if (/invalid_idempotency_key/i.test(message)) return jsonResponse({ ok:false, error:"invalid_idempotency_key" }, 400);

    return jsonResponse({ ok:false, error:"hotel_bootstrap_failed" }, 502);
  }
}

export function onRequest() {
  return jsonResponse({ ok:false, error:"method_not_allowed" }, 405, { allow:"POST" });
}
