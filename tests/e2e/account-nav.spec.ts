import { test, expect } from "@playwright/test";
import { signInAsTestMember } from "./helpers/auth";

test("account nav is grouped into labeled sections", async ({ page }) => {
  await signInAsTestMember(page);
  await page.goto("/account");

  const main = page.getByRole("main");

  await expect(main.getByText("Account", { exact: true })).toBeVisible();
  await expect(main.getByText("My Journey", { exact: true })).toBeVisible();

  await expect(main.getByRole("link", { name: "My Profile" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Settings", exact: true })).toBeVisible();
  await expect(main.getByRole("link", { name: "Security" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Billing" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Points" })).toBeVisible();

  await expect(main.getByRole("link", { name: "Home", exact: true })).toBeVisible();
  await expect(main.getByRole("link", { name: "Focus & Goals" })).toBeVisible();
  await expect(main.getByRole("link", { name: "My Plan" })).toBeVisible();
  await expect(main.getByRole("link", { name: "My Pathways" })).toBeVisible();
  await expect(main.getByRole("link", { name: "My Challenges" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Daily Check-In" })).toBeVisible();
  await expect(main.getByRole("link", { name: "Reflections" })).toBeVisible();
  await expect(main.getByRole("link", { name: "My Progress" })).toBeVisible();

  // Role-specific sections should not appear for a plain MEMBER account
  await expect(main.getByText("Business", { exact: true })).not.toBeVisible();
  await expect(main.getByText("Ambassador", { exact: true })).not.toBeVisible();
});
