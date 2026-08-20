import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

const STAMP = Date.now();
const TITLE = `QA e2e challenge ${STAMP}`;
const SUMMARY = `QA e2e summary ${STAMP}`;
const UPDATED_SUMMARY = `QA e2e summary ${STAMP} (updated)`;
const DESCRIPTION = `QA e2e description for automated admin-authoring coverage ${STAMP}.`;
const STEP_TITLE = `QA e2e step ${STAMP}`;
const DURATION_DAYS = "5";
const LOYALTY_POINTS = "25";

test.describe.configure({ mode: "serial" });

test("admin creates challenge -> adds step -> edits -> deactivates", async ({ page }) => {
  test.setTimeout(60000);

  await signInAsTestAdmin(page);
  await page.goto("/admin/challenges/new");

  const newForm = page.locator("form");
  await newForm.getByPlaceholder("e.g. 30-Day Business Foundations Challenge").fill(TITLE);
  await newForm.getByPlaceholder("A short description of what members will accomplish.").fill(SUMMARY);
  await newForm
    .getByPlaceholder("Full description of this challenge — what members will do, learn, and achieve.")
    .fill(DESCRIPTION);
  await newForm.locator('input[type="number"]').nth(0).fill(DURATION_DAYS);
  await newForm.locator('input[type="number"]').nth(1).fill(LOYALTY_POINTS);

  // Start mode already defaults to EVERGREEN, the only value that doesn't
  // also require a start date — leaving it selected keeps this test generic.
  await expect(newForm.getByRole("combobox")).toHaveValue("EVERGREEN");

  await newForm.getByRole("button", { name: "Create challenge" }).click();

  // Exclude "new" explicitly — under concurrent load this assertion can
  // resolve while the redirect off /admin/challenges/new is still in flight.
  await expect(page).toHaveURL(/\/admin\/challenges\/(?!new$)[^/]+$/);
  await expect(page.getByRole("heading", { name: TITLE, level: 1 })).toBeVisible();

  const slug = await page.locator("input[readonly]").inputValue();
  expect(slug.length).toBeGreaterThan(0);

  await page.getByRole("button", { name: "+ Add step" }).click();
  const stepForm = page.locator("form").filter({ hasText: "New step" });
  await stepForm.locator('input[type="number"]').fill("1");
  await stepForm.locator('input[type="text"]').fill(STEP_TITLE);
  await stepForm.getByPlaceholder("What should the member do on this day?").fill("Do the QA thing.");
  await stepForm.getByPlaceholder("Optional question for member reflection").fill("How did it go?");
  await stepForm.getByRole("button", { name: "Add step" }).click();

  await expect(page.getByRole("heading", { name: "Steps (1)" })).toBeVisible();
  await expect(page.getByText(STEP_TITLE)).toBeVisible();

  const settingsForm = page.locator("form").filter({ hasText: "Challenge settings" });
  const summaryInput = settingsForm.locator('input[type="text"]').nth(1);
  await summaryInput.fill(UPDATED_SUMMARY);
  await settingsForm.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.reload();
  await expect(page.locator("form").filter({ hasText: "Challenge settings" }).locator('input[type="text"]').nth(1)).toHaveValue(
    UPDATED_SUMMARY
  );
  await expect(page.getByText(STEP_TITLE)).toBeVisible();

  await page.goto("/admin/challenges");
  const row = page.locator("tbody tr").filter({ hasText: TITLE });
  await expect(row).toBeVisible();
  await expect(row.locator("td").nth(1)).toHaveText("1");
  await expect(row.locator("td").nth(2)).toHaveText(DURATION_DAYS);
  await expect(row.getByText("Active", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "Deactivate" }).click();
  await expect(row.getByText("Inactive", { exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "Deactivate" })).not.toBeVisible();

  await page.reload();
  const reloadedRow = page.locator("tbody tr").filter({ hasText: TITLE });
  await expect(reloadedRow.getByText("Inactive", { exact: true })).toBeVisible();
  await expect(reloadedRow.getByRole("link", { name: "Edit" })).toBeVisible();

  await page.goto(`/challenges/${slug}`);
  await expect(page.getByRole("heading", { name: "We can't find that page" })).toBeVisible();

  await page.goto("/challenges");
  await expect(page.getByText(TITLE)).not.toBeVisible();
});
