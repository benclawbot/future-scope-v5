import { readFile } from "node:fs/promises";

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

for (const file of productionFiles) {
  const content = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  for (const term of prohibited) {
    const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "i");
    if (pattern.test(stripComments(content))) failures.push(`${file}: ${term}`);
  }
  if (content.includes(scenarioReference)) failures.push(`${file}: reference scenario text`);
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
