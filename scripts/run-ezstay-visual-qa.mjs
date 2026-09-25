import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.EZSTAY_QA_URL || "http://127.0.0.1:4177";
const outDir = process.env.EZSTAY_QA_OUT || "qa-artifacts";
await mkdir(outDir, { recursive:true });

const report = { baseURL, startedAt:new Date().toISOString(), pages:[], consoleErrors:[], pageErrors:[] };

function captureErrors(page, label) {
  page.on("console", message => {
    if (message.type() === "error") report.consoleErrors.push({ label, text:message.text() });
  });
  page.on("pageerror", error => {
    report.pageErrors.push({ label, text:error?.stack || error?.message || String(error) });
  });
}

async function expectVisible(locator, description) {
  assert.equal(await locator.first().isVisible(), true, description);
}

async function screenshot(page, name) {
  const path = `${outDir}/${name}.png`;
  await page.screenshot({ path, fullPage:true });
  report.pages.push({ name, url:page.url(), path });
}

async function openLanding(page) {
  await page.route("**/api/ezstay/backend-health", route => route.fulfill({
    status:200,
    contentType:"application/json",
    body:JSON.stringify({
      ok:true,
      app:"ezstay",
      contractVersion:"ezstay-backend-v1",
      mode:"not_configured",
      authConfigured:false,
      runtimeConfigured:false,
      turnstileConfigured:false,
      schedulerEnabled:false,
    }),
  }));
  await page.route("**/api/ezstay/public-config", route => route.fulfill({
    status:200,
    contentType:"application/json",
    body:JSON.stringify({
      app:"ezstay",
      contractVersion:"ezstay-backend-v1",
      mode:"not_configured",
    }),
  }));
  await page.goto(baseURL, { waitUntil:"networkidle" });
  await expectVisible(page.getByText("Hotel operations that", { exact:false }), "landing hero should render");
  await expectVisible(page.getByRole("button", { name:"Explore interactive demo" }).first(), "landing CTA should render");
  assert.equal(await page.locator(".vite-error-overlay").count(), 0, "Vite error overlay must not render");
}

async function enterDemo(page) {
  await page.getByRole("button", { name:"Explore interactive demo" }).first().click();
  await page.waitForURL(/#demo$/);
  await expectVisible(page.getByRole("heading", { name:"Command Center" }), "workspace should open on Command Center");
  await expectVisible(page.getByRole("button", { name:"Sandbox environment" }), "sandbox boundary should remain available");
  await expectVisible(page.getByText("hotel time"), "workspace chrome should expose hotel time");
}

async function runScenario(page, title) {
  await page.getByRole("button", { name:"Sandbox environment" }).click();
  const panel = page.locator(".demo-control-drawer[role='dialog'][aria-modal='true']");
  await panel.waitFor({ state:"visible" });
  const row = panel.locator(".sandbox-scenario-row").filter({ hasText:title });
  await expectVisible(row, `scenario control should render: ${title}`);
  await row.click();
  const inspector = page.locator(".run-drawer[role='dialog'][aria-modal='true']");
  await inspector.waitFor({ state:"visible" });
  for (const heading of ["Input","Decision","Changes","Delivery","Audit","Linked records"]) {
    await expectVisible(inspector.getByRole("heading", { name:heading }), `inspector section should render: ${heading}`);
  }
  return inspector;
}

const browser = await chromium.launch({ headless:true });

try {
  const desktop = await browser.newContext({ viewport:{ width:1440, height:1000 }, deviceScaleFactor:1 });
  const page = await desktop.newPage();
  captureErrors(page, "desktop");
  await openLanding(page);
  await screenshot(page, "01-landing-desktop");

  await enterDemo(page);
  await expectVisible(page.locator(".operator-card").filter({ hasText:"Sam Rahman" }), "desktop workspace should expose the Northstar operator identity");
  await expectVisible(page.locator(".operator-card").filter({ hasText:"Owner" }), "desktop operator role should be visible");
  await screenshot(page, "02-command-center-desktop");

  let inspector = await runScenario(page, "Guest request → assigned task");
  assert.match(await inspector.innerText(), /Housekeeping/i);
  await screenshot(page, "03-guest-request-inspector");
  await inspector.getByRole("button", { name:"Close run inspector" }).click();

  inspector = await runScenario(page, "Checkout → room ready");
  assert.match(await inspector.innerText(), /turnover|vacant|dirty/i);
  const reservationLink = inspector.locator(".linked-list button").filter({ hasText:"EZ-1047" });
  await expectVisible(reservationLink, "checkout run should link to the source reservation");
  await reservationLink.click();

  await expectVisible(page.getByRole("heading", { name:"Operations" }), "linked reservation should open Operations");
  await expectVisible(page.locator(".record-focus").filter({ hasText:"Noah Williams" }), "linked reservation should be visible and focused");
  await expectVisible(page.getByRole("heading", { name:"Stays & arrivals" }), "Operations should expose reservation state");
  await expectVisible(page.getByRole("heading", { name:"Inventory & par levels" }), "Operations should expose inventory state");
  const turnover = page.locator(".list-row").filter({ hasText:"Room 108 · Full turnover" });
  await expectVisible(turnover, "room 108 turnover task should exist");
  await expectVisible(turnover.getByRole("button", { name:"Complete turnover" }), "turnover completion action should render");
  await screenshot(page, "04-operations-turnover");

  await page.getByRole("button", { name:"Needs attention" }).click();
  await expectVisible(page.locator(".room-tile").filter({ hasText:"108" }), "dirty room 108 should remain in the needs-attention filter");
  await expectVisible(page.locator(".room-tile").filter({ hasText:"207" }), "blocked room 207 should remain in the needs-attention filter");
  await page.getByRole("button", { name:"All rooms" }).click();

  await page.getByRole("button", { name:"Maintenance" }).click();
  await expectVisible(page.locator(".list-row").filter({ hasText:"Room 207 · HVAC inspection" }), "maintenance team filter should isolate maintenance work");
  await screenshot(page, "04b-operations-filtered");
  await page.getByRole("button", { name:"All teams" }).click();

  await turnover.getByRole("button", { name:"Complete turnover" }).click();
  inspector = page.locator(".run-drawer[role='dialog'][aria-modal='true']");
  await inspector.waitFor({ state:"visible" });
  assert.match(await inspector.innerText(), /sellable|readiness|Clean/i);
  await inspector.getByRole("button", { name:"Close run inspector" }).click();
  await page.getByRole("button", { name:/Completed/ }).click();
  const completedTurnover = page.locator(".list-row").filter({ hasText:"Room 108 · Full turnover" });
  await expectVisible(completedTurnover, "completed turnover should move into task history");
  assert.match(await completedTurnover.innerText(), /Done/i);

  await page.getByRole("button", { name:"Command Center" }).click();
  inspector = await runScenario(page, "Low stock → approval");
  const inventoryLink = inspector.locator(".linked-list button").filter({ hasText:"Queen bed sheets" });
  await expectVisible(inventoryLink, "low-stock run should link to the inventory item");
  await inventoryLink.click();
  await expectVisible(page.locator(".record-focus").filter({ hasText:"Queen bed sheets" }), "linked inventory should be visible and focused");
  await page.getByRole("button", { name:"Approvals" }).click();
  await expectVisible(page.getByRole("heading", { name:"Approvals" }), "Approvals page should render");
  const stockApproval = page.locator(".approval-card").filter({ hasText:"Queen bed sheet restock" });
  await expectVisible(stockApproval, "stock approval should be visible");
  await screenshot(page, "05-approvals");
  await stockApproval.getByRole("button", { name:"Approve" }).click();
  inspector = page.locator(".run-drawer[role='dialog'][aria-modal='true']");
  await inspector.waitFor({ state:"visible" });
  assert.match(await inspector.innerText(), /purchase draft|approved/i);
  const approvalLink = inspector.locator(".linked-list button").filter({ hasText:"Queen bed sheet restock" });
  await expectVisible(approvalLink, "approval run should link to the resolved decision");
  await approvalLink.click();
  const historyView = page.locator(".approval-view-filter button.active").filter({ hasText:"Decision history" });
  await historyView.waitFor({ state:"visible" });
  const focusedApproval = page.locator(".approval-card.record-focus").filter({ hasText:"Queen bed sheet restock" });
  await focusedApproval.waitFor({ state:"visible" });
  await expectVisible(page.getByRole("heading", { name:"Purchase drafts" }), "approved stock request should create a purchase draft");
  await expectVisible(page.getByText("Coastal Textile").first(), "purchase draft should expose its supplier");
  await screenshot(page, "06-approved-purchase-draft");

  await page.getByRole("button", { name:"Command Center" }).click();
  inspector = await runScenario(page, "Failure → safe recovery");
  assert.match(await inspector.innerText(), /without replaying|delivery/i);
  const deliveryLink = inspector.locator(".linked-list button").filter({ hasText:/operations webhook/i });
  await expectVisible(deliveryLink, "recovery run should link to the recovered delivery");
  await deliveryLink.click();
  await expectVisible(page.getByRole("heading", { name:"Activity" }), "linked delivery should open Activity");
  await expectVisible(page.locator(".delivery-row.record-focus").filter({ hasText:"DLV-400" }), "linked delivery should be visible and focused");
  const recoveryDelivery = page.locator(".list-row").filter({ hasText:"DLV-400" });
  await expectVisible(recoveryDelivery, "seeded failed delivery should remain traceable");
  assert.match(await recoveryDelivery.innerText(), /Delivered/i);
  await screenshot(page, "07-activity-recovery");

  await page.getByRole("button", { name:"Automations" }).click();
  await expectVisible(page.getByRole("heading", { name:"Automations" }), "Automations page should render");
  await expectVisible(page.getByText("Last run").first(), "automation cards should expose execution state");
  await page.getByRole("button", { name:/Policy/ }).click();
  await expectVisible(page.getByText("Occupancy rate guard"), "policy filter should include occupancy guard");
  await expectVisible(page.getByText("Low-stock replenishment"), "policy filter should include replenishment policy");
  await screenshot(page, "08-automations-policy");
  await page.getByRole("button", { name:/All rules/ }).click();
  await screenshot(page, "08b-automations-all");

  await page.getByRole("button", { name:"Integrations" }).click();
  await expectVisible(page.getByRole("heading", { name:"Integrations" }), "Integrations page should render");
  await expectVisible(page.getByText("Live credentials"), "integration boundary should be explicit");
  const integrationCards = page.locator("details.integration-contract");
  assert.equal(await integrationCards.count(), 5, "five practical adapter contracts should be defined");
  for (let index = 0; index < await integrationCards.count(); index += 1) {
    const card = integrationCards.nth(index);
    await card.locator("summary").click();
    await expectVisible(card.getByText("Transport"), "adapter inspection should expose transport");
    await expectVisible(card.getByText("Event scope"), "adapter inspection should expose event scope");
    await expectVisible(card.getByText("Failure handling"), "adapter inspection should expose failure handling");
    await expectVisible(card.getByText("Idempotency"), "adapter inspection should expose idempotency strategy");
    await expectVisible(card.getByText("Credentials"), "adapter inspection should expose credential requirements");
  }
  const pmsAdapter = integrationCards.filter({ hasText:"PMS / booking engine" });
  await expectVisible(pmsAdapter.getByText("Webhook + REST"), "PMS adapter transport should be explicit");
  await screenshot(page, "09-integrations");

  await page.getByRole("button", { name:"Activity" }).click();

  await page.reload({ waitUntil:"networkidle" });
  await expectVisible(page.getByRole("button", { name:"Sandbox environment" }), "workspace should survive reload");
  await page.getByRole("button", { name:"Activity" }).click();
  const persistedDelivery = page.locator(".list-row").filter({ hasText:"DLV-400" });
  await expectVisible(persistedDelivery, "recovered delivery should persist through reload");
  assert.match(await persistedDelivery.innerText(), /Delivered/i);

  await page.getByRole("button", { name:"Sandbox environment" }).click();
  await expectVisible(page.getByText("Advance +30 min"), "Demo control should expose deterministic clock");
  await screenshot(page, "10-demo-control");
  await page.getByRole("button", { name:"Reset workspace" }).click();
  await expectVisible(page.getByText("Northstar workspace reset to the canonical sandbox state."), "reset should confirm a fresh generation");
  await page.getByRole("button", { name:"Activity" }).click();
  const resetDelivery = page.locator(".list-row").filter({ hasText:"DLV-400" });
  await expectVisible(resetDelivery, "reset should restore the seeded failed delivery");
  assert.match(await resetDelivery.innerText(), /Dead-letter/i);
  await screenshot(page, "11-reset-restored-state");

  await page.getByRole("button", { name:"Approvals" }).click();
  const maintenanceApproval = page.locator(".approval-card").filter({ hasText:"Room 207 HVAC service authorization" });
  await expectVisible(maintenanceApproval, "maintenance authorization should be a real pending decision");
  await maintenanceApproval.getByRole("button", { name:"Approve" }).click();
  inspector = page.locator(".run-drawer[role='dialog'][aria-modal='true']");
  await inspector.waitFor({ state:"visible" });
  assert.match(await inspector.innerText(), /maintenance approved|authorized and in progress/i);
  const maintenanceTaskLink = inspector.locator(".linked-list button").filter({ hasText:"HVAC inspection" });
  await expectVisible(maintenanceTaskLink, "maintenance approval should link to the authorized work");
  await maintenanceTaskLink.click();
  await expectVisible(page.locator(".record-focus").filter({ hasText:"HVAC inspection" }), "authorized maintenance task should be visible and focused");
  assert.match(await page.locator(".record-focus").filter({ hasText:"HVAC inspection" }).innerText(), /In progress/i);

  await page.getByRole("button", { name:"Approvals" }).click();
  await page.getByRole("button", { name:/Decision history/ }).click();
  const resolvedMaintenance = page.locator(".approval-card").filter({ hasText:"Room 207 HVAC service authorization" });
  await expectVisible(resolvedMaintenance, "resolved maintenance decision should remain in history");
  assert.match(await resolvedMaintenance.innerText(), /Approved/i);

  await page.getByRole("button", { name:"Sandbox environment" }).click();
  const clockPanel = page.locator(".demo-control-drawer[role='dialog'][aria-modal='true']");
  await clockPanel.waitFor({ state:"visible" });
  await clockPanel.getByRole("button", { name:/Advance \+30 min/ }).click();
  await clockPanel.waitFor({ state:"hidden" });
  inspector = page.locator(".run-drawer[role='dialog'][aria-modal='true']");
  await inspector.waitFor({ state:"visible" });
  assert.match(await inspector.innerText(), /Demo clock advanced by 30 minutes/i);
  await inspector.getByRole("button", { name:"Close run inspector" }).click();

  await page.getByRole("button", { name:"Activity" }).click();
  await expectVisible(page.locator(".delivery-row").filter({ hasText:"Demo operations alert" }).first(), "SLA escalation must materialize in the delivery outbox");
  await expectVisible(page.getByRole("heading", { name:"Audit trail" }), "Activity should expose the operator audit trail");
  await expectVisible(page.locator(".audit-row").filter({ hasText:"Overdue task escalated" }).first(), "SLA escalation should remain audit-visible");
  await screenshot(page, "11b-maintenance-and-sla");

  await desktop.close();

  const mobile = await browser.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:1 });
  const mobilePage = await mobile.newPage();
  captureErrors(mobilePage, "mobile-390");
  await openLanding(mobilePage);
  await screenshot(mobilePage, "12-landing-mobile-390");
  await enterDemo(mobilePage);
  await screenshot(mobilePage, "13-workspace-mobile-390");
  await expectVisible(mobilePage.locator(".workspace-context b").filter({ hasText:"Northstar Grand" }), "property identity should remain visible on mobile");
  await expectVisible(mobilePage.getByRole("button", { name:"Sandbox environment" }), "sandbox environment should remain reachable on mobile");
  for (const label of ["Command","Operations","Automations","Approvals","Activity","Integrations"]) {
    const navButton = mobilePage.locator(".primary-nav button").filter({ hasText:label });
    const navLabel = navButton.locator("span");
    await expectVisible(navLabel, `mobile navigation label should remain visible: ${label}`);
    const fontSize = await navLabel.evaluate(node => Number.parseFloat(getComputedStyle(node).fontSize));
    assert.ok(fontSize >= 10, `mobile navigation label should remain legible: ${label}`);
  }
  assert.equal(
    await mobilePage.evaluate(() => document.documentElement.scrollWidth <= globalThis.innerWidth),
    true,
    "mobile workspace must not overflow horizontally"
  );
  await mobilePage.getByRole("button", { name:"Operations" }).click();
  await expectVisible(mobilePage.getByRole("heading", { name:"Inventory & par levels" }), "mobile Operations should retain inventory context");
  assert.equal(
    await mobilePage.evaluate(() => document.documentElement.scrollWidth <= globalThis.innerWidth),
    true,
    "mobile Operations must not overflow horizontally"
  );
  await screenshot(mobilePage, "13b-operations-mobile-390");
  await mobile.close();

  const tablet = await browser.newContext({ viewport:{ width:768, height:1024 }, deviceScaleFactor:1 });
  const tabletPage = await tablet.newPage();
  captureErrors(tabletPage, "tablet-768");
  await openLanding(tabletPage);
  await screenshot(tabletPage, "14-landing-tablet-768");
  await enterDemo(tabletPage);
  await screenshot(tabletPage, "15-workspace-tablet-768");
  await tablet.close();

  const reduced = await browser.newContext({
    viewport:{ width:390, height:844 },
    deviceScaleFactor:1,
    reducedMotion:"reduce",
  });
  const reducedPage = await reduced.newPage();
  captureErrors(reducedPage, "reduced-motion");
  await openLanding(reducedPage);
  await enterDemo(reducedPage);
  await reducedPage.getByRole("button", { name:"Sandbox environment" }).click();
  await reducedPage.locator(".demo-control-drawer[role='dialog'][aria-modal='true']").waitFor({ state:"visible" });
  assert.equal(
    await reducedPage.evaluate(() => document.getAnimations().filter(animation => animation.playState !== "finished").length),
    0,
    "reduced-motion users should not receive active interface animations"
  );
  await reduced.close();

  assert.deepEqual(report.consoleErrors, [], "browser console must contain no errors");
  assert.deepEqual(report.pageErrors, [], "page must contain no uncaught errors");
  report.result = "pass";
} catch (error) {
  report.result = "fail";
  report.failure = error?.stack || error?.message || String(error);
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(`${outDir}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
