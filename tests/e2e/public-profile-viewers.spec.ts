import { test, expect } from "@playwright/test";
import { signInAsTestMember, signInAsTestAdmin } from "./helpers/auth";

// qa-member is the profile being viewed; qa-admin plays the "other signed-in
// member" viewer. Neither account's username/headline is depended on by any
// other spec, so it's safe to set them temporarily here.
const STAMP = Date.now();
const TEMP_USERNAME = `qa_pv_${STAMP}`;
const HEADLINE = `QA e2e public profile headline ${STAMP}`;
const BIO = `QA e2e public profile bio ${STAMP}.`;

test.describe.configure({ mode: "serial" });

test("public profile -> other members see Message, signed-out visitors see a sign-in prompt, owner controls stay hidden", async ({ page, browser }) => {
  test.setTimeout(45000);

  await signInAsTestMember(page);
  await page.goto("/account/profile");
  const usernameInput = page.getByLabel("Username");
  const headlineInput = page.getByLabel("Headline");
  const bioInput = page.getByLabel("About you");
  const originalUsername = await usernameInput.inputValue();
  const originalHeadline = await headlineInput.inputValue();
  const originalBio = await bioInput.inputValue();
  const username = originalUsername || TEMP_USERNAME;

  try {
    await usernameInput.fill(username);
    await headlineInput.fill(HEADLINE);
    await bioInput.fill(BIO);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    // Another signed-in member views the profile: sees Message, not owner controls.
    await signInAsTestAdmin(page);
    await page.goto(`/profile/${username}`);
    await expect(page.getByText(HEADLINE)).toBeVisible();
    await expect(page.getByText(BIO)).toBeVisible();
    await expect(page.getByRole("button", { name: "Message" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit profile" })).not.toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in to message" })).not.toBeVisible();

    await page.getByRole("button", { name: "Message" }).click();
    await expect(page).toHaveURL(/\/network\/messages\/[a-z0-9]+$/, { timeout: 15000 });

    // A signed-out visitor sees a sign-in prompt instead of Message or owner controls.
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/profile/${username}`);
    await expect(guestPage.getByText(HEADLINE)).toBeVisible();
    await expect(guestPage.getByRole("link", { name: "Sign in to message" })).toBeVisible();
    await expect(guestPage.getByRole("button", { name: "Message" })).not.toBeVisible();
    await expect(guestPage.getByRole("link", { name: "Edit profile" })).not.toBeVisible();
    await guestContext.close();

    const notFoundContext = await browser.newContext();
    const notFoundPage = await notFoundContext.newPage();
    await notFoundPage.goto(`/profile/qa-nonexistent-${STAMP}`);
    await expect(notFoundPage.getByRole("heading", { name: "We can't find that page" })).toBeVisible();
    await notFoundContext.close();
  } finally {
    await signInAsTestMember(page);
    await page.goto("/account/profile");
    await page.getByLabel("Username").fill(originalUsername);
    await page.getByLabel("Headline").fill(originalHeadline);
    await page.getByLabel("About you").fill(originalBio);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();
  }
});
