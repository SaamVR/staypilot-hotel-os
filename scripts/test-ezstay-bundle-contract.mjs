import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bootstrap = readFileSync("src/ezstay/runtime/bootstrap.js", "utf8");

test("Supabase anonymous Auth is loaded only when backend sandbox construction is requested", () => {
  assert.doesNotMatch(bootstrap, /import\s+\{\s*createSupabaseAnonymousAuth\s*\}\s+from\s+["']\.\/supabaseAnonymousAuth\.js["']/);
  assert.match(bootstrap, /await\s+import\(["']\.\/supabaseAnonymousAuth\.js["']\)/);
});

test("dependency injection remains supported so backend bootstrap stays unit-testable", () => {
  assert.match(bootstrap, /createAuthImpl/);
  assert.match(bootstrap, /createHttpRuntimeImpl/);
});
