import { claimInboundEvents, processClaimedEvent } from "./worker.js";
import { claimWebhookDeliveries, dispatchClaimedDelivery } from "./dispatcher.js";

function boundedInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(Math.trunc(n), max));
}

function summarize(results = []) {
  return results.reduce((acc, result) => {
    const key = result?.status || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export async function runOrchestration(config, env, {
  cycles = 2,
  workerBatch = 5,
  dispatcherBatch = 5,
  workerPrefix = "orchestrator",
} = {}) {
  const maxCycles = boundedInt(cycles, 2, 1, 3);
  const workerLimit = boundedInt(workerBatch, 5, 1, 10);
  const dispatcherLimit = boundedInt(dispatcherBatch, 5, 1, 10);

  const canDispatch = Boolean(
    config?.webhookAllowedHosts &&
    config?.outboundSigningMasterSecret
  );

  const runId = crypto.randomUUID();
  const cycleResults = [];
  let totalWorkerClaimed = 0;
  let totalDispatcherClaimed = 0;
  const workerResults = [];
  const dispatcherResults = [];

  for (let index = 0; index < maxCycles; index += 1) {
    const workerName = `${workerPrefix}-worker-${runId}-${index + 1}`;
    const events = await claimInboundEvents(config, workerName, workerLimit);
    const processedEvents = [];
    for (const event of events) {
      const result = await processClaimedEvent(config, event);
      processedEvents.push(result);
      workerResults.push(result);
    }
    totalWorkerClaimed += events.length;

    let deliveries = [];
    const dispatched = [];
    if (canDispatch) {
      const dispatcherName = `${workerPrefix}-dispatcher-${runId}-${index + 1}`;
      deliveries = await claimWebhookDeliveries(config, dispatcherName, dispatcherLimit);
      for (const delivery of deliveries) {
        const result = await dispatchClaimedDelivery(config, env, delivery);
        dispatched.push(result);
        dispatcherResults.push(result);
      }
      totalDispatcherClaimed += deliveries.length;
    }

    cycleResults.push({
      cycle:index + 1,
      worker_claimed:events.length,
      worker_summary:summarize(processedEvents),
      dispatcher_enabled:canDispatch,
      dispatcher_claimed:deliveries.length,
      dispatcher_summary:summarize(dispatched),
    });

    if (events.length === 0 && deliveries.length === 0) break;
  }

  return {
    orchestration_id:runId,
    cycles:cycleResults.length,
    worker_claimed:totalWorkerClaimed,
    worker_summary:summarize(workerResults),
    dispatcher_enabled:canDispatch,
    dispatcher_claimed:totalDispatcherClaimed,
    dispatcher_summary:summarize(dispatcherResults),
    cycle_results:cycleResults,
  };
}
