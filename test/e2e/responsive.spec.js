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
