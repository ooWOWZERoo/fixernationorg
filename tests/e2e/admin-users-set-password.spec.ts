import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

test("admin can set a member's password via /admin/users set-password panel", async ({ page }) => {
  test.setTimeout(30000);

  await signInAsTestAdmin(page);
  await page.goto("/admin/users");

  // Find a QA test account row that's not the admin's own account and not a super admin
  // Look for qa-provider or qa-ambassador or similar test accounts
  const rows = page.locator("tbody tr");
  const rowCount = await rows.count();
  console.log(`Found ${rowCount} rows in admin/users table`);

  let targetRow = null;
  let targetEmail = "";

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const emailText = await row.locator("td").first().textContent();
    const rowText = await row.textContent();

    // Skip the current user's row (marked with "you")
    if (rowText?.includes("you")) {
      console.log(`Skipping own row: ${emailText}`);
      continue;
    }

    // Look for qa-provider, qa-ambassador, or other test accounts
    if (emailText?.includes("qa-")) {
      console.log(`Checking row: ${emailText}`);

      // Verify "Set password" button exists (indicating not a super admin and not own row)
      const setPasswordBtn = row.locator('button:has-text("Set password")');
      const btnCount = await setPasswordBtn.count();

      if (btnCount > 0) {
        targetRow = row;
        targetEmail = emailText || "Unknown";
        console.log(`Selected target row: ${targetEmail}`);
        break;
      }
    }
  }

  expect(targetRow, `Could not find a suitable test account row with "Set password" button`).toBeTruthy();

  // Click the "Set password" button
  const setPasswordBtn = targetRow!.locator('button:has-text("Set password")');
  await expect(setPasswordBtn).toBeVisible();
  await setPasswordBtn.click();
  console.log(`✓ Clicked "Set password" button`);

  // The panel appears in the NEXT row (sibling <tr>). Wait for it to appear.
  // The panel row contains a text input with placeholder "At least 8 characters"
  const panelInput = page.locator('input[placeholder="At least 8 characters"]').first();
  await expect(panelInput).toBeVisible({ timeout: 5000 });
  console.log(`✓ Password panel appeared`);

  // Type a test password (at least 8 characters)
  const testPassword = "TestPassword123!";
  await panelInput.fill(testPassword);
  console.log(`✓ Entered test password: "${testPassword}"`);

  // Click "Save password" button (it's in the same panel row)
  const saveBtn = page.locator('button:has-text("Save password")').first();
  await expect(saveBtn).toBeVisible();
  await saveBtn.click();
  console.log(`✓ Clicked "Save password" button`);

  // Confirm success message appears (should say "Password set")
  const successMsg = page.locator('text=Password set').first();
  await expect(successMsg).toBeVisible({ timeout: 5000 });
  console.log(`✓ "Password set" success message appeared`);

  // Wait a moment for the auto-close timeout (2 seconds in the code)
  await page.waitForTimeout(2500);

  // Reload the page and confirm the panel is closed/reset
  await page.reload();
  await page.waitForLoadState("networkidle");

  // Find the target row again by email
  const reloadedTargetRow = page.locator("tbody tr").filter({ hasText: targetEmail }).first();
  await expect(reloadedTargetRow).toBeVisible();

  // The password panel should no longer be visible
  const panelInputAfterReload = page.locator('input[placeholder="At least 8 characters"]').first();
  const panelVisible = await panelInputAfterReload.isVisible().catch(() => false);

  expect(panelVisible).toBe(false);
  console.log(`✓ Panel is closed after reload`);

  console.log(`✓ All set-password functional checks passed for ${targetEmail}`);
});
