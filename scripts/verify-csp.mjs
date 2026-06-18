import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const style = extract(html, /<style id="app-styles">([\s\S]*?)<\/style>/, "app styles");
const script = extract(html, /<script id="app-script">([\s\S]*?)<\/script>/, "app script");
const policy = extract(
  html,
  /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/,
  "CSP meta policy",
);

const required = [hash(style), hash(script)];
const missing = required.filter((value) => !policy.includes(`'${value}'`));
if (missing.length > 0) {
  console.error(`CSP hash mismatch: ${missing.join(", ")}`);
  process.exitCode = 1;
} else if (policy.includes("'unsafe-inline'") && !policy.includes("style-src")) {
  console.error("CSP must not permit inline scripts.");
  process.exitCode = 1;
} else {
  console.log("CSP hashes match the embedded application assets.");
}

function hash(value) {
  return `sha256-${createHash("sha256").update(value, "utf8").digest("base64")}`;
}

function extract(value, pattern, label) {
  const match = value.match(pattern);
  if (!match) throw new Error(`Could not find ${label}`);
  return match[1];
}
