import { test, expect, Page } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";
import { getLatestContactMergeHistory } from "./helpers/db";

const STAMP = Date.now();
const SURVIVOR_EMAIL = `qa-merge-survivor-${STAMP}@example.com`;
const SOURCE_EMAIL = `qa-merge-source-${STAMP}@example.com`;
const TAG_SHARED = `qa-merge-shared-${STAMP}`;
const TAG_UNIQUE = `qa-merge-unique-${STAMP}`;
const SURVIVOR_NOTE = `QA survivor note ${STAMP}`;
const SOURCE_NOTE = `QA source note ${STAMP}`;

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signInAsTestAdmin(page);
});

async function createContact(page: Page, email: string, lastName: string) {
  await page.goto("/admin/contacts/new");
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="text"]').nth(0).fill("QA");
  await page.locator('input[type="text"]').nth(1).fill(lastName);
  await page.getByRole("button", { name: "Create contact" }).click();
  // Exclude "new" explicitly — this assertion can otherwise resolve while
  // the redirect off /admin/contacts/new is still in flight (established
  // gotcha in this suite, e.g. admin-morning-boost.spec.ts).
  await expect(page).toHaveURL(/\/admin\/contacts\/(?!new$)[a-z0-9]+$/);
  return page.url().split("/").pop() as string;
}

async function addTag(page: Page, tag: string) {
  await page.getByPlaceholder("Add tag…").fill(tag);
  await page.getByRole("button", { name: "Add tag" }).click();
  await expect(page.getByText(tag).first()).toBeVisible();
}

async function addNote(page: Page, body: string) {
  await page.getByRole("button", { name: "Notes" }).click();
  await page.getByPlaceholder("Write a note…").fill(body);
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText(body)).toBeVisible();
}

test("merging a contact moves its tags (deduped) and notes, deletes the source, and logs merge history", async ({ page }) => {
  test.setTimeout(60000);

  await createContact(page, SOURCE_EMAIL, `MergeSource${STAMP}`);
  await addTag(page, TAG_SHARED);
  await addTag(page, TAG_UNIQUE);
  await addNote(page, SOURCE_NOTE);

  const survivorId = await createContact(page, SURVIVOR_EMAIL, `MergeSurvivor${STAMP}`);
  await addTag(page, TAG_SHARED);
  await addNote(page, SURVIVOR_NOTE);

  await page.getByRole("button", { name: "Merge" }).click();
  await page.getByPlaceholder("Search by name or email…").fill(SOURCE_EMAIL);
  await page.getByRole("button", { name: new RegExp(SOURCE_EMAIL) }).click();
  await expect(page.getByText(`Absorb: QA MergeSource${STAMP}`)).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Confirm merge" }).click();
  await expect(page.getByText("Merge another contact into this one")).not.toBeVisible({ timeout: 15000 });

  // Tag chips render as <span>{tag}<button>×</button></span> — the chip's
  // full text content is "tag×", so an exact match would never succeed.
  await expect(page.getByText(TAG_SHARED)).toHaveCount(1);
  await expect(page.getByText(TAG_UNIQUE)).toBeVisible();

  await page.getByRole("button", { name: "Notes" }).click();
  await expect(page.getByText(SURVIVOR_NOTE)).toBeVisible();
  await expect(page.getByText(SOURCE_NOTE)).toBeVisible();

  await expect.poll(async () => {
    const row = await getLatestContactMergeHistory(survivorId);
    return row?.absorbedEmail ?? null;
  }, { timeout: 10000 }).toBe(SOURCE_EMAIL);
  const history = await getLatestContactMergeHistory(survivorId);

  const searchRes = await page.request.get(`/api/admin/contacts?q=${encodeURIComponent(SOURCE_EMAIL)}`);
  const { contacts } = await searchRes.json();
  expect(contacts).toHaveLength(0);

  const sourceDetailRes = await page.request.get(`/admin/contacts/${history?.absorbedId}`);
  expect(sourceDetailRes.status()).toBe(404);
});

test("a contact cannot be merged into itself", async ({ page }) => {
  test.setTimeout(20000);

  const res = await page.request.get(`/api/admin/contacts?q=${encodeURIComponent(SURVIVOR_EMAIL)}`);
  const { contacts } = await res.json();
  const survivorId = contacts[0].id as string;

  const mergeRes = await page.request.post(`/api/admin/contacts/${survivorId}/merge`, {
    data: { sourceId: survivorId },
  });
  expect(mergeRes.status()).toBe(400);
  const body = await mergeRes.json();
  expect(body.error).toBe("Cannot merge a contact into itself");

  // Clean up the surviving contact (the source was already deleted by the merge itself).
  await page.goto(`/admin/contacts/${survivorId}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/admin\/contacts$/);
});
