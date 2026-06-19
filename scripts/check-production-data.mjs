import { access, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { extname } from "node:path";

const productionFiles = [
  "index.html",
  "proxy/worker.js",
  "proxy/agents.js",
  "proxy/providers.js",
  "proxy/probability.js",
  "proxy/schemas.js",
  "proxy/security.js",
  "proxy/errors.js",
  "proxy/validation.js",
];

const prohibited = [
  ["de", "mo"].join(""),
  ["mo", "ck"].join(""),
  ["sample", "Scenario"].join(""),
  ["fallback", "Analysis"].join(""),
  ["canned", "Outcomes"].join(""),
  ["default", "Forecast"].join(""),
];
const scenarioReference = ["GPT", "-", "7"].join("");
const failures = [];
const retiredProvider = ["br", "ave"].join("");
const retiredTerms = [
  retiredProvider,
  ["X-Subscription", "-Token"].join(""),
  ["BR", "AVE", "_SEARCH_API_KEY"].join(""),
  ["BR", "AVE", "_API_BASE_URL"].join(""),
  ["X-Dev-", "Br", "ave-Key"].join(""),
  ["/api/", retiredProvider, "/search"].join(""),
  ["search", "Br", "ave"].join(""),
  [retiredProvider, "_configured"].join(""),
];

for (const file of productionFiles) {
  const content = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  for (const term of prohibited) {
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
    if (pattern.test(stripComments(content))) failures.push(`${file}: ${term}`);
  }
  if (content.includes(scenarioReference)) failures.push(`${file}: reference scenario text`);
}

const textExtensions = new Set([
  ".html",
  ".js",
  ".mjs",
  ".json",
  ".jsonc",
  ".md",
  ".yml",
  ".yaml",
]);
const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  cwd: new URL("../", import.meta.url),
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean)
  .filter((file) => textExtensions.has(extname(file)) || file === ".dev.vars.example");

for (const file of trackedFiles) {
  const fileUrl = new URL(`../${file}`, import.meta.url);
  try {
    await access(fileUrl);
  } catch {
    continue;
  }
  const content = await readFile(fileUrl, "utf8");
  const normalized = content.toLowerCase();
  for (const term of retiredTerms) {
    if (normalized.includes(term.toLowerCase())) {
      failures.push(`${file}: retired research provider reference`);
      break;
    }
  }
}

if (failures.length > 0) {
  console.error(`Prohibited production data found:\n${failures.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log("Production sources contain no prohibited forecast fixtures.");
}

function stripComments(content) {
  return content
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
