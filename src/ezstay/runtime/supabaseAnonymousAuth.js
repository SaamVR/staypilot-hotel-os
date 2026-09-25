import { createClient } from "@supabase/supabase-js";

function isAnonymousSession(session) {
  return Boolean(session?.access_token && session?.user?.is_anonymous === true);
}

export function createSupabaseAnonymousAuth({
  supabaseUrl,
  publishableKey,
  createClientImpl = createClient,
} = {}) {
  const url = String(supabaseUrl || "").trim();
  const key = String(publishableKey || "").trim();
  if (!url || !key) throw new Error("supabase_auth_not_configured");

  const client = createClientImpl(url, key, {
    auth:{
      storageKey:"ezstay:v2:auth",
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:false,
    },
  });

  async function currentSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw new Error(error.message || "supabase_auth_unavailable");
    return data?.session || null;
  }

  return {
    async ensureAnonymousSession({ captchaToken } = {}) {
      const existing = await currentSession();
      if (existing) {
        if (!isAnonymousSession(existing)) throw new Error("anonymous_demo_identity_required");
        return existing;
      }

      const token = String(captchaToken || "").trim();
      if (!token) throw new Error("captcha_token_required");

      const { data, error } = await client.auth.signInAnonymously({
        options:{ captchaToken:token },
      });
      if (error) throw new Error(error.message || "anonymous_signin_failed");
      if (!isAnonymousSession(data?.session)) throw new Error("anonymous_signin_failed");
      return data.session;
    },

    async getAccessToken() {
      const session = await currentSession();
      return isAnonymousSession(session) ? session.access_token : null;
    },

    client,
  };
}
