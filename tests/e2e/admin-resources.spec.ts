import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

const STAMP = Date.now();
const TITLE = `QA e2e resource ${STAMP}`;
const UPDATED_TITLE = `${TITLE} updated`;
const BODY_TEXT = `QA e2e resource body ${STAMP}`;

test.describe.configure({ mode: "serial" });

test("admin creates a resource -> appears in list -> edit persists -> delete removes it", async ({ page }) => {
  test.setTimeout(60000);

  await signInAsTestAdmin(page);
  await page.goto("/admin/resources/new");

  // The resource form's <label> elements aren't associated to their inputs
  // (no htmlFor/id, not nested), so getByLabel() can't find them — fall
  // back to positional locators, same as group-join.spec.ts does.
  await page.locator('form input[type="text"]').nth(0).fill(TITLE);
  await page.locator("form select").selectOption("Guide");
  await page.locator("form textarea").nth(1).fill(BODY_TEXT);

  await page.getByRole("button", { name: "Create Resource" }).click();
  await expect(page).toHaveURL(/\/admin\/resources\/[^/]+$/);
  const resourceId = page.url().split("/").pop()!;

  try {
    await page.goto("/admin/resources");
    const row = page.locator("tbody tr").filter({ hasText: TITLE });
    await expect(row).toBeVisible();
    await expect(row.getByText("Guide", { exact: true })).toBeVisible();

    await row.getByRole("link", { name: "Edit" }).click();
    await expect(page).toHaveURL(`/admin/resources/${resourceId}`);

    await page.locator('form input[type="text"]').nth(0).fill(UPDATED_TITLE);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.reload();
    await expect(page.locator('form input[type="text"]').nth(0)).toHaveValue(UPDATED_TITLE);
    await expect(page.getByRole("heading", { name: UPDATED_TITLE, exact: true })).toBeVisible();

    await page.goto("/admin/resources");
    await expect(page.locator("tbody tr").filter({ hasText: UPDATED_TITLE })).toBeVisible();
  } finally {
    await page.goto(`/admin/resources/${resourceId}`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/admin\/resources$/);
    await expect(page.locator("tbody tr").filter({ hasText: UPDATED_TITLE })).not.toBeVisible();
  }
});
