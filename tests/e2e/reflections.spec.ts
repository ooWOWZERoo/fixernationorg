import { test, expect, type Page } from "@playwright/test";
import { signInAsTestMember } from "./helpers/auth";

const QA_TITLE = "QA e2e reflection — Playwright";
const QA_BODY = "This is a QA test reflection entry created by the Playwright suite.";
const QA_BODY_EDITED = "This is a QA test reflection entry, edited by the Playwright suite.";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signInAsTestMember(page);
});

test("create entry -> edit -> delete", async ({ page }) => {
  await page.goto("/account/reflections");
  await removeQaEntries(page);

  await expect(page.getByRole("heading", { name: "My Reflections" })).toBeVisible();

  await page.getByRole("button", { name: "New entry" }).first().click();
  await page.getByPlaceholder("Optional title...").fill(QA_TITLE);
  await page.getByPlaceholder("Write anything. This is just for you.").fill(QA_BODY);
  await page.getByRole("button", { name: "Save entry" }).click();

  await expect(page.getByText("Entry saved.")).toBeVisible();
  const card = page.locator("div.rounded-2xl").filter({ hasText: QA_TITLE });
  await expect(card).toHaveCount(1);
  await expect(card.getByText(QA_BODY)).toBeVisible();

  await card.getByRole("button", { name: "Edit" }).click();
  const bodyField = page.getByPlaceholder("Write anything. This is just for you.");
  await bodyField.fill(QA_BODY_EDITED);
  await page.getByRole("button", { name: "Save entry" }).click();

  await expect(page.getByText("Entry saved.")).toBeVisible();
  await expect(card.getByText(QA_BODY_EDITED)).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Entry deleted.")).toBeVisible();
  await expect(page.locator("div.rounded-2xl").filter({ hasText: QA_TITLE })).toHaveCount(0);
});

async function removeQaEntries(page: Page) {
  const card = page.locator("div.rounded-2xl").filter({ hasText: QA_TITLE });
  let remaining = await card.count();
  while (remaining > 0) {
    page.once("dialog", (dialog) => dialog.accept());
    await card.first().getByRole("button", { name: "Delete" }).click();
    await expect(card).toHaveCount(remaining - 1);
    remaining = await card.count();
  }
}
