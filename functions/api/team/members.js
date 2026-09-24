import { AuthzError, requireHotelOwner } from "../../_shared/auth.js";
import { requireConfirmedAccount } from "../../_shared/onboarding.js";
import {
  normalizeHotelId,
  TeamOnboardingError,
} from "../../_shared/team.js";
import { getBackendConfig, jsonResponse } from "../../_shared/webhook.js";
import { supabaseRpc, SupabaseHttpError } from "../../_shared/supabase.js";

function mapFailure(error) {
  if (error instanceof AuthzError) return jsonResponse({ ok:false, error:error.code }, error.status);
  if (error instanceof TeamOnboardingError) return jsonResponse({ ok:false, error:error.code }, error.status);
  const detail = error instanceof SupabaseHttpError
    ? String(error?.body?.message || error?.body?.details || "")
    : "";
  if (/owner_role_required/i.test(detail)) return jsonResponse({ ok:false, error:"owner_role_required" }, 403);
  return jsonResponse({ ok:false, error:"team_members_list_failed" }, 502);
}

export async function onRequestGet({ request, env }) {
  const config = getBackendConfig(env);
  if (!config.supabaseUrl || !config.supabaseKey) {
    return jsonResponse({ ok:false, error:"backend_not_configured" }, 503);
  }
  if (!config.teamOnboardingEnabled) {
    return jsonResponse({ ok:false, error:"team_onboarding_disabled" }, 503);
  }

  try {
    const url = new URL(request.url);
    const hotelId = normalizeHotelId(url.searchParams.get("hotel_id"));
    const { user } = await requireHotelOwner(config, request, hotelId);
    requireConfirmedAccount(user);

    const { data } = await supabaseRpc(config, "list_hotel_members", {
      owner_uuid:user.id,
      hotel_uuid:hotelId,
    });

    return jsonResponse({
      ok:true,
      members:Array.isArray(data) ? data : [],
    });
  } catch (error) {
    return mapFailure(error);
  }
}

export function onRequest() {
  return jsonResponse({ ok:false, error:"method_not_allowed" }, 405, { allow:"GET" });
}
