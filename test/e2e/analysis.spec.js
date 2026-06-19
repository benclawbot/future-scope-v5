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
  await expect(page.locator(".source-mix-card")).toBeVisible();
  await expect(page.getByRole("img", { name: "Source mix: 8 sources" })).toBeVisible();
  await expect(page.locator(".source-mix-segment")).toHaveCount(4);

  const factorColors = await page.locator("[data-factor-id]").evaluateAll((rows) =>
    Object.fromEntries(
      rows.map((row) => [row.dataset.factorId, row.style.getPropertyValue("--factor-color")]),
    ),
  );
  expect(factorColors).toEqual({
    market_momentum: "#8b5cf6",
    execution_quality: "#38bdf8",
    competitive_pressure: "#fb7185",
    regulatory_pressure: "#f59e0b",
    resource_availability: "#34d399",
    technology_readiness: "#22d3ee",
  });
  await expect(page.getByLabel("Market Momentum")).toHaveCSS(
    "background-image",
    /linear-gradient/,
  );

  await page.getByRole("tab", { name: "Ranked" }).click();
  await expect(page.getByRole("heading", { name: "Ranked outcomes" })).toBeVisible();
  await expect(page.getByText(/most decision-relevant outcomes/)).toBeVisible();

  await page.getByRole("tab", { name: "Tree" }).click();
  await expect(page.getByRole("heading", { name: "Scenario tree" })).toBeVisible();
  await expect(page.locator("[data-tree-outcome]")).toHaveCount(4);
  await expect(page.locator(".tree-links")).toBeVisible();
  await expect(page.locator('.tree-link[data-link-role="root-branch"]')).toHaveCount(3);
  await expect(page.locator('.tree-link[data-link-role="branch-outcome"]')).toHaveCount(4);
  await expect(page.locator(".tree-port")).toHaveCount(6);
  const treePaths = await page.locator(".tree-link").evaluateAll((paths) =>
    paths.map((path) => ({
      d: path.getAttribute("d"),
      marker: path.getAttribute("marker-end"),
    })),
  );
  expect(treePaths.every(({ d }) => d?.includes(" H ") && d.includes(" C "))).toBe(true);
  expect(treePaths.every(({ marker }) => marker?.startsWith("url(#tree-arrow-"))).toBe(true);

  await page.getByRole("tab", { name: "Timeline" }).click();
  await expect(page.getByRole("heading", { name: "Evidence timeline" })).toBeVisible();
  await expect(page.getByText("Policy review milestone")).toBeVisible();
  await expect(page.locator(".timeline-milestone")).toHaveCount(1);
  await expect(page.locator(".timeline-pin")).toHaveCount(1);

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
  await page.getByRole("tab", { name: "Timeline" }).click();
  const timelineEvent = page.locator("[data-timeline-user-event]").filter({
    hasText: "A major policy incentive passes",
  });
  await expect(timelineEvent).toHaveAttribute("data-draggable", "true");
  const beforeDecay = await timelineEvent.getAttribute("data-time-decay");
  const box = await timelineEvent.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 80, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(timelineEvent).not.toHaveAttribute("data-time-decay", beforeDecay);

  await page.getByRole("tab", { name: "Simulation" }).click();
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

  await expect(
    page.getByText(
      "Utility procurement plans in the research set schedule additional grid-scale battery capacity through 2028.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Supporting statement", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Official source", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Utility storage procurement outlook" }).first(),
  ).toHaveAttribute("href", "https://source1.example/report");

  await page.getByRole("button", { name: "Opposing" }).click();
  await expect(
    page.getByText(
      "Interconnection queues in several regions could delay otherwise financeable storage projects.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Opposing statement", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Regulatory source", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Neutral" }).click();
  await expect(
    page.getByText(
      "Current regional deployment remains uneven, so the national acceleration signal is not yet uniform.",
    ),
  ).toBeVisible();
  await expect(page.getByText("Neutral statement", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("News source", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Interconnection constraints")).toBeVisible();
});
