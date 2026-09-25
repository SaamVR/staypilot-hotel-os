import {
  advanceDemoClock,
  completeHousekeeping,
  resolveApproval,
  retryDelivery,
  runCheckout,
  runGuestRequest,
  runLowStock,
} from "../domain/automation.js";
import {
  BACKEND_CONTRACT_VERSION,
  DEFAULT_DEMO_NOW,
  SEED_VERSION,
} from "../domain/constants.js";
import { createNorthstarSeed } from "../domain/seed.js";

const STORAGE_KEY = "ezstay:v2:demo";
const STORAGE_SCHEMA_VERSION = 1;

function fallbackStorage() {
  const data = new Map();
  return {
    getItem:key => data.has(key) ? data.get(key) : null,
    setItem:(key, value) => data.set(key, String(value)),
    removeItem:key => data.delete(key),
  };
}

function sessionId() {
  const uuid = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
  return `demo_local_${uuid}`;
}

function newEnvelope(resetGeneration = 0) {
  const snapshot = createNorthstarSeed();
  snapshot.meta.resetGeneration = resetGeneration;
  const expiresAt = new Date(new Date(DEFAULT_DEMO_NOW).getTime() + 72 * 60 * 60 * 1000).toISOString();
  return {
    schemaVersion:STORAGE_SCHEMA_VERSION,
    session:{
      id:sessionId(),
      appKey:"ezstay",
      hotelId:snapshot.hotel.id,
      seedVersion:SEED_VERSION,
      backendContractVersion:BACKEND_CONTRACT_VERSION,
      mode:"local-preview",
      demoNow:snapshot.meta.demoNow,
      expiresAt,
      resetGeneration,
    },
    snapshot,
    runtimeLedger:{},
  };
}

function validEnvelope(value) {
  return Boolean(
    value &&
    value.schemaVersion === STORAGE_SCHEMA_VERSION &&
    value.session?.backendContractVersion === BACKEND_CONTRACT_VERSION &&
    value.session?.seedVersion === SEED_VERSION &&
    value.snapshot?.meta?.seedVersion === SEED_VERSION &&
    value.snapshot?.hotel?.id
  );
}

export function createLocalPreviewRuntime({ storage = globalThis.localStorage || fallbackStorage() } = {}) {
  let envelope = null;

  function persist() {
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  }

  function ensure() {
    if (envelope && validEnvelope(envelope)) return envelope;
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (validEnvelope(parsed)) {
          envelope = parsed;
          envelope.runtimeLedger ||= {};
          return envelope;
        }
      } catch {
        // Corrupt preview state is intentionally replaced by the canonical fixture.
      }
    }
    envelope = newEnvelope();
    persist();
    return envelope;
  }

  function syncSnapshot(snapshot) {
    const current = ensure();
    current.snapshot = snapshot;
    current.session.demoNow = snapshot.meta.demoNow;
    current.session.resetGeneration = snapshot.meta.resetGeneration;
    persist();
    return current;
  }

  async function execute(domainFn, args) {
    const current = ensure();
    const command = {
      ...args,
      resetGeneration:args?.resetGeneration ?? current.session.resetGeneration,
    };
    const result = domainFn(current.snapshot, command);
    syncSnapshot(result.state);
    return { run:result.run, snapshot:result.state, duplicate:result.duplicate };
  }

  return {
    async getSession() {
      const current = ensure();
      return { session:structuredClone(current.session), snapshot:structuredClone(current.snapshot) };
    },

    async startDemo() {
      return this.getSession();
    },

    async resetDemo({ idempotencyKey } = {}) {
      if (!idempotencyKey) throw new Error("idempotency_key_required");
      const current = ensure();
      const prior = current.runtimeLedger[idempotencyKey];
      if (prior?.type === "reset") {
        return { session:structuredClone(current.session), snapshot:structuredClone(current.snapshot), duplicate:true };
      }

      const generation = Number(current.session.resetGeneration || 0) + 1;
      const replacement = newEnvelope(generation);
      replacement.runtimeLedger = {
        ...current.runtimeLedger,
        [idempotencyKey]:{ type:"reset", generation },
      };
      envelope = replacement;
      persist();
      return { session:structuredClone(envelope.session), snapshot:structuredClone(envelope.snapshot), duplicate:false };
    },

    runGuestRequest(args) {
      return execute(runGuestRequest, args);
    },

    runCheckout(args) {
      return execute(runCheckout, args);
    },

    completeHousekeeping(args) {
      return execute(completeHousekeeping, args);
    },

    runLowStock(args) {
      return execute(runLowStock, args);
    },

    resolveApproval(args) {
      return execute(resolveApproval, args);
    },

    retryDelivery(args) {
      return execute(retryDelivery, args);
    },

    advanceClock(args) {
      return execute(advanceDemoClock, args);
    },

    async getRun(runId) {
      const current = ensure();
      const run = current.snapshot.automationRuns.find(item => item.id === runId);
      if (!run) throw new Error("run_not_found");
      return { run:structuredClone(run) };
    },
  };
}
