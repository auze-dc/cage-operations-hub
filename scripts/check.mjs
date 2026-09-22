import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const required = [
  "dist/design-system.css", "dist/design-system.js", "dist/hub-collaboration.js", "dist/hub-collaboration.css",
  "dist/admissions-review.js", "dist/admissions-admin.js", "dist/admissions-common.js", "dist/apply.js", "dist/apply.html", "dist/admissions.css",
  "dist/index.html", "dist/styles.css", "dist/app.js", "dist/production.js",
  "dist/cage-logo.svg", "supabase/migrations/001_initial_schema.sql",
  "supabase/functions/send-document/index.ts", "supabase/functions/admin-users/index.ts",
  "supabase/functions/careers/index.ts", "supabase/functions/notify-interview/index.ts",
  "supabase/migrations/003_hr_and_role_management.sql",
  "dist/hr.js", "dist/careers.html", "dist/careers.js", "DEPLOYMENT_GUIDE.md"
];
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) throw new Error(`Missing required files: ${missing.join(", ")}`);

for (const file of ["dist/hub-collaboration.js", "dist/design-system.js", "dist/messenger.js", "dist/personal-work.js", "dist/app.js", "dist/production.js", "dist/hr.js", "dist/careers.js", "dist/admissions-review.js", "dist/admissions-admin.js", "dist/admissions-common.js", "dist/apply.js"]) {
  new vm.Script(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
}
const html = fs.readFileSync(path.join(root, "dist/index.html"), "utf8");
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length) throw new Error(`Duplicate HTML ids: ${duplicateIds.join(", ")}`);
for (const ref of ["hub-collaboration.js", "hub-collaboration.css", "design-system.js", "design-system.css", "runtime-config.js", "vendor/supabase.js", "production.js", "app.js", "hr.js", "admissions-review.js", "admissions-admin.js"]) {
  if (!html.includes(ref)) throw new Error(`index.html does not load ${ref}`);
}
console.log("CAGE Operations Hub production checks passed.");
