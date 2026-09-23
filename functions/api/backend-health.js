import { getBackendConfig, jsonResponse } from "../_shared/webhook.js";

export async function onRequestGet({ env }) {
  const config = getBackendConfig(env);
  const databaseConfigured = Boolean(config.supabaseUrl && config.supabaseKey);
  const signingConfigured = Boolean(config.webhookSigningSecret);
  const workerConfigured = Boolean(config.workerSecret);
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
    },
    note: configured
      ? "Server boundary dependencies are configured; worker execution remains disabled until the database migrations are applied and explicitly enabled."
      : "Portfolio frontend remains local-first until dedicated backend and worker secrets are configured.",
  });
}

export function onRequest() {
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET" });
}
