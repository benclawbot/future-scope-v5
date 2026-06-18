import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 768, height: 900 },
  { width: 320, height: 760 },
]) {
  test(`empty state fits ${viewport.width}px without horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
    await expect(
      page.getByText("Enter a forecast question and connect the live research backend."),
    ).toBeVisible();
  });
}

test("empty workspace spans the desktop grid", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const width = await page.locator(".center-panel").evaluate((element) => {
    return element.getBoundingClientRect().width;
  });
  expect(width).toBeGreaterThan(1100);
});

test("all populated views remain within a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Backend proxy URL").fill("http://127.0.0.1:4173");
  await page.getByLabel("App access token").fill("test-token");
  await page.getByRole("button", { name: "Save and test" }).click();
  await page.getByRole("button", { name: "Close settings" }).click();
  await page
    .getByLabel("Forecast question")
    .fill("Will grid storage deployment accelerate by June 2028?");
  await page.getByRole("button", { name: "Analyze" }).click();
  await expect(page.getByRole("heading", { name: "Probability field" })).toBeVisible();

  for (const tab of ["Galaxy", "Ranked", "Tree", "Timeline", "Matrix", "Simulation"]) {
    await page.getByRole("tab", { name: tab }).click();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(dimensions.page, tab).toBeLessThanOrEqual(dimensions.viewport);
  }
});
