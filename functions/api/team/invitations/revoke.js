import { AuthzError, requireHotelOwner } from "../../../_shared/auth.js";
import { requireConfirmedAccount } from "../../../_shared/onboarding.js";
import {
  normalizeHotelId,
  normalizeInviteId,
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
  if (/invite_not_found/i.test(detail)) return jsonResponse({ ok:false, error:"invite_not_found" }, 404);
  if (/invite_already_used/i.test(detail)) return jsonResponse({ ok:false, error:"invite_already_used" }, 409);
  if (/invite_expired/i.test(detail)) return jsonResponse({ ok:false, error:"invite_expired" }, 410);
  return jsonResponse({ ok:false, error:"team_invite_revoke_failed" }, 502);
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
    const inviteId = normalizeInviteId(input?.invite_id);
    const { user } = await requireHotelOwner(config, request, hotelId);
    requireConfirmedAccount(user);

    const { data } = await supabaseRpc(config, "revoke_team_invitation", {
      owner_uuid:user.id,
      invite_uuid:inviteId,
    });

    if (data?.ok === false && data?.error === "invite_expired") {
      return jsonResponse({ ok:false, error:"invite_expired" }, 410);
    }
    if (!data?.id) return jsonResponse({ ok:false, error:"team_invite_revoke_failed" }, 502);

    return jsonResponse({
      ok:true,
      revoked:Boolean(data.revoked),
      invitation:{ id:data.id, hotel_id:data.hotel_id, status:data.status || "revoked" },
    });
  } catch (error) {
    return mapFailure(error);
  }
}

export function onRequest() {
  return jsonResponse({ ok:false, error:"method_not_allowed" }, 405, { allow:"POST" });
}
