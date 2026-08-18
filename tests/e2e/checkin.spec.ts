import { test, expect, type Page } from "@playwright/test";
import { signInAsTestMember } from "./helpers/auth";

const NOTE = "QA e2e note — should be removed by the test.";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signInAsTestMember(page);
});

test("submit today's check-in -> verify -> remove today's entry", async ({ page }) => {
  await page.goto("/account/checkin");
  await removeTodayIfPresent(page);

  await expect(page.getByRole("heading", { name: "Daily Check-In" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check In" })).toBeVisible();

  await page.getByRole("button", { name: "🙂" }).click();
  await page.getByRole("button", { name: "4", exact: true }).click();
  await page.getByPlaceholder("A win, a struggle, something you noticed...").fill(NOTE);
  await page.getByRole("button", { name: "Check In" }).click();

  await expect(page.getByText("Checked in — nice work!")).toBeVisible();
  await expect(page.getByText("Already checked in today")).toBeVisible();
  await expect(page.getByRole("button", { name: "Update" })).toBeVisible();

  await page.getByRole("button", { name: "Remove today's entry" }).click();
  await expect(page.getByText("Entry removed.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Check In" })).toBeVisible();
  await expect(page.getByText("Already checked in today")).not.toBeVisible();
});

async function removeTodayIfPresent(page: Page) {
  const removeBtn = page.getByRole("button", { name: "Remove today's entry" });
  if (await removeBtn.isVisible().catch(() => false)) {
    await removeBtn.click();
    await expect(page.getByRole("button", { name: "Check In" })).toBeVisible();
  }
}
