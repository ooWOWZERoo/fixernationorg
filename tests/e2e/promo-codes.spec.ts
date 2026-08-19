import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

// Seeded via a one-time admin endpoint against the qa-ambassador test user —
// see session notes. Affiliate detail is a fixed, stable id. Promo codes
// have no delete/deactivate UI, so a unique code per run avoids colliding
// with prior runs' codes (custom codes are globally unique — a duplicate
// is rejected with a 409).
const AFFILIATE_ID = "cmszf2ebi0002naq90i72v7ms";
const CODE = `QAE2E${Date.now()}`;

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signInAsTestAdmin(page);
  await page.goto(`/admin/affiliates/${AFFILIATE_ID}`);
  // "Promo codes" is the default active tab, but assert it explicitly in
  // case that ever changes.
  await page.getByRole("button", { name: "Promo codes" }).click();
});

test("create a promo code -> verify it in the list", async ({ page }) => {
  await page.getByPlaceholder("10").fill("15");
  await page.getByPlaceholder("Unlimited").fill("5");
  await page.getByPlaceholder("Auto-generated if blank").fill(CODE);
  await page.getByRole("button", { name: "Create code" }).click();

  await expect(page.getByText(`Code ${CODE} created.`)).toBeVisible();

  const row = page.locator("tbody tr").filter({ hasText: CODE });
  await expect(row).toBeVisible();
  await expect(row.getByText("15%")).toBeVisible();
  await expect(row.getByText("0 / 5")).toBeVisible();
  await expect(row.getByText("ACTIVE")).toBeVisible();
});

test("duplicate custom code is rejected", async ({ page }) => {
  await page.getByPlaceholder("10").fill("10");
  await page.getByPlaceholder("Auto-generated if blank").fill(CODE);
  await page.getByRole("button", { name: "Create code" }).click();

  await expect(page.getByText("Promo code already in use.")).toBeVisible();

  // Confirm no second row with this code was created — only the one from
  // the previous test.
  const rows = page.locator("tbody tr").filter({ hasText: CODE });
  await expect(rows).toHaveCount(1);
});

test("auto-generated code is created when left blank", async ({ page }) => {
  const rowsBefore = await page.locator("tbody tr").count();

  // Discount type defaults to Percentage, so the value placeholder is "10".
  await page.getByPlaceholder("10").fill("20");
  await page.getByRole("button", { name: "Create code" }).click();

  // Success message names whatever code the server generated.
  await expect(page.getByText(/^Code \S+ created\.$/)).toBeVisible();

  await expect(page.locator("tbody tr")).toHaveCount(rowsBefore + 1);
});
