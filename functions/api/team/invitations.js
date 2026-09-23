import { AuthzError, requireHotelOwner } from "../../_shared/auth.js";
import { requireConfirmedAccount } from "../../_shared/onboarding.js";
import {
  generateInviteToken,
  normalizeInviteEmail,
  normalizeInviteRole,
  normalizeUuid,
  TeamInvitationError,
} from "../../_shared/team-invitations.js";
import { getBackendConfig, jsonResponse, sha256Hex } from "../../_shared/webhook.js";
import { supabaseRpc, SupabaseHttpError } from "../../_shared/supabase.js";

function failClosed(config) {
  if (!config.supabaseUrl || !config.supabaseKey) {
    return jsonResponse({ ok:false, error:"backend_not_configured" }, 503);
  }
  if (!config.teamInvitesEnabled) {
    return jsonResponse({ ok:false, error:"team_invitations_disabled" }, 503);
  }
  return null;
}

function mapFailure(error) {
  if (error instanceof AuthzError) return jsonResponse({ ok:false, error:error.code }, error.status);
  if (error instanceof TeamInvitationError) return jsonResponse({ ok:false, error:error.code }, error.status);
  const detail = error instanceof SupabaseHttpError
    ? String(error?.body?.message || error?.body?.details || "")
    : "";
  if (/already_hotel_member/i.test(detail)) return jsonResponse({ ok:false, error:"already_hotel_member" }, 409);
  if (/invitation_already_pending/i.test(detail)) return jsonResponse({ ok:false, error:"invitation_already_pending" }, 409);
  if (/owner_role_required/i.test(detail)) return jsonResponse({ ok:false, error:"owner_role_required" }, 403);
  if (/invalid_invite_(email|role|token)/i.test(detail)) {
    return jsonResponse({ ok:false, error:detail.match(/invalid_invite_[a-z_]+/i)?.[0] || "invalid_team_invitation" }, 400);
  }
  return jsonResponse({ ok:false, error:"team_invitation_failed" }, 502);
}

export async function onRequestGet({ request, env }) {
  const config = getBackendConfig(env);
  const closed = failClosed(config);
  if (closed) return closed;

  try {
    const url = new URL(request.url);
    const hotelId = normalizeUuid(url.searchParams.get("hotel_id"), "invalid_hotel_id");
    const { user } = await requireHotelOwner(config, request, hotelId);
    requireConfirmedAccount(user);

    const { data } = await supabaseRpc(config, "list_hotel_invitations", {
      hotel_uuid:hotelId,
      owner_uuid:user.id,
    });

    return jsonResponse({
      ok:true,
      invitations:Array.isArray(data) ? data : [],
    });
  } catch (error) {
    return mapFailure(error);
  }
}

export async function onRequestPost({ request, env }) {
  const config = getBackendConfig(env);
  const closed = failClosed(config);
  if (closed) return closed;

  let input;
  try { input = await request.json(); }
  catch { return jsonResponse({ ok:false, error:"invalid_json" }, 400); }

  try {
    const hotelId = normalizeUuid(input?.hotel_id, "invalid_hotel_id");
    const email = normalizeInviteEmail(input?.email);
    const role = normalizeInviteRole(input?.role);
    const { user } = await requireHotelOwner(config, request, hotelId);
    requireConfirmedAccount(user);

    const rawToken = generateInviteToken();
    const tokenHash = await sha256Hex(rawToken);

    const { data } = await supabaseRpc(config, "create_hotel_invitation", {
      hotel_uuid:hotelId,
      inviter_uuid:user.id,
      invite_email:email,
      invite_role:role,
      invite_token_hash:tokenHash,
      expiry_hours:168,
    });

    if (!data?.id) return jsonResponse({ ok:false, error:"team_invitation_failed" }, 502);

    return jsonResponse({
      ok:true,
      invitation:data,
      invite_token:rawToken,
      accept_endpoint:"/api/team/invitations/accept",
      delivery:"manual_copy",
      note:"Raw invite token is returned once and is not stored by StayPilot.",
    }, 201);
  } catch (error) {
    return mapFailure(error);
  }
}

export function onRequest() {
  return jsonResponse({ ok:false, error:"method_not_allowed" }, 405, { allow:"GET, POST" });
}
