import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

test("browser metadata presents EZStay as a product, not a prototype", () => {
  const html = readFileSync("index.html", "utf8");
  assert.doesNotMatch(html, /interactive hotel operations automation prototype/i);
  assert.match(html, /Hotel operations automation workspace/i);
  assert.match(html, /property="og:title"/);
  assert.match(html, /name="twitter:card"/);
  assert.match(html, /rel="icon"[^>]+favicon\.svg/);
  assert.match(html, /rel="manifest"[^>]+manifest\.webmanifest/);
});

test("EZStay ships branded browser identity assets", () => {
  assert.equal(existsSync("public/favicon.svg"), true);
  assert.equal(existsSync("public/manifest.webmanifest"), true);
  const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
  assert.equal(manifest.name, "EZStay — Hotel Operations Automation");
  assert.equal(manifest.short_name, "EZStay");
  assert.equal(manifest.theme_color, "#111816");
});
