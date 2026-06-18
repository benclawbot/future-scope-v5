import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const modules = [
  "proxy/worker.js",
  "proxy/agents.js",
  "proxy/providers.js",
  "proxy/probability.js",
  "proxy/schemas.js",
  "proxy/security.js",
  "proxy/errors.js",
  "proxy/validation.js",
];

for (const modulePath of modules) {
  const result = spawnSync(process.execPath, ["--check", modulePath], {
    cwd: new URL("../", import.meta.url),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const script = html.match(/<script id="app-script">([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error("Embedded application script not found");
new Function(script);
console.log("Worker modules and embedded application script parse successfully.");
