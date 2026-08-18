import { test, expect } from "@playwright/test";
import { signInAsTestMember } from "./helpers/auth";

// Seeded in the Phase 2 content seed — see prisma seed / admin/challenges.
const CHALLENGE_SLUG = "7-day-financial-check-in";
const CHALLENGE_TITLE = "7-Day Financial Check-In";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signInAsTestMember(page);
});

test("challenge join → verify in My Challenges → abandon", async ({ page }) => {
  // Start from a clean state so this test is repeatable regardless of history.
  await abandonIfPresent(page);

  await page.goto(`/challenges/${CHALLENGE_SLUG}`);
  await expect(page.getByRole("heading", { name: CHALLENGE_TITLE })).toBeVisible();

  const joinButton = page.getByRole("button", { name: "Join challenge" });
  await expect(joinButton).toBeVisible();
  await joinButton.click();

  await expect(page.getByText("You are taking this challenge.")).toBeVisible();
  const viewProgress = page.getByRole("link", { name: "View my progress →" });
  await expect(viewProgress).toBeVisible();

  await viewProgress.click();
  await expect(page).toHaveURL(/\/account\/challenges/);

  const card = page.getByRole("link", { name: CHALLENGE_TITLE });
  await expect(card).toBeVisible();
  await expect(page.getByText("0 / 7 steps")).toBeVisible();
  await expect(page.getByText("Day 1 of 7")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Abandon" }).click();
  await expect(card).not.toBeVisible();

  // Confirm the challenge page reflects the withdrawal too.
  await page.goto(`/challenges/${CHALLENGE_SLUG}`);
  await expect(page.getByRole("button", { name: "Join challenge" })).toBeVisible();
});

async function abandonIfPresent(page: import("@playwright/test").Page) {
  await page.goto("/account/challenges");
  const card = page.getByRole("link", { name: CHALLENGE_TITLE });
  if (await card.isVisible().catch(() => false)) {
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Abandon" }).click();
    await expect(card).not.toBeVisible();
  }
}
