import { getBackendConfig, jsonResponse } from "../_shared/webhook.js";

export async function onRequestGet({ env }) {
  const config = getBackendConfig(env);
  const databaseConfigured = Boolean(config.supabaseUrl && config.supabaseKey);
  const signingConfigured = Boolean(config.webhookSigningSecret);
  const configured = databaseConfigured && signingConfigured;

  return jsonResponse({
    ok: true,
    service: "staypilot-backend-foundation",
    mode: configured ? "configured" : "not_configured",
    configured,
    dependencies: {
      database: databaseConfigured,
      inbound_signature_verification: signingConfigured,
    },
    note: configured
      ? "Server boundary is configured; automation worker rollout is a separate phase."
      : "Portfolio frontend remains local-first until dedicated backend secrets are configured.",
  });
}

export function onRequest() {
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET" });
}
