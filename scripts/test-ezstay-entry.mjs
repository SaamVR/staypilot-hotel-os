import test from "node:test";
import assert from "node:assert/strict";
import {
  EZSTAY_ENTRY_CTA,
  EZSTAY_ENTRY_DISCLOSURE,
  resolveEzstayView,
  workspaceHash,
} from "../src/ezstay/domain/entry.js";

test("EZStay opens on the presentation layer by default", () => {
  assert.equal(resolveEzstayView(""), "presentation");
  assert.equal(resolveEzstayView("#top"), "presentation");
});

test("the interactive workspace has an explicit shareable route", () => {
  assert.equal(workspaceHash(), "#demo");
  assert.equal(resolveEzstayView("#demo"), "workspace");
  assert.equal(resolveEzstayView("#demo/activity"), "workspace");
});

test("entry copy makes the public demo boundary explicit", () => {
  assert.equal(EZSTAY_ENTRY_CTA, "Explore interactive demo");
  assert.match(EZSTAY_ENTRY_DISCLOSURE, /sample hotel data/i);
  assert.match(EZSTAY_ENTRY_DISCLOSURE, /simulated/i);
});
