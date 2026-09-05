import { test, expect } from "@playwright/test";
import { signInAsTestMfa } from "./helpers/auth";

// Uses the dedicated qa-mfa-test account (not qa-member) because this test
// changes the display name and password — mutations that would collide with
// other tests running concurrently against the shared qa-member account
// (e.g. progress.spec.ts asserts on the literal text "QA Test Member").
const STAMP = Date.now();
const ORIGINAL_NAME = "QA MFA Test";
const TEMP_NAME = `QA Settings Test ${STAMP}`;
const ORIGINAL_PW = process.env.TEST_MFA_PASSWORD!;
const NEW_PW = `Temp-${STAMP}-pw!`;

test.describe.configure({ mode: "serial" });

test("update display name -> persists after reload", async ({ page }) => {
  test.setTimeout(30000);

  try {
    await signInAsTestMfa(page);
    await page.goto("/account");
    await page.getByPlaceholder("Your name").fill(TEMP_NAME);
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText("Name updated.")).toBeVisible();

    await page.reload();
    await expect(page.getByPlaceholder("Your name")).toHaveValue(TEMP_NAME);
  } finally {
    await page.goto("/account");
    await page.getByPlaceholder("Your name").fill(ORIGINAL_NAME);
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText("Name updated.")).toBeVisible();
  }
});

test("toggle Morning Boost email preference -> persists after reload", async ({ page }) => {
  test.setTimeout(30000);

  await signInAsTestMfa(page);
  await page.goto("/account");
  // The email-preferences card has one checkbox per topic now (Morning
  // Boost, Promos & offers, Newsletter, Product updates) -- target this
  // one by its label text rather than assuming it's the page's only one.
  const checkbox = page.getByRole("checkbox", { name: /Morning Boost/i });
  await expect(checkbox).toBeChecked();

  await checkbox.uncheck();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Morning Boost/i })).not.toBeChecked();

  await page.getByRole("checkbox", { name: /Morning Boost/i }).check();
  await expect(page.getByText("Saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: /Morning Boost/i })).toBeChecked();
});

test("change password -> new password signs in -> reverted to original", async ({ page, browser }) => {
  test.setTimeout(45000);

  await signInAsTestMfa(page);
  await page.goto("/account");
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.nth(0).fill(ORIGINAL_PW);
  await passwordInputs.nth(1).fill(NEW_PW);
  await passwordInputs.nth(2).fill(NEW_PW);

  try {
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText("Password updated.")).toBeVisible();

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto("/signin");
    await page2.getByLabel("Email address").fill(process.env.TEST_MFA_EMAIL!);
    await page2.getByLabel("Password").fill(NEW_PW);
    await page2.getByRole("button", { name: "Sign in" }).click();
    await expect(page2).not.toHaveURL(/\/signin/, { timeout: 15000 });
    await context2.close();
  } finally {
    // Original page's session was never touched — still authenticated.
    await page.goto("/account");
    const revertInputs = page.locator('input[type="password"]');
    await revertInputs.nth(0).fill(NEW_PW);
    await revertInputs.nth(1).fill(ORIGINAL_PW);
    await revertInputs.nth(2).fill(ORIGINAL_PW);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText("Password updated.")).toBeVisible();
  }

  // Confirm the original password works again for future runs.
  const context3 = await browser.newContext();
  const page3 = await context3.newPage();
  await page3.goto("/signin");
  await page3.getByLabel("Email address").fill(process.env.TEST_MFA_EMAIL!);
  await page3.getByLabel("Password").fill(ORIGINAL_PW);
  await page3.getByRole("button", { name: "Sign in" }).click();
  await expect(page3).not.toHaveURL(/\/signin/, { timeout: 15000 });
  await context3.close();
});
