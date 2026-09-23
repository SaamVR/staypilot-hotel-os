import { getBackendConfig, jsonResponse } from "../_shared/webhook.js";

export async function onRequestGet({ env }) {
  const config = getBackendConfig(env);
  const databaseConfigured = Boolean(config.supabaseUrl && config.supabaseKey);
  const signingConfigured = Boolean(config.webhookSigningSecret);
  const workerConfigured = Boolean(config.workerSecret);
  const dispatcherAuthConfigured = Boolean(config.dispatcherSecret);
  const outboundAllowlistConfigured = String(config.webhookAllowedHosts || "").split(",").some(value => value.trim());
  const configured = databaseConfigured && signingConfigured && workerConfigured;

  return jsonResponse({
    ok: true,
    service: "staypilot-backend-foundation",
    mode: configured ? "configured" : "not_configured",
    configured,
    dependencies: {
      database: databaseConfigured,
      inbound_signature_verification: signingConfigured,
      durable_worker_authentication: workerConfigured,
      outbound_dispatcher_authentication: dispatcherAuthConfigured,
      outbound_host_allowlist: outboundAllowlistConfigured,
    },
    note: configured
      ? (dispatcherAuthConfigured && outboundAllowlistConfigured
          ? "Core server dependencies and optional outbound dispatcher controls are configured; authority still requires applied migrations and explicit rollout."
          : "Core server dependencies are configured; optional outbound webhook dispatch remains disabled until dispatcher auth and an exact-host allowlist are configured.")
      : "Portfolio frontend remains local-first until dedicated backend and worker secrets are configured.",
  });
}

export function onRequest() {
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET" });
}
