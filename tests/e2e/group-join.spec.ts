import { test, expect } from "@playwright/test";
import { signInAsTestAdmin, signInAsTestMember, signInAsTestRecipient } from "./helpers/auth";

const STAMP = Date.now();
const GROUP_NAME = `QA e2e group ${STAMP}`;
const GROUP_SLUG = `qa-e2e-group-${STAMP}`;
const POST_BODY = `QA e2e group post ${STAMP}`;

test.describe.configure({ mode: "serial" });

test("create group -> request to join -> admin approves -> member posts -> non-member can see it", async ({ page }) => {
  test.setTimeout(60000);

  await signInAsTestAdmin(page);
  await page.goto("/admin/groups/new");
  await page.locator("form input").first().fill(GROUP_NAME);
  await page.getByRole("button", { name: /Create/ }).click();

  await expect(page).toHaveURL(/\/admin\/groups$/);
  const row = page.locator("tbody tr").filter({ hasText: GROUP_NAME });
  await expect(row).toBeVisible();

  await signInAsTestMember(page);
  await page.goto("/network/groups");
  const card = page.locator("div.rounded-2xl").filter({ hasText: GROUP_NAME });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Request to Join" }).click();
  await expect(card.getByText("Request Sent")).toBeVisible();

  await signInAsTestAdmin(page);
  await page.goto("/admin/groups");
  const pendingLink = page.locator("tbody tr").filter({ hasText: GROUP_NAME }).getByRole("link", { name: /pending/ });
  await expect(pendingLink).toBeVisible();
  await pendingLink.click();

  await expect(page.getByRole("heading", { name: "Join Requests" })).toBeVisible();
  const requestRow = page.locator("tbody tr");
  await expect(requestRow).toBeVisible();
  await requestRow.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("No pending requests.")).toBeVisible();

  await signInAsTestMember(page);
  await page.goto(`/network/groups/${GROUP_SLUG}`);
  await expect(page.getByRole("heading", { name: GROUP_NAME })).toBeVisible();
  await expect(page.getByText("Request to Join")).not.toBeVisible();

  await page.locator("textarea").first().fill(POST_BODY);
  await page.getByRole("button", { name: "Post" }).click();
  await expect(page.getByText(POST_BODY)).toBeVisible();

  // A non-member can still see the post on this PUBLIC group, but can't post.
  await signInAsTestRecipient(page);
  await page.goto(`/network/groups/${GROUP_SLUG}`);
  await expect(page.getByText(POST_BODY)).toBeVisible();
  await expect(page.getByRole("button", { name: "Request to Join" })).toBeVisible();
  await expect(page.locator("textarea")).not.toBeVisible();
});
