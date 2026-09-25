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
  const panel = page.getByLabel("Sandbox environment panel");
  await panel.waitFor({ state:"visible" });
  const row = panel.locator(".sandbox-scenario-row").filter({ hasText:title });
  await expectVisible(row, `scenario control should render: ${title}`);
  await row.click();
  const inspector = page.getByLabel("Automation run inspector");
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
  await screenshot(page, "02-command-center-desktop");

  let inspector = await runScenario(page, "Guest request → assigned task");
  assert.match(await inspector.innerText(), /Housekeeping/i);
  await screenshot(page, "03-guest-request-inspector");
  await inspector.getByRole("button", { name:"Close run inspector" }).click();

  inspector = await runScenario(page, "Checkout → room ready");
  assert.match(await inspector.innerText(), /turnover|vacant|dirty/i);
  await inspector.getByRole("button", { name:"Close run inspector" }).click();

  await page.getByRole("button", { name:"Operations" }).click();
  await expectVisible(page.getByRole("heading", { name:"Operations" }), "Operations page should render");
  const turnover = page.locator(".list-row").filter({ hasText:"Room 108 · Full turnover" });
  await expectVisible(turnover, "room 108 turnover task should exist");
  await expectVisible(turnover.getByRole("button", { name:"Complete turnover" }), "turnover completion action should render");
  await screenshot(page, "04-operations-turnover");
  await turnover.getByRole("button", { name:"Complete turnover" }).click();
  inspector = page.getByLabel("Automation run inspector");
  await inspector.waitFor({ state:"visible" });
  assert.match(await inspector.innerText(), /sellable|readiness|Clean/i);
  await inspector.getByRole("button", { name:"Close run inspector" }).click();
  assert.match(await turnover.innerText(), /Done/i);

  await page.getByRole("button", { name:"Command Center" }).click();
  inspector = await runScenario(page, "Low stock → approval");
  await inspector.getByRole("button", { name:"Close run inspector" }).click();
  await page.getByRole("button", { name:"Approvals" }).click();
  await expectVisible(page.getByRole("heading", { name:"Approvals" }), "Approvals page should render");
  const stockApproval = page.locator(".approval-card").filter({ hasText:"Queen bed sheet restock" });
  await expectVisible(stockApproval, "stock approval should be visible");
  await screenshot(page, "05-approvals");
  await stockApproval.getByRole("button", { name:"Approve" }).click();
  inspector = page.getByLabel("Automation run inspector");
  await inspector.waitFor({ state:"visible" });
  assert.match(await inspector.innerText(), /purchase draft|approved/i);
  await inspector.getByRole("button", { name:"Close run inspector" }).click();
  await expectVisible(page.getByRole("heading", { name:"Purchase drafts" }), "approved stock request should create a purchase draft");
  await expectVisible(page.getByText("Coastal Textile").first(), "purchase draft should expose its supplier");
  await screenshot(page, "06-approved-purchase-draft");

  await page.getByRole("button", { name:"Command Center" }).click();
  inspector = await runScenario(page, "Failure → safe recovery");
  assert.match(await inspector.innerText(), /without replaying|delivery/i);
  await inspector.getByRole("button", { name:"Close run inspector" }).click();
  await page.getByRole("button", { name:"Activity" }).click();
  await expectVisible(page.getByRole("heading", { name:"Activity" }), "Activity page should render");
  const recoveryDelivery = page.locator(".list-row").filter({ hasText:"DLV-400" });
  await expectVisible(recoveryDelivery, "seeded failed delivery should remain traceable");
  assert.match(await recoveryDelivery.innerText(), /Delivered/i);
  await screenshot(page, "07-activity-recovery");

  await page.getByRole("button", { name:"Automations" }).click();
  await expectVisible(page.getByRole("heading", { name:"Automations" }), "Automations page should render");
  await expectVisible(page.getByText("Last run").first(), "automation cards should expose execution state");
  await screenshot(page, "08-automations");

  await page.getByRole("button", { name:"Integrations" }).click();
  await expectVisible(page.getByRole("heading", { name:"Integrations" }), "Integrations page should render");
  await expectVisible(page.getByText("Live credentials"), "integration boundary should be explicit");
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
  await desktop.close();

  const mobile = await browser.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:1 });
  const mobilePage = await mobile.newPage();
  captureErrors(mobilePage, "mobile-390");
  await openLanding(mobilePage);
  await screenshot(mobilePage, "12-landing-mobile-390");
  await enterDemo(mobilePage);
  await screenshot(mobilePage, "13-workspace-mobile-390");
  await expectVisible(mobilePage.getByText("Northstar Grand").first(), "property identity should remain visible on mobile");
  await expectVisible(mobilePage.getByRole("button", { name:"Sandbox environment" }), "sandbox environment should remain reachable on mobile");
  for (const label of ["Command","Operations","Automations","Approvals","Activity","Integrations"]) {
    const navButton = mobilePage.locator(".primary-nav button").filter({ hasText:label });
    await expectVisible(
      navButton.locator("span"),
      `mobile navigation label should remain visible: ${label}`
    );
  }
  await mobile.close();

  const tablet = await browser.newContext({ viewport:{ width:768, height:1024 }, deviceScaleFactor:1 });
  const tabletPage = await tablet.newPage();
  captureErrors(tabletPage, "tablet-768");
  await openLanding(tabletPage);
  await screenshot(tabletPage, "14-landing-tablet-768");
  await enterDemo(tabletPage);
  await screenshot(tabletPage, "15-workspace-tablet-768");
  await tablet.close();

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
