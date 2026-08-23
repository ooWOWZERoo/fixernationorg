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

test("header profile dropdown includes My Journey under My Profile, linking to /account/home", async ({ page }) => {
  await signInAsTestMember(page);
  await page.goto("/dashboard");

  const banner = page.getByRole("banner");
  await banner.getByRole("button").first().click();

  const profileLink = banner.getByRole("link", { name: "My Profile" });
  const journeyLink = banner.getByRole("link", { name: "My Journey" });

  await expect(profileLink).toBeVisible();
  await expect(journeyLink).toBeVisible();
  await expect(journeyLink).toHaveAttribute("href", "/account/home");

  // "under My Profile" — confirm ordering, not just presence
  const linkTexts = await banner.getByRole("link").allTextContents();
  expect(linkTexts.indexOf("My Journey")).toBe(linkTexts.indexOf("My Profile") + 1);

  await journeyLink.click();
  await expect(page).toHaveURL(/\/account\/home$/);
});
