import { test, expect } from "@playwright/test";

const STAMP = Date.now();
const NONEXISTENT_EMAIL = `qa-no-such-account-${STAMP}@example.com`;
const FAKE_TOKEN = `qa-fake-token-${STAMP}`;

// The success path (a real emailed token -> new password actually works) is
// not testable here since there's no inbox access. This covers the two
// parts that don't require a real token: the no-enumeration confirmation
// message on /forgot-password, and the invalid-token error on
// /reset-password.

test("forgot-password shows the same confirmation for an existing and a nonexistent email", async ({ page }) => {
  test.setTimeout(90000);

  // The API awaits a real SMTP send for the existing-account case before
  // responding. Wait on the actual response rather than guessing a UI
  // timeout, since this session has sent a lot of test email traffic and
  // the SMTP provider may be throttling.
  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(process.env.TEST_MFA_EMAIL!);
  const respPromise = page.waitForResponse(
    (r) => r.url().includes("/api/auth/forgot-password"),
    { timeout: 60000 },
  );
  await page.getByRole("button", { name: "Send reset link" }).click();
  const resp = await respPromise;
  expect(resp.status(), `forgot-password response: ${await resp.text().catch(() => "<no body>")}`).toBe(200);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText(process.env.TEST_MFA_EMAIL!)).toBeVisible();

  await page.goto("/forgot-password");
  await page.getByLabel("Email address").fill(NONEXISTENT_EMAIL);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText(NONEXISTENT_EMAIL)).toBeVisible();
});

test("reset-password rejects an invalid token", async ({ page }) => {
  await page.goto(`/reset-password?token=${FAKE_TOKEN}`);
  await page.getByLabel("New password").fill("a-brand-new-password");
  await page.getByLabel("Confirm password").fill("a-brand-new-password");
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page.getByText("This link is invalid.")).toBeVisible();
});
