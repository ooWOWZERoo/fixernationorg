import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

const STAMP = Date.now();
// Passes validation: no prohibited terms, no negative-opener framing, 8-24 words.
const CONTENT = `QA e2e positivity boost message for automated testing purposes today, stamp ${STAMP}.`;
// Deliberately fails validation: contains a prohibited term.
const BAD_CONTENT = `QA e2e hopeless positivity boost message for automated testing purposes, stamp ${STAMP}.`;

test.describe.configure({ mode: "serial" });

test("admin creates, approves, activates, and deletes a message", async ({ page }) => {
  test.setTimeout(45000);

  await signInAsTestAdmin(page);
  await page.goto("/admin/positivity-boosts/new");

  await page.getByLabel("Message", { exact: true }).fill(CONTENT);
  await page.getByRole("button", { name: "Run validation" }).click();
  await expect(page.getByText("Positivity Validation: Passed")).toBeVisible();

  await page.getByRole("button", { name: "Create message" }).click();
  await expect(page).toHaveURL(/\/admin\/positivity-boosts\/(?!new$)[a-z0-9-]+$/);

  try {
    // Fresh content should land as DRAFT with validation already passed.
    await expect(page.getByText("Positivity Validation: Passed")).toBeVisible();

    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Approved", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Activate" }).click();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();

    await expect(page.getByText("Never shown on the homepage yet.")).toBeVisible();

    await page.goto("/admin/positivity-boosts");
    const row = page.locator("tbody tr").filter({ hasText: CONTENT.slice(0, 40) });
    await expect(row).toBeVisible();
    await expect(row.getByText("Active", { exact: true })).toBeVisible();

    await row.getByRole("link", { name: "Edit" }).click();
  } finally {
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete this message" }).click();
    await expect(page).toHaveURL(/\/admin\/positivity-boosts$/);
  }

  await expect(page.locator("tbody tr").filter({ hasText: CONTENT.slice(0, 40) })).not.toBeVisible();
});

test("content that fails validation cannot be activated", async ({ page }) => {
  test.setTimeout(45000);

  await signInAsTestAdmin(page);
  await page.goto("/admin/positivity-boosts/new");

  await page.getByLabel("Message", { exact: true }).fill(BAD_CONTENT);
  await page.getByRole("button", { name: "Run validation" }).click();
  await expect(page.getByText("Not Eligible for Public Display")).toBeVisible();

  await page.getByRole("button", { name: "Create message" }).click();
  await expect(page).toHaveURL(/\/admin\/positivity-boosts\/(?!new$)[a-z0-9-]+$/);

  try {
    // Server-computed status must be REJECTED regardless of what the form submitted.
    await expect(page.getByText("Rejected", { exact: true })).toBeVisible();
    await expect(page.getByText("Not Eligible for Public Display")).toBeVisible();

    // No path to ACTIVE is offered for rejected content.
    await expect(page.getByRole("button", { name: "Approve" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Activate" })).not.toBeVisible();
  } finally {
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete this message" }).click();
    await expect(page).toHaveURL(/\/admin\/positivity-boosts$/);
  }
});
