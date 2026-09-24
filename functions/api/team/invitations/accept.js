import { AuthzError, requireAuthenticatedUser } from "../../../_shared/auth.js";
import {
  hashInviteToken,
  normalizeInviteToken,
  requireConfirmedEmailAccount,
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

  if (/invite_email_mismatch/i.test(detail)) return jsonResponse({ ok:false, error:"invite_email_mismatch" }, 403);
  if (/invite_(revoked|expired)/i.test(detail)) return jsonResponse({ ok:false, error:detail.match(/invite_[a-z_]+/i)?.[0] || "invite_unavailable" }, 410);
  if (/invite_already_used/i.test(detail)) return jsonResponse({ ok:false, error:"invite_already_used" }, 409);
  if (/team_member_already_exists/i.test(detail)) return jsonResponse({ ok:false, error:"team_member_already_exists" }, 409);
  if (/invalid_invite_token/i.test(detail)) return jsonResponse({ ok:false, error:"invalid_invite_token" }, 400);
  return jsonResponse({ ok:false, error:"team_invite_accept_failed" }, 502);
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
    const token = normalizeInviteToken(input?.token);
    const user = requireConfirmedEmailAccount(await requireAuthenticatedUser(config, request));
    const tokenHash = await hashInviteToken(token);

    const { data } = await supabaseRpc(config, "accept_team_invitation", {
      user_uuid:user.id,
      user_email:user.email,
      invite_token_hash:tokenHash,
    });

    if (data?.ok === false && data?.error === "invite_expired") {
      return jsonResponse({ ok:false, error:"invite_expired" }, 410);
    }
    if (!data?.ok || !data?.hotel_id || !data?.role) {
      return jsonResponse({ ok:false, error:"team_invite_accept_failed" }, 502);
    }

    return jsonResponse({
      ok:true,
      hotel_id:data.hotel_id,
      role:data.role,
      invite_id:data.invite_id,
    });
  } catch (error) {
    return mapFailure(error);
  }
}

export function onRequest() {
  return jsonResponse({ ok:false, error:"method_not_allowed" }, 405, { allow:"POST" });
}
