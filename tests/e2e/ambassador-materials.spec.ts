import { test, expect } from "@playwright/test";
import { signInAsTestAmbassador } from "./helpers/auth";

// Seeded via a one-time admin endpoint — see session notes. A single Campaign
// row (isAmbassadorMaterial: true, status: SENT) upserted by name, so this
// stays stable and unique across repeated test runs.
const MATERIAL_NAME = "QA e2e ambassador material";
const SUBJECT = "QA e2e test subject — ambassador material";
const HTML_BODY = "<p>QA e2e test HTML body for the ambassador materials flow.</p>";
const TEXT_BODY = "QA e2e test plain text body for the ambassador materials flow.";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test.beforeEach(async ({ page }) => {
  await signInAsTestAmbassador(page);
});

test("preview a material and copy its subject, text, and HTML", async ({ page }) => {
  await page.goto("/account/ambassador/materials");

  await expect(page.getByRole("heading", { name: "Campaign materials" })).toBeVisible();

  const card = page.locator("div.rounded-2xl").filter({ hasText: MATERIAL_NAME });
  await expect(card).toBeVisible();
  await expect(card.getByText("Email", { exact: true })).toBeVisible();
  await expect(card.getByText(SUBJECT)).toBeVisible();

  await card.getByRole("button", { name: "Copy subject" }).click();
  await expect(card.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await readClipboard(page)).toBe(SUBJECT);

  await card.getByRole("button", { name: "Preview" }).click();
  await expect(card.getByText("Plain text", { exact: true })).toBeVisible();
  await expect(card.getByText("HTML", { exact: true })).toBeVisible();

  await card.getByRole("button", { name: "Copy text" }).click();
  expect(await readClipboard(page)).toBe(TEXT_BODY);

  await card.getByRole("button", { name: "Copy HTML" }).click();
  expect(await readClipboard(page)).toBe(HTML_BODY);

  await card.getByRole("button", { name: "Hide" }).click();
  await expect(card.getByText("Plain text", { exact: true })).not.toBeVisible();
});

async function readClipboard(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}
