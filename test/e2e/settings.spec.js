import { expect, test } from "@playwright/test";

test("tests the proxy and persists only versioned preferences", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();

  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Theme")).toBeFocused();

  await page.getByLabel("Theme").selectOption("light");
  await page.getByLabel("Backend proxy URL").fill("http://127.0.0.1:4173");
  await page.getByLabel("App access token").fill("test-token");
  await page.getByRole("button", { name: "Save and test" }).click();

  await expect(page.getByRole("status", { name: "Connection status" })).toContainText(
    "Connected",
  );
  await page.getByRole("button", { name: "Close settings" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("future-scope-prefs")),
  );
  expect(stored).toEqual({
    schema_version: 1,
    theme: "light",
    backend_proxy_url: "http://127.0.0.1:4173",
    ui_density: "comfortable",
    last_tab: "galaxy",
  });
  expect(JSON.stringify(stored)).not.toContain("test-token");

  await page.reload();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByLabel("App access token")).toHaveValue("");
});

test("ignores preferences from unknown schema versions", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem(
      "future-scope-prefs",
      JSON.stringify({
        schema_version: 99,
        theme: "light",
        backend_proxy_url: "https://untrusted.invalid",
      }),
    );
  });
  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByLabel("Backend proxy URL")).toHaveValue("");
});
