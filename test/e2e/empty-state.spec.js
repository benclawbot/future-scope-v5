import { expect, test } from "@playwright/test";

test("starts empty and keeps analysis views unavailable", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Future•Scope" })).toBeVisible();
  await expect(
    page.getByText("Enter a forecast question and connect the live research backend."),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Galaxy" })).toBeDisabled();
  await expect(page.getByRole("tab", { name: "Simulation" })).toBeDisabled();
  await expect(page.locator("[data-outcome-id]")).toHaveCount(0);
});

test("validates prompt length before making a request", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Forecast question").fill("x".repeat(401));
  await page.getByRole("button", { name: "Analyze" }).click();

  await expect(page.getByRole("alertdialog")).toContainText("E_INPUT_INVALID");
  await expect(page.getByRole("alertdialog")).toContainText("400 characters");
});
