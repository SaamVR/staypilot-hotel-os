function bearerToken(request) {
  const value = request?.headers?.get?.("authorization") || "";
  const match = value.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) throw new Error("authentication_required");
  return match[1].trim();
}

function configuredOrigin(raw) {
  let url;
  try {
    url = new URL(String(raw || ""));
  } catch {
    throw new Error("auth_not_configured");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("auth_not_configured");
  }
  return url.origin;
}

function decodeJwtPayload(jwt) {
  const parts = String(jwt || "").split(".");
  if (parts.length !== 3) throw new Error("authentication_invalid");
  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("authentication_invalid");
  }
}

export async function requireAuthenticatedUser(request, env = {}, fetchImpl = globalThis.fetch) {
  const token = bearerToken(request);
  const origin = configuredOrigin(env.SUPABASE_URL);
  const publishableKey = String(env.SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!publishableKey || typeof fetchImpl !== "function") throw new Error("auth_not_configured");

  const response = await fetchImpl(`${origin}/auth/v1/user`, {
    method:"GET",
    redirect:"manual",
    cache:"no-store",
    headers:{
      apikey:publishableKey,
      authorization:`Bearer ${token}`,
      accept:"application/json",
    },
  });

  if (!response.ok) throw new Error("authentication_invalid");

  let user;
  try {
    user = await response.json();
  } catch {
    throw new Error("authentication_invalid");
  }

  const payload = decodeJwtPayload(token);
  if (!user?.id || !payload?.sub || String(user.id) !== String(payload.sub)) {
    throw new Error("authentication_subject_mismatch");
  }

  return {
    userId:String(user.id),
    isAnonymous:payload.is_anonymous === true,
    user,
  };
}
