function normalizedKey(value) {
  const key = String(value || "").trim();
  if (!key) throw new Error("idempotency_key_required");
  return key;
}

export function assertDemoGeneration(state, command = {}) {
  if (
    command.resetGeneration !== undefined &&
    Number(command.resetGeneration) !== Number(state?.meta?.resetGeneration ?? 0)
  ) {
    throw new Error("stale_demo_generation");
  }
}

export function stableToken(value) {
  return normalizedKey(value)
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(-40) || "command";
}

export function withIdempotency(state, idempotencyKey, execute) {
  const key = normalizedKey(idempotencyKey);
  const prior = state?.commandLedger?.[key];
  if (prior) {
    const run = (state.automationRuns || []).find(item => item.id === prior.runId) || prior.run || null;
    return { state, run, duplicate:true };
  }

  const working = structuredClone(state);
  const result = execute(working, key);
  if (!result?.run?.id) throw new Error("automation_run_required");

  result.state.commandLedger = {
    ...(result.state.commandLedger || {}),
    [key]:{ runId:result.run.id },
  };
  return { ...result, duplicate:false };
}
