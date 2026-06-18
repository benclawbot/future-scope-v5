import { expect, test } from "@playwright/test";

test("visible controls have accessible names and headings do not skip levels", async ({
  page,
}) => {
  await page.goto("/");
  const audit = await page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        element.getClientRects().length > 0
      );
    };
    const nameOf = (element) => {
      const aria = element.getAttribute("aria-label");
      if (aria) return aria.trim();
      if (element.id) {
        const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (label?.textContent.trim()) return label.textContent.trim();
      }
      const wrappingLabel = element.closest("label");
      if (wrappingLabel?.textContent.trim()) return wrappingLabel.textContent.trim();
      return element.textContent?.trim() || element.getAttribute("title") || "";
    };
    const unnamed = [...document.querySelectorAll("button,input,select,summary")]
      .filter(visible)
      .filter((element) => !nameOf(element))
      .map((element) => element.outerHTML.slice(0, 120));
    const levels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
      .filter(visible)
      .map((heading) => Number(heading.tagName.slice(1)));
    const skipped = levels.some(
      (level, index) => index > 0 && level > levels[index - 1] + 1,
    );
    return { unnamed, levels, skipped };
  });

  expect(audit.unnamed).toEqual([]);
  expect(audit.skipped).toBe(false);
  expect(audit.levels[0]).toBe(1);
});

test("reduced motion has an explicit fallback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const animationDuration = await page.locator(".progress-track span").evaluate((element) => {
    return getComputedStyle(element).animationDuration;
  });
  expect(Number.parseFloat(animationDuration)).toBeLessThanOrEqual(0.001);
});
