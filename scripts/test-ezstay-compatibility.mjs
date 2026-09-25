import test from "node:test";
import assert from "node:assert/strict";
import { buildEzstayBackendHealth, buildEzstayPublicConfig } from "../functions/_shared/ezstay/compatibility.js";

test("backend health reports frozen contract and fail-closed default mode", () => {
  const health = buildEzstayBackendHealth({});
  assert.deepEqual(health, {
    ok:true,
    app:"ezstay",
    contractVersion:"ezstay-backend-v1",
    mode:"not_configured",
    authConfigured:false,
    runtimeConfigured:false,
    turnstileConfigured:false,
    schedulerEnabled:false,
  });
});

test("backend health reports configured components without exposing secrets", () => {
  const health = buildEzstayBackendHealth({
    EZSTAY_BACKEND_MODE:"configured",
    EZSTAY_RUNTIME:{ fetch(){} },
    SUPABASE_URL:"https://project.supabase.co",
    SUPABASE_PUBLISHABLE_KEY:"publishable",
    TURNSTILE_SITE_KEY:"site_public_123",
    EZSTAY_SCHEDULER_ENABLED:"true",
    SECRET_VALUE:"must-not-appear",
  });
  assert.equal(health.mode, "configured");
  assert.equal(health.authConfigured, true);
  assert.equal(health.runtimeConfigured, true);
  assert.equal(health.turnstileConfigured, true);
  assert.equal(health.schedulerEnabled, true);
  assert.equal(JSON.stringify(health).includes("must-not-appear"), false);
});

test("backend stays fail-closed when Turnstile public configuration is missing", () => {
  const health = buildEzstayBackendHealth({
    EZSTAY_BACKEND_MODE:"configured",
    EZSTAY_RUNTIME:{ fetch(){} },
    SUPABASE_URL:"https://project.supabase.co",
    SUPABASE_PUBLISHABLE_KEY:"publishable",
  });
  assert.equal(health.mode, "not_configured");
  assert.equal(health.turnstileConfigured, false);
});

test("public config exposes only browser-safe backend values", () => {
  const config = buildEzstayPublicConfig({
    EZSTAY_BACKEND_MODE:"configured",
    EZSTAY_RUNTIME:{ fetch(){} },
    SUPABASE_URL:"https://project.supabase.co",
    SUPABASE_PUBLISHABLE_KEY:"publishable",
    TURNSTILE_SITE_KEY:"site_public_123",
    SUPABASE_SECRET_KEY:"never",
    DATABASE_URL:"never",
  });
  assert.deepEqual(config, {
    app:"ezstay",
    contractVersion:"ezstay-backend-v1",
    mode:"configured",
    supabaseUrl:"https://project.supabase.co",
    supabasePublishableKey:"publishable",
    turnstileSiteKey:"site_public_123",
  });
  assert.equal(JSON.stringify(config).includes("never"), false);
});
