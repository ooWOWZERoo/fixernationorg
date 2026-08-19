import { test, expect } from "@playwright/test";
import { signInAsTestAdmin, signInAsTestMember, signInAsTestRecipient } from "./helpers/auth";

const STAMP = Date.now();
const EVENT_TITLE = `QA e2e event ${STAMP}`;
const EVENT_SLUG = `qa-e2e-event-${STAMP}`;

test.describe.configure({ mode: "serial" });

test("free event with capacity 1 -> register, waitlist, cancel, no auto-promotion, re-register", async ({ page }) => {
  test.setTimeout(60000);

  // Create a free, virtual, capacity-1 event, published immediately.
  await signInAsTestAdmin(page);
  await page.goto("/admin/events/new");
  await page.locator('input[type="text"]').first().fill(EVENT_TITLE);
  await page.getByLabel("Online event").check();
  await page.locator('input[type="datetime-local"]').first().fill("2026-12-31T10:00");
  await page.locator('input[type="number"]').nth(1).fill("1"); // Capacity (Price is nth(0))
  await page.getByLabel("Publish immediately").check();
  await page.getByRole("button", { name: "Create event" }).click();

  await expect(page).toHaveURL(/\/admin\/events\/[a-z0-9]+$/);

  const eventUrl = `/events/${EVENT_SLUG}`;

  // Member registers -> fills the only spot.
  await signInAsTestMember(page);
  await page.goto(eventUrl);
  await expect(page.getByRole("heading", { name: EVENT_TITLE })).toBeVisible();
  await page.getByRole("button", { name: "Count me in" }).click();
  await expect(page.getByText("You're registered.")).toBeVisible();
  await expect(page.getByText("1 / 1 spots filled")).toBeVisible();

  // Recipient hits capacity -> joins the waitlist instead of registering.
  await signInAsTestRecipient(page);
  await page.goto(eventUrl);
  await expect(page.getByText("This event is full.")).toBeVisible();
  await page.getByRole("button", { name: "Join waitlist" }).click();
  await expect(page.getByText("You're on the waitlist.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Leave waitlist" })).toBeVisible();

  // Member cancels -> spot opens up, but the waitlisted recipient is not
  // auto-promoted (the API only recomputes capacity on the waitlisted
  // user's own next action, not when someone else cancels).
  await signInAsTestMember(page);
  await page.goto(eventUrl);
  await page.getByRole("button", { name: "Cancel registration" }).click();
  await expect(page.getByText("Registration cancelled.")).toBeVisible();
  await expect(page.getByText("0 / 1 spots filled")).toBeVisible();

  await signInAsTestRecipient(page);
  await page.goto(eventUrl);
  await expect(page.getByText("You're on the waitlist.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Leave waitlist" })).toBeVisible();

  // Recipient leaves the waitlist, then re-attempts -> now registers for
  // real since the spot is open.
  await page.getByRole("button", { name: "Leave waitlist" }).click();
  await expect(page.getByText("Registration cancelled.")).toBeVisible();
  await page.getByRole("button", { name: "Count me in" }).click();
  await expect(page.getByText("You're registered.")).toBeVisible();
  await expect(page.getByText("1 / 1 spots filled")).toBeVisible();
});
