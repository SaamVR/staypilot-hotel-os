import { eq, selectQuery, supabaseRequest } from "./supabase.js";

export class AuthzError extends Error {
  constructor(message, status = 401, code = "unauthorized") {
    super(message);
    this.name = "AuthzError";
    this.status = status;
    this.code = code;
  }
}

export function bearerToken(request) {
  const value = request?.headers?.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match?.[1]?.trim() || "";
}

export async function requireAuthenticatedUser(config, request, { fetchImpl = fetch } = {}) {
  const token = bearerToken(request);
  if (!token) throw new AuthzError("missing_bearer_token", 401, "authentication_required");
  if (!config?.supabaseUrl || !config?.supabaseKey) {
    throw new AuthzError("backend_not_configured", 503, "backend_not_configured");
  }

  const response = await fetchImpl(`${config.supabaseUrl}/auth/v1/user`, {
    method:"GET",
    headers:{
      apikey:config.supabaseKey,
      authorization:`Bearer ${token}`,
      accept:"application/json",
    },
  });

  if (!response.ok) {
    throw new AuthzError("invalid_or_expired_session", 401, "authentication_required");
  }

  const user = await response.json();
  if (!user?.id) throw new AuthzError("invalid_user_response", 401, "authentication_required");
  return user;
}

export async function requireHotelOwner(config, request, hotelId, options = {}) {
  const user = await requireAuthenticatedUser(config, request, options);
  const query = selectQuery({
    hotel_id:eq(hotelId),
    user_id:eq(user.id),
    role:eq("owner"),
    select:"hotel_id,user_id,role",
    limit:"1",
  });
  const { data } = await supabaseRequest(config, `/rest/v1/hotel_members?${query}`);
  const membership = Array.isArray(data) ? data[0] || null : null;
  if (!membership) throw new AuthzError("owner_role_required", 403, "owner_role_required");
  return { user, membership };
}
