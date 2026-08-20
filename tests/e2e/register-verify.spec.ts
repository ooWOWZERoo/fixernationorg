import { test, expect } from "@playwright/test";
import { getVerificationToken, deleteTestUser, closeTestDb } from "./helpers/db";

// Registers a fresh, disposable account per run (real email verification
// requires a real token from the VerificationToken table — there's no
// mailbox to read in CI, so this reads it directly via TEST_DATABASE_URL,
// same DB the app itself writes to. See .env.test comment for scope.
const STAMP = Date.now();
const TEST_EMAIL = `qa-register-${STAMP}@fixernation-e2e.test`;
const TEST_NAME = "QA Register Test";
const TEST_PASSWORD = "Register-Test-Pw!23";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await deleteTestUser(TEST_EMAIL);
  await closeTestDb();
});

test("register -> check-your-email state -> duplicate email doesn't create a second account", async ({ page }) => {
  test.setTimeout(30000);

  await page.goto("/register");
  await page.getByLabel("Full name").fill(TEST_NAME);
  await page.getByLabel("Email address").fill(TEST_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText(TEST_EMAIL)).toBeVisible();

  // Re-submitting the same email must not create a second account or error —
  // the API always returns success to avoid leaking which emails are registered.
  await page.getByRole("button", { name: "try again" }).click();
  await page.getByLabel("Full name").fill(TEST_NAME);
  await page.getByLabel("Email address").fill(TEST_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
});

test("sign-in is blocked before verification -> succeeds after clicking the real verification link", async ({ page }) => {
  test.setTimeout(30000);

  await page.goto("/signin");
  await page.getByLabel("Email address").fill(TEST_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Your email or password is incorrect.")).toBeVisible();
  await expect(page).toHaveURL(/\/signin/);

  const token = await getVerificationToken(TEST_EMAIL);
  expect(token, "expected a pending VerificationToken row for the newly registered account").toBeTruthy();

  await page.goto(`/api/auth/verify-email?token=${token}`);
  await expect(page).toHaveURL(/\/signin\?verified=1/);
  await expect(page.getByText("Email verified! You can now sign in.")).toBeVisible();

  await page.getByLabel("Email address").fill(TEST_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/signin/, { timeout: 15000 });
});

test("verify-email rejects an invalid token", async ({ page }) => {
  test.setTimeout(15000);

  await page.goto("/api/auth/verify-email?token=not-a-real-token");
  await expect(page).toHaveURL(/\/signin\?error=InvalidToken/);
  await expect(page.getByText("That link is invalid.")).toBeVisible();
});
