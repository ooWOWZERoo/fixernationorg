import { Page, expect } from "@playwright/test";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/signin");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/signin/, { timeout: 15000 });
}

export async function signInAsTestMember(page: Page) {
  const email = process.env.TEST_MEMBER_EMAIL;
  const password = process.env.TEST_MEMBER_PASSWORD;
  if (!email || !password) {
    throw new Error("TEST_MEMBER_EMAIL / TEST_MEMBER_PASSWORD not set — see .env.test");
  }
  await signIn(page, email, password);
}

// A second dedicated QA account, used only as a target for flows that can't
// act on the primary test member (e.g. recognitions block self-recognition).
export async function signInAsTestRecipient(page: Page) {
  const email = process.env.TEST_RECIPIENT_EMAIL;
  const password = process.env.TEST_RECIPIENT_PASSWORD;
  if (!email || !password) {
    throw new Error("TEST_RECIPIENT_EMAIL / TEST_RECIPIENT_PASSWORD not set — see .env.test");
  }
  await signIn(page, email, password);
}
