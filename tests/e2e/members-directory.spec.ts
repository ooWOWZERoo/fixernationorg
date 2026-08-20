import { test, expect } from "@playwright/test";
import { signInAsTestMfa, signInAsTestMember } from "./helpers/auth";

const STAMP = Date.now();
const TARGET_HEADLINE = `QA e2e directory headline ${STAMP}`;
const NO_MATCH_QUERY = `qa-directory-no-match-${STAMP}`;

test.describe.configure({ mode: "serial" });

test("members directory -> search filters correctly, view profile and message both work from a card", async ({ page }) => {
  test.setTimeout(45000);

  // qa-mfa-test is the search target here — give it a unique, searchable
  // headline and a username (reverted in finally), same setup pattern as
  // profile-edit.spec.ts / provider-profile.spec.ts.
  await signInAsTestMfa(page);
  await page.goto("/account/profile");
  const usernameInput = page.getByLabel("Username");
  const headlineInput = page.getByLabel("Headline");
  const originalUsername = await usernameInput.inputValue();
  const originalHeadline = await headlineInput.inputValue();
  const tempUsername = originalUsername || `qa_dir_${STAMP}`;

  try {
    await usernameInput.fill(tempUsername);
    await headlineInput.fill(TARGET_HEADLINE);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();

    await signInAsTestMember(page);
    await page.goto("/network/members");

    await page.getByPlaceholder("Search members…").fill(NO_MATCH_QUERY);
    await expect(page.getByText("No members match that search.")).toBeVisible();

    await page.getByPlaceholder("Search members…").fill(TARGET_HEADLINE);
    const card = page.locator("div.rounded-2xl").filter({ hasText: TARGET_HEADLINE });
    await expect(card.first()).toBeVisible();
    await expect(page.getByText("No members match that search.")).not.toBeVisible();

    await card.first().getByRole("link", { name: "View profile" }).click();
    await expect(page).toHaveURL(`/profile/${tempUsername}`);

    await page.goto("/network/members");
    await page.getByPlaceholder("Search members…").fill(TARGET_HEADLINE);
    const cardAgain = page.locator("div.rounded-2xl").filter({ hasText: TARGET_HEADLINE });
    await cardAgain.first().getByRole("button", { name: "Message" }).click();
    await expect(page).toHaveURL(/\/network\/messages\/[a-z0-9]+$/, { timeout: 15000 });
  } finally {
    await signInAsTestMfa(page);
    await page.goto("/account/profile");
    await page.getByLabel("Username").fill(originalUsername);
    await page.getByLabel("Headline").fill(originalHeadline);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();
  }
});
