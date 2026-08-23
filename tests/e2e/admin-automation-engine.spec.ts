import { test, expect, type Page } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";
import { getContactTagNames, getAutomationEnrollment, forceEnrollmentStatus } from "./helpers/db";

const STAMP = Date.now();

// Manually trigger the automation tick via the same cron endpoint Vercel's
// scheduler calls, instead of waiting for a real cron cycle.
async function tickAutomations(page: Page) {
  const res = await page.request.get(
    `/api/cron?job=automation-tick&token=${encodeURIComponent(process.env.CRON_SECRET as string)}`
  );
  expect(res.ok()).toBeTruthy();
}

// See automation-journeys.spec.ts for the full writeup — a confirmed,
// pre-existing backend caching/read-lag issue after step/journey changes.
async function reloadUntilVisible(page: Page, text: string, maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    await page.reload();
    await expect(page.getByText("Loading canvas…")).not.toBeVisible({ timeout: 15000 });
    if (await page.getByText(text).first().isVisible().catch(() => false)) return;
  }
  await expect(page.getByText(text).first()).toBeVisible();
}

async function createContact(page: Page, email: string, lastName: string) {
  await page.goto("/admin/contacts/new");
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="text"]').nth(0).fill("QA");
  await page.locator('input[type="text"]').nth(1).fill(lastName);
  await page.getByRole("button", { name: "Create contact" }).click();
  await expect(page).toHaveURL(/\/admin\/contacts\/(?!new$)[a-z0-9]+$/);
  return page.url().split("/").pop() as string;
}

async function addTag(page: Page, tag: string) {
  await page.getByPlaceholder("Add tag…").fill(tag);
  await page.getByRole("button", { name: "Add tag" }).click();
  await expect(page.getByText(tag).first()).toBeVisible();
}

async function createJourney(page: Page, name: string, trigger: string) {
  await page.goto("/admin/automations");
  await page.getByRole("button", { name: "New journey" }).click();
  await page.getByPlaceholder("e.g. Provider welcome sequence").fill(name);
  // The Trigger <label> has no htmlFor/id association (known pattern across
  // several admin forms in this codebase) — select positionally instead.
  await page.locator("select").first().selectOption(trigger);
  await page.getByRole("button", { name: "Create & edit" }).click();
  await expect(page).toHaveURL(/\/admin\/automations\/(?!new$)[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  return page.url().split("/").pop() as string;
}

async function addStep(page: Page, journeyId: string, type: string, config: Record<string, unknown>) {
  const res = await page.request.post("/api/admin/automations/step", {
    data: { journeyId, type, config },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signInAsTestAdmin(page);
});

test("previously-blocked triggers (group join, event RSVP, loyalty milestone) can now create a journey", async ({ page }) => {
  test.setTimeout(45000);

  // Regression check for the createSchema fix in
  // src/pages/api/admin/automations/index.ts — these 3 trigger values used
  // to be silently rejected by the API's own zod enum (not just the UI).
  for (const trigger of ["GROUP_JOIN", "EVENT_RSVP", "LOYALTY_MILESTONE"]) {
    const name = `QA e2e trigger-fix ${trigger} ${STAMP}`;
    const journeyId = await createJourney(page, name, trigger);
    expect(journeyId).toBeTruthy();
  }
});

test("TAG_ADDED trigger enrolls a contact; ADD_TAG, REMOVE_TAG, and EXIT steps execute on tick", async ({ page }) => {
  test.setTimeout(90000);

  const TRIGGER_TAG = `qa-auto-trigger-${STAMP}`;
  const ADDED_TAG = `qa-auto-added-${STAMP}`;
  const journeyName = `QA e2e tag-added journey ${STAMP}`;

  const journeyId = await createJourney(page, journeyName, "TAG_ADDED");

  // Configure the trigger filter: only fire for TRIGGER_TAG.
  await page.getByRole("button", { name: "Configure" }).click();
  await page.getByPlaceholder("e.g. ambassador-prospect").fill(TRIGGER_TAG);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(`"${TRIGGER_TAG}"`)).toBeVisible();

  await addStep(page, journeyId, "ADD_TAG", { tag: ADDED_TAG });
  await addStep(page, journeyId, "REMOVE_TAG", { tag: TRIGGER_TAG });
  await addStep(page, journeyId, "EXIT", {});

  await page.getByRole("button", { name: "Inactive" }).click();
  await expect(page.getByRole("button", { name: "Active" })).toBeVisible();

  const contactId = await createContact(page, `qa-auto-tagtrigger-${STAMP}@example.com`, `AutoTagTrigger${STAMP}`);
  await addTag(page, TRIGGER_TAG);

  await tickAutomations(page);

  // A direct DB check right after confirmed the enrollment actually
  // completed correctly within a couple seconds of the tick — the flake
  // here is in seeing it via TEST_DATABASE_URL's connection specifically
  // (same eventually-consistent-read class as the loyalty-points checks
  // elsewhere in this suite), not the automation logic itself. Generous
  // window rather than a tight one.
  await expect.poll(async () => {
    const enrollment = await getAutomationEnrollment(journeyId, contactId);
    return enrollment?.status ?? null;
  }, { timeout: 40000, intervals: [2000, 3000, 5000, 5000, 5000] }).toBe("COMPLETED");

  const tags = await getContactTagNames(contactId);
  expect(tags).toContain(ADDED_TAG);
  expect(tags).not.toContain(TRIGGER_TAG);
});

test("CONDITION step branches correctly: true path continues, false path jumps via falseNextOrder", async ({ page }) => {
  test.setTimeout(90000);

  const CHECK_TAG = `qa-auto-check-${STAMP}`;
  const TRUE_TAG = `qa-auto-true-${STAMP}`;
  const FALSE_TAG = `qa-auto-false-${STAMP}`;
  const journeyName = `QA e2e condition journey ${STAMP}`;

  const journeyId = await createJourney(page, journeyName, "MANUAL");

  // Step 1: CONDITION (has CHECK_TAG?) -> true continues to step 2, false
  // jumps to step 4 (falseNextOrder), skipping steps 2-3 entirely.
  await addStep(page, journeyId, "CONDITION", {
    field: "tag", operator: "equals", value: CHECK_TAG, falseNextOrder: 4,
  });
  await addStep(page, journeyId, "ADD_TAG", { tag: TRUE_TAG });
  await addStep(page, journeyId, "EXIT", {});
  await addStep(page, journeyId, "ADD_TAG", { tag: FALSE_TAG });

  await page.getByRole("button", { name: "Inactive" }).click();
  await expect(page.getByRole("button", { name: "Active" })).toBeVisible();

  const trueContactId = await createContact(page, `qa-auto-true-${STAMP}@example.com`, `AutoConditionTrue${STAMP}`);
  await addTag(page, CHECK_TAG);

  const falseContactId = await createContact(page, `qa-auto-false-${STAMP}@example.com`, `AutoConditionFalse${STAMP}`);
  // No CHECK_TAG added — this contact should take the false branch.

  await page.request.post("/api/admin/automations/enroll", { data: { journeyId, contactId: trueContactId } });
  await page.request.post("/api/admin/automations/enroll", { data: { journeyId, contactId: falseContactId } });

  await tickAutomations(page);

  await expect.poll(async () => {
    const e = await getAutomationEnrollment(journeyId, trueContactId);
    return e?.status ?? null;
  }, { timeout: 40000, intervals: [2000, 3000, 5000, 5000, 5000] }).toBe("COMPLETED");
  await expect.poll(async () => {
    const e = await getAutomationEnrollment(journeyId, falseContactId);
    return e?.status ?? null;
  }, { timeout: 40000, intervals: [2000, 3000, 5000, 5000, 5000] }).toBe("COMPLETED");

  const trueTags = await getContactTagNames(trueContactId);
  expect(trueTags).toContain(TRUE_TAG);
  expect(trueTags).not.toContain(FALSE_TAG);

  const falseTags = await getContactTagNames(falseContactId);
  expect(falseTags).toContain(FALSE_TAG);
  expect(falseTags).not.toContain(TRUE_TAG);
});

test("journey detail overview: status counts and the Failed filter reliably surface a failed enrollment", async ({ page }) => {
  test.setTimeout(45000);

  const journeyName = `QA e2e overview journey ${STAMP}`;
  const journeyId = await createJourney(page, journeyName, "MANUAL");
  await addStep(page, journeyId, "EXIT", {});

  const activeContactId = await createContact(page, `qa-overview-active-${STAMP}@example.com`, `OverviewActive${STAMP}`);
  const failedContactId = await createContact(page, `qa-overview-failed-${STAMP}@example.com`, `OverviewFailed${STAMP}`);

  await page.request.post("/api/admin/automations/enroll", { data: { journeyId, contactId: activeContactId } });
  await page.request.post("/api/admin/automations/enroll", { data: { journeyId, contactId: failedContactId } });

  // Force one enrollment straight to FAILED rather than engineering a real
  // failure (e.g. a broken webhook) — this test verifies the overview's
  // counting/filtering, not the automation engine's own failure detection.
  await forceEnrollmentStatus(journeyId, failedContactId, "FAILED");

  await page.goto(`/admin/automations/${journeyId}`);
  await expect(page.getByText("1 active", { exact: true })).toBeVisible();
  await expect(page.getByText("1 failed", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Enrollments" }).click();
  const failedFilter = page.getByRole("button", { name: /^Failed \(1\)$/ });
  await expect(failedFilter).toBeVisible();
  await failedFilter.click();
  await expect(page.getByText("Showing 1 failed enrollment")).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr").first().getByText("failed", { exact: true })).toBeVisible();

  // The journeys list classifies this under "Needs attention" regardless
  // of the journey's own active/inactive toggle — a failed enrollment
  // doesn't resolve itself, so it stays actionable either way.
  await page.goto("/admin/automations");
  const listRow = page.locator("tbody tr").filter({ hasText: journeyName });
  await expect(listRow).toBeVisible();
  await expect(listRow.getByText(/Needs attention/)).toBeVisible();
});
