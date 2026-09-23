import { constantTimeEqual, hmacSha256Hex } from "./webhook.js";

export class ProvisioningError extends Error {
  constructor(message, { status = 400, code = "provisioning_error" } = {}) {
    super(message);
    this.name = "ProvisioningError";
    this.status = status;
    this.code = code;
  }
}

export function normalizeEndpointName(value) {
  const name = String(value || "").trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) {
    throw new ProvisioningError("invalid_endpoint_name", { code:"invalid_endpoint_name" });
  }
  return name;
}

export function normalizeEndpointEvents(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || "").split(",");
  const events = [...new Set(
    source
      .map(item => String(item || "").trim().toLowerCase())
      .filter(Boolean),
  )];

  if (events.length < 1 || events.length > 25) {
    throw new ProvisioningError("invalid_event_subscription_count", { code:"invalid_event_subscription_count" });
  }

  for (const event of events) {
    if (!/^[a-z][a-z0-9_.-]{2,100}$/.test(event)) {
      throw new ProvisioningError("invalid_event_subscription", { code:"invalid_event_subscription" });
    }
  }
  return events;
}

export function endpointSecretRef(endpointId) {
  const compact = String(endpointId || "").replace(/-/g, "").toUpperCase();
  if (!/^[A-F0-9]{32}$/.test(compact)) {
    throw new ProvisioningError("invalid_endpoint_id", { code:"invalid_endpoint_id" });
  }
  return `DERIVED_V1_${compact}`;
}

export async function deriveEndpointSigningSecret(masterSecret, secretRef) {
  const master = String(masterSecret || "");
  const ref = String(secretRef || "").trim().toUpperCase();
  if (master.length < 32) {
    throw new ProvisioningError("outbound_signing_master_not_configured", {
      status:503,
      code:"outbound_signing_master_not_configured",
    });
  }
  if (!/^DERIVED_V1_[A-F0-9]{32}$/.test(ref)) {
    throw new ProvisioningError("invalid_derived_secret_ref", { code:"invalid_derived_secret_ref" });
  }
  const hex = await hmacSha256Hex(master, `staypilot:webhook:${ref}`);
  return `spwh_${hex}`;
}

export async function verificationProof(secret, challenge) {
  const value = String(challenge || "");
  if (!/^[0-9a-f-]{36}$/i.test(value)) {
    throw new ProvisioningError("invalid_verification_challenge", { code:"invalid_verification_challenge" });
  }
  return hmacSha256Hex(secret, `verify:${value}`);
}

export async function verifyChallengeProof(secret, challenge, providedProof) {
  const expected = await verificationProof(secret, challenge);
  return constantTimeEqual(expected.toLowerCase(), String(providedProof || "").trim().toLowerCase());
}
