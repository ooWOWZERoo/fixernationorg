import { test, expect, Page } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

// Exercises src/lib/audience.ts's actual combination logic (AND/OR over
// include rules, exclude subtraction, consent-opt-out suppression) via the
// same /api/admin/campaigns/preview-audience endpoint the campaign wizard
// uses. admin-campaign.spec.ts already covers the wizard UI end-to-end with
// a single tag rule — this fills the real gap: what the logic actually does
// with more than one rule, which the wizard-level test never exercises.
//
// Fixture contacts (all created fresh, tag names are STAMP-unique so they
// can't collide with any real or other-test data):
//   C1: tag A only
//   C2: tag B only
//   C3: tag A + tag B
//   C4: tag A only, opted OUT of the CAMPAIGNS consent topic (suppression)

const STAMP = Date.now();
const TAG_A = `qa-aud-a-${STAMP}`;
const TAG_B = `qa-aud-b-${STAMP}`;

test.describe.configure({ mode: "serial" });

async function createTaggedContact(page: Page, label: string, tags: string[]) {
  await page.goto("/admin/contacts/new");
  await page.locator('input[type="email"]').first().fill(`qa-aud-${label}-${STAMP}@example.com`);
  await page.locator('input[type="text"]').nth(0).fill("QA");
  await page.locator('input[type="text"]').nth(1).fill(`Audience${label}`);
  await page.getByRole("button", { name: "Create contact" }).click();
  await expect(page).toHaveURL(/\/admin\/contacts\/[a-z0-9]+$/);

  for (const tag of tags) {
    await page.getByPlaceholder("Add tag…").fill(tag);
    await page.getByRole("button", { name: "Add tag" }).click();
    await expect(page.getByText(tag).first()).toBeVisible();
  }
}

async function optOutOfCampaigns(page: Page) {
  await page.getByRole("button", { name: "Consent" }).click();
  const row = page.locator("xpath=//span[normalize-space(text())='Campaigns']/..");
  await row.getByRole("button", { name: "Out" }).click();
  await expect(row.getByRole("button", { name: "Out" })).toHaveClass(/bg-red-600/);
}

async function previewAudience(page: Page, include: unknown[], exclude: unknown[], logic: "AND" | "OR" = "OR") {
  const res = await page.request.post("/api/admin/campaigns/preview-audience", {
    data: { rules: { logic, include, exclude } },
  });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await signInAsTestAdmin(page);

  await createTaggedContact(page, "c1", [TAG_A]);
  await createTaggedContact(page, "c2", [TAG_B]);
  await createTaggedContact(page, "c3", [TAG_A, TAG_B]);
  await createTaggedContact(page, "c4", [TAG_A]);
  await optOutOfCampaigns(page);

  await page.close();
});

test("OR logic includes the union of all matching contacts, then suppresses opted-out ones", async ({ page }) => {
  await signInAsTestAdmin(page);
  const preview = await previewAudience(
    page,
    [{ type: "tag", tag: TAG_A }, { type: "tag", tag: TAG_B }],
    [],
    "OR"
  );
  // C1, C2, C3, C4 all match (union) — C4 is then suppressed for its
  // CAMPAIGNS opt-out, leaving C1/C2/C3.
  expect(preview.totalIncluded).toBe(3);
  expect(preview.totalSuppressed).toBe(1);
  expect(preview.suppressionBreakdown).toEqual([{ reason: "opted_out", count: 1 }]);
});

test("AND logic includes only contacts matching every rule", async ({ page }) => {
  await signInAsTestAdmin(page);
  const preview = await previewAudience(
    page,
    [{ type: "tag", tag: TAG_A }, { type: "tag", tag: TAG_B }],
    [],
    "AND"
  );
  // Only C3 has both tags.
  expect(preview.totalIncluded).toBe(1);
  expect(preview.totalSuppressed).toBe(0);
});

test("exclude rules subtract from the included set regardless of include logic", async ({ page }) => {
  await signInAsTestAdmin(page);
  const preview = await previewAudience(
    page,
    [{ type: "tag", tag: TAG_A }],
    [{ type: "tag", tag: TAG_B }],
    "OR"
  );
  // tag A -> C1, C3, C4. Excluding tag B removes C3. C4 is then suppressed
  // for its opt-out, leaving only C1.
  expect(preview.totalIncluded).toBe(1);
  expect(preview.totalSuppressed).toBe(1);
});

test("an empty include list resolves to zero contacts, not \"everyone\"", async ({ page }) => {
  await signInAsTestAdmin(page);
  const preview = await previewAudience(page, [], [{ type: "tag", tag: TAG_A }], "OR");
  expect(preview.totalIncluded).toBe(0);
  expect(preview.totalSuppressed).toBe(0);
});
