import { AuthzError, requireAuthenticatedUser } from "../../../_shared/auth.js";
import { requireConfirmedAccount } from "../../../_shared/onboarding.js";
import { normalizeInviteToken, TeamInvitationError } from "../../../_shared/team-invitations.js";
import { getBackendConfig, jsonResponse, sha256Hex } from "../../../_shared/webhook.js";
import { supabaseRpc, SupabaseHttpError } from "../../../_shared/supabase.js";

function mapFailure(error) {
  if (error instanceof AuthzError) return jsonResponse({ ok:false, error:error.code }, error.status);
  if (error instanceof TeamInvitationError) return jsonResponse({ ok:false, error:error.code }, error.status);

  const detail = error instanceof SupabaseHttpError
    ? String(error?.body?.message || error?.body?.details || "")
    : "";
  const conflicts = ["invitation_revoked","invitation_expired","invitation_already_accepted","membership_conflict","invite_email_mismatch"];
  for (const code of conflicts) {
    if (new RegExp(code,"i").test(detail)) return jsonResponse({ ok:false, error:code }, 409);
  }
  if (/invalid_invite_token/i.test(detail)) return jsonResponse({ ok:false, error:"invalid_invite_token" }, 404);
  return jsonResponse({ ok:false, error:"invitation_accept_failed" }, 502);
}

export async function onRequestPost({ request, env }) {
  const config = getBackendConfig(env);
  if (!config.supabaseUrl || !config.supabaseKey) return jsonResponse({ ok:false, error:"backend_not_configured" }, 503);
  if (!config.teamInvitesEnabled) return jsonResponse({ ok:false, error:"team_invitations_disabled" }, 503);

  let input;
  try { input = await request.json(); }
  catch { return jsonResponse({ ok:false, error:"invalid_json" }, 400); }

  try {
    const rawToken = normalizeInviteToken(input?.token);
    const user = requireConfirmedAccount(await requireAuthenticatedUser(config, request));
    const email = String(user.email || "").trim().toLowerCase();
    if (!email) return jsonResponse({ ok:false, error:"confirmed_email_required" }, 403);

    const tokenHash = await sha256Hex(rawToken);
    const { data } = await supabaseRpc(config, "accept_hotel_invitation", {
      user_uuid:user.id,
      user_email:email,
      invite_token_hash:tokenHash,
    });

    return jsonResponse({
      ok:true,
      accepted:Boolean(data?.accepted),
      replayed:Boolean(data?.replayed),
      hotel_id:data?.hotel_id || null,
      role:data?.role || null,
      invitation_id:data?.invitation_id || null,
    }, data?.accepted ? 201 : 200);
  } catch (error) {
    return mapFailure(error);
  }
}

export function onRequest() {
  return jsonResponse({ ok:false, error:"method_not_allowed" }, 405, { allow:"POST" });
}
