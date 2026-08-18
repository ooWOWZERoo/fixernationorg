import { Page, expect } from "@playwright/test";

export async function signInAsTestMember(page: Page) {
  const email = process.env.TEST_MEMBER_EMAIL;
  const password = process.env.TEST_MEMBER_PASSWORD;
  if (!email || !password) {
    throw new Error("TEST_MEMBER_EMAIL / TEST_MEMBER_PASSWORD not set — see .env.test");
  }

  await page.goto("/signin");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/signin/, { timeout: 15000 });
}
