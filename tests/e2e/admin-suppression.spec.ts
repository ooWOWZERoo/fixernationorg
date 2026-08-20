import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

const STAMP = Date.now();
const TEST_EMAIL = `qa-suppression-${STAMP}@fixernation-e2e.test`;
const REASON = `QA e2e test reason ${STAMP}`;
const NO_MATCH_QUERY = `qa-suppression-no-match-${STAMP}`;

test.describe.configure({ mode: "serial" });

test("admin adds a manual suppression -> filters find it -> lift marks it inactive", async ({ page }) => {
  test.setTimeout(30000);

  await signInAsTestAdmin(page);
  await page.goto("/admin/suppression");

  await page.getByRole("button", { name: "+ Add suppression" }).click();
  // Neither label here is associated to its input (no htmlFor/id), so fall
  // back to placeholder text, same as the other admin forms with this gap.
  await page.getByPlaceholder("contact@example.com").fill(TEST_EMAIL);
  await page.getByPlaceholder("e.g. requested by contact").fill(REASON);
  await page.getByRole("button", { name: "Add suppression" }).click();

  const row = page.locator("tbody tr").filter({ hasText: TEST_EMAIL });
  await expect(row).toBeVisible();
  await expect(row.getByText("Manual", { exact: true })).toBeVisible();
  await expect(row.getByText(REASON)).toBeVisible();
  await expect(row.getByText("Active", { exact: true })).toBeVisible();

  await page.getByPlaceholder("Search by email…").fill(NO_MATCH_QUERY);
  await expect(page.getByText("No records match your filters.")).toBeVisible();

  await page.getByPlaceholder("Search by email…").fill(TEST_EMAIL);
  await expect(row).toBeVisible();

  await page.getByRole("combobox").first().selectOption("BOUNCE");
  await expect(page.getByText("No records match your filters.")).toBeVisible();
  await page.getByRole("combobox").first().selectOption("all");
  await expect(row).toBeVisible();

  await page.getByRole("combobox").nth(1).selectOption("lifted");
  await expect(page.getByText("No records match your filters.")).toBeVisible();
  await page.getByRole("combobox").nth(1).selectOption("active");
  await expect(row).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Lift" }).click();
  // The activeFilter is still "active" here, and lifting flips r.active to
  // false client-side — switch to "all" or the row is filtered out entirely.
  await page.getByRole("combobox").nth(1).selectOption("all");
  await expect(row.getByText(/^Lifted/)).toBeVisible();
  await expect(row.getByRole("button", { name: "Lift" })).not.toBeVisible();
});
