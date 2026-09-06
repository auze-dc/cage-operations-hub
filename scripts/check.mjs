import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const required = [
  "dist/index.html", "dist/styles.css", "dist/app.js", "dist/production.js",
  "dist/runtime-config.js", "dist/cage-logo.svg", "supabase/migrations/001_initial_schema.sql",
  "supabase/functions/send-document/index.ts", "supabase/functions/admin-users/index.ts",
  "supabase/functions/careers/index.ts", "supabase/functions/notify-interview/index.ts",
  "supabase/migrations/003_hr_and_role_management.sql",
  "dist/hr.js", "dist/careers.html", "dist/careers.js", "DEPLOYMENT_GUIDE.md"
];
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Missing required files: ${missing.join(", ")}`);

for (const file of ["dist/app.js", "dist/production.js", "dist/runtime-config.js", "dist/hr.js", "dist/careers.js"]) {
  new vm.Script(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
}
const html = fs.readFileSync(path.join(root, "dist/index.html"), "utf8");
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length) throw new Error(`Duplicate HTML ids: ${duplicateIds.join(", ")}`);
for (const ref of ["runtime-config.js", "vendor/supabase.js", "production.js", "app.js", "hr.js"]) {
  if (!html.includes(ref)) throw new Error(`index.html does not load ${ref}`);
}
console.log("CAGE Operations Hub production checks passed.");
