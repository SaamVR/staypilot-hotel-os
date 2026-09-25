import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

function walk(dir) {
  return readdirSync(dir, { withFileTypes:true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

test("every relative import in EZStay Pages Functions resolves from its route file", () => {
  const files = walk("functions/api/ezstay").filter(path => path.endsWith(".js"));
  const failures = [];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
      const specifier = match[1];
      const target = resolve(dirname(file), specifier);
      if (!existsSync(target)) failures.push({ file, specifier, target });
    }
  }

  assert.deepEqual(failures, []);
});
