import { test, expect, type Page } from "@playwright/test";
import { signInAsTestMember } from "./helpers/auth";

// Seeded in the Phase 2 content seed — see prisma seed / admin/issue-topics.
const ISSUE_SLUG = "isolated-disconnected";
const ISSUE_TITLE = "I feel isolated and disconnected";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signInAsTestMember(page);
});

test("track issue -> mark resolved -> stop tracking", async ({ page }) => {
  await page.goto(`/issues/${ISSUE_SLUG}`);
  await stopTrackingIfPresent(page);

  await expect(page.getByRole("heading", { name: ISSUE_TITLE })).toBeVisible();

  const trackButton = page.getByRole("button", { name: "I'm dealing with this" });
  await expect(trackButton).toBeVisible();
  await trackButton.click();

  await expect(page.getByText("Tracking this issue")).toBeVisible();
  const resolveButton = page.getByRole("button", { name: "Mark as resolved" });
  await expect(resolveButton).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop tracking" })).toBeVisible();

  await resolveButton.click();
  await expect(page.getByText("Resolved", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark as unresolved" })).toBeVisible();

  await page.getByRole("button", { name: "Stop tracking" }).click();
  await expect(page.getByRole("button", { name: "I'm dealing with this" })).toBeVisible();
});

async function stopTrackingIfPresent(page: Page) {
  const stopButton = page.getByRole("button", { name: "Stop tracking" });
  if (await stopButton.isVisible().catch(() => false)) {
    await stopButton.click();
    await expect(page.getByRole("button", { name: "I'm dealing with this" })).toBeVisible();
  }
}
