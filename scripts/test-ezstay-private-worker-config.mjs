import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = readFileSync("cloudflare/wrangler.ezstay-runtime.jsonc.example", "utf8");

test("EZStay runtime Worker is not exposed on workers.dev", () => {
  assert.match(config, /"workers_dev"\s*:\s*false/);
});

test("EZStay runtime keeps the Hyperdrive binding and Node compatibility contract", () => {
  assert.match(config, /"binding"\s*:\s*"HYPERDRIVE"/);
  assert.match(config, /"nodejs_compat"/);
});

test("backend mode remains disabled in the checked-in Worker example", () => {
  assert.match(config, /"EZSTAY_BACKEND_MODE"\s*:\s*"not_configured"/);
  assert.match(config, /"EZSTAY_SCHEDULER_ENABLED"\s*:\s*"false"/);
});
