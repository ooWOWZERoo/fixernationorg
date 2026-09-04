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

// Hits the same live /api/admin/contacts?q= endpoint the merge modal uses,
// so a test can assert on exactly what the modal would see before acting on
// it. This suite's isolation from real production contacts depends entirely
// on the query strings staying fully-qualified and unique (STAMP-tagged) —
// there's no server-side scoping to a "test" subset. This helper exists so
// that invariant is checked explicitly rather than assumed.
async function searchContactsFor(page: Page, q: string): Promise<{ id: string; email: string }[]> {
  const res = await page.request.get(`/api/admin/contacts?q=${encodeURIComponent(q)}`);
  const { contacts } = await res.json();
  return contacts;
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

  // Guard rail: this modal's search hits the live /api/admin/contacts?q=
  // endpoint against real production data, scoped to safety here only by
  // the fact that SOURCE_EMAIL happens to be a fully-qualified unique
  // string. Assert that invariant explicitly via the same API the modal
  // uses, so a future edit that loosens the search term fails loud here
  // instead of silently risking a real contact ending up in the results.
  await expect(searchContactsFor(page, SOURCE_EMAIL)).resolves.toEqual([
    expect.objectContaining({ email: SOURCE_EMAIL }),
  ]);

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

  expect(await searchContactsFor(page, SOURCE_EMAIL)).toHaveLength(0);

  const sourceDetailRes = await page.request.get(`/admin/contacts/${history?.absorbedId}`);
  expect(sourceDetailRes.status()).toBe(404);
});

test("a contact cannot be merged into itself", async ({ page }) => {
  test.setTimeout(20000);

  // Guard rail: don't trust "first result" blindly — assert the search is
  // scoped to exactly this run's own fixture before acting on its id, same
  // as the guard in the test above.
  const contacts = await searchContactsFor(page, SURVIVOR_EMAIL);
  expect(contacts).toEqual([expect.objectContaining({ email: SURVIVOR_EMAIL })]);
  const survivorId = contacts[0].id;

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
