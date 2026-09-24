import { AuthzError, requireHotelOwner } from "../../_shared/auth.js";
import { requireConfirmedAccount } from "../../_shared/onboarding.js";
import {
  generateInviteToken,
  hashInviteToken,
  normalizeHotelId,
  normalizeInviteEmail,
  normalizeInviteLifetimeHours,
  normalizeInviteRole,
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
  if (/invite_already_pending/i.test(detail)) return jsonResponse({ ok:false, error:"invite_already_pending" }, 409);
  if (/team_member_already_exists/i.test(detail)) return jsonResponse({ ok:false, error:"team_member_already_exists" }, 409);
  if (/invalid_invite_(email|role|token_hash|expiry)/i.test(detail)) {
    return jsonResponse({ ok:false, error:detail.match(/invalid_invite_[a-z_]+/i)?.[0] || "invalid_team_request" }, 400);
  }
  return jsonResponse({ ok:false, error:"team_invitation_failed" }, 502);
}

function requireEnabled(config) {
  if (!config.supabaseUrl || !config.supabaseKey) {
    return jsonResponse({
      ok:false,
      error:"backend_not_configured",
      message:"Dedicated StayPilot Supabase is required before team onboarding can run.",
    }, 503);
  }
  if (!config.teamOnboardingEnabled) {
    return jsonResponse({
      ok:false,
      error:"team_onboarding_disabled",
      message:"Team onboarding is staged but explicitly disabled until controlled backend rollout.",
    }, 503);
  }
  return null;
}

export async function onRequestPost({ request, env }) {
  const config = getBackendConfig(env);
  const blocked = requireEnabled(config);
  if (blocked) return blocked;

  let input;
  try { input = await request.json(); }
  catch { return jsonResponse({ ok:false, error:"invalid_json" }, 400); }

  try {
    const hotelId = normalizeHotelId(input?.hotel_id);
    const email = normalizeInviteEmail(input?.email);
    const role = normalizeInviteRole(input?.role);
    const hours = normalizeInviteLifetimeHours(input?.expires_in_hours ?? 72);

    const { user } = await requireHotelOwner(config, request, hotelId);
    requireConfirmedAccount(user);

    const token = generateInviteToken();
    const tokenHash = await hashInviteToken(token);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    const { data } = await supabaseRpc(config, "create_team_invitation", {
      owner_uuid:user.id,
      hotel_uuid:hotelId,
      invite_email:email,
      invite_role:role,
      invite_token_hash:tokenHash,
      invite_expires_at:expiresAt,
    });

    if (!data?.id) return jsonResponse({ ok:false, error:"team_invitation_failed" }, 502);

    return jsonResponse({
      ok:true,
      invitation:data,
      invite_token:token,
      delivery:"manual_demo",
      note:"The raw invitation token is returned once to the authorized Owner. Production email delivery is a separate integration.",
    }, 201);
  } catch (error) {
    return mapFailure(error);
  }
}

export async function onRequestGet({ request, env }) {
  const config = getBackendConfig(env);
  const blocked = requireEnabled(config);
  if (blocked) return blocked;

  try {
    const url = new URL(request.url);
    const hotelId = normalizeHotelId(url.searchParams.get("hotel_id"));
    const { user } = await requireHotelOwner(config, request, hotelId);
    requireConfirmedAccount(user);

    const { data } = await supabaseRpc(config, "list_team_invitations", {
      owner_uuid:user.id,
      hotel_uuid:hotelId,
    });

    return jsonResponse({
      ok:true,
      invitations:Array.isArray(data) ? data : [],
    });
  } catch (error) {
    return mapFailure(error);
  }
}

export function onRequest() {
  return jsonResponse({ ok:false, error:"method_not_allowed" }, 405, { allow:"GET, POST" });
}
