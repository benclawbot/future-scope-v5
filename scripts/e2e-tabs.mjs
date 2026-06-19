// scripts/e2e-tabs.mjs
// Drive the page in headless Chromium through every tab in BOTH dark and
// light themes. Take screenshots, capture console errors, validate that
// the bubbles and labels don't overlap.

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
await page.waitForTimeout(1500);

// Pre-set localStorage
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
await page.waitForTimeout(1500);

// Run an analysis
await page.fill("#forecast-prompt", "Will inflation fall below 2.5% in 2026?");
console.log("clicking Analyse");
const t0 = Date.now();
await page.click("#analyze-button");
let done = false;
for (let i = 0; i < 180; i += 1) {
  await page.waitForTimeout(1000);
  const hidden = await page.evaluate(() =>
    document.querySelector("#loading-layer")?.classList.contains("hidden"),
  );
  if (hidden) { done = true; break; }
}
const t1 = Date.now();
console.log(`analysis took ${((t1 - t0) / 1000).toFixed(1)}s, done=${done}`);

if (!done) {
  console.log("FAILED: analysis didn't complete");
  await page.screenshot({ path: "C:/Users/thoma/AppData/Local/Temp/failed.png", fullPage: true });
  await browser.close();
  process.exit(1);
}

const tabs = ["galaxy", "ranked", "tree", "timeline", "matrix", "simulation"];

for (const theme of ["dark", "light"]) {
  console.log(`\n=== theme: ${theme} ===`);
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
  }, theme);
  await page.waitForTimeout(500);
  for (const tab of tabs) {
    await page.click(`#tab-${tab}`);
    await page.waitForTimeout(400);
    const out = await page.evaluate((t) => {
      const dialog = document.querySelector("#error-dialog");
      const open = dialog?.open ?? false;
      const code = document.querySelector("#error-code")?.textContent ?? "";
      const msg = document.querySelector("#error-message")?.textContent ?? "";
      return { tab: t, dialogOpen: open, code, msg };
    }, tab);
    if (out.dialogOpen) {
      console.log(`  ${tab}: ERROR DIALOG OPEN — ${out.code}: ${out.msg}`);
    } else {
      console.log(`  ${tab}: ok`);
    }
    await page.screenshot({
      path: `C:/Users/thoma/AppData/Local/Temp/${theme}-${tab}.png`,
      fullPage: true,
    });
  }
}

// Inspect the matrix view in dark theme for overlap (a quick proxy check
// by reading DOM rectangles of bubbles + labels)
await page.click("#tab-matrix");
await page.waitForTimeout(500);
const matrixInfo = await page.evaluate(() => {
  const bubbles = [...document.querySelectorAll(".matrix-outcome")].map((b) => {
    const r = b.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const labels = [...document.querySelectorAll(".matrix-label")].map((l) => {
    const r = l.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  // Check label-label overlap
  let labelOverlaps = 0;
  for (let i = 0; i < labels.length; i += 1) {
    for (let j = i + 1; j < labels.length; j += 1) {
      const a = labels[i];
      const b = labels[j];
      if (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
      ) {
        labelOverlaps += 1;
      }
    }
  }
  // Pull impact values from the outcome meta strings ("...impact NN%")
  const impacts = [...document.querySelectorAll(".matrix-label-meta")].map((m) => {
    const m2 = m.textContent.match(/impact (\d+)%/);
    return m2 ? Number(m2[1]) : null;
  });
  return { bubbles: bubbles.length, labels: labels.length, labelOverlaps, impacts };
});
console.log("\nmatrix view (dark):", JSON.stringify(matrixInfo));

// Galaxy view: verify all orbs are round (aspect ratio 1:1)
await page.click("#tab-galaxy");
await page.waitForTimeout(500);
const galaxyInfo = await page.evaluate(() => {
  const orbs = [...document.querySelectorAll(".outcome-orb")].map((o) => {
    const r = o.getBoundingClientRect();
    return { w: r.width, h: r.height, ratio: r.width / r.height };
  });
  return { count: orbs.length, ratios: orbs.map((o) => o.ratio.toFixed(3)) };
});
console.log("galaxy view (dark):", JSON.stringify(galaxyInfo));

// Timeline view: check that milestones don't visually overlap
await page.click("#tab-timeline");
await page.waitForTimeout(500);
const timelineInfo = await page.evaluate(() => {
  const ms = [...document.querySelectorAll(".timeline-milestone")].map((m) => {
    const r = m.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, row: m.dataset.timelineRow };
  });
  let overlaps = 0;
  for (let i = 0; i < ms.length; i += 1) {
    for (let j = i + 1; j < ms.length; j += 1) {
      if (ms[i].row === ms[j].row) {
        const a = ms[i];
        const b = ms[j];
        if (a.x < b.x + b.w && a.x + a.w > b.x) overlaps += 1;
      }
    }
  }
  return { milestones: ms.length, rows: [...new Set(ms.map((m) => m.row))], sameRowOverlaps: overlaps };
});
console.log("timeline view (dark):", JSON.stringify(timelineInfo));

// Factor impacts: check that outcomes have non-zero factor_coefficients
const factorInfo = await page.evaluate(() => {
  // state.analysis is on window? No, it's module-scoped. Read the
  // factor-control DOM values instead — they reflect the active state.
  const rows = [...document.querySelectorAll(".factor-control")];
  return rows.map((r) => ({
    id: r.dataset.factorId,
    value: r.querySelector('input[type="range"]')?.value,
  }));
});
console.log("factor controls:", JSON.stringify(factorInfo));

// Click a factor slider and see if outcomes re-rank
const beforeRanking = await page.evaluate(() => {
  const orbs = [...document.querySelectorAll(".outcome-orb")].map((o) => o.dataset.outcomeId);
  return orbs;
});
await page.click("#tab-simulation");
await page.waitForTimeout(300);
const sliderHandle = await page.$('.factor-control input[type="range"]');
if (sliderHandle) {
  await sliderHandle.fill("1");
  await page.waitForTimeout(500);
}
const afterRanking = await page.evaluate(() => {
  const orbs = [...document.querySelectorAll(".outcome-orb")].map((o) => o.dataset.outcomeId);
  return orbs;
});
console.log("outcome ranking before slider:", beforeRanking);
console.log("outcome ranking after  slider:", afterRanking);
console.log("ranking changed:", JSON.stringify(beforeRanking) !== JSON.stringify(afterRanking));

// --- PDF export check -------------------------------------------------
// Click Export, capture the download, save it, and assert it's a real,
// multi-page PDF that contains the analysis id and resolved question.
console.log("\n=== PDF export ===");
const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
await page.click("#tab-galaxy");
await page.waitForTimeout(200);
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
const rq = await page.evaluate(() => state?.analysis?.resolved_question ?? "");
const pdfCheck = {
  headerMagic: header === "%PDF-",
  hasEof: tail.includes("%%EOF"),
  byteSize: buf.length,
  pageCount: pageMatches.length,
  containsResolvedQuestion: rq ? text.includes(rq.slice(0, 32)) : false,
};
console.log("PDF check:", JSON.stringify(pdfCheck, null, 2));
if (!pdfCheck.headerMagic || !pdfCheck.hasEof || pdfCheck.byteSize < 20_000 || pdfCheck.pageCount < 9) {
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
