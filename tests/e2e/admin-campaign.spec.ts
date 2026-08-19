import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

const STAMP = Date.now();
const CONTACT_EMAIL = `qa-campaign-contact-${STAMP}@example.com`;
const TAG = `qa-campaign-${STAMP}`;
const CAMPAIGN_NAME = `QA e2e admin campaign ${STAMP}`;
const SUBJECT = "QA e2e admin campaign subject";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signInAsTestAdmin(page);
});

test("create contact + tag -> build campaign -> send -> verify", async ({ page }) => {
  test.setTimeout(60000);

  // Create a single test contact and tag it, so the campaign audience can be
  // scoped to exactly this one contact rather than any real member list.
  await page.goto("/admin/contacts/new");
  await page.locator('input[type="email"]').first().fill(CONTACT_EMAIL);
  await page.locator('input[type="text"]').nth(0).fill("QA");
  await page.locator('input[type="text"]').nth(1).fill("Campaign");
  await page.getByRole("button", { name: "Create contact" }).click();

  await expect(page).toHaveURL(/\/admin\/contacts\/[a-z0-9]+$/);
  await page.getByPlaceholder("Add tag…").fill(TAG);
  await page.getByRole("button", { name: "Add tag" }).click();
  await expect(page.getByText(TAG).first()).toBeVisible();

  // Build the campaign through the wizard.
  await page.goto("/admin/campaigns/new");

  // Step 0: Details
  await page.getByPlaceholder("August newsletter").fill(CAMPAIGN_NAME);
  await page.getByRole("button", { name: /^Next:/ }).click();

  // Step 1: Content — switch to raw HTML so we don't depend on the block composer
  await page.getByPlaceholder("Your monthly update from Fixer Nation").fill(SUBJECT);
  await page.getByRole("button", { name: "HTML", exact: true }).first().click();
  await page.getByPlaceholder("Paste your HTML email body here…").fill("<p>QA e2e test email body.</p>");
  await page.getByRole("button", { name: /^Next:/ }).click();

  // Step 2: UTM & Tracking — defaults are fine
  await page.getByRole("button", { name: /^Next:/ }).click();

  // Step 3: Test Send — skip
  await page.getByRole("button", { name: /^Next:/ }).click();

  // Step 4: Audience — scope to contacts tagged with our unique tag
  await expect(page.getByRole("heading", { name: "Audience" })).toBeVisible();
  await page.getByRole("button", { name: "+ Add include rule" }).click();
  await page.getByRole("combobox").first().selectOption("tag");
  await page.getByPlaceholder("e.g. member-onboarded").fill(TAG);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(TAG)).toBeVisible();

  // Use the AudienceBuilder's own "Preview audience" button. The wizard
  // page also renders a second, redundant "Preview audience size" button
  // just below it that reads a `data.count` field the preview API never
  // returns (the API returns `totalIncluded`) — that button always shows
  // "Estimated audience: 0 contacts" regardless of the real audience size.
  await page.getByRole("button", { name: "Preview audience", exact: true }).click();
  await expect(page.getByText("1 contact will receive this email")).toBeVisible();

  await page.getByRole("button", { name: /^Next:/ }).click();

  // Step 5: Schedule — leave blank (save as draft)
  await page.getByRole("button", { name: /^Next:/ }).click();

  // Step 6: Review & Launch
  await expect(page.getByText(CAMPAIGN_NAME)).toBeVisible();
  await page.getByRole("button", { name: "Save as draft" }).click();

  await expect(page).toHaveURL(/\/admin\/campaigns\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: CAMPAIGN_NAME })).toBeVisible();
  await expect(page.getByText("draft", { exact: true })).toBeVisible();

  // Send now — the admin send path always finalizes the campaign as SENT
  // server-side (unlike the provider campaign flow), even if the test
  // contact's @example.com address can't actually accept mail.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Send now" }).click();
  await expect(page.getByText(/^Sent to \d+ contact/)).toBeVisible({ timeout: 30000 });

  await page.reload();
  await expect(page.getByText("sent", { exact: true })).toBeVisible();

  await page.goto("/admin/campaigns");
  const row = page.locator("tbody tr").filter({ hasText: CAMPAIGN_NAME });
  await expect(row).toBeVisible();
  await expect(row.getByText("sent", { exact: true })).toBeVisible();

  // Clean up the campaign (contacts have no delete UI, so the tagged test
  // contact is left behind like other timestamp-unique QA contacts).
  await row.getByText(CAMPAIGN_NAME).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/admin\/campaigns$/);
});
