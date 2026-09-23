import { hmacSha256Hex } from "./webhook.js";
import { deriveEndpointSigningSecret } from "./provisioning.js";
import { supabaseRpc, SupabaseHttpError } from "./supabase.js";

export class DispatcherError extends Error {
  constructor(message, { retryable = false, code = "dispatcher_error" } = {}) {
    super(message);
    this.name = "DispatcherError";
    this.retryable = retryable;
    this.code = code;
  }
}

export function parseAllowedHosts(raw = "") {
  return [...new Set(
    String(raw)
      .split(",")
      .map(value => value.trim().toLowerCase())
      .filter(Boolean),
  )];
}

function isIpLiteral(hostname) {
  const host = String(hostname || "").replace(/^\[|\]$/g, "");
  if (host.includes(":")) return true;
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  return parts.every(part => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

export function validateWebhookDestination(urlValue, verifiedHost, allowedHosts) {
  let url;
  try {
    url = new URL(String(urlValue || ""));
  } catch {
    throw new DispatcherError("invalid_webhook_url", { code:"invalid_webhook_url" });
  }

  const hostname = url.hostname.toLowerCase();
  const verified = String(verifiedHost || "").trim().toLowerCase();
  const allowed = Array.isArray(allowedHosts) ? allowedHosts : parseAllowedHosts(allowedHosts);

  if (url.protocol !== "https:") {
    throw new DispatcherError("https_required", { code:"https_required" });
  }
  if (url.username || url.password) {
    throw new DispatcherError("url_credentials_forbidden", { code:"url_credentials_forbidden" });
  }
  if (url.port && url.port !== "443") {
    throw new DispatcherError("nonstandard_port_forbidden", { code:"nonstandard_port_forbidden" });
  }
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal") || isIpLiteral(hostname)) {
    throw new DispatcherError("private_or_local_destination_forbidden", { code:"private_or_local_destination_forbidden" });
  }
  if (!verified || hostname !== verified) {
    throw new DispatcherError("verified_host_mismatch", { code:"verified_host_mismatch" });
  }
  if (!allowed.includes(hostname)) {
    throw new DispatcherError("destination_not_allowlisted", { code:"destination_not_allowlisted" });
  }

  return url;
}

export function validateProvisioningDestination(urlValue, allowedHosts) {
  let parsed;
  try { parsed = new URL(String(urlValue || "")); }
  catch { throw new DispatcherError("invalid_webhook_url", { code:"invalid_webhook_url" }); }
  return validateWebhookDestination(urlValue, parsed.hostname, allowedHosts);
}

export async function resolveWebhookSecret(env, secretRef) {
  const rawRef = String(secretRef || "").trim().toUpperCase();
  if (/^DERIVED_V1_[A-F0-9]{32}$/.test(rawRef)) {
    try {
      return await deriveEndpointSigningSecret(env?.OUTBOUND_SIGNING_MASTER_SECRET, rawRef);
    } catch {
      throw new DispatcherError("webhook_secret_missing", { code:"webhook_secret_missing" });
    }
  }

  const ref = rawRef.replace(/-/g, "_");
  if (!/^[A-Z0-9_]{3,64}$/.test(ref)) {
    throw new DispatcherError("invalid_secret_ref", { code:"invalid_secret_ref" });
  }
  const key = `WEBHOOK_SECRET_${ref}`;
  const secret = String(env?.[key] || "");
  if (!secret) {
    throw new DispatcherError("webhook_secret_missing", { code:"webhook_secret_missing" });
  }
  return secret;
}

export function buildWebhookEnvelope(delivery) {
  return {
    id: delivery.event_id,
    type: delivery.event_type,
    hotel_id: delivery.hotel_id,
    received_at: delivery.event_received_at || null,
    data: delivery.event_payload && typeof delivery.event_payload === "object"
      ? delivery.event_payload
      : {},
  };
}

export function retryDelaySeconds(attempts, retryAfterHeader = null) {
  const retryAfter = Number.parseInt(String(retryAfterHeader || ""), 10);
  if (Number.isFinite(retryAfter) && retryAfter >= 5) {
    return Math.min(retryAfter, 3600);
  }
  const attempt = Math.max(1, Number(attempts) || 1);
  return Math.min(30 * (2 ** (attempt - 1)), 1800);
}

export function classifyHttpStatus(status) {
  const code = Number(status);
  if (code >= 200 && code < 300) return { outcome:"delivered", retryable:false };
  if (code === 408 || code === 425 || code === 429 || code >= 500) {
    return { outcome:"retry", retryable:true };
  }
  return { outcome:"dead_letter", retryable:false };
}

export async function claimWebhookDeliveries(config, workerName, batchSize = 5) {
  const { data } = await supabaseRpc(config, "claim_webhook_deliveries", {
    worker_name:workerName,
    batch_size:Math.max(1, Math.min(Number(batchSize) || 5, 10)),
  });
  return Array.isArray(data) ? data : [];
}

async function finishWebhookDelivery(config, delivery, {
  outcome,
  httpStatus = null,
  durationMs = null,
  errorMessage = null,
  retryDelay = 60,
}) {
  const { data } = await supabaseRpc(config, "finish_webhook_delivery", {
    delivery_uuid:delivery.delivery_id,
    outcome,
    response_status:httpStatus,
    elapsed_ms:durationMs,
    error_message:errorMessage,
    retry_delay_seconds:retryDelay,
  });
  return data;
}

function classifyError(error) {
  if (error instanceof DispatcherError) return error;
  if (error instanceof SupabaseHttpError) {
    return new DispatcherError(error.message, {
      retryable:error.retryable,
      code:`supabase_${error.status}`,
    });
  }
  if (error?.name === "AbortError") {
    return new DispatcherError("delivery_timeout", { retryable:true, code:"delivery_timeout" });
  }
  return new DispatcherError(error?.message || "delivery_network_error", {
    retryable:true,
    code:"delivery_network_error",
  });
}

export async function dispatchClaimedDelivery(config, env, delivery, {
  fetchImpl = fetch,
  nowMs = Date.now(),
  timeoutMs = 8000,
} = {}) {
  const started = Date.now();
  try {
    const allowedHosts = parseAllowedHosts(config.webhookAllowedHosts);
    const url = validateWebhookDestination(
      delivery.endpoint_url,
      delivery.endpoint_verified_host,
      allowedHosts,
    );
    const secret = await resolveWebhookSecret(env, delivery.secret_ref);
    const envelope = buildWebhookEnvelope(delivery);
    const body = JSON.stringify(envelope);
    const timestamp = String(Math.floor(nowMs / 1000));
    const signature = await hmacSha256Hex(secret, `${timestamp}.${body}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(timeoutMs, 15000)));
    let response;
    try {
      response = await fetchImpl(url.toString(), {
        method:"POST",
        redirect:"manual",
        cache:"no-store",
        signal:controller.signal,
        headers:{
          "content-type":"application/json",
          "user-agent":"StayPilot-Webhook/1.0",
          "x-staypilot-event-id":delivery.event_id,
          "x-staypilot-event-type":delivery.event_type,
          "x-staypilot-timestamp":timestamp,
          "x-staypilot-signature":`v1=${signature}`,
        },
        body,
      });
    } finally {
      clearTimeout(timer);
    }

    const durationMs = Math.max(0, Date.now() - started);
    const classification = classifyHttpStatus(response.status);
    try { await response.body?.cancel(); } catch {}

    if (classification.outcome === "delivered") {
      await finishWebhookDelivery(config, delivery, {
        outcome:"delivered",
        httpStatus:response.status,
        durationMs,
      });
      return { deliveryId:delivery.delivery_id, status:"delivered", httpStatus:response.status };
    }

    if (classification.retryable) {
      const delay = retryDelaySeconds(delivery.attempts, response.headers.get("retry-after"));
      await finishWebhookDelivery(config, delivery, {
        outcome:"retry",
        httpStatus:response.status,
        durationMs,
        errorMessage:`http_${response.status}`,
        retryDelay:delay,
      });
      return { deliveryId:delivery.delivery_id, status:"retrying", httpStatus:response.status, retryDelay:delay };
    }

    await finishWebhookDelivery(config, delivery, {
      outcome:"dead_letter",
      httpStatus:response.status,
      durationMs,
      errorMessage:`http_${response.status}`,
    });
    return { deliveryId:delivery.delivery_id, status:"dead_letter", httpStatus:response.status };
  } catch (rawError) {
    const error = classifyError(rawError);
    const durationMs = Math.max(0, Date.now() - started);
    const outcome = error.retryable ? "retry" : "dead_letter";
    const delay = error.retryable ? retryDelaySeconds(delivery.attempts) : 60;

    try {
      await finishWebhookDelivery(config, delivery, {
        outcome,
        durationMs,
        errorMessage:`${error.code}: ${error.message}`,
        retryDelay:delay,
      });
    } catch {
      // A claimed delivery keeps its lease and will be recovered by stale-lease claiming.
    }

    return {
      deliveryId:delivery.delivery_id,
      status:error.retryable ? "retrying" : "dead_letter",
      error:error.code,
      retryable:error.retryable,
      ...(error.retryable ? { retryDelay:delay } : {}),
    };
  }
}
