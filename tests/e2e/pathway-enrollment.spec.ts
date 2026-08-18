import { test, expect } from "@playwright/test";
import { signInAsTestMember } from "./helpers/auth";

// Seeded in the Phase 2 content seed — see prisma seed / admin/pathways.
const PATHWAY_SLUG = "commit-to-your-health";
const PATHWAY_TITLE = "Commit to Your Health";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signInAsTestMember(page);
});

test("pathway enroll → verify in My Pathways → unenroll", async ({ page }) => {
  // Start from a clean state: if a leftover enrollment exists from a prior
  // run, remove it so this test is repeatable regardless of history.
  await unenrollIfPresent(page);

  await page.goto(`/pathways/${PATHWAY_SLUG}`);
  await expect(page.getByRole("heading", { name: PATHWAY_TITLE })).toBeVisible();

  const enrollButton = page.getByRole("button", { name: "Enroll now" });
  await expect(enrollButton).toBeVisible();
  await enrollButton.click();

  await expect(page.getByText("You are enrolled in this pathway.")).toBeVisible();
  const viewProgress = page.getByRole("link", { name: "View my progress →" });
  await expect(viewProgress).toBeVisible();

  await viewProgress.click();
  await expect(page).toHaveURL(/\/account\/pathways/);

  const card = page.getByRole("link", { name: PATHWAY_TITLE });
  await expect(card).toBeVisible();
  await expect(page.getByText("0 / 5 stages")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Unenroll" }).click();
  await expect(card).not.toBeVisible();

  // Confirm the pathway page reflects the withdrawal too.
  await page.goto(`/pathways/${PATHWAY_SLUG}`);
  await expect(page.getByRole("button", { name: "Enroll now" })).toBeVisible();
});

async function unenrollIfPresent(page: import("@playwright/test").Page) {
  await page.goto("/account/pathways");
  const card = page.getByRole("link", { name: PATHWAY_TITLE });
  if (await card.isVisible().catch(() => false)) {
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Unenroll" }).click();
    await expect(card).not.toBeVisible();
  }
}
