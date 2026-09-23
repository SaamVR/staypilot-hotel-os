import { AuthzError, requireHotelOwner } from "../../../_shared/auth.js";
import { requireConfirmedAccount } from "../../../_shared/onboarding.js";
import { normalizeUuid, TeamInvitationError } from "../../../_shared/team-invitations.js";
import { getBackendConfig, jsonResponse } from "../../../_shared/webhook.js";
import { supabaseRpc, SupabaseHttpError } from "../../../_shared/supabase.js";

function mapFailure(error) {
  if (error instanceof AuthzError) return jsonResponse({ ok:false, error:error.code }, error.status);
  if (error instanceof TeamInvitationError) return jsonResponse({ ok:false, error:error.code }, error.status);
  const detail = error instanceof SupabaseHttpError
    ? String(error?.body?.message || error?.body?.details || "")
    : "";
  if (/invitation_not_found/i.test(detail)) return jsonResponse({ ok:false, error:"invitation_not_found" }, 404);
  if (/invitation_already_accepted/i.test(detail)) return jsonResponse({ ok:false, error:"invitation_already_accepted" }, 409);
  if (/owner_role_required/i.test(detail)) return jsonResponse({ ok:false, error:"owner_role_required" }, 403);
  return jsonResponse({ ok:false, error:"invitation_revoke_failed" }, 502);
}

export async function onRequestPost({ request, env }) {
  const config = getBackendConfig(env);
  if (!config.supabaseUrl || !config.supabaseKey) return jsonResponse({ ok:false, error:"backend_not_configured" }, 503);
  if (!config.teamInvitesEnabled) return jsonResponse({ ok:false, error:"team_invitations_disabled" }, 503);

  let input;
  try { input = await request.json(); }
  catch { return jsonResponse({ ok:false, error:"invalid_json" }, 400); }

  try {
    const hotelId = normalizeUuid(input?.hotel_id, "invalid_hotel_id");
    const invitationId = normalizeUuid(input?.invitation_id, "invalid_invitation_id");
    const { user } = await requireHotelOwner(config, request, hotelId);
    requireConfirmedAccount(user);

    const { data } = await supabaseRpc(config, "revoke_hotel_invitation", {
      hotel_uuid:hotelId,
      owner_uuid:user.id,
      invitation_uuid:invitationId,
    });

    return jsonResponse({
      ok:true,
      invitation_id:data?.id || invitationId,
      status:data?.status || "revoked",
      replayed:Boolean(data?.replayed),
    });
  } catch (error) {
    return mapFailure(error);
  }
}

export function onRequest() {
  return jsonResponse({ ok:false, error:"method_not_allowed" }, 405, { allow:"POST" });
}
