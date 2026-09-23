import { getBackendConfig, jsonResponse } from "../_shared/webhook.js";

export async function onRequestGet({ env }) {
  const config = getBackendConfig(env);
  const databaseConfigured = Boolean(config.supabaseUrl && config.supabaseKey);
  const signingConfigured = Boolean(config.webhookSigningSecret);
  const workerConfigured = Boolean(config.workerSecret);
  const dispatcherAuthConfigured = Boolean(config.dispatcherSecret);
  const outboundAllowlistConfigured = String(config.webhookAllowedHosts || "").split(",").some(value => value.trim());
  const outboundSigningConfigured = Boolean(config.outboundSigningMasterSecret);
  const orchestratorAuthConfigured = Boolean(config.orchestratorSecret);
  const orchestratorEnabled = Boolean(config.orchestratorEnabled);
  const tenantBootstrapEnabled = Boolean(config.tenantBootstrapEnabled);
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
      outbound_signing_master: outboundSigningConfigured,
      scheduler_orchestration_authentication: orchestratorAuthConfigured,
      scheduler_orchestration_enabled: orchestratorEnabled,
      tenant_bootstrap_enabled: tenantBootstrapEnabled,
    },
    note: configured
      ? (dispatcherAuthConfigured && outboundAllowlistConfigured && outboundSigningConfigured
          ? "Core server dependencies and outbound dispatcher/provisioning controls are configured; scheduled authority still requires ORCHESTRATOR_ENABLED=true."
          : "Core server dependencies are configured; outbound webhook provisioning remains disabled until dispatcher auth, an exact-host allowlist and the outbound signing master are configured.")
      : "Portfolio frontend remains local-first until dedicated backend and worker secrets are configured.",
  });
}

export function onRequest() {
  return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, { allow: "GET" });
}
