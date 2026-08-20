import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

const STAMP = Date.now();
const TOPIC_NAME = `QA e2e topic ${STAMP}`;
const TOPIC_DESC = `QA e2e topic description ${STAMP}`;

test.describe.configure({ mode: "serial" });

test("admin creates a newsletter topic -> toggles active -> deletes it", async ({ page }) => {
  test.setTimeout(30000);

  await signInAsTestAdmin(page);
  await page.goto("/admin/newsletter-topics");

  await page.getByRole("button", { name: "New Topic" }).click();
  // Neither field's <label> is associated to its <input> (no htmlFor/id),
  // so fall back to placeholder text, same as this suite's other admin forms.
  await page.getByPlaceholder("e.g. Weekly Roundup").fill(TOPIC_NAME);
  await page.getByPlaceholder("What subscribers get with this topic").fill(TOPIC_DESC);
  await page.getByRole("button", { name: "Create" }).click();

  const row = page.locator("tbody tr").filter({ hasText: TOPIC_NAME });
  await expect(row).toBeVisible();
  await expect(row.getByText(TOPIC_DESC)).toBeVisible();
  // Column order per the table header: Name, Slug, Subscribers, Status, Actions.
  await expect(row.locator("td").nth(2)).toHaveText("0");
  await expect(row.getByRole("button", { name: "Active", exact: true })).toBeVisible();

  await row.getByRole("button", { name: "Active", exact: true }).click();
  await expect(row.getByRole("button", { name: "Inactive", exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Inactive", exact: true }).click();
  await expect(row.getByRole("button", { name: "Active", exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Delete" }).click();
  await expect(row).not.toBeVisible();
});
