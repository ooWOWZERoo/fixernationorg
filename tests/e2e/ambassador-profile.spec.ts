import { test, expect, type Page } from "@playwright/test";
import { signInAsTestAmbassador } from "./helpers/auth";

// qa-ambassador is also used by ambassador-materials.spec.ts, but that spec
// only previews materials — safe to mutate profile fields here without
// colliding with it.
const STAMP = Date.now();
const TERRITORY = `QA Territory ${STAMP}`;
const BIO = `QA e2e test ambassador bio, stamp ${STAMP}.`;
const WEBSITE = "https://qa-ambassador-test.example.com";
const PHONE = "555-0200";
const TEMP_USERNAME = `qa_ambassador_${STAMP}`;

test.describe.configure({ mode: "serial" });

async function readUsername(page: Page): Promise<string> {
  await page.goto("/account/profile");
  return page.getByLabel("Username").inputValue();
}

test("ambassador profile -> saves, persists, and appears on the public listing with a working referral link", async ({ page }) => {
  test.setTimeout(45000);

  await signInAsTestAmbassador(page);

  const originalUsername = await readUsername(page);
  let setTempUsername = false;
  if (!originalUsername) {
    await page.getByLabel("Username").fill(TEMP_USERNAME);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();
    setTempUsername = true;
  }
  const username = originalUsername || TEMP_USERNAME;

  await page.goto("/account/ambassador");
  // Parse the code straight out of the displayed referral URL rather than a
  // separate locator for the "Your code: ..." line — one fewer place to break.
  const referralUrlText = (await page.locator("code").first().textContent())?.trim() ?? "";
  const referralCode = referralUrlText.match(/ref=([\w-]+)$/)?.[1];
  expect(referralCode, `expected a /register?ref=<code> URL, got "${referralUrlText}"`).toBeTruthy();

  const territoryInput = page.getByLabel("Territory");
  const bioInput = page.getByLabel("About you");
  const websiteInput = page.getByLabel("Website");
  const phoneInput = page.getByLabel("Phone");

  const original = {
    territory: await territoryInput.inputValue(),
    bio: await bioInput.inputValue(),
    website: await websiteInput.inputValue(),
    phone: await phoneInput.inputValue(),
  };

  try {
    await territoryInput.fill(TERRITORY);
    await bioInput.fill(BIO);
    await websiteInput.fill(WEBSITE);
    await phoneInput.fill(PHONE);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    await page.reload();
    await expect(territoryInput).toHaveValue(TERRITORY);
    await expect(bioInput).toHaveValue(BIO);
    await expect(websiteInput).toHaveValue(WEBSITE);
    await expect(phoneInput).toHaveValue(PHONE);

    await page.goto(`/profile/${username}`);
    await expect(page.getByText("Ambassador", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(TERRITORY)).toBeVisible();
    await expect(page.getByText(BIO)).toBeVisible();
    await expect(page.getByRole("link", { name: "Visit website" })).toHaveAttribute("href", WEBSITE);
    await expect(page.getByText(PHONE)).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit your listing" })).toBeVisible();
  } finally {
    await page.goto("/account/ambassador");
    await page.getByLabel("Territory").fill(original.territory);
    await page.getByLabel("About you").fill(original.bio);
    await page.getByLabel("Website").fill(original.website);
    await page.getByLabel("Phone").fill(original.phone);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    if (setTempUsername) {
      await page.goto("/account/profile");
      await page.getByLabel("Username").fill("");
      await page.getByRole("button", { name: "Save profile" }).click();
      await expect(page.getByText("Profile saved.")).toBeVisible();
    }
  }
});

test("referral history -> totals and conversion rate match the displayed table", async ({ page }) => {
  test.setTimeout(20000);

  await signInAsTestAmbassador(page);
  await page.goto("/account/referrals");

  const totalText = await page.getByText("Total referrals").locator("..").locator("p.text-3xl").textContent();
  const total = Number(totalText?.trim());
  expect(Number.isFinite(total)).toBe(true);

  const rowCount = await page.locator("tbody tr").count().catch(() => 0);

  if (total === 0) {
    await expect(page.getByText("No referrals yet. Start sharing your link.")).toBeVisible();
    expect(rowCount).toBe(0);
  } else {
    expect(rowCount).toBe(total);
  }

  const convertedText = await page.getByText("Converted", { exact: true }).locator("..").locator("p.text-3xl").textContent();
  const converted = Number(convertedText?.trim());
  const rateText = await page.getByText("Conversion rate").locator("..").locator("p.text-3xl").textContent();
  const expectedRate = total > 0 ? Math.round((converted / total) * 100) : 0;
  expect(rateText?.trim()).toBe(`${expectedRate}%`);

  const referralUrlCode = await page.locator("code").first().textContent();
  expect(referralUrlCode).toContain("/register?ref=");
});
