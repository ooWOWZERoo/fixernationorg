import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

const STAMP = Date.now();
const EMAIL = `qa-affiliate-app-${STAMP}@example.com`;
const FIRST_NAME = "QA";
const LAST_NAME = `Applicant${STAMP}`;

test.describe.configure({ mode: "serial" });

test("submit the affiliate application -> confirmation page -> appears in admin queue", async ({ page }) => {
  test.setTimeout(60000);

  await page.goto("/become-an-affiliate");

  // Step 1: Contact info — the only required step besides the signature step.
  await page.getByPlaceholder("Jane", { exact: true }).fill(FIRST_NAME);
  await page.getByPlaceholder("Smith").fill(LAST_NAME);
  await page.getByPlaceholder("jane@example.com").fill(EMAIL);
  await page.getByPlaceholder("(555) 000-0000").fill("5555550124");
  await page.getByRole("button", { name: "Continue" }).click();

  // Steps 2-3 (How you'll promote, Online presence) are both optional —
  // confirm Continue advances through each unfilled. Affiliate has
  // TOTAL_STEPS = 4 (see src/pages/become-an-affiliate.tsx), unlike
  // Ambassador's 6.
  await expect(page.getByText("Step 2 of 4")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 3 of 4")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Step 4 of 4")).toBeVisible();

  // Step 4: Review and sign.
  await page.getByText("The information in this application is accurate").click();
  await page.getByText("I agree to Fixer Nation's community guidelines and affiliate program terms.").click();
  await page.getByText("I agree to be contacted by Fixer Nation").click();
  await page.getByPlaceholder("Type your full legal name").fill(`${FIRST_NAME} ${LAST_NAME}`);
  await page.getByRole("button", { name: "Submit application" }).click();

  // The API awaits real confirmation + admin-notify SMTP sends before
  // responding, well over the 5s default timeout (same as the ambassador
  // and provider application flows).
  await expect(page).toHaveURL(/\/apply\/confirmed\?type=affiliate/, { timeout: 30000 });
  await expect(page.getByRole("heading", { name: "Application received." })).toBeVisible();
  await expect(page.getByText(EMAIL)).toBeVisible();

  await signInAsTestAdmin(page);
  await page.goto("/admin/applications");
  await page.getByPlaceholder("Search by name, email, phone, business, or category…").fill(EMAIL);
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(EMAIL)}`));

  const row = page.getByRole("button").filter({ hasText: EMAIL });
  await expect(row).toBeVisible();
  await expect(row.getByText("Submitted")).toBeVisible();
  await expect(row.getByText("AFFILIATE").first()).toBeVisible();
});
