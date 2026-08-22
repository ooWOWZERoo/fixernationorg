import { test, expect } from "@playwright/test";
import { signInAsTestAdmin, signInAsTestSuperAdmin } from "./helpers/auth";
import { getUserId, deleteTestUser, closeTestDb } from "./helpers/db";

// A fresh throwaway registration per run — the admin/users list needs a real
// target user, but nothing needs to sign in as it, so skipping email
// verification and going straight through the register API is enough.
const STAMP = Date.now();
const TARGET_EMAIL = `qa-admin-users-target-${STAMP}@fixernation-e2e.test`;
const SUPER_TARGET_EMAIL = `qa-admin-users-super-target-${STAMP}@fixernation-e2e.test`;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await deleteTestUser(TARGET_EMAIL);
  await deleteTestUser(SUPER_TARGET_EMAIL);
  await closeTestDb();
});

test("admin changes a member's role -> persists; own row and staff access stay locked down", async ({ page }) => {
  test.setTimeout(30000);

  const res = await page.request.post("/api/auth/register", {
    data: { name: "QA Admin Users Target", email: TARGET_EMAIL, password: "Target-Test-Pw!23" },
  });
  expect(res.ok()).toBe(true);

  await signInAsTestAdmin(page);
  await page.goto("/admin/users");

  const targetRow = page.locator("tbody tr").filter({ hasText: TARGET_EMAIL });
  await expect(targetRow).toBeVisible();
  await expect(targetRow.locator("select").first()).toHaveValue("CONSUMER");

  // qa-admin is ADMIN, not SUPER_ADMIN — the "Staff access" column for any
  // other user must render as a read-only badge, not an editable select.
  await expect(targetRow.locator("select")).toHaveCount(1);
  await expect(targetRow.getByText("None", { exact: true })).toBeVisible();

  await targetRow.locator("select").first().selectOption("MEMBER");
  await expect(targetRow.getByText("Saved", { exact: true })).toBeVisible();

  await page.reload();
  const targetRowAfterReload = page.locator("tbody tr").filter({ hasText: TARGET_EMAIL });
  await expect(targetRowAfterReload.locator("select").first()).toHaveValue("MEMBER");

  // Own row: neither field is editable, for either role type.
  const ownRow = page.locator("tbody tr").filter({ has: page.getByText("you", { exact: true }) });
  await expect(ownRow).toBeVisible();
  await expect(ownRow.locator("select")).toHaveCount(0);
});

test("non-super-admin cannot change staff access via the API directly", async ({ page }) => {
  test.setTimeout(20000);

  const targetId = await getUserId(TARGET_EMAIL);
  expect(targetId, `expected the target user ${TARGET_EMAIL} to exist`).toBeTruthy();

  await signInAsTestAdmin(page);
  const res = await page.request.patch(`/api/admin/users/${targetId}`, {
    data: { adminRole: "ADMIN" },
  });
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toBe("Only super admins can change staff access.");
});

test("super admin CAN change another user's staff access -> persists", async ({ page }) => {
  test.setTimeout(30000);

  const res = await page.request.post("/api/auth/register", {
    data: { name: "QA Admin Users Super Target", email: SUPER_TARGET_EMAIL, password: "Target-Test-Pw!23" },
  });
  expect(res.ok()).toBe(true);

  await signInAsTestSuperAdmin(page);
  await page.goto("/admin/users");

  const targetRow = page.locator("tbody tr").filter({ hasText: SUPER_TARGET_EMAIL });
  await expect(targetRow).toBeVisible();
  // Viewed by a SUPER_ADMIN, an ordinary target row gets two editable
  // selects (membership role + staff access) instead of a read-only badge.
  await expect(targetRow.locator("select")).toHaveCount(2);

  const staffAccessSelect = targetRow.locator("select").nth(1);
  await expect(staffAccessSelect).toHaveValue("NONE");
  await staffAccessSelect.selectOption("ADMIN");
  await expect(targetRow.getByText("Saved", { exact: true })).toBeVisible();

  await page.reload();
  const targetRowAfterReload = page.locator("tbody tr").filter({ hasText: SUPER_TARGET_EMAIL });
  await expect(targetRowAfterReload.locator("select").nth(1)).toHaveValue("ADMIN");
});
