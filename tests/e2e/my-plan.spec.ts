import { test, expect, type Page } from "@playwright/test";
import { signInAsTestMember } from "./helpers/auth";

const PLAN_TITLE = "QA Test Plan — Playwright";
const ITEM_TITLE = "QA test action item";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signInAsTestMember(page);
});

test("create plan -> add item -> complete -> delete item -> archive plan", async ({ page }) => {
  await page.goto("/account/my-plan");
  await clearActivePlan(page);

  await expect(page.getByRole("heading", { name: "My Fixer Plan" })).toBeVisible();

  await page.getByRole("button", { name: "New plan" }).click();
  await page.getByPlaceholder("e.g. Fix the bathroom before summer").fill(PLAN_TITLE);
  await page.getByRole("button", { name: "Create plan" }).click();
  await expect(page.getByRole("heading", { name: PLAN_TITLE })).toBeVisible();

  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByPlaceholder("What do you want to do?").fill(ITEM_TITLE);
  await page.getByRole("button", { name: "Add to plan" }).click();
  await expect(page.getByText(ITEM_TITLE)).toBeVisible();

  // Mark the item done — it should move into the Done section (shows an
  // "Undo" action instead of "Done"/"Skip" once completed).
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();

  // Remove the item entirely.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "✕", exact: true }).click();
  await expect(page.getByText(ITEM_TITLE)).not.toBeVisible();

  // Archive the plan and confirm we're back to the empty state.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Archive this plan" }).click();
  await expect(page.getByText("No plan yet.")).toBeVisible();
});

async function clearActivePlan(page: Page) {
  const archiveBtn = page.getByRole("button", { name: "Archive this plan" });
  if (await archiveBtn.isVisible().catch(() => false)) {
    page.once("dialog", (dialog) => dialog.accept());
    await archiveBtn.click();
    await expect(page.getByText("No plan yet.")).toBeVisible();
  }
}
