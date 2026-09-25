import { existsSync } from "node:fs";

const required = [
  "supabase/migrations/20260925010000_platform_foundation.sql",
  "supabase/migrations/20260925020000_ezstay_domain.sql",
  "supabase/migrations/20260925030000_ezstay_security.sql",
  "supabase/seed/ezstay-northstar-v2.sql"
];

const missing = required.filter(path => !existsSync(path));
if (missing.length) {
  console.error("Missing backend contract files:", missing.join(", "));
  process.exit(1);
}

console.log("EZStay backend layout verified");
