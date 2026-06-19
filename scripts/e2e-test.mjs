// scripts/e2e-test.mjs
// Real end-to-end test: drive the actual page in headless Chromium, click
// Analyse, watch the console, and report any thrown errors.

import { chromium } from "playwright";

const URL = "http://localhost:4173/";
const APP_TOKEN = "eb5dfbebe033d18dec401fbbf5dea0588c823754070c59fbba671f796619792c";
const PROXY_URL = "http://localhost:8787";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const consoleErrors = [];
const pageErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") {
    consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
  }
});
page.on("pageerror", (err) => {
  pageErrors.push(`PAGE ERROR: ${err.message}\n${err.stack ?? ""}`);
});

console.log("=== navigating to", URL);
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
await page.waitForTimeout(2000);

// Check the prompt input is reachable (proves the script ran)
const promptInput = await page.$("#forecast-prompt");
const analyzeBtn = await page.$("#analyze-button");
console.log("prompt input present:", !!promptInput);
console.log("analyze button present:", !!analyzeBtn);

// Pre-set localStorage so the app skips the settings dialog
await page.evaluate(
  ([token, url]) => {
    localStorage.setItem(
      "future-scope-prefs",
      JSON.stringify({
        schema_version: 1,
        theme: "dark",
        backend_proxy_url: url,
        app_token: token,
        ui_density: "comfortable",
        last_tab: "galaxy",
      }),
    );
  },
  [APP_TOKEN, PROXY_URL],
);
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);

// Type a forecast question and click Analyse
await page.fill("#forecast-prompt", "Will inflation fall below 2.5% in 2026?");
console.log("=== clicking Analyse button (timing it)");
const t0 = Date.now();
await page.click("#analyze-button");

// Wait for the loading layer to hide (i.e. analysis complete)
let analysisOk = false;
try {
  await page.waitForFunction(
    () => document.querySelector("#loading-layer")?.classList.contains("hidden"),
    { timeout: 240_000, polling: 1000 },
  );
  analysisOk = true;
} catch (e) {
  console.log("waitForFunction timed out — analysis may still be running or hung");
}
const t1 = Date.now();
console.log(`=== analysis phase took ${((t1 - t0) / 1000).toFixed(1)}s, ok=${analysisOk}`);

// Give the dialog a moment to render if it opened
await page.waitForTimeout(500);

// Capture the error dialog RIGHT NOW
const errorState = await page.evaluate(() => {
  const dlg = document.querySelector("#error-dialog");
  return {
    open: dlg?.open ?? false,
    code: document.querySelector("#error-code")?.textContent ?? "",
    message: document.querySelector("#error-message")?.textContent ?? "",
  };
});
console.log("error dialog state at end:", JSON.stringify(errorState));

// Take a screenshot of the result
await page.screenshot({ path: "C:/Users/thoma/AppData/Local/Temp/result.png", fullPage: true });

// Check the error dialog state
const errorOpen = await page.evaluate(
  () => document.querySelector("#error-dialog")?.open ?? false,
);
const errorCode = await page.textContent("#error-code").catch(() => "");
const errorMsg = await page.textContent("#error-message").catch(() => "");
console.log("error dialog open:", errorOpen);
console.log("error code:", errorCode);
console.log("error message:", errorMsg);

// Check the analysis result on the page
const outcomeCount = await page.locator(".outcome-orb").count();
const sourceCount = await page.evaluate(
  () => document.querySelectorAll("[data-source-id]").length,
);
const evidenceCount = await page.locator(".evidence-item").count();
const contradictionCount = await page.locator(".contradiction-item").count();
console.log("outcomes rendered:", outcomeCount);
console.log("sources rendered:", sourceCount);
console.log("evidence items rendered:", evidenceCount);
console.log("contradictions rendered:", contradictionCount);

console.log("\n=== console errors/warnings ===");
for (const e of consoleErrors) console.log(" ", e);
console.log("\n=== page errors ===");
for (const e of pageErrors) console.log(" ", e);

await browser.close();

if (pageErrors.length > 0 || errorOpen) {
  console.log("\nFAILED");
  process.exit(1);
}
console.log("\nPASSED");
