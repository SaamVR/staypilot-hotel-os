import { AuthzError, requireHotelOwner } from "../../../_shared/auth.js";
import { requireConfirmedAccount } from "../../../_shared/onboarding.js";
import {
  normalizeHotelId,
  normalizeMemberUserId,
  TeamOnboardingError,
} from "../../../_shared/team.js";
import { getBackendConfig, jsonResponse } from "../../../_shared/webhook.js";
import { supabaseRpc, SupabaseHttpError } from "../../../_shared/supabase.js";

function mapFailure(error) {
  if (error instanceof AuthzError) return jsonResponse({ ok:false, error:error.code }, error.status);
  if (error instanceof TeamOnboardingError) return jsonResponse({ ok:false, error:error.code }, error.status);

  const detail = error instanceof SupabaseHttpError
    ? String(error?.body?.message || error?.body?.details || "")
    : "";

  if (/owner_role_required/i.test(detail)) return jsonResponse({ ok:false, error:"owner_role_required" }, 403);
  if (/team_member_not_found/i.test(detail)) return jsonResponse({ ok:false, error:"team_member_not_found" }, 404);
  if (/owner_role_immutable/i.test(detail)) return jsonResponse({ ok:false, error:"owner_role_immutable" }, 409);
  if (/team_member_changed_concurrently/i.test(detail)) return jsonResponse({ ok:false, error:"team_member_changed_concurrently" }, 409);
  return jsonResponse({ ok:false, error:"team_member_remove_failed" }, 502);
}

export async function onRequestPost({ request, env }) {
  const config = getBackendConfig(env);
  if (!config.supabaseUrl || !config.supabaseKey) {
    return jsonResponse({ ok:false, error:"backend_not_configured" }, 503);
  }
  if (!config.teamOnboardingEnabled) {
    return jsonResponse({ ok:false, error:"team_onboarding_disabled" }, 503);
  }

  let input;
  try { input = await request.json(); }
  catch { return jsonResponse({ ok:false, error:"invalid_json" }, 400); }

  try {
    const hotelId = normalizeHotelId(input?.hotel_id);
    const memberUserId = normalizeMemberUserId(input?.user_id);
    const { user } = await requireHotelOwner(config, request, hotelId);
    requireConfirmedAccount(user);

    const { data } = await supabaseRpc(config, "remove_team_member", {
      owner_uuid:user.id,
      hotel_uuid:hotelId,
      member_user_uuid:memberUserId,
    });

    if (!data?.ok || !data?.user_id) {
      return jsonResponse({ ok:false, error:"team_member_remove_failed" }, 502);
    }

    return jsonResponse({
      ok:true,
      removed:Boolean(data.removed),
      member:{
        hotel_id:data.hotel_id,
        user_id:data.user_id,
        previous_role:data.previous_role,
      },
    });
  } catch (error) {
    return mapFailure(error);
  }
}

export function onRequest() {
  return jsonResponse({ ok:false, error:"method_not_allowed" }, 405, { allow:"POST" });
}
