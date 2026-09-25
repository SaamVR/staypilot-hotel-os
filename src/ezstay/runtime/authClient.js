import { createClient } from "@supabase/supabase-js";

export function createDemoAuthClient({
  supabaseUrl,
  publishableKey,
  createClientImpl = createClient,
} = {}) {
  if (!supabaseUrl || !publishableKey) throw new Error("backend_auth_not_configured");

  const client = createClientImpl(supabaseUrl, publishableKey, {
    auth:{
      persistSession:true,
      autoRefreshToken:true,
      detectSessionInUrl:false,
    },
  });

  return {
    async signInDemo({ captchaToken } = {}) {
      const options = {};
      if (captchaToken) options.captchaToken = captchaToken;

      const { data, error } = await client.auth.signInAnonymously({ options });
      if (error) throw new Error(error.message || "anonymous_sign_in_failed");

      const session = data?.session;
      const user = data?.user || session?.user;
      if (!session?.access_token || !user?.id) throw new Error("anonymous_session_missing");

      return {
        accessToken:session.access_token,
        userId:user.id,
        isAnonymous:user.is_anonymous === true,
      };
    },

    async getAccessToken() {
      const { data, error } = await client.auth.getSession();
      if (error) throw new Error(error.message || "session_read_failed");
      return data?.session?.access_token || null;
    },

    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) throw new Error(error.message || "sign_out_failed");
    },
  };
}
