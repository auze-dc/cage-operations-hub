import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import {validateBrowserConfig,readBrowserConfig} from "./runtime-config.mjs";

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
const runtimePath=path.join(dist,"runtime-config.js");
if(!missing.length){validateBrowserConfig(config);fs.writeFileSync(runtimePath,`window.CAGE_CONFIG = Object.freeze(${JSON.stringify(config)});\n`);console.log("Production browser bundle created.");}
else if(fs.existsSync(runtimePath)){readBrowserConfig(fs.readFileSync(runtimePath,"utf8"));console.log("Kept existing runtime-config.js; environment configuration is incomplete.");}
else {throw new Error(`No runtime-config.js exists. Set the existing deployment environment values: ${missing.join(", ")}`);}
