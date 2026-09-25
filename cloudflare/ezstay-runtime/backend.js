const METHODS = [
  "getSession",
  "startDemo",
  "resetDemo",
  "getSnapshot",
  "runGuestRequest",
  "runCheckout",
  "runLowStock",
  "resolveApproval",
  "retryDelivery",
  "advanceClock",
  "getRun",
];

async function unavailable() {
  throw new Error("backend_not_configured");
}

export function createBackendAdapter(env = {}) {
  const bound = env.EZSTAY_BACKEND;
  if (!bound) {
    return Object.fromEntries(METHODS.map(name => [name, unavailable]));
  }

  const adapter = {};
  for (const name of METHODS) {
    adapter[name] = typeof bound[name] === "function"
      ? context => bound[name](context)
      : unavailable;
  }
  return adapter;
}
