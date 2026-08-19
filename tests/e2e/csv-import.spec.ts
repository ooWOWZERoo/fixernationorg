import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";
import fs from "fs";
import os from "os";
import path from "path";

// Contacts have no delete UI reachable from this flow, so use fresh,
// timestamp-unique emails each run rather than fixed ones — avoids the
// "already exists" skip path from ever-accumulating prior runs, and lets us
// test that path deliberately in its own test below.
const STAMP = Date.now();
const EMAIL_1 = `qa-import-1-${STAMP}@example.com`;
const EMAIL_2 = `qa-import-2-${STAMP}@example.com`;

function writeCsv(): string {
  const csv = [
    "Email,First Name,Last Name,Phone",
    `${EMAIL_1},QA,ImportOne,555-0001`,
    `${EMAIL_2},QA,ImportTwo,555-0002`,
    ",,,", // a row with no email — should be skipped, not imported
  ].join("\n");
  const filePath = path.join(os.tmpdir(), `qa-e2e-import-${STAMP}.csv`);
  fs.writeFileSync(filePath, csv);
  return filePath;
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signInAsTestAdmin(page);
});

test("import a CSV -> verify preview, consent, and result", async ({ page }) => {
  const filePath = writeCsv();
  await page.goto("/admin/contacts/import");

  await page.locator('input[type="file"]').setInputFiles(filePath);

  await expect(page.getByText("2 contacts ready to import")).toBeVisible();
  await expect(page.getByText("1 row skipped (no email)")).toBeVisible();
  await expect(page.getByText(EMAIL_1)).toBeVisible();
  await expect(page.getByText(EMAIL_2)).toBeVisible();
  await expect(page.getByText("QA ImportOne")).toBeVisible();

  // This CSV has no subscriber-status column, so the opt-in checkboxes show.
  await expect(page.getByText("Opt in to email lists (optional)")).toBeVisible();
  await page.getByText("Newsletters").click();

  await page.getByRole("button", { name: "Import 2 contacts" }).click();

  await expect(page.getByText("Import complete")).toBeVisible();
  await expect(page.getByText("2 contacts added")).toBeVisible();
  await expect(page.getByText("2 consent records set")).toBeVisible();

  // Import history is server-rendered and isn't refetched after a client-side
  // import, so the new batch only shows up after a reload.
  await page.reload();
  await expect(page.getByText("Import history")).toBeVisible();
  const historyRow = page.locator("tbody tr").first();
  await expect(historyRow.locator("td").nth(1)).toHaveText("2"); // Rows
  await expect(historyRow.locator("td").nth(2)).toHaveText("2"); // Added
  await expect(historyRow.locator("td").nth(3)).toHaveText("0"); // Skipped
});

test("re-importing the same emails reports them as skipped", async ({ page }) => {
  const filePath = writeCsv();
  await page.goto("/admin/contacts/import");

  await page.locator('input[type="file"]').setInputFiles(filePath);
  await expect(page.getByText("2 contacts ready to import")).toBeVisible();

  await page.getByRole("button", { name: "Import 2 contacts" }).click();

  await expect(page.getByText("Import complete")).toBeVisible();
  await expect(page.getByText("0 contacts added")).toBeVisible();
  await expect(page.getByText("2 skipped — email already in contacts")).toBeVisible();
});
