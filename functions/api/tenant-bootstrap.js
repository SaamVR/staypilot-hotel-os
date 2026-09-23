import { AuthzError, requireAuthenticatedUser } from "../_shared/auth.js";
import {
  normalizeTenantBootstrapInput,
  OnboardingError,
  requireConfirmedAccount,
} from "../_shared/onboarding.js";
import { getBackendConfig, jsonResponse } from "../_shared/webhook.js";
import { supabaseRpc, SupabaseHttpError } from "../_shared/supabase.js";

function mapFailure(error) {
  if (error instanceof AuthzError) return jsonResponse({ ok:false, error:error.code }, error.status);
  if (error instanceof OnboardingError) return jsonResponse({ ok:false, error:error.code }, error.status);

  const detail = error instanceof SupabaseHttpError
    ? String(error?.body?.message || error?.body?.details || "")
    : "";

  if (/hotel_slug_taken/i.test(detail)) return jsonResponse({ ok:false, error:"hotel_slug_taken" }, 409);
  if (/hotel_already_exists/i.test(detail)) return jsonResponse({ ok:false, error:"hotel_already_exists" }, 409);
  if (/idempotency_key_reused/i.test(detail)) return jsonResponse({ ok:false, error:"idempotency_key_reused" }, 409);
  if (/invalid_(hotel_slug|hotel_name|timezone|currency|idempotency_key)/i.test(detail)) {
    return jsonResponse({ ok:false, error:detail.match(/invalid_[a-z_]+/i)?.[0] || "invalid_onboarding_request" }, 400);
  }
  return jsonResponse({ ok:false, error:"tenant_bootstrap_failed" }, 502);
}

export async function onRequestPost({ request, env }) {
  const config = getBackendConfig(env);

  if (!config.supabaseUrl || !config.supabaseKey) {
    return jsonResponse({
      ok:false,
      error:"backend_not_configured",
      message:"Dedicated StayPilot Supabase is required before tenant onboarding can run.",
    }, 503);
  }

  if (!config.tenantBootstrapEnabled) {
    return jsonResponse({
      ok:false,
      error:"tenant_bootstrap_disabled",
      message:"Tenant bootstrap is staged but explicitly disabled until controlled backend rollout.",
    }, 503);
  }

  let input;
  try { input = await request.json(); }
  catch { return jsonResponse({ ok:false, error:"invalid_json" }, 400); }

  try {
    const user = requireConfirmedAccount(await requireAuthenticatedUser(config, request));
    const normalized = normalizeTenantBootstrapInput(
      input,
      request.headers.get("x-staypilot-idempotency-key"),
    );

    const { data } = await supabaseRpc(config, "bootstrap_hotel_owner", {
      user_uuid:user.id,
      idempotency_key:normalized.idempotencyKey,
      hotel_slug:normalized.slug,
      hotel_name:normalized.name,
      hotel_timezone:normalized.timezone,
      hotel_currency:normalized.currency,
    });

    if (!data?.hotel?.id) return jsonResponse({ ok:false, error:"tenant_bootstrap_failed" }, 502);

    return jsonResponse({
      ok:true,
      created:Boolean(data.created),
      hotel:data.hotel,
      role:data.role || "owner",
      automation_rules_seeded:Number(data.automation_rules_seeded || 0),
      automation_paused:Boolean(data.hotel?.automation_paused),
      next:"Complete property setup, integrations and policy review before enabling server automation.",
    }, data.created ? 201 : 200);
  } catch (error) {
    return mapFailure(error);
  }
}

export function onRequest() {
  return jsonResponse({ ok:false, error:"method_not_allowed" }, 405, { allow:"POST" });
}
