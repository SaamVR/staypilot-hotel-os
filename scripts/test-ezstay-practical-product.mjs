import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path, "utf8");

test("Operations separates active work from completed history", () => {
  const source = read("src/ezstay/pages/Operations.jsx");
  for (const label of ["Open work","Completed","All work"]) assert.match(source, new RegExp(label));
  assert.match(source, /taskView/);
  assert.match(source, /visibleTasks/);
});

test("Approvals separates pending decisions from decision history and shows linked work", () => {
  const source = read("src/ezstay/pages/Approvals.jsx");
  assert.match(source, /Pending decisions/);
  assert.match(source, /Decision history/);
  assert.match(source, /approvalView/);
  assert.match(source, /visibleApprovals/);
  assert.match(source, /Linked work/);
});

test("approval feedback reports the actual downstream result", () => {
  const source = read("src/ezstay/EZStayApp.jsx");
  assert.doesNotMatch(source, /Approval executed and purchase draft created/);
  assert.match(source, /typeof successMessage === "function"/);
  assert.match(source, /result => result\.run\?\.summary/);
});

test("Activity exposes the durable audit trail, not only runs and deliveries", () => {
  const source = read("src/ezstay/pages/Activity.jsx");
  assert.match(source, /auditEvents/);
  assert.match(source, /Audit trail/);
  assert.match(source, /actorKind/);
});

test("integration contracts are inspectable, truthful, and recovery-aware", () => {
  const source = read("src/ezstay/pages/Integrations.jsx");
  assert.match(source, /ChevronDown/);
  assert.match(source, /integration-inspect/);
  assert.match(source, /failureMode/);
  assert.match(source, /idempotency/);
  assert.match(source, /Failure handling/);
  assert.match(source, /Idempotency/);
});

test("automation registry distinguishes interactive workflows from configured rules", () => {
  const source = read("src/ezstay/pages/Automations.jsx");
  assert.match(source, /Automation registry/);
  assert.doesNotMatch(source, /Automation control/);
  assert.match(source, /Twelve configured operational rules/);
  assert.match(source, /Interactive sandbox workflow/);
  assert.match(source, /Configured rule/);
});

test("workspace status language does not imply external production connectivity", () => {
  const command = read("src/ezstay/pages/CommandCenter.jsx");
  const operations = read("src/ezstay/pages/Operations.jsx");
  assert.doesNotMatch(command, /Live operations|Automation online/);
  assert.doesNotMatch(operations, /Live hotel state/);
  assert.match(command, /Operations workspace/);
  assert.match(command, /Automation engine active/);
  assert.match(operations, /Current hotel state/);
});

test("fictional operator identity is explicit and approval semantics match the downstream work", () => {
  const app = read("src/ezstay/EZStayApp.jsx");
  const seed = read("src/ezstay/domain/seed.js");
  assert.doesNotMatch(app, /snapshot\.approvals\.find\(item => item\.requestedBy\)/);
  assert.match(app, /operatorName="Sam Rahman"/);
  assert.doesNotMatch(seed, /HVAC invoice/);
  assert.match(seed, /HVAC service authorization/);
  assert.match(seed, /requestedBy:"Maintenance desk"/);
});

test("linked records land on inspectable operating records", () => {
  const app = read("src/ezstay/EZStayApp.jsx");
  const operations = read("src/ezstay/pages/Operations.jsx");
  const approvals = read("src/ezstay/pages/Approvals.jsx");
  const activity = read("src/ezstay/pages/Activity.jsx");

  assert.match(app, /focusedRecord/);
  assert.match(app, /handleLinkedRecord/);
  assert.match(operations, /Reservations/);
  assert.match(operations, /Inventory & par levels/);
  assert.match(operations, /data-record-id/);
  assert.match(operations, /focusRecord/);
  assert.match(approvals, /focusRecord/);
  assert.match(approvals, /setApprovalView/);
  assert.match(approvals, /data-record-id/);
  assert.match(activity, /focusRecord/);
  assert.match(activity, /data-record-id/);
});

test("clock evaluation closes the environment drawer before opening run evidence", () => {
  const source = read("src/ezstay/components/DemoControl.jsx");
  assert.match(source, /const advanceClock = \(\) =>/);
  assert.match(source, /onClose\(\);[\s\S]*onAdvanceClock\?\.\(\)/);
  assert.match(source, /onClick=\{advanceClock\}/);
});

test("drawers are keyboard-accessible modal dialogs", () => {
  for (const path of ["src/ezstay/components/RunInspector.jsx","src/ezstay/components/DemoControl.jsx"]) {
    const source = read(path);
    assert.match(source, /useEffect/);
    assert.match(source, /event\.key === "Escape"/);
    assert.match(source, /role="dialog"/);
    assert.match(source, /aria-modal="true"/);
    assert.match(source, /autoFocus/);
  }
});

test("workspace exposes visible focus and practical legibility targets", () => {
  const css = read("src/ezstay/styles/app.css");
  assert.match(css, /:focus-visible/);
  assert.match(css, /Practical-product legibility/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /\.integration-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.rule-detail-grid small[^}]*font-size:10px/);
  assert.match(css, /\.rule-detail-grid b[^}]*font-size:11px/);
});

test("marketing proof metadata is not rendered at 8px", () => {
  const css = read("src/ezstay/styles/presentation.css");
  assert.match(css, /Product-story legibility/);
  assert.match(css, /\.proof-contract span[^}]*font-size:10px/);
});
