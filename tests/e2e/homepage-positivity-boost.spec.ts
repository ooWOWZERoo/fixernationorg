import { test, expect } from "@playwright/test";

test("Your Daily Positivity Boost renders between the hero and the next section", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Your Daily Positivity Boost").first()).toBeVisible();
  await expect(page.getByText("A little something positive for today.")).toBeVisible();
  await expect(page.getByText("New positivity, every day.")).toBeVisible();

  // DOM order: hero heading, then the boost section, then the next heading —
  // verified by y-position rather than sibling traversal, since the actual
  // markup nesting is an implementation detail.
  const heroHeading = page.getByRole("heading", { level: 1, name: /Health Club for Your Mind/i });
  const boostSection = page.getByText("A little something positive for today.");
  const nextHeading = page.getByRole("heading", { name: /This is what your time online can become/i });

  const heroBox = await heroHeading.boundingBox();
  const boostBox = await boostSection.boundingBox();
  const nextBox = await nextHeading.boundingBox();

  expect(heroBox).not.toBeNull();
  expect(boostBox).not.toBeNull();
  expect(nextBox).not.toBeNull();
  expect(heroBox!.y).toBeLessThan(boostBox!.y);
  expect(boostBox!.y).toBeLessThan(nextBox!.y);

  // The message itself must be present and non-empty -- fallback or not,
  // the section must never render empty/undefined/null.
  const messageText = await page
    .locator("p.font-display")
    .filter({ hasText: /\S/ })
    .first()
    .textContent();
  expect(messageText?.trim().length).toBeGreaterThan(0);
});
