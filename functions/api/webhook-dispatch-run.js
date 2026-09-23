import { constantTimeEqual, getBackendConfig, jsonResponse } from "../_shared/webhook.js";
import { claimWebhookDeliveries, dispatchClaimedDelivery, parseAllowedHosts } from "../_shared/dispatcher.js";

export async function onRequestPost({ request, env }) {
  const config = getBackendConfig(env);
  const allowedHosts = parseAllowedHosts(config.webhookAllowedHosts);
  if (!config.supabaseUrl || !config.supabaseKey || !config.dispatcherSecret || allowedHosts.length === 0) {
    return jsonResponse({
      ok:false,
      error:"dispatcher_not_configured",
      message:"Dedicated Supabase, DISPATCHER_SECRET and WEBHOOK_ALLOWED_HOSTS are required before outbound delivery is enabled.",
    }, 503);
  }

  const providedSecret = request.headers.get("x-staypilot-dispatcher-secret") || "";
  if (!constantTimeEqual(providedSecret, config.dispatcherSecret)) {
    return jsonResponse({ ok:false, error:"dispatcher_unauthorized" }, 401);
  }

  let batchSize = 5;
  try {
    const body = await request.json();
    if (body && typeof body === "object" && body.batch_size !== undefined) {
      batchSize = Math.max(1, Math.min(Number(body.batch_size) || 5, 10));
    }
  } catch {
    // Empty body uses the default bounded batch size.
  }

  const dispatcherId = `cf-webhook-${crypto.randomUUID()}`;
  try {
    const deliveries = await claimWebhookDeliveries(config, dispatcherId, batchSize);
    const results = [];
    for (const delivery of deliveries) {
      results.push(await dispatchClaimedDelivery(config, env, delivery));
    }

    const summary = results.reduce((acc, result) => {
      const key = result.status || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return jsonResponse({
      ok:true,
      dispatcher_id:dispatcherId,
      claimed:deliveries.length,
      summary,
      results,
    });
  } catch (error) {
    return jsonResponse({
      ok:false,
      error:"dispatcher_unavailable",
      message:error?.message || "Outbound dispatcher could not claim deliveries.",
    }, 502);
  }
}

export function onRequest() {
  return jsonResponse({ ok:false, error:"method_not_allowed" }, 405, { allow:"POST" });
}
