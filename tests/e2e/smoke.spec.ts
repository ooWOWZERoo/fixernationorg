import { test, expect } from "@playwright/test";
import { signInAsTestMember } from "./helpers/auth";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Fixer Nation/i);
});

test("sign-in with valid credentials reaches the dashboard", async ({ page }) => {
  await signInAsTestMember(page);
  await page.goto("/dashboard");
  await expect(page.getByText(/welcome/i).first()).toBeVisible();
});

test("member can reach key Five Pillar pages", async ({ page }) => {
  await signInAsTestMember(page);

  for (const path of ["/account/home", "/account/pathways", "/account/challenges", "/account/checkin"]) {
    const res = await page.goto(path);
    expect(res?.status(), `${path} should return 200`).toBe(200);
  }
});
