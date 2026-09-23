import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const migrationDir = join(here, "..", "supabase", "migrations");
const files = (await readdir(migrationDir)).filter(name => name.endsWith(".sql")).sort();

assert.ok(files.length > 0, "at least one Supabase migration is required");

const versions = new Map();
for (const file of files) {
  const match = /^(\d{14})_[a-z0-9_]+\.sql$/i.exec(file);
  assert.ok(match, `migration must use a 14-digit timestamp prefix: ${file}`);
  const version = match[1];
  assert.equal(versions.has(version), false, `duplicate Supabase migration version ${version}: ${versions.get(version)} and ${file}`);
  versions.set(version, file);
}

const ordered = [...versions.keys()];
assert.deepEqual(ordered, [...ordered].sort(), "migration filenames must sort in version order");

console.log(`StayPilot migration version verification passed (${files.length} migrations).`);
