import { test, expect } from "@playwright/test";
import { signInAsTestAdmin, signInAsTestMember } from "./helpers/auth";

const STAMP = Date.now();
const DESCRIPTION = `QA e2e gift code ${STAMP}`;

test.describe.configure({ mode: "serial" });

let generatedCode = "";

test("generate a gift code -> redeem as a member -> verify redeemed in admin", async ({ page }) => {
  test.setTimeout(45000);

  await signInAsTestAdmin(page);
  await page.goto("/admin/gift-codes");

  await page.getByPlaceholder("Optional note").fill(DESCRIPTION);
  await page.getByRole("button", { name: "Generate" }).click();

  const row = page.locator("tbody tr").filter({ hasText: DESCRIPTION });
  await expect(row).toBeVisible();
  generatedCode = (await row.locator("span.font-mono").innerText()).trim();
  expect(generatedCode.length).toBeGreaterThan(0);

  await signInAsTestMember(page);
  await page.goto("/redeem");
  await page.getByLabel("Gift code").fill(generatedCode);
  await page.getByRole("button", { name: "Redeem code" }).click();

  await expect(page.getByText("Done. Your account has been upgraded.")).toBeVisible();

  await signInAsTestAdmin(page);
  await page.goto("/admin/gift-codes");
  const redeemedRow = page.locator("tbody tr").filter({ hasText: generatedCode });
  await expect(redeemedRow).toBeVisible();
  await expect(redeemedRow.getByText("MEMBER", { exact: true })).toBeVisible();
});

test("redeeming an already-used code shows an error", async ({ page }) => {
  test.setTimeout(30000);
  expect(generatedCode.length).toBeGreaterThan(0);

  await signInAsTestMember(page);
  await page.goto("/redeem");
  await page.getByLabel("Gift code").fill(generatedCode);
  await page.getByRole("button", { name: "Redeem code" }).click();

  await expect(page.getByText("That code has already been redeemed.")).toBeVisible();
});

test("redeeming a nonexistent code shows an error", async ({ page }) => {
  test.setTimeout(30000);

  await signInAsTestMember(page);
  await page.goto("/redeem");
  await page.getByLabel("Gift code").fill(`FN-NOPE-${STAMP}`);
  await page.getByRole("button", { name: "Redeem code" }).click();

  await expect(page.getByText("That code doesn't exist.")).toBeVisible();
});
