import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/deploy-ezstay-v2.yml", "utf8");
const docs = readFileSync("docs/deployment/ezstay-cloudflare.md", "utf8");

test("EZStay deploy requires explicit backend enablement before private runtime deployment", () => {
  assert.match(workflow, /EZSTAY_BACKEND_ENABLE/);
  assert.match(workflow, /EZSTAY_HYPERDRIVE_ID/);
  assert.match(workflow, /SUPABASE_URL/);
  assert.match(workflow, /SUPABASE_PUBLISHABLE_KEY/);
  assert.match(workflow, /TURNSTILE_SITE_KEY/);
});

test("backend-ready deployment creates the private Worker before Pages service binding", () => {
  const workerIndex = workflow.indexOf("Deploy private EZStay runtime Worker");
  const pagesIndex = workflow.indexOf("Deploy backend-enabled EZStay Pages");
  assert.ok(workerIndex >= 0, "private Worker deploy step");
  assert.ok(pagesIndex > workerIndex, "Pages deploy follows Worker deploy");
  assert.match(workflow, /"binding":"EZSTAY_RUNTIME","service":"ezstay-runtime"/);
});

test("local-preview deployment remains available without backend credentials", () => {
  assert.match(workflow, /Deploy local-preview EZStay Pages/);
  assert.match(workflow, /backend_ready\.outputs\.available != 'true'/);
});

test("deployment docs describe implemented Hyperdrive adapter and private workers.dev boundary", () => {
  assert.match(docs, /hyperdriveBackend\.js/);
  assert.match(docs, /workers_dev.*false/i);
  assert.match(docs, /TURNSTILE_SITE_KEY/);
});
