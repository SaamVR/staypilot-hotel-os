import { requireHotelOwner, AuthzError } from "../../_shared/auth.js";
import { validateProvisioningDestination, parseAllowedHosts, DispatcherError } from "../../_shared/dispatcher.js";
import { getBackendConfig, jsonResponse } from "../../_shared/webhook.js";
import {
  deriveEndpointSigningSecret,
  endpointSecretRef,
  normalizeEndpointEvents,
  normalizeEndpointName,
  ProvisioningError,
} from "../../_shared/provisioning.js";
import { supabaseRequest } from "../../_shared/supabase.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(error) {
  if (error instanceof AuthzError) return jsonResponse({ ok:false, error:error.code }, error.status);
  if (error instanceof ProvisioningError) return jsonResponse({ ok:false, error:error.code }, error.status);
  if (error instanceof DispatcherError) return jsonResponse({ ok:false, error:error.code }, 400);
  return jsonResponse({ ok:false, error:"endpoint_registration_failed" }, 502);
}

export async function onRequestPost({ request, env }) {
  const config = getBackendConfig(env);
  const allowedHosts = parseAllowedHosts(config.webhookAllowedHosts);
  if (!config.supabaseUrl || !config.supabaseKey || !config.outboundSigningMasterSecret || allowedHosts.length === 0) {
    return jsonResponse({
      ok:false,
      error:"provisioning_not_configured",
      message:"Dedicated Supabase, WEBHOOK_ALLOWED_HOSTS and OUTBOUND_SIGNING_MASTER_SECRET are required before endpoint registration is enabled.",
    }, 503);
  }

  let input;
  try { input = await request.json(); }
  catch { return jsonResponse({ ok:false, error:"invalid_json" }, 400); }

  const hotelId = String(input?.hotel_id || "").trim();
  if (!UUID_RE.test(hotelId)) return jsonResponse({ ok:false, error:"invalid_hotel_id" }, 400);

  try {
    await requireHotelOwner(config, request, hotelId);
    const name = normalizeEndpointName(input?.name);
    const events = normalizeEndpointEvents(input?.events);
    const destination = validateProvisioningDestination(input?.url, allowedHosts);

    const endpointId = crypto.randomUUID();
    const secretRef = endpointSecretRef(endpointId);
    const signingSecret = await deriveEndpointSigningSecret(config.outboundSigningMasterSecret, secretRef);

    const { data } = await supabaseRequest(
      config,
      "/rest/v1/webhook_endpoints?select=id,hotel_id,name,url,events,status,verification_status,verified_host,verified_at,created_at",
      {
        method:"POST",
        prefer:"return=representation",
        body:{
          id:endpointId,
          hotel_id:hotelId,
          name,
          url:destination.toString(),
          events,
          status:"Paused",
          secret_ref:secretRef,
          verification_status:"Pending",
        },
      },
    );

    const endpoint = Array.isArray(data) ? data[0] || null : null;
    if (!endpoint) return jsonResponse({ ok:false, error:"endpoint_registration_failed" }, 502);

    return jsonResponse({
      ok:true,
      endpoint,
      signing_secret:signingSecret,
      credential_note:"Store this HMAC credential in the destination system. The raw value is derived server-side and is never stored in the webhook endpoint row.",
      next:"Configure the destination verification handler, then call /api/webhook-endpoints/verify.",
    }, 201);
  } catch (error) {
    return failure(error);
  }
}

export function onRequest() {
  return jsonResponse({ ok:false, error:"method_not_allowed" }, 405, { allow:"POST" });
}
