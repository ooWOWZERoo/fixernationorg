import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

const STAMP = Date.now();
const POST_TITLE = `QA e2e blog post ${STAMP}`;
const EDITED_TITLE = `QA e2e blog post edited ${STAMP}`;
const CATEGORY = `QA Category ${STAMP}`;
const BODY_TEXT = `QA e2e blog post body content, stamp ${STAMP}.`;

test.describe.configure({ mode: "serial" });

test("admin creates a blog post -> appears in list -> edits title -> persists -> deletes -> removed from list", async ({ page }) => {
  test.setTimeout(60000);

  await signInAsTestAdmin(page);
  await page.goto("/admin/blog/new");

  await page.getByLabel("Title").fill(POST_TITLE);
  await page.getByLabel("Category").fill(CATEGORY);
  await page.getByLabel("Body").fill(BODY_TEXT);
  await page.getByRole("button", { name: "Create Post" }).click();

  // Exclude "new" explicitly — under concurrent load this assertion can
  // resolve while the redirect off /admin/blog/new is still in flight,
  // otherwise matching the literal "new" segment and corrupting postId.
  await expect(page).toHaveURL(/\/admin\/blog\/(?!new$)[a-z0-9]+$/);
  const postId = page.url().split("/").pop();
  await expect(page.getByRole("heading", { name: POST_TITLE })).toBeVisible();

  try {
    await page.goto("/admin/blog");
    const row = page.locator("tbody tr").filter({ hasText: POST_TITLE });
    await expect(row).toBeVisible();
    await expect(row.getByText(CATEGORY, { exact: true })).toBeVisible();
    await expect(row.getByText("Draft", { exact: true })).toBeVisible();

    await row.getByRole("link", { name: "Edit" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/blog/${postId}$`));

    await page.getByLabel("Title").fill(EDITED_TITLE);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    // The edit page's heading renders from the server-fetched post, not the
    // in-memory form state, so it only reflects the save after a reload.
    await page.reload();
    await expect(page.getByLabel("Title")).toHaveValue(EDITED_TITLE);
    await expect(page.getByRole("heading", { name: EDITED_TITLE })).toBeVisible();

    await page.goto("/admin/blog");
    await expect(page.locator("tbody tr").filter({ hasText: EDITED_TITLE })).toBeVisible();
  } finally {
    await page.goto(`/admin/blog/${postId}`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/admin\/blog$/);
    await expect(page.locator("tbody tr").filter({ hasText: EDITED_TITLE })).not.toBeVisible();
  }
});
