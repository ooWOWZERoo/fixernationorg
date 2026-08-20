import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

const STAMP = Date.now();
const TITLE = `QA e2e pathway ${STAMP}`;
const SUMMARY = `QA e2e summary ${STAMP}`;
const DESCRIPTION = `QA e2e description of a pathway created by the admin authoring test ${STAMP}`;
const STAGE_TITLE = `QA e2e stage ${STAMP}`;
const STAGE_PROMPT = `QA e2e action prompt ${STAMP}`;
const UPDATED_SUMMARY = `QA e2e summary updated ${STAMP}`;

test.describe.configure({ mode: "serial" });

test("admin creates a pathway -> adds a stage -> edits it -> deactivates it", async ({ page }) => {
  test.setTimeout(90000);

  await signInAsTestAdmin(page);
  await page.goto("/admin/pathways/new");

  await page.getByPlaceholder("e.g. Launch Your First Service").fill(TITLE);
  await page.getByPlaceholder("A short description shown on pathway cards.").fill(SUMMARY);
  await page
    .getByPlaceholder("Full description of this pathway, what members will learn, and what they'll accomplish.")
    .fill(DESCRIPTION);
  await page.getByRole("spinbutton").fill("21");

  await page.getByRole("button", { name: "Create pathway" }).click();
  await expect(page).toHaveURL(/\/admin\/pathways\/(?!new)[\w-]+$/);
  await expect(page.getByRole("heading", { name: TITLE, exact: true })).toBeVisible();

  await page.getByRole("button", { name: "+ Add stage", exact: true }).click();
  const addStageForm = page.locator("form").filter({ hasText: "New stage" });
  await addStageForm.locator('input[type="text"]').first().fill(STAGE_TITLE);
  await addStageForm.locator("select").selectOption("RESOURCE");
  await addStageForm.locator("textarea").fill(STAGE_PROMPT);
  await addStageForm.locator('input[type="number"]').fill("15");
  await addStageForm.getByRole("button", { name: "Add stage", exact: true }).click();

  await expect(addStageForm).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Stages (1)", exact: true })).toBeVisible();
  await expect(page.getByText(STAGE_TITLE)).toBeVisible();
  await expect(page.getByText("Resource", { exact: true })).toBeVisible();
  await expect(page.getByText("15 min")).toBeVisible();

  await page.getByRole("link", { name: "← Pathways" }).click();
  await expect(page).toHaveURL(/\/admin\/pathways$/);

  const row = page.locator("tbody tr").filter({ hasText: TITLE });
  await expect(row).toBeVisible();
  await expect(row.locator("td").nth(1)).toHaveText("1");
  await expect(row.locator("td").nth(4)).toHaveText("Active");

  await row.getByRole("link", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: TITLE, exact: true })).toBeVisible();

  const settingsForm = page.locator("form").filter({ hasText: "Pathway settings" });
  const summaryInput = settingsForm.locator('input[type="text"]').nth(1);
  await expect(summaryInput).toHaveValue(SUMMARY);
  await summaryInput.fill(UPDATED_SUMMARY);
  await settingsForm.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  await page.reload();
  await expect(page.locator("form").filter({ hasText: "Pathway settings" }).locator('input[type="text"]').nth(1)).toHaveValue(
    UPDATED_SUMMARY,
  );

  await page.getByRole("link", { name: "← Pathways" }).click();
  await expect(page).toHaveURL(/\/admin\/pathways$/);

  const rowAfterEdit = page.locator("tbody tr").filter({ hasText: TITLE });
  await rowAfterEdit.getByRole("button", { name: "Deactivate" }).click();
  await expect(rowAfterEdit.locator("td").nth(4)).toHaveText("Inactive");
  await expect(rowAfterEdit.getByRole("button", { name: "Deactivate" })).not.toBeVisible();

  await page.reload();
  const rowAfterReload = page.locator("tbody tr").filter({ hasText: TITLE });
  await expect(rowAfterReload.locator("td").nth(4)).toHaveText("Inactive");
});
