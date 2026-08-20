import { test, expect, type Page } from "@playwright/test";
import { signInAsTestProvider } from "./helpers/auth";

// qa-provider is also used by provider-campaign.spec.ts, but that spec only
// touches contacts/campaigns — safe to mutate business-profile fields here
// without colliding with it.
const STAMP = Date.now();
const BUSINESS_NAME = `QA Provider Business ${STAMP}`;
const SPECIALTY = `QA Test Specialty ${STAMP}`;
const SERVICES = `QA e2e test services description, stamp ${STAMP}.`;
const WEBSITE = "https://qa-provider-test.example.com";
const PHONE = "555-0100";
const SERVICE_AREA = `QA Metro Area ${STAMP}`;
const TEMP_USERNAME = `qa_provider_${STAMP}`;

test.describe.configure({ mode: "serial" });

async function readUsername(page: Page): Promise<string> {
  await page.goto("/account/profile");
  return page.getByLabel("Username").inputValue();
}

test("provider business profile -> saves, persists, and appears on the public listing", async ({ page }) => {
  test.setTimeout(45000);

  await signInAsTestProvider(page);

  // The public profile page 404s without a username — set one temporarily
  // if this account doesn't already have one, and restore afterward.
  const originalUsername = await readUsername(page);
  let setTempUsername = false;
  if (!originalUsername) {
    await page.getByLabel("Username").fill(TEMP_USERNAME);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();
    setTempUsername = true;
  }
  const username = originalUsername || TEMP_USERNAME;

  await page.goto("/account/business");
  const businessNameInput = page.getByLabel("Business name");
  const specialtyInput = page.getByLabel("Specialty");
  const servicesInput = page.getByLabel("Services");
  const websiteInput = page.getByLabel("Website");
  const phoneInput = page.getByLabel("Phone");
  const serviceAreaInput = page.getByLabel("Service area");

  const original = {
    businessName: await businessNameInput.inputValue(),
    specialty: await specialtyInput.inputValue(),
    services: await servicesInput.inputValue(),
    website: await websiteInput.inputValue(),
    phone: await phoneInput.inputValue(),
    serviceArea: await serviceAreaInput.inputValue(),
  };

  try {
    await businessNameInput.fill(BUSINESS_NAME);
    await specialtyInput.fill(SPECIALTY);
    await servicesInput.fill(SERVICES);
    await websiteInput.fill(WEBSITE);
    await phoneInput.fill(PHONE);
    await serviceAreaInput.fill(SERVICE_AREA);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    await page.reload();
    await expect(businessNameInput).toHaveValue(BUSINESS_NAME);
    await expect(specialtyInput).toHaveValue(SPECIALTY);
    await expect(servicesInput).toHaveValue(SERVICES);
    await expect(websiteInput).toHaveValue(WEBSITE);
    await expect(phoneInput).toHaveValue(PHONE);
    await expect(serviceAreaInput).toHaveValue(SERVICE_AREA);

    await page.goto(`/profile/${username}`);
    await expect(page.getByText("Service Provider")).toBeVisible();
    await expect(page.getByText(SPECIALTY)).toBeVisible();
    await expect(page.getByText(SERVICES)).toBeVisible();
    await expect(page.getByRole("link", { name: "Visit website" })).toHaveAttribute("href", WEBSITE);
    await expect(page.getByText(PHONE)).toBeVisible();
    await expect(page.getByText(SERVICE_AREA)).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit your listing" })).toBeVisible();
  } finally {
    await page.goto("/account/business");
    await page.getByLabel("Business name").fill(original.businessName);
    await page.getByLabel("Specialty").fill(original.specialty);
    await page.getByLabel("Services").fill(original.services);
    await page.getByLabel("Website").fill(original.website);
    await page.getByLabel("Phone").fill(original.phone);
    await page.getByLabel("Service area").fill(original.serviceArea);
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
