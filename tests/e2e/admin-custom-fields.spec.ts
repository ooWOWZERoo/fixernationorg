import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

const STAMP = Date.now();
const LABEL = `QA e2e field ${STAMP}`;
const OPTIONS = "Hot, Warm, Cold";

test.describe.configure({ mode: "serial" });

test("admin creates a dropdown custom field -> toggles active -> deletes it", async ({ page }) => {
  test.setTimeout(30000);

  await signInAsTestAdmin(page);
  await page.goto("/admin/custom-fields");

  await page.getByRole("button", { name: "+ New field" }).click();
  // Neither field's <label> is associated to its <input>/<select> (no
  // htmlFor/id), so fall back to placeholder text / the sole visible
  // combobox, same as this suite's other admin forms with this gap.
  await page.getByPlaceholder("e.g. Lead score").fill(LABEL);
  await page.getByRole("combobox").selectOption("DROPDOWN");
  await page.getByPlaceholder("Hot lead, Warm, Cold").fill(OPTIONS);
  await page.getByRole("button", { name: "Create field" }).click();

  const row = page.locator("tbody tr").filter({ hasText: LABEL });
  await expect(row).toBeVisible();
  await expect(row.getByText("Dropdown", { exact: true })).toBeVisible();
  await expect(row.getByText(OPTIONS, { exact: true })).toBeVisible();
  await expect(row.locator("td").nth(3)).toHaveText("No");
  await expect(row.getByRole("button", { name: "Active", exact: true })).toBeVisible();
  await expect(row.locator("td").nth(5)).toHaveText("0");

  await row.getByRole("button", { name: "Active", exact: true }).click();
  await expect(row.getByRole("button", { name: "Inactive", exact: true })).toBeVisible();
  await row.getByRole("button", { name: "Inactive", exact: true }).click();
  await expect(row.getByRole("button", { name: "Active", exact: true })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Delete" }).click();
  await expect(row).not.toBeVisible();
});
