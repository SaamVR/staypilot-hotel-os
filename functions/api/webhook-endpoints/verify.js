import { requireHotelOwner, AuthzError } from "../../_shared/auth.js";
import {
  parseAllowedHosts,
  resolveWebhookSecret,
  validateProvisioningDestination,
  DispatcherError,
} from "../../_shared/dispatcher.js";
import { constantTimeEqual, getBackendConfig, hmacSha256Hex, jsonResponse } from "../../_shared/webhook.js";
import { verifyChallengeProof, ProvisioningError } from "../../_shared/provisioning.js";
import { eq, selectQuery, supabaseRequest, supabaseRpc } from "../../_shared/supabase.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function markFailed(config, endpointId, reason) {
  try {
    await supabaseRpc(config, "mark_webhook_endpoint_verification_failed", {
      endpoint_uuid:endpointId,
      error_text:String(reason || "verification_failed").slice(0, 240),
    });
  } catch {
    // Verification failure must still be reported even if status persistence also fails.
  }
}

function failure(error) {
  if (error instanceof AuthzError) return jsonResponse({ ok:false, error:error.code }, error.status);
  if (error instanceof ProvisioningError) return jsonResponse({ ok:false, error:error.code }, error.status);
  if (error instanceof DispatcherError) return jsonResponse({ ok:false, error:error.code }, 400);
  return jsonResponse({ ok:false, error:"endpoint_verification_failed" }, 502);
}

export async function onRequestPost({ request, env }) {
  const config = getBackendConfig(env);
  const allowedHosts = parseAllowedHosts(config.webhookAllowedHosts);
  if (!config.supabaseUrl || !config.supabaseKey || !config.outboundSigningMasterSecret || allowedHosts.length === 0) {
    return jsonResponse({
      ok:false,
      error:"provisioning_not_configured",
      message:"Dedicated Supabase, WEBHOOK_ALLOWED_HOSTS and OUTBOUND_SIGNING_MASTER_SECRET are required before endpoint verification is enabled.",
    }, 503);
  }

  let input;
  try { input = await request.json(); }
  catch { return jsonResponse({ ok:false, error:"invalid_json" }, 400); }

  const hotelId = String(input?.hotel_id || "").trim();
  const endpointId = String(input?.endpoint_id || "").trim();
  if (!UUID_RE.test(hotelId)) return jsonResponse({ ok:false, error:"invalid_hotel_id" }, 400);
  if (!UUID_RE.test(endpointId)) return jsonResponse({ ok:false, error:"invalid_endpoint_id" }, 400);

  let endpoint = null;
  try {
    await requireHotelOwner(config, request, hotelId);
    const query = selectQuery({
      id:eq(endpointId),
      hotel_id:eq(hotelId),
      select:"id,hotel_id,name,url,events,status,verification_status,verified_host,verified_at,secret_ref",
      limit:"1",
    });
    const { data } = await supabaseRequest(config, `/rest/v1/webhook_endpoints?${query}`);
    endpoint = Array.isArray(data) ? data[0] || null : null;
    if (!endpoint) return jsonResponse({ ok:false, error:"webhook_endpoint_not_found" }, 404);

    const destination = validateProvisioningDestination(endpoint.url, allowedHosts);
    const secret = await resolveWebhookSecret(env, endpoint.secret_ref);
    const challenge = crypto.randomUUID();
    const body = JSON.stringify({
      type:"staypilot.webhook.verify",
      endpoint_id:endpoint.id,
      challenge,
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await hmacSha256Hex(secret, `${timestamp}.${body}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let response;
    try {
      response = await fetch(destination.toString(), {
        method:"POST",
        redirect:"manual",
        cache:"no-store",
        signal:controller.signal,
        headers:{
          "content-type":"application/json",
          "user-agent":"StayPilot-Webhook-Verify/1.0",
          "x-staypilot-event-type":"staypilot.webhook.verify",
          "x-staypilot-timestamp":timestamp,
          "x-staypilot-signature":`v1=${signature}`,
        },
        body,
      });
    } finally {
      clearTimeout(timer);
    }

    if (response.status < 200 || response.status >= 300) {
      await markFailed(config, endpoint.id, `verification_http_${response.status}`);
      try { await response.body?.cancel(); } catch {}
      return jsonResponse({ ok:false, error:"verification_http_failure", status:response.status }, 422);
    }

    const text = await response.text();
    if (text.length > 16_384) {
      await markFailed(config, endpoint.id, "verification_response_too_large");
      return jsonResponse({ ok:false, error:"verification_response_too_large" }, 422);
    }

    let proof;
    try { proof = JSON.parse(text || "{}"); }
    catch {
      await markFailed(config, endpoint.id, "verification_invalid_json");
      return jsonResponse({ ok:false, error:"verification_invalid_json" }, 422);
    }

    const challengeMatches = constantTimeEqual(String(proof?.challenge || ""), challenge);
    const proofMatches = await verifyChallengeProof(secret, challenge, proof?.proof);
    if (!challengeMatches || !proofMatches) {
      await markFailed(config, endpoint.id, "verification_proof_mismatch");
      return jsonResponse({ ok:false, error:"verification_proof_mismatch" }, 422);
    }

    const { data:verified } = await supabaseRpc(config, "mark_webhook_endpoint_verified", {
      endpoint_uuid:endpoint.id,
      verified_host_text:destination.hostname.toLowerCase(),
    });

    return jsonResponse({
      ok:true,
      endpoint_id:endpoint.id,
      status:"Active",
      verification_status:"Verified",
      verified_host:destination.hostname.toLowerCase(),
      verified_at:verified?.verified_at || null,
    });
  } catch (error) {
    if (endpoint?.id && !(error instanceof AuthzError)) {
      await markFailed(config, endpoint.id, error?.code || error?.message || "verification_failed");
    }
    if (error?.name === "AbortError") {
      return jsonResponse({ ok:false, error:"verification_timeout" }, 422);
    }
    return failure(error);
  }
}

export function onRequest() {
  return jsonResponse({ ok:false, error:"method_not_allowed" }, 405, { allow:"POST" });
}
