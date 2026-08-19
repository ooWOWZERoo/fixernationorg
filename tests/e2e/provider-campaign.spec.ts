import { test, expect, type Page } from "@playwright/test";
import { signInAsTestProvider } from "./helpers/auth";

const CONTACT_EMAIL = "qa-provider-contact@example.com";
const CAMPAIGN_NAME = "QA e2e provider campaign";
const CAMPAIGN_SUBJECT = "QA e2e test subject";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signInAsTestProvider(page);
});

test("create campaign -> send -> verify post-send state", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/account/provider/contacts");
  await removeContactIfPresent(page);

  await page.getByRole("button", { name: "+ Add contact" }).click();
  await page.locator('input[type="email"]').fill(CONTACT_EMAIL);
  await page.getByRole("button", { name: "Add contact" }).click();
  await expect(page.getByText(CONTACT_EMAIL)).toBeVisible();

  await page.goto("/account/provider/campaigns/new");
  await page.getByPlaceholder("e.g. August newsletter").fill(CAMPAIGN_NAME);
  await page.getByPlaceholder("e.g. Sarah at Smith Financial").fill("QA Provider");
  await page.getByPlaceholder("What's this email about?").fill(CAMPAIGN_SUBJECT);
  await page.getByPlaceholder("<p>Hi there,</p><p>Here's what I wanted to share...</p>").fill("<p>QA e2e test email body.</p>");
  await page.getByRole("button", { name: "Save as draft" }).click();

  await expect(page).toHaveURL(/\/account\/provider\/campaigns\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: CAMPAIGN_NAME })).toBeVisible();
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();

  const sendButton = page.getByRole("button", { name: /Send to \d+ contact/ });
  await expect(sendButton).toBeVisible();
  await expect(sendButton).toBeEnabled();

  page.once("dialog", (dialog) => dialog.accept());
  await sendButton.click();

  // The test contact's domain can't accept real mail, so the SMTP attempt
  // fails and the server reports 0 sent / 1 failed. Per the send API
  // (src/pages/api/provider/campaigns/[id]/send.ts), a campaign with 0
  // successful sends reverts to DRAFT status server-side rather than
  // becoming SENT. The client-side handler, however, unconditionally sets
  // local status to "Sent" whenever the POST returns 200 — regardless of
  // whether any send actually succeeded — so the page misrepresents the
  // campaign as Sent even though the server correctly kept it as Draft.
  // This send takes a real SMTP round trip, well over the 5s default.
  await expect(page.getByText(/Sent to \d+ contact/)).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/Sent to 0 contact/)).toBeVisible();

  // Client-side state (misleading): shows Sent even though 0 sends succeeded,
  // and the send button/section is hidden as a result.
  await expect(page.getByRole("button", { name: /Send to \d+ contact/ })).not.toBeVisible();

  // Reload to fetch fresh server props and confirm the real, authoritative
  // state: the campaign is still Draft, the failed send is recorded, and the
  // provider can retry sending immediately.
  await page.reload();
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Send to \d+ contact/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Failed" })).toBeVisible();

  await page.goto("/account/provider/contacts");
  await removeContactIfPresent(page);
});

async function removeContactIfPresent(page: Page) {
  const row = page.getByText(CONTACT_EMAIL);
  if (await row.isVisible().catch(() => false)) {
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(row).not.toBeVisible();
  }
}
