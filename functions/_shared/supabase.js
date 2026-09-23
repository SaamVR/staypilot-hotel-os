export class SupabaseHttpError extends Error {
  constructor(message, status, body = null) {
    super(message);
    this.name = "SupabaseHttpError";
    this.status = status;
    this.body = body;
    this.retryable = status === 429 || status >= 500;
  }
}

function buildHeaders(config, extra = {}) {
  return {
    apikey: config.supabaseKey,
    authorization: `Bearer ${config.supabaseKey}`,
    "content-type": "application/json",
    ...extra,
  };
}

export async function supabaseRequest(config, path, {
  method = "GET",
  body,
  prefer,
  headers = {},
} = {}) {
  if (!config?.supabaseUrl || !config?.supabaseKey) {
    throw new SupabaseHttpError("supabase_not_configured", 503);
  }

  const response = await fetch(`${config.supabaseUrl}${path}`, {
    method,
    headers: buildHeaders(config, {
      ...(prefer ? { prefer } : {}),
      ...headers,
    }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = text; }
  }

  if (!response.ok) {
    throw new SupabaseHttpError("supabase_request_failed", response.status, data);
  }

  return { status: response.status, data, headers: response.headers };
}

export async function supabaseRpc(config, functionName, args = {}) {
  return supabaseRequest(config, `/rest/v1/rpc/${encodeURIComponent(functionName)}`, {
    method: "POST",
    body: args,
  });
}

export function eq(value) {
  return `eq.${encodeURIComponent(String(value))}`;
}

export function selectQuery(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) query.set(key, String(value));
  }
  return query.toString();
}
