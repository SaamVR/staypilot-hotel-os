import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("Operations exposes practical room and work filters without changing state authority", () => {
  const source = readFileSync("src/ezstay/pages/Operations.jsx", "utf8");
  assert.match(source, /useState/);
  for (const label of ["All rooms","Needs attention","Reserved","Blocked"]) assert.match(source, new RegExp(label));
  for (const label of ["All teams","Housekeeping","Maintenance","Front desk"]) assert.match(source, new RegExp(label));
  assert.match(source, /filteredRooms/);
  assert.match(source, /filteredTasks/);
});

test("Automations can be filtered by authority instead of acting like a static poster grid", () => {
  const source = readFileSync("src/ezstay/pages/Automations.jsx", "utf8");
  assert.match(source, /useState/);
  for (const label of ["All rules","Auto","Policy","Approval"]) assert.match(source, new RegExp(label));
  assert.match(source, /filteredRules/);
  assert.match(source, /automation-filter-bar/);
});

test("Integrations expose inspectable adapter contracts while keeping credential state truthful", () => {
  const source = readFileSync("src/ezstay/pages/Integrations.jsx", "utf8");
  assert.match(source, /Inspect adapter/);
  assert.match(source, /Not connected/);
  assert.match(source, /Transport/);
  assert.match(source, /Event scope/);
  assert.match(source, /Credentials/);
  assert.doesNotMatch(source, /Connected successfully|Live connection/i);
});

test("workspace chrome includes a fictional operator identity tied to Northstar context", () => {
  const source = readFileSync("src/ezstay/components/AppShell.jsx", "utf8");
  assert.match(source, /operatorName/);
  assert.match(source, /Owner/);
  assert.match(source, /operator-card/);
});

test("marketing hero leads with the product, while sandbox disclosure remains explicit elsewhere", () => {
  const landing = readFileSync("src/ezstay/components/MarketingLanding.jsx", "utf8");
  const entry = readFileSync("src/ezstay/domain/entry.js", "utf8");
  assert.match(landing, /Hotel operations automation<\/span>/);
  assert.doesNotMatch(landing, /Hotel operations automation · sandbox workspace/);
  assert.match(entry, /Sample Northstar Grand workspace/);
});
