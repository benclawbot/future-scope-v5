import { expect, test } from "@playwright/test";

async function configureAndAnalyze(page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Backend proxy URL").fill("http://127.0.0.1:4173");
  await page.getByLabel("App access token").fill("test-token");
  await page.getByRole("button", { name: "Save and test" }).click();
  await expect(page.getByRole("status", { name: "Connection status" })).toContainText(
    "Connected",
  );
  await page.getByRole("button", { name: "Close settings" }).click();
  await page
    .getByLabel("Forecast question")
    .fill("Will grid storage deployment accelerate by June 2028?");
  await page.getByRole("button", { name: "Analyze" }).click();
  await expect(page.getByRole("heading", { name: "Probability field" })).toBeVisible();
}

test("renders all six live analysis views", async ({ page }) => {
  await configureAndAnalyze(page);

  await expect(page.locator("[data-outcome-id]")).toHaveCount(4);
  await expect(page.getByText("8", { exact: true }).first()).toBeVisible();

  await page.getByRole("tab", { name: "Ranked" }).click();
  await expect(page.getByRole("heading", { name: "Ranked outcomes" })).toBeVisible();
  await expect(page.getByText(/most decision-relevant outcomes/)).toBeVisible();

  await page.getByRole("tab", { name: "Tree" }).click();
  await expect(page.getByRole("heading", { name: "Scenario tree" })).toBeVisible();
  await expect(page.locator("[data-tree-outcome]")).toHaveCount(4);

  await page.getByRole("tab", { name: "Timeline" }).click();
  await expect(page.getByRole("heading", { name: "Evidence timeline" })).toBeVisible();
  await expect(page.getByText("Policy review milestone")).toBeVisible();

  await page.getByRole("tab", { name: "Matrix" }).click();
  await expect(page.getByRole("heading", { name: "Outcome impact matrix" })).toBeVisible();
  await expect(page.locator("[data-matrix-outcome]")).toHaveCount(4);

  await page.getByRole("tab", { name: "Simulation" }).click();
  await expect(page.getByRole("heading", { name: "Simulation results" })).toBeVisible();
  await expect(page.getByLabel("Market Momentum")).toBeVisible();
});

test("recalculates deterministically from sliders and user events", async ({ page }) => {
  await configureAndAnalyze(page);
  await page.getByRole("tab", { name: "Simulation" }).click();

  const leadingProbability = page.locator('[data-outcome-id="out_001"] [data-probability]');
  const before = await leadingProbability.textContent();
  await page.getByLabel("Market Momentum").fill("1");
  const after = await leadingProbability.textContent();
  expect(after).not.toBe(before);

  const displayed = await page.locator("[data-probability-value]").allTextContents();
  const totalTenths = displayed.reduce(
    (sum, value) => sum + Math.round(Number.parseFloat(value) * 10),
    0,
  );
  expect(totalTenths).toBe(1000);

  await page.getByLabel("New event").fill("A major policy incentive passes");
  await page.getByRole("button", { name: "Add event" }).click();
  await expect(page.getByText("A major policy incentive passes")).toBeVisible();

  const eventCard = page.locator("[data-user-event]").filter({
    hasText: "A major policy incentive passes",
  });
  await eventCard.getByRole("checkbox").uncheck();
  await expect(eventCard).toContainText("Inactive");
  await eventCard.getByRole("button", { name: "Delete event" }).click();
  await expect(eventCard).toHaveCount(0);
});

test("supports keyboard tab navigation and exposes sourced evidence", async ({ page }) => {
  await configureAndAnalyze(page);

  const galaxy = page.getByRole("tab", { name: "Galaxy" });
  await galaxy.focus();
  await galaxy.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Ranked" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await expect(page.getByRole("link", { name: "Evidence source 1" })).toHaveAttribute(
    "href",
    "https://source1.example/report",
  );
  await expect(page.getByText("Interconnection constraints")).toBeVisible();
});
