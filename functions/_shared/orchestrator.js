import { claimInboundEvents, processClaimedEvent } from "./worker.js";
import { claimWebhookDeliveries, dispatchClaimedDelivery, parseAllowedHosts } from "./dispatcher.js";

function countByStatus(results = []) {
  return results.reduce((acc, result) => {
    const key = String(result?.status || "unknown");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export function dispatcherConfigured(config) {
  return Boolean(
    config?.supabaseUrl &&
    config?.supabaseKey &&
    config?.dispatcherSecret &&
    config?.outboundSigningMasterSecret &&
    parseAllowedHosts(config?.webhookAllowedHosts).length > 0
  );
}

export async function runOrchestration(config, env, {
  runId = crypto.randomUUID(),
  workerBatch = 5,
  dispatcherBatch = 5,
  maxCycles = 2,
  maxDurationMs = 20_000,
} = {}, deps = {}) {
  const claimEvents = deps.claimInboundEvents || claimInboundEvents;
  const processEvent = deps.processClaimedEvent || processClaimedEvent;
  const claimDeliveries = deps.claimWebhookDeliveries || claimWebhookDeliveries;
  const dispatchDelivery = deps.dispatchClaimedDelivery || dispatchClaimedDelivery;
  const now = deps.now || Date.now;

  const safeWorkerBatch = Math.max(1, Math.min(Number(workerBatch) || 5, 10));
  const safeDispatcherBatch = Math.max(1, Math.min(Number(dispatcherBatch) || 5, 10));
  const safeCycles = Math.max(1, Math.min(Number(maxCycles) || 2, 3));
  const safeDuration = Math.max(5_000, Math.min(Number(maxDurationMs) || 20_000, 25_000));
  const startedAt = now();
  const deadline = startedAt + safeDuration;
  const workerName = `orchestrator-${runId}`;
  const dispatcherName = `orchestrator-webhook-${runId}`;
  const canDispatch = dispatcherConfigured(config);

  const workerResults = [];
  const dispatcherResults = [];
  let workerClaimed = 0;
  let dispatcherClaimed = 0;
  let cycles = 0;
  let stopped = "empty";

  for (let cycle = 0; cycle < safeCycles; cycle += 1) {
    if (now() >= deadline) {
      stopped = "time_budget";
      break;
    }

    cycles += 1;
    const events = await claimEvents(config, workerName, safeWorkerBatch);
    workerClaimed += events.length;
    for (const event of events) {
      if (now() >= deadline) {
        stopped = "time_budget";
        break;
      }
      workerResults.push(await processEvent(config, event));
    }

    let deliveries = [];
    if (canDispatch && now() < deadline) {
      deliveries = await claimDeliveries(config, dispatcherName, safeDispatcherBatch);
      dispatcherClaimed += deliveries.length;
      for (const delivery of deliveries) {
        if (now() >= deadline) {
          stopped = "time_budget";
          break;
        }
        dispatcherResults.push(await dispatchDelivery(config, env, delivery));
      }
    }

    if (stopped === "time_budget") break;

    if (events.length < safeWorkerBatch && (!canDispatch || deliveries.length < safeDispatcherBatch)) {
      stopped = "empty";
      break;
    }

    stopped = cycle + 1 >= safeCycles ? "cycle_limit" : "continuing";
  }

  const finishedAt = now();
  return {
    runId,
    cycles,
    stopped,
    durationMs:Math.max(0, finishedAt - startedAt),
    worker:{
      batchSize:safeWorkerBatch,
      claimed:workerClaimed,
      summary:countByStatus(workerResults),
      results:workerResults,
    },
    dispatcher:{
      configured:canDispatch,
      batchSize:safeDispatcherBatch,
      claimed:dispatcherClaimed,
      summary:countByStatus(dispatcherResults),
      results:dispatcherResults,
      ...(canDispatch ? {} : { skipped:"dispatcher_not_configured" }),
    },
  };
}
