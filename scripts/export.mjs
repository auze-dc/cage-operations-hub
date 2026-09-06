import fs from "node:fs";
import path from "node:path";
import archiver from "archiver";

const root = path.resolve(import.meta.dirname, "..");
const outputPath = path.join(root, "CAGE_Operations_Hub_Production_Export.zip");
const output = fs.createWriteStream(outputPath);
const archive = archiver("zip", { zlib: { level: 9 } });

await new Promise((resolve, reject) => {
  output.on("close", resolve);
  archive.on("error", reject);
  archive.pipe(output);
  archive.glob("**/*", {
    cwd: root,
    dot: true,
    ignore: [".git/**", ".openai/**", "node_modules/**", "*.zip", ".env", ".supabase/**"]
  });
  archive.finalize();
});
console.log(`Export created: ${outputPath}`);
