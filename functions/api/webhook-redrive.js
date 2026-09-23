import { constantTimeEqual, getBackendConfig, jsonResponse } from "../_shared/webhook.js";
import { parseAllowedHosts } from "../_shared/dispatcher.js";
import { supabaseRpc } from "../_shared/supabase.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function onRequestPost({ request, env }) {
  const config = getBackendConfig(env);
  const allowedHosts = parseAllowedHosts(config.webhookAllowedHosts);
  if (!config.supabaseUrl || !config.supabaseKey || !config.dispatcherSecret || allowedHosts.length === 0) {
    return jsonResponse({
      ok:false,
      error:"dispatcher_not_configured",
      message:"Dedicated Supabase, DISPATCHER_SECRET and WEBHOOK_ALLOWED_HOSTS are required before delivery redrive is enabled.",
    }, 503);
  }

  const providedSecret = request.headers.get("x-staypilot-dispatcher-secret") || "";
  if (!constantTimeEqual(providedSecret, config.dispatcherSecret)) {
    return jsonResponse({ ok:false, error:"dispatcher_unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok:false, error:"invalid_json" }, 400);
  }

  const deliveryId = String(body?.delivery_id || "").trim();
  const reason = String(body?.reason || "Operator redrive").trim().slice(0, 500);
  if (!UUID_RE.test(deliveryId)) {
    return jsonResponse({ ok:false, error:"invalid_delivery_id" }, 400);
  }

  try {
    const { data } = await supabaseRpc(config, "redrive_webhook_delivery", {
      delivery_uuid:deliveryId,
      reason_text:reason || "Operator redrive",
    });

    return jsonResponse({
      ok:true,
      delivery_id:deliveryId,
      status:data?.status || "queued",
      redrive_count:Number(data?.redrive_count || 0),
      next_retry_at:data?.next_retry_at || null,
    });
  } catch (error) {
    const detail = typeof error?.body?.message === "string" ? error.body.message : "";
    if (/delivery_not_redrivable/i.test(detail)) {
      return jsonResponse({ ok:false, error:"delivery_not_redrivable" }, 409);
    }
    if (/webhook_endpoint_not_dispatchable/i.test(detail)) {
      return jsonResponse({ ok:false, error:"endpoint_not_dispatchable" }, 409);
    }
    if (/webhook_delivery_not_found/i.test(detail)) {
      return jsonResponse({ ok:false, error:"delivery_not_found" }, 404);
    }
    return jsonResponse({ ok:false, error:"redrive_unavailable" }, 502);
  }
}

export function onRequest() {
  return jsonResponse({ ok:false, error:"method_not_allowed" }, 405, { allow:"POST" });
}
