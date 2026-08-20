import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

const STAMP = Date.now();
const TITLE = `QA e2e morning boost ${STAMP}`;
const EDITED_TITLE = `${TITLE} edited`;
const BODY = `QA e2e morning boost body content, stamp ${STAMP}.`;

// The single most-recently-published entry is the "featured" boost shown to
// everyone, including signed-out visitors — dating this test entry in 2021
// keeps it far behind any real content and out of that slot.
const PUBLISHED_AT = "2021-01-15T08:00";

test.describe.configure({ mode: "serial" });

test("admin creates, edits, and deletes a Morning Boost entry", async ({ page }) => {
  test.setTimeout(45000);

  await signInAsTestAdmin(page);
  await page.goto("/admin/morning-boost/new");

  await page.getByLabel("Title").fill(TITLE);
  await page.getByLabel("Body").fill(BODY);
  await page.locator('input[type="datetime-local"]').fill(PUBLISHED_AT);
  await page.getByRole("button", { name: "Create Entry" }).click();

  await expect(page).toHaveURL(/\/admin\/morning-boost\/[a-z0-9-]+$/);

  try {
    await page.goto("/admin/morning-boost");
    const row = page.locator("tbody tr").filter({ hasText: TITLE });
    await expect(row).toBeVisible();
    await expect(row.getByText("Published", { exact: true })).toBeVisible();

    await row.getByRole("link", { name: "Edit" }).click();
    await expect(page.getByLabel("Title")).toHaveValue(TITLE);

    await page.getByLabel("Title").fill(EDITED_TITLE);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Title")).toHaveValue(EDITED_TITLE);

    await page.goto("/admin/morning-boost");
    await expect(page.locator("tbody tr").filter({ hasText: EDITED_TITLE })).toBeVisible();
  } finally {
    await page.goto("/admin/morning-boost");
    const row = page.locator("tbody tr").filter({ hasText: TITLE }).first();
    if (await row.isVisible().catch(() => false)) {
      await row.getByRole("link", { name: "Edit" }).click();
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page).toHaveURL(/\/admin\/morning-boost$/);
    }
  }

  await expect(page.locator("tbody tr").filter({ hasText: TITLE })).not.toBeVisible();
});
