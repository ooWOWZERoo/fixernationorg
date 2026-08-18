import { test, expect, type Page } from "@playwright/test";
import { signInAsTestMember, signInAsTestRecipient } from "./helpers/auth";

const RECOGNITION_MESSAGE = "QA e2e recognition — thanks for helping test the platform!";

async function getCommunityPoints(page: Page): Promise<number> {
  const card = page.locator("div.text-center").filter({ hasText: "Community points" });
  const text = await card.locator("p").first().textContent();
  return parseInt((text ?? "0").replace(/,/g, ""), 10);
}

test.describe.configure({ mode: "serial" });

test("milestones section renders without a tracked milestone", async ({ page }) => {
  await signInAsTestMember(page);
  await page.goto("/account/progress");

  await expect(page.getByRole("heading", { name: "My Progress" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Milestones" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recognitions received" })).toBeVisible();

  // Milestones are system-awarded (challenge/pathway completion, streaks) —
  // there's no member action to create one here, so just confirm the
  // loading skeleton resolves into a real render (empty state or cards)
  // without erroring.
  await expect(page.getByText("Loading your progress...")).not.toBeVisible({ timeout: 10000 });
});

test("send a recognition -> recipient sees it in Recognitions received", async ({ page }) => {
  const recipientId = process.env.TEST_RECIPIENT_ID;
  if (!recipientId) {
    throw new Error("TEST_RECIPIENT_ID not set — see .env.test");
  }

  await signInAsTestMember(page);
  await page.goto("/account/progress");

  await page.getByPlaceholder("Paste the member's user ID").fill(recipientId);
  await page.getByPlaceholder("Tell them what they did and why it matters...").fill(RECOGNITION_MESSAGE);
  await page.getByRole("button", { name: "Send recognition" }).click();

  await expect(page.getByText("Recognition sent — you earned 10 points!")).toBeVisible();

  // Switch to the recipient account and confirm it shows up on their side.
  await signInAsTestRecipient(page);
  await page.goto("/account/progress");

  await expect(page.getByText("QA Test Member").first()).toBeVisible();
  const card = page.locator("div.rounded-2xl").filter({ hasText: RECOGNITION_MESSAGE }).first();
  await expect(card).toBeVisible();
});

test("sending a recognition awards 10 loyalty points to the sender", async ({ page }) => {
  const recipientId = process.env.TEST_RECIPIENT_ID;
  if (!recipientId) {
    throw new Error("TEST_RECIPIENT_ID not set — see .env.test");
  }

  await signInAsTestMember(page);
  await page.goto("/account/progress");

  const pointsBefore = await getCommunityPoints(page);

  await page.getByPlaceholder("Paste the member's user ID").fill(recipientId);
  await page.getByPlaceholder("Tell them what they did and why it matters...").fill(RECOGNITION_MESSAGE);
  await page.getByRole("button", { name: "Send recognition" }).click();
  await expect(page.getByText("Recognition sent — you earned 10 points!")).toBeVisible();

  // awardPoints is fire-and-forget on the server, so the ledger write can
  // land slightly after the success toast — poll instead of asserting once.
  await expect.poll(
    async () => {
      await page.reload();
      return getCommunityPoints(page);
    },
    { timeout: 10000, intervals: [500, 1000, 1500, 2000, 2000] }
  ).toBe(pointsBefore + 10);
});
