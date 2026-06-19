// scripts/e2e-pdf.mjs
// Quick PDF-export-only Playwright check. Bypasses the full analyse
// pipeline by loading the page, injecting prefs, and then triggering
// the export from a stub analysis payload so we can verify the
// builder in seconds.

import { chromium } from "playwright";

const URL = "http://localhost:4173/";
const APP_TOKEN = "eb5dfbebe033d18dec401fbbf5dea0588c823754070c59fbba671f796619792c";
const PROXY_URL = "http://localhost:8787";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
const page = await ctx.newPage();

const consoleErrors = [];
const pageErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => pageErrors.push(err.message));

await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);

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

// Stub a realistic analysis payload so the export builder has data to
// walk. This matches the schema the proxy returns after a real
// analyse; we mirror the keys the renderers + PDF builder use.
const stub = {
  analysis_id: "fsv5-pdf-test",
  resolved_question: "Will global inflation fall below 2.5% in 2026?",
  time_horizon: {
    start: "2026-01-01",
    end: "2027-12-31",
    label: "2026-2027",
  },
  confidence: { overall: 0.72 },
  coverage_note:
    "Coverage reflects the top cited sources at the time of analysis. Some long-tail outcomes may be under-evidenced.",
  probability_model: { raw_probabilities: {} },
  factors: [
    { id: "market_momentum", label: "Market momentum", value: 0.5 },
    { id: "execution_quality", label: "Execution quality", value: 0.5 },
    { id: "competitive_pressure", label: "Competitive pressure", value: 0.5 },
    { id: "regulatory_pressure", label: "Regulatory pressure", value: 0.5 },
    { id: "resource_availability", label: "Resource availability", value: 0.5 },
    { id: "technology_readiness", label: "Technology readiness", value: 0.5 },
  ],
  outcomes: [
    {
      id: "outcome-1",
      title: "Inflation falls to 2.0% by Q4 2026",
      description:
        "Most likely path. Disinflation continues, central banks cut rates modestly, and supply chains remain stable.",
      category: "positive",
      confidence: 0.78,
      impact: 0.82,
      base_logit: 1.4,
      current_probability: 0.42,
      display_probability: 42.0,
      factor_coefficients: {
        market_momentum: 0.9,
        execution_quality: 0.4,
        competitive_pressure: -0.1,
        regulatory_pressure: 0.2,
        resource_availability: 0.3,
        technology_readiness: 0.1,
      },
    },
    {
      id: "outcome-2",
      title: "Inflation sticky at 2.5-3.0%",
      description: "Sticky services inflation keeps headline CPI in a tight band.",
      category: "neutral",
      confidence: 0.66,
      impact: 0.55,
      base_logit: 0.4,
      current_probability: 0.31,
      display_probability: 31.0,
      factor_coefficients: {
        market_momentum: 0.2,
        execution_quality: 0.5,
        competitive_pressure: 0.3,
        regulatory_pressure: 0.4,
        resource_availability: 0.1,
        technology_readiness: 0.0,
      },
    },
    {
      id: "outcome-3",
      title: "Inflation re-accelerates above 3.5%",
      description: "Geopolitical shock or commodity spike drives a second wave of price increases.",
      category: "negative",
      confidence: 0.5,
      impact: 0.92,
      base_logit: -0.6,
      current_probability: 0.18,
      display_probability: 18.0,
      factor_coefficients: {
        market_momentum: -0.6,
        execution_quality: -0.2,
        competitive_pressure: 0.8,
        regulatory_pressure: 0.5,
        resource_availability: -0.4,
        technology_readiness: 0.0,
      },
    },
    {
      id: "outcome-4",
      title: "Inflation collapses below 1.5%",
      description: "Demand destruction and credit tightening pull CPI down sharply.",
      category: "uncertain",
      confidence: 0.42,
      impact: 0.78,
      base_logit: -1.4,
      current_probability: 0.09,
      display_probability: 9.0,
      factor_coefficients: {
        market_momentum: -0.4,
        execution_quality: -0.5,
        competitive_pressure: 0.2,
        regulatory_pressure: -0.3,
        resource_availability: -0.6,
        technology_readiness: 0.0,
      },
    },
  ],
  evidence_items: [
    {
      id: "ev1",
      stance: "supporting",
      claim: "OECD leading indicators point to a 0.4-point softening through Q2.",
      strength: 0.78,
      quality_weight: 0.7,
      date: "2026-04-12",
      source_ids: ["s1", "s3"],
    },
    {
      id: "ev2",
      stance: "supporting",
      claim: "Services CPI components decelerated for the third consecutive month.",
      strength: 0.71,
      quality_weight: 0.74,
      date: "2026-05-02",
      source_ids: ["s2"],
    },
    {
      id: "ev3",
      stance: "opposing",
      claim: "Energy futures imply a 1.8% rebound in headline CPI by Q4.",
      strength: 0.62,
      quality_weight: 0.58,
      date: "2026-05-22",
      source_ids: ["s4"],
    },
    {
      id: "ev4",
      stance: "neutral",
      claim: "Wage growth remains consistent with a 2.4% inflation regime.",
      strength: 0.55,
      quality_weight: 0.66,
      date: "2026-03-30",
      source_ids: ["s1", "s5"],
    },
  ],
  sources: [
    { id: "s1", title: "OECD Economic Outlook 2026", url: "https://www.oecd.org/economic-outlook", domain: "oecd.org", source_type: "research", quality_score: 0.92 },
    { id: "s2", title: "US BLS CPI release", url: "https://www.bls.gov/cpi", domain: "bls.gov", source_type: "official", quality_score: 0.95 },
    { id: "s3", title: "IMF World Economic Outlook", url: "https://www.imf.org/weo", domain: "imf.org", source_type: "research", quality_score: 0.9 },
    { id: "s4", title: "EIA Short-Term Energy Outlook", url: "https://www.eia.gov/outlooks/steo", domain: "eia.gov", source_type: "official", quality_score: 0.88 },
    { id: "s5", title: "Reuters: Wage tracker Q1 2026", url: "https://reuters.com/wages", domain: "reuters.com", source_type: "news", quality_score: 0.72 },
  ],
  contradictions: [
    {
      topic: "Energy price trajectory",
      claim_a: "OECD: oil demand softens through 2026.",
      claim_b: "EIA: crude inventories tighten into Q4.",
      resolution: "open",
      source_ids: ["s1", "s4"],
      description: "Two official sources project opposite paths for energy prices.",
    },
  ],
  events: [
    { label: "ECB rate decision", date: "2026-07-15" },
    { label: "Fed FOMC meeting", date: "2026-09-17" },
    { label: "Q4 OECD outlook", date: "2026-11-25" },
  ],
};

await page.evaluate((payload) => {
  // The export button calls exportAnalysis() which reads state.analysis.
  // The IIFE keeps state private; we exercise it by injecting a fake
  // analysis via the Analyse button or by directly calling the export.
  // We post a CustomEvent the app doesn't listen for, then call the
  // export function directly. Easiest: dispatch a click on Analyse
  // would still go to the proxy. Instead, evaluate the export builder
  // with a known analysis.
  window.__testBuildPdf = (analysis) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    return doc;
  };
  // Mutate the in-page state by calling activateAnalysisWorkspace after
  // we set the state. The IIFE binds state to a closure, so we can't
  // reach in. Workaround: navigate through the proxy by setting
  // localStorage to a real prefs shape, then use a hidden analysis
  // object that the page fetches. Cleanest path: trigger a tiny
  // analysis through the proxy and then export. That keeps this
  // script fast by using a "deep" request that finishes in <90s.
}, stub);

// Easier path: trigger the real export button and stub state via
// a small monkey-patch that intercepts the proxy response. But the
// page does a fetch from the proxy. To keep the test fast, we wait
// for jspdf to load, then build the PDF directly from the stub
// using the same builder the page uses. We do that by re-implementing
// buildAnalysisPdf() in the page context — but that function is in a
// closure, so we cannot. The simplest reliable path is to call
// document.querySelector("#export-button").click() after we override
// apiFetch. We patch apiFetch via the prefs and a tiny mock.
await page.evaluate((payload) => {
  // Find the page's fetch and wrap it so the next /api/analyze call
  // returns our stubbed payload.
  const originalFetch = window.fetch.bind(window);
  window.__stubPayload = payload;
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (url && url.includes("/api/analyze")) {
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input, init);
  };
}, stub);

await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);

// Re-inject the fetch override after reload (the page re-binds).
await page.evaluate((payload) => {
  const originalFetch = window.fetch.bind(window);
  window.__stubPayload = payload;
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input.url;
    if (url && url.includes("/api/analyze")) {
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return originalFetch(input, init);
  };
}, stub);

await page.fill("#forecast-prompt", stub.resolved_question);
await page.click("#analyze-button");
console.log("clicked Analyse (stubbed)");

let done = false;
for (let i = 0; i < 60; i += 1) {
  await page.waitForTimeout(500);
  const hidden = await page.evaluate(() =>
    document.querySelector("#loading-layer")?.classList.contains("hidden"),
  );
  if (hidden) { done = true; break; }
}
if (!done) {
  console.error("FAILED: analysis didn't complete");
  await page.screenshot({ path: "C:/Users/thoma/AppData/Local/Temp/pdf-test-failed.png", fullPage: true });
  await browser.close();
  process.exit(1);
}
console.log("analysis complete");

// Now click Export
const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
await page.click("#export-button");
const download = await downloadPromise;
const pdfPath = "C:/Users/thoma/AppData/Local/Temp/future-scope.pdf";
await download.saveAs(pdfPath);
console.log(`saved PDF to ${pdfPath}`);

const { readFile } = await import("node:fs/promises");
const buf = await readFile(pdfPath);
const header = buf.subarray(0, 5).toString("ascii");
const tail = buf.subarray(buf.length - 32).toString("ascii");
const text = buf.toString("latin1");
const pageMatches = text.match(/\/Type\s*\/Page[^s]/g) ?? [];
const check = {
  headerMagic: header === "%PDF-",
  hasEof: tail.includes("%%EOF"),
  byteSize: buf.length,
  pageCount: pageMatches.length,
  containsResolvedQuestion: text.includes("Will global inflation"),
  containsOutcome1: text.includes("Inflation falls to 2.0%"),
  containsContradiction: text.includes("Energy price trajectory"),
  containsFactorMomentum: text.includes("Market momentum"),
  containsSource: text.includes("OECD Economic Outlook"),
};
console.log("PDF check:", JSON.stringify(check, null, 2));
const passed =
  check.headerMagic &&
  check.hasEof &&
  check.byteSize > 20_000 &&
  check.pageCount >= 9 &&
  check.containsResolvedQuestion &&
  check.containsOutcome1 &&
  check.containsContradiction &&
  check.containsFactorMomentum &&
  check.containsSource;
if (!passed) {
  console.error("PDF export check FAILED");
  process.exitCode = 1;
} else {
  console.log("PDF export check OK");
}

console.log("\n=== console errors ===");
for (const e of consoleErrors) console.log(" ", e);
console.log("\n=== page errors ===");
for (const e of pageErrors) console.log(" ", e);

await browser.close();
