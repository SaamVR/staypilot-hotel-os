import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync("index.html", "utf8");

test("EZStay document metadata carries the V2 brand", () => {
  assert.match(html, /<title>EZStay — Hotel Operations Automation<\/title>/);
  assert.match(html, /name="description"\s+content="EZStay is a hotel operations automation workspace/);
  assert.match(html, /name="theme-color"\s+content="#111816"/);
});

test("public document metadata does not present the V1 StayPilot brand", () => {
  const head = html.match(/<head>[\s\S]*?<\/head>/i)?.[0] || "";
  assert.doesNotMatch(head, /StayPilot/i);
});
