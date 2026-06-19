import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const baseUrl = "http://127.0.0.1:4173";
const question = "Will grid storage deployment accelerate by June 2028?";
const screenshotsUrl = new URL("../screenshots/", import.meta.url);
const server = spawn(process.execPath, ["test/server.mjs"], {
  cwd: new URL("../", import.meta.url),
  stdio: "inherit",
  windowsHide: true,
});

let browser;
try {
  await waitForServer();
  await mkdir(screenshotsUrl, { recursive: true });
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(baseUrl);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Backend proxy URL").fill(baseUrl);
  await page.getByLabel("App access token").fill("test-token");
  await page.getByRole("button", { name: "Save and test" }).click();
  await page
    .getByRole("status", { name: "Connection status" })
    .waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Close settings" }).click();

  await page.getByLabel("Forecast question").fill(question);
  await page.getByRole("button", { name: "Analyze" }).click();
  await page.getByRole("heading", { name: "Probability field" }).waitFor();
  await page.locator(".toast").waitFor({ state: "detached", timeout: 6_000 });

  const views = [
    ["Galaxy", "galaxy.png"],
    ["Ranked", "ranked.png"],
    ["Tree", "tree.png"],
    ["Timeline", "timeline.png"],
    ["Matrix", "matrix.png"],
    ["Simulation", "simulation.png"],
  ];
  for (const [tab, filename] of views) {
    await page.getByRole("tab", { name: tab }).click();
    await page.locator(".view").waitFor({ state: "visible" });
    await page.screenshot({
      path: fileURLToPath(new URL(filename, screenshotsUrl)),
      animations: "disabled",
    });
  }

  const evidenceRail = page.locator("#right-rail");
  for (const stance of ["Supporting", "Opposing", "Neutral"]) {
    await page.getByRole("button", { name: stance }).click();
    const railBox = await evidenceRail.boundingBox();
    if (!railBox) throw new Error(`Could not measure the ${stance} evidence rail.`);
    await page.screenshot({
      path: fileURLToPath(
        new URL(`evidence-${stance.toLowerCase()}.png`, screenshotsUrl),
      ),
      animations: "disabled",
      clip: {
        x: railBox.x,
        y: railBox.y,
        width: railBox.width,
        height: Math.min(750, 1000 - railBox.y),
      },
    });
  }

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("dialog", { name: "Settings" }).waitFor({ state: "visible" });
  await page.screenshot({
    path: fileURLToPath(new URL("settings.png", screenshotsUrl)),
    animations: "disabled",
  });
} finally {
  await browser?.close();
  server.kill();
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // The test server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for the screenshot test server.");
}
