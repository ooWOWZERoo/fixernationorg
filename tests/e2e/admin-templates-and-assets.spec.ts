import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

const STAMP = Date.now();
const TEMPLATE_NAME = `QA e2e template ${STAMP}`;
const TEMPLATE_SUBJECT = `QA e2e template subject ${STAMP}`;
const HEADING_TEXT = `QA e2e heading ${STAMP}`;
const SECTION_NAME = `QA e2e section ${STAMP}`;

// Minimal 1x1 red PNG, inlined so this doesn't need a fixture file on disk.
const PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signInAsTestAdmin(page);
});

test("media library: upload an image, edit its alt text, find it by search", async ({ page }) => {
  test.setTimeout(30000);

  await page.goto("/admin/media");
  // The upload API strips the file extension into the stored `name` field.
  const assetBaseName = `qa-e2e-asset-${STAMP}`;

  await page.locator('input[type="file"]').setInputFiles({
    name: `${assetBaseName}.png`,
    mimeType: "image/png",
    buffer: PNG_BUFFER,
  });
  await expect(page.getByRole("button", { name: "Uploading…" })).toHaveCount(0, { timeout: 15000 });

  await page.getByPlaceholder("Search by name, alt text, or tags…").fill(assetBaseName);
  const card = page.getByRole("button").filter({ hasText: assetBaseName });
  await expect(card).toBeVisible();
  await card.click();

  // Selecting the asset opens a detail panel — alt text starts as a
  // "Click to add alt text" trigger button that swaps to a textarea + Save.
  const altText = `QA e2e alt text ${STAMP}`;
  await page.getByRole("button", { name: "Click to add alt text" }).click();
  await page.locator("#alt-textarea").fill(altText);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: altText, exact: true })).toBeVisible();
});

test("email template: create with a block -> save/insert a section -> clone -> approve -> retire -> restore -> delete", async ({ page }) => {
  test.setTimeout(60000);

  await page.goto("/admin/email-templates/new");
  await page.getByPlaceholder("e.g. Monthly Newsletter").fill(TEMPLATE_NAME);
  await page.getByPlaceholder("e.g. Your monthly update from Fixer Nation").fill(TEMPLATE_SUBJECT);

  // Add a Heading block and set its text — this also selects the block and
  // shows its inline editor immediately.
  await page.getByRole("button", { name: "Heading", exact: true }).click();
  await page.getByPlaceholder("Heading text").fill(HEADING_TEXT);

  // Save the single block as a reusable section (prompt() for the name).
  // The click resolves on the click event, not on the handler's internal
  // await fetch(...) — wait for the "Saving…" state to clear so the POST
  // has actually landed before moving on.
  page.once("dialog", (dialog) => dialog.accept(SECTION_NAME));
  await page.getByRole("button", { name: "Save section" }).click();
  await expect(page.getByRole("button", { name: "Save section" })).toBeVisible({ timeout: 10000 });

  await page.getByRole("button", { name: "Create template" }).click();
  await expect(page).toHaveURL(/\/admin\/email-templates\/[a-z0-9]+$/);
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();

  // Reopen the Sections panel and insert the just-saved section — this
  // should append a second copy of the heading block.
  await page.getByRole("button", { name: "Sections" }).click();
  await expect(page.getByText(SECTION_NAME)).toBeVisible();
  await page.getByRole("button", { name: SECTION_NAME }).click();
  await expect(page.getByText(HEADING_TEXT)).toHaveCount(2);

  // Clean up the saved section itself so it doesn't accumulate across runs.
  await page.getByRole("button", { name: "Sections" }).click();
  const sectionRow = page.locator("xpath=//button[normalize-space(text())='" + SECTION_NAME + "']/..");
  await sectionRow.getByText("✕").click();
  await expect(page.getByText(SECTION_NAME)).not.toBeVisible();

  // Clone -> full navigation (window.location.href, not router.push — see
  // the fix in [id].tsx) to a new draft template with "Copy of " + name.
  // The URL regex below also matches the pre-click URL, so it's not a
  // reliable "navigation happened" signal by itself — wait for the actual
  // cloned content (the renamed field) before trusting page.url().
  await page.getByRole("button", { name: "Clone" }).click();
  await expect(page).toHaveURL(/\/admin\/email-templates\/[a-z0-9]+$/);
  await expect(page.locator('input[type="text"]').first()).toHaveValue(`Copy of ${TEMPLATE_NAME}`, { timeout: 15000 });
  const cloneUrl = page.url();
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();

  // Status transitions on the clone: Draft -> Approved -> Retired -> Draft.
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retire" }).click();
  await expect(page.getByText("Retired", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Restore to draft" }).click();
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();

  // Delete the clone (0 campaigns, so the Danger zone delete is available).
  await expect(page).toHaveURL(cloneUrl);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete this template" }).click();
  await expect(page).toHaveURL(/\/admin\/email-templates$/);
  await expect(page.getByText(TEMPLATE_NAME).first()).toBeVisible();

  // Delete the original template from the list too.
  const card = page.locator("xpath=//h2[normalize-space(text())='" + TEMPLATE_NAME + "']/..");
  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText(TEMPLATE_NAME)).not.toBeVisible();
});
