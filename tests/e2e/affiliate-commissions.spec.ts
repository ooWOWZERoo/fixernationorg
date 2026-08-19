import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

// Seeded via a one-time admin endpoint against the qa-ambassador test user —
// see session notes. Affiliate detail is a fixed, stable id.
const AFFILIATE_ID = "cmszf2ebi0002naq90i72v7ms";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signInAsTestAdmin(page);
});

async function addLedgerEntry(page: import("@playwright/test").Page, description: string, gross: string, commission: string) {
  await page.goto(`/admin/affiliates/${AFFILIATE_ID}`);
  await page.getByRole("button", { name: "Ledger" }).click();

  await page.locator("select").selectOption("BONUS");
  await page.getByPlaceholder("e.g. Q3 performance bonus").fill(description);
  const amountInputs = page.locator('input[type="number"][step="0.01"]');
  await amountInputs.nth(0).fill(gross);
  await amountInputs.nth(1).fill(commission);
  // Pending days must be > 0, or the server auto-approves the entry
  // immediately (status: pendingUntil ? "PENDING" : "APPROVED" in
  // src/pages/api/admin/affiliates/[id].ts) — leaving it at the default 0
  // skips the PENDING state entirely.
  await page.locator('input[type="number"][min="0"]').fill("1");
  await page.getByRole("button", { name: "Add entry" }).click();
  await expect(page.getByText("Entry added.")).toBeVisible();

  // Reloading remounts the page, so the active-tab state resets to its
  // default — re-open the Ledger tab before looking for the row.
  await page.reload();
  await page.getByRole("button", { name: "Ledger" }).click();
  const row = page.locator("tbody tr").filter({ hasText: description }).first();
  await expect(row).toBeVisible();
  return row;
}

test("add a manual ledger entry -> approve -> mark paid", async ({ page }) => {
  const row = await addLedgerEntry(page, "QA e2e ledger entry - approve and pay", "100", "10");
  await expect(row.getByText("PENDING", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "Approve" }).click();
  await expect(row.getByText("APPROVED", { exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "Mark paid" })).toBeVisible();

  await row.getByRole("button", { name: "Mark paid" }).click();
  await expect(row.getByText("PAID", { exact: true })).toBeVisible();

  // A paid entry is terminal — no further action buttons render for it.
  await expect(row.getByRole("button")).toHaveCount(0);
});

test("hold and release a pending entry", async ({ page }) => {
  const row = await addLedgerEntry(page, "QA e2e ledger entry - hold and release", "50", "5");
  await expect(row.getByText("PENDING", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "Hold" }).click();
  await expect(row.getByText("ON_HOLD", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "Release" }).click();
  await expect(row.getByText("PENDING", { exact: true })).toBeVisible();
});

test("reversing an entry requires a reason", async ({ page }) => {
  const row = await addLedgerEntry(page, "QA e2e ledger entry - reverse", "25", "2.50");
  await expect(row.getByText("PENDING", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "Reverse" }).click();

  const confirmButton = page.getByRole("button", { name: "Confirm reverse" });
  await expect(confirmButton).toBeDisabled();

  await page.getByPlaceholder("Reason for reversal (required)").fill("QA e2e test reversal");
  await expect(confirmButton).toBeEnabled();
  await confirmButton.click();

  await expect(row.getByText("REVERSED", { exact: true })).toBeVisible();
  await expect(row.getByRole("button")).toHaveCount(0);
});
