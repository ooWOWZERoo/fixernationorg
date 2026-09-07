import { test, expect } from "@playwright/test";
import { signInAsTestMember } from "./helpers/auth";

// SP-TB-P7 -- accessibility/mobile regression coverage for Tune Your Brain.
// Focused on the three highest-value checks from the phase's audit: no
// horizontal scroll on small viewports, full keyboard operability on a
// representative game, and Calm & Focus's prefers-reduced-motion handling.

test.describe.configure({ mode: "serial" });

const PAGES = ["/tune-your-brain", "/tune-your-brain/positive-reframe", "/tune-your-brain/calm-focus"];
const WIDTHS = [320, 768];

test("no horizontal scroll on the hub and game pages at mobile/tablet widths", async ({ page }) => {
  await signInAsTestMember(page);
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of PAGES) {
      await page.goto(path);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth, `${path} at ${width}px should not scroll horizontally`).toBeLessThanOrEqual(clientWidth + 1);
    }
  }
});

test("Positive Reframe is fully operable via keyboard alone", async ({ page }) => {
  await signInAsTestMember(page);
  await page.goto("/tune-your-brain/positive-reframe");

  // The 4 answer options render as plain buttons inside a labeled group.
  const options = page.locator('div.space-y-2 > button');
  await expect(options).toHaveCount(4, { timeout: 10000 });

  // Tab forward from the back link until focus lands on one of the options
  // -- proves there's no keyboard trap and the options are reachable in
  // document order, without hardcoding an exact tab count.
  await page.getByRole("link", { name: "← Tune Your Brain" }).focus();
  let reachedOption = false;
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    reachedOption = await page.evaluate(() => {
      const active = document.activeElement;
      const container = document.querySelector("div.space-y-2");
      return !!(active && container && container.contains(active));
    });
    if (reachedOption) break;
  }
  expect(reachedOption).toBe(true);

  // Activate with the keyboard (no click) and confirm the result is
  // announced via a status region, not just a color change.
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toBeVisible({ timeout: 10000 });
});

test("Calm & Focus respects prefers-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signInAsTestMember(page);
  await page.goto("/tune-your-brain/calm-focus");

  await page.getByRole("button", { name: "Guided Breathing" }).click();
  await expect(page.getByText("How long would you like to breathe?")).toBeVisible({ timeout: 10000 });

  // The in-page toggle should reflect the OS-level preference by default.
  await expect(page.getByLabel("Reduce motion")).toBeChecked();

  await page.getByRole("button", { name: "30s" }).click();
  await page.waitForTimeout(500);

  // No inline-transform-animated element should render while reduced
  // motion is active.
  const animatedCount = await page.evaluate(() => document.querySelectorAll('[style*="scale("]').length);
  expect(animatedCount).toBe(0);
});
