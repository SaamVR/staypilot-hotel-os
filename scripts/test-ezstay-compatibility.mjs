import test from "node:test";
import assert from "node:assert/strict";
import { buildEzstayBackendHealth } from "../functions/_shared/ezstay/compatibility.js";

test("backend health reports frozen contract and fail-closed default mode", () => {
  const health = buildEzstayBackendHealth({});
  assert.deepEqual(health, {
    ok:true,
    app:"ezstay",
    contractVersion:"ezstay-backend-v1",
    mode:"not_configured",
    authConfigured:false,
    runtimeConfigured:false,
    schedulerEnabled:false,
  });
});

test("backend health reports configured components without exposing secrets", () => {
  const health = buildEzstayBackendHealth({
    EZSTAY_BACKEND_MODE:"configured",
    EZSTAY_RUNTIME:{ fetch(){} },
    SUPABASE_URL:"https://project.supabase.co",
    SUPABASE_PUBLISHABLE_KEY:"publishable",
    EZSTAY_SCHEDULER_ENABLED:"true",
    SECRET_VALUE:"must-not-appear",
  });
  assert.equal(health.mode, "configured");
  assert.equal(health.authConfigured, true);
  assert.equal(health.runtimeConfigured, true);
  assert.equal(health.schedulerEnabled, true);
  assert.equal(JSON.stringify(health).includes("must-not-appear"), false);
});
