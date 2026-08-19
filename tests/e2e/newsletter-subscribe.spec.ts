import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

const STAMP = Date.now();
const EMAIL = `qa-newsletter-${STAMP}@example.com`;

test.describe.configure({ mode: "serial" });

async function subscribe(page: import("@playwright/test").Page, firstName: string) {
  await page.goto("/");
  await page.getByPlaceholder("First name (optional)").fill(firstName);
  await page.getByPlaceholder("you@email.com").fill(EMAIL);
  await page.getByRole("button", { name: "Subscribe" }).click();
}

test("subscribe from the homepage -> contact created with list membership and newsletter consent", async ({ page }) => {
  test.setTimeout(30000);

  await subscribe(page, "QA");
  await expect(page.getByText("You're subscribed!")).toBeVisible();
  await expect(page.getByText("Thanks for signing up. We'll send you the newsletter when it goes out.")).toBeVisible();

  await signInAsTestAdmin(page);
  await page.goto("/admin/contacts");
  await page.getByPlaceholder("Search by name, email, or company…").fill(EMAIL);
  // Search is debounced (400ms) and re-navigates the page — wait for that
  // navigation to settle before interacting, or the click races the re-render.
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(EMAIL)}`));
  const row = page.locator("tbody tr").filter({ hasText: EMAIL });
  await expect(row).toBeVisible();
  await row.getByRole("link").first().click();

  await expect(page).toHaveURL(/\/admin\/contacts\/[a-z0-9]+$/);
  await expect(page.getByText("Source: subscribe")).toBeVisible();

  await page.getByRole("button", { name: "Lists" }).click();
  await expect(page.getByRole("link", { name: "Newsletter Subscribers" })).toBeVisible();

  await page.getByRole("button", { name: "Consent" }).click();
  const newsletterRow = page.locator("div").filter({ hasText: /^Newsletters/ }).last();
  await expect(newsletterRow.getByRole("button", { name: "In" })).toHaveClass(/bg-green-600/);
});

test("re-subscribing the same email does not create a duplicate contact", async ({ page }) => {
  test.setTimeout(30000);

  await subscribe(page, "QA");
  await expect(page.getByText("You're subscribed!")).toBeVisible();

  await signInAsTestAdmin(page);
  await page.goto("/admin/contacts");
  await page.getByPlaceholder("Search by name, email, or company…").fill(EMAIL);
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(EMAIL)}`));
  await expect(page.locator("tbody tr").filter({ hasText: EMAIL })).toHaveCount(1);
});
