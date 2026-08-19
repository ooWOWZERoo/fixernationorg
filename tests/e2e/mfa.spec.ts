import { test, expect } from "@playwright/test";
import { signInAsTestMfa } from "./helpers/auth";
import { generateTOTP } from "./helpers/totp";

// This test enables real MFA, which requires a dedicated account
// (qa-mfa-test, seeded via the now-removed one-time admin endpoint) rather
// than the shared qa-member — a previous version of this test used
// qa-member and, when the test's own timeout cut off the disable step mid
// run, left MFA stuck on for that account, breaking every other test's
// signInAsTestMember running concurrently (4 unrelated tests failed on
// their first attempt in a full-suite run before this was caught). The
// mutating "enable" click is the only step that flips mfaEnabled
// server-side (confirmed in src/pages/api/account/mfa/enable.ts) —
// everything from that click onward runs in a try/finally so the account
// is always disabled again, including on assertion failure. The "sign in
// requires a code" check happens in a SEPARATE browser context, so the
// original page's already-authenticated session is never touched and can
// always reach /account/security to disable MFA even if the second
// context's sign-in attempt goes wrong.
test("enable MFA -> sign-in requires a code -> disable MFA", async ({ page, browser }) => {
  test.setTimeout(120000);

  await signInAsTestMfa(page);
  await page.goto("/account/security");
  await expect(page.getByText("Off", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Enable two-factor authentication" }).click();
  await page.getByText("Can't scan? Enter the key manually").click();
  const secret = (await page.locator("p.font-mono").textContent())?.trim();
  expect(secret?.length).toBeGreaterThan(0);
  if (!secret) throw new Error("Could not read MFA secret");

  await page.getByRole("button", { name: "I've added it — continue" }).click();
  await page.getByPlaceholder("000000").fill(generateTOTP(secret));

  try {
    await page.getByRole("button", { name: "Verify and enable" }).click();
    await expect(page.getByText("Two-factor authentication is now active.")).toBeVisible();

    // Fresh, unauthenticated context — proves sign-in now demands a code.
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto("/signin");
    await page2.getByLabel("Email address").fill(process.env.TEST_MFA_EMAIL!);
    await page2.getByLabel("Password").fill(process.env.TEST_MFA_PASSWORD!);
    await page2.getByRole("button", { name: "Sign in" }).click();

    await expect(page2.getByRole("heading", { name: "Two-factor verification" })).toBeVisible();
    await page2.getByPlaceholder("000000").fill(generateTOTP(secret));
    await page2.getByRole("button", { name: "Verify" }).click();
    await expect(page2).not.toHaveURL(/\/signin/, { timeout: 15000 });
    await context2.close();
  } finally {
    // Original page's session was never touched — still authenticated, no
    // MFA prompt needed to reach this page.
    await page.goto("/account/security");
    if (await page.getByRole("button", { name: "Disable two-factor authentication" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Disable two-factor authentication" }).click();
      await page.getByPlaceholder("000000").fill(generateTOTP(secret));
      await page.getByRole("button", { name: "Confirm disable" }).click();
      await expect(page.getByText("Off", { exact: true })).toBeVisible();
    }
  }

  // Confirm a normal, code-free sign-in works again for future runs.
  const context3 = await browser.newContext();
  const page3 = await context3.newPage();
  await page3.goto("/signin");
  await page3.getByLabel("Email address").fill(process.env.TEST_MFA_EMAIL!);
  await page3.getByLabel("Password").fill(process.env.TEST_MFA_PASSWORD!);
  await page3.getByRole("button", { name: "Sign in" }).click();
  await expect(page3).not.toHaveURL(/\/signin/, { timeout: 15000 });
  await context3.close();
});
