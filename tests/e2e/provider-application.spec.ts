import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

const STAMP = Date.now();
const EMAIL = `qa-provider-app-${STAMP}@example.com`;
const FIRST_NAME = "QA";
const LAST_NAME = `Applicant${STAMP}`;

test.describe.configure({ mode: "serial" });

test("submit the provider application -> confirmation page -> appears in admin queue", async ({ page }) => {
  test.setTimeout(60000);

  await page.goto("/become-a-provider");

  // Step 1: Contact info — the only required step besides the signature step.
  await page.getByPlaceholder("Jane", { exact: true }).fill(FIRST_NAME);
  await page.getByPlaceholder("Smith").fill(LAST_NAME);
  await page.getByPlaceholder("jane@example.com").fill(EMAIL);
  await page.getByPlaceholder("(555) 000-0000").fill("5555550123");
  await page.getByRole("button", { name: "Continue" }).click();

  // Steps 2-5 (Business, Services, Story, Online presence) are all optional —
  // confirm Continue advances through each without filling anything.
  await expect(page.getByText("Step 2 of 6")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 3 of 6")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 4 of 6")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 5 of 6")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 6 of 6")).toBeVisible();

  // Step 6: Review and sign.
  await page.getByText("The information in this application is accurate").click();
  await page.getByText("I agree to Fixer Nation's community guidelines").click();
  await page.getByText("I agree to be contacted by Fixer Nation").click();
  await page.getByPlaceholder("Type your full legal name").fill(`${FIRST_NAME} ${LAST_NAME}`);
  await page.getByRole("button", { name: "Submit application" }).click();

  // The API awaits real confirmation + admin-notify SMTP sends before
  // responding, well over the 5s default timeout.
  await expect(page).toHaveURL(/\/apply\/confirmed\?type=provider/, { timeout: 30000 });
  await expect(page.getByRole("heading", { name: "Application received." })).toBeVisible();
  await expect(page.getByText(EMAIL)).toBeVisible();

  await signInAsTestAdmin(page);
  await page.goto("/admin/applications");
  await page.getByPlaceholder("Search by name, email, phone, business, or category…").fill(EMAIL);
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(EMAIL)}`));

  const row = page.getByRole("button").filter({ hasText: EMAIL });
  await expect(row).toBeVisible();
  await expect(row.getByText("Submitted")).toBeVisible();
});
