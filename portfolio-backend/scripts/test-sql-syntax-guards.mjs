import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = "supabase/migrations";
const migrations = readdirSync(dir).filter(name => name.endsWith(".sql")).sort();

test("SQL function bodies never use malformed single-dollar quotes", () => {
  for (const name of migrations) {
    const sql = readFileSync(join(dir, name), "utf8");
    assert.doesNotMatch(sql, /\bas \$\s*(?:declare|begin|select)/i, `${name}: malformed AS $`);
    assert.doesNotMatch(sql, /\n\$;\s*(?:create|revoke|grant|do\s+\$\$|$)/i, `${name}: malformed closing $`);
  }
});

test("double-dollar function delimiters are balanced per migration", () => {
  for (const name of migrations) {
    const sql = readFileSync(join(dir, name), "utf8");
    const count = (sql.match(/\$\$/g) || []).length;
    assert.equal(count % 2, 0, `${name}: unbalanced $$ delimiters`);
  }
});
