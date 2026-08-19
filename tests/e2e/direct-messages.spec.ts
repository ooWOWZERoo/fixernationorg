import { test, expect } from "@playwright/test";
import { signInAsTestMember, signInAsTestRecipient } from "./helpers/auth";

const STAMP = Date.now();
const MEMBER_MESSAGE = `QA e2e DM from member ${STAMP}`;
const RECIPIENT_REPLY = `QA e2e DM reply from recipient ${STAMP}`;

test.describe.configure({ mode: "serial" });

test("start a conversation from search -> send -> recipient sees unread + reply -> member sees reply", async ({ page }) => {
  test.setTimeout(45000);

  await signInAsTestMember(page);
  await page.goto("/network/messages");
  await page.getByRole("button", { name: "New Message" }).first().click();
  await page.getByPlaceholder("Search by name or email...").fill(process.env.TEST_RECIPIENT_EMAIL!);
  await page.getByText(process.env.TEST_RECIPIENT_EMAIL!).click();

  await expect(page).toHaveURL(/\/network\/messages\/[a-z0-9]+$/);
  await page.getByPlaceholder("Type a message…").fill(MEMBER_MESSAGE);
  await page.getByPlaceholder("Type a message…").press("Enter");
  await expect(page.getByText(MEMBER_MESSAGE)).toBeVisible();

  await signInAsTestRecipient(page);
  await page.goto("/network/messages");
  const row = page.locator("a").filter({ hasText: MEMBER_MESSAGE });
  await expect(row).toBeVisible();
  await expect(row.getByText(/^[1-9]\d*$/)).toBeVisible(); // unread badge

  await row.click();
  await expect(page).toHaveURL(/\/network\/messages\/[a-z0-9]+$/);
  await expect(page.getByText(MEMBER_MESSAGE)).toBeVisible();

  await page.getByPlaceholder("Type a message…").fill(RECIPIENT_REPLY);
  await page.getByPlaceholder("Type a message…").press("Enter");
  await expect(page.getByText(RECIPIENT_REPLY)).toBeVisible();

  // Reading the thread clears the unread badge for the recipient.
  await page.goto("/network/messages");
  const clearedRow = page.locator("a").filter({ hasText: RECIPIENT_REPLY });
  await expect(clearedRow.getByText(/^[1-9]\d*$/)).not.toBeVisible();

  await signInAsTestMember(page);
  await page.goto("/network/messages");
  const memberRow = page.locator("a").filter({ hasText: RECIPIENT_REPLY });
  await expect(memberRow).toBeVisible();
  await expect(memberRow.getByText(/^[1-9]\d*$/)).toBeVisible(); // member's own unread badge

  await memberRow.click();
  await expect(page.getByText(RECIPIENT_REPLY)).toBeVisible();
});
