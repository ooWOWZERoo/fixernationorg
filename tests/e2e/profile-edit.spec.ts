import { test, expect } from "@playwright/test";
import { signInAsTestMfa, signInAsTestMember } from "./helpers/auth";

// Reuses the qa-mfa-test account (not qa-member) because this test mutates
// username, headline, bio, location, and avatar — persistent profile fields
// that other concurrently-running tests must not see change underneath them.
const STAMP = Date.now();
const TEST_USERNAME = `qa_profile_${STAMP}`;
const TEST_HEADLINE = `QA headline ${STAMP}`;
const TEST_BIO = `QA bio content for the automated profile test, stamp ${STAMP}.`;
const TEST_LOCATION = `QA City ${STAMP}`;

// Minimal 1x1 red PNG, inlined so the test doesn't need a fixture file on disk.
const PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

test.describe.configure({ mode: "serial" });

test("edit profile -> username, headline, bio, location, avatar persist and appear on public profile", async ({ page }) => {
  test.setTimeout(45000);

  await signInAsTestMfa(page);
  await page.goto("/account/profile");

  const usernameInput = page.getByLabel("Username");
  const headlineInput = page.getByLabel("Headline");
  const bioInput = page.getByLabel("About you");
  const locationInput = page.getByLabel("Location");
  const avatarImg = page.locator('img[alt="Avatar"]');

  const originalUsername = await usernameInput.inputValue();
  const originalHeadline = await headlineInput.inputValue();
  const originalBio = await bioInput.inputValue();
  const originalLocation = await locationInput.inputValue();
  const hadOriginalAvatar = await avatarImg.isVisible().catch(() => false);

  try {
    await usernameInput.fill(TEST_USERNAME);
    await headlineInput.fill(TEST_HEADLINE);
    await bioInput.fill(TEST_BIO);
    await locationInput.fill(TEST_LOCATION);

    await page.setInputFiles('input[type="file"]', {
      name: "avatar.png",
      mimeType: "image/png",
      buffer: PNG_BUFFER,
    });
    await expect(avatarImg).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    await page.reload();
    await expect(usernameInput).toHaveValue(TEST_USERNAME);
    await expect(headlineInput).toHaveValue(TEST_HEADLINE);
    await expect(bioInput).toHaveValue(TEST_BIO);
    await expect(locationInput).toHaveValue(TEST_LOCATION);
    await expect(avatarImg).toBeVisible();

    await page.goto(`/profile/${TEST_USERNAME}`);
    await expect(page.getByText(`@${TEST_USERNAME}`)).toBeVisible();
    await expect(page.getByText(TEST_HEADLINE)).toBeVisible();
    await expect(page.getByText(TEST_BIO)).toBeVisible();
    await expect(page.getByText(TEST_LOCATION)).toBeVisible();
    await expect(page.locator("img").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit profile" })).toBeVisible();
  } finally {
    await page.goto("/account/profile");
    await page.getByLabel("Username").fill(originalUsername);
    await page.getByLabel("Headline").fill(originalHeadline);
    await page.getByLabel("About you").fill(originalBio);
    await page.getByLabel("Location").fill(originalLocation);
    if (!hadOriginalAvatar) {
      const removeButton = page.getByRole("button", { name: "Remove" });
      if (await removeButton.isVisible().catch(() => false)) {
        await removeButton.click();
      }
    }
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();
  }
});

test("username validation -> invalid characters and duplicate usernames are rejected", async ({ page, browser }) => {
  test.setTimeout(30000);

  // Discover qa-member's current username (if any) at runtime rather than
  // assuming a fixed value, so this test doesn't silently rot if that
  // account's username ever changes.
  const memberContext = await browser.newContext();
  const memberPage = await memberContext.newPage();
  await signInAsTestMember(memberPage);
  const memberProfile = await memberContext.request
    .get(new URL("/api/account/profile", memberPage.url()).toString())
    .then((r) => r.json());
  await memberContext.close();
  const takenUsername = memberProfile?.username as string | null;

  await signInAsTestMfa(page);
  await page.goto("/account/profile");
  const usernameInput = page.getByLabel("Username");
  const originalUsername = await usernameInput.inputValue();

  try {
    await usernameInput.fill("Invalid Username!");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText(/lowercase letters, numbers, underscores/i)).toBeVisible();

    if (takenUsername) {
      await usernameInput.fill(takenUsername);
      await page.getByRole("button", { name: "Save profile" }).click();
      await expect(page.getByText("That username is already taken")).toBeVisible();
    }
  } finally {
    await usernameInput.fill(originalUsername);
    await page.getByRole("button", { name: "Save profile" }).click();
  }
});
