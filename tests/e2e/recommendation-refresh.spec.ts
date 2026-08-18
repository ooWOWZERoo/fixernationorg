import { test, expect } from "@playwright/test";
import { signInAsTestMember } from "./helpers/auth";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signInAsTestMember(page);
});

test("home page loads a recommendation and refresh replaces it", async ({ page }) => {
  await page.goto("/account/home");

  await expect(page.getByText("One thing today")).toBeVisible();

  // Wait for the skeleton loader to resolve into either a recommendation
  // or the empty state, then confirm we got a real recommendation — the
  // Phase 2 seed guarantees at least one active challenge, so the
  // fallback-to-any-active-challenge branch should always produce one.
  const noRecMessage = page.getByText("No recommendation yet");
  const refreshLink = page.getByRole("button", { name: "Get a different suggestion" });
  await expect(refreshLink.or(noRecMessage)).toBeVisible({ timeout: 10000 });
  await expect(noRecMessage).not.toBeVisible();

  const recHeading = page.getByRole("heading", { level: 2 });
  await expect(recHeading).toBeVisible();
  const initialTitle = await recHeading.textContent();
  expect(initialTitle?.trim().length).toBeGreaterThan(0);

  await refreshLink.click();
  await expect(page.getByText("Here's a fresh suggestion.")).toBeVisible();
  await expect(recHeading).toBeVisible();
  const refreshedTitle = await recHeading.textContent();
  expect(refreshedTitle?.trim().length).toBeGreaterThan(0);

  // Refresh again to confirm the action is repeatable, not a one-shot fluke.
  await refreshLink.click();
  await expect(page.getByText("Here's a fresh suggestion.")).toBeVisible();
  await expect(recHeading).toBeVisible();
});
