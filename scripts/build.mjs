import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
fs.mkdirSync(path.join(dist, "vendor"), { recursive: true });

const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

await build({
  entryPoints: [path.join(root, "node_modules/@supabase/supabase-js/dist/umd/supabase.js")],
  bundle: false,
  minify: true,
  outfile: path.join(dist, "vendor/supabase.js")
});

const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "CAGE_ORGANIZATION_ID", "APP_URL"];
const missing = required.filter(key => !process.env[key]);
const mode = missing.length ? "setup-required" : "production";
const config = {
  mode,
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  organizationId: process.env.CAGE_ORGANIZATION_ID || "",
  appUrl: process.env.APP_URL || ""
};
fs.writeFileSync(path.join(dist, "runtime-config.js"), `window.CAGE_CONFIG = Object.freeze(${JSON.stringify(config)});\n`);

if (missing.length) {
  console.warn(`Build completed in setup-required mode. Missing: ${missing.join(", ")}`);
} else {
  console.log("Production browser bundle created.");
}
