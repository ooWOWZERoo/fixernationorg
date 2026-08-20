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

  // This send takes a real SMTP round trip, well over the 5s default.
  // Whether our relay accepts an @example.com recipient for delivery (vs.
  // rejecting it immediately) is genuinely non-deterministic in practice —
  // observed both ways across runs — so branch on whichever the server
  // actually reports rather than assuming one outcome.
  const resultText = page.getByText(/Sent to \d+ contact/);
  await expect(resultText).toBeVisible({ timeout: 30000 });
  const succeeded = await page.getByText("Sent to 1 contact.").isVisible();

  await expect(page.getByRole("button", { name: /Send to \d+ contact/ })).not.toBeVisible();

  // Reload to fetch fresh server props and confirm the authoritative server
  // state. Per the send API (src/pages/api/provider/campaigns/[id]/send.ts),
  // a campaign becomes SENT only if at least one send succeeded — otherwise
  // it reverts to DRAFT, which the client's own optimistic "Sent" state above
  // doesn't reflect until this reload.
  await page.reload();
  if (succeeded) {
    await expect(page.getByText("Sent", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "Sent" })).toBeVisible();
  } else {
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Failed" })).toBeVisible();
  }

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
