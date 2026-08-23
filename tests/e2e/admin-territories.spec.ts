import { test, expect, Page } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

const STAMP = Date.now();
const TERRITORY_NAME = `QA e2e exclusive territory ${STAMP}`;
const LOCKED_TERRITORY_NAME = `QA e2e locked territory ${STAMP}`;

test.describe.configure({ mode: "serial" });

let applicationAId: string;
let applicationBId: string;
let exclusiveTerritoryId: string;
let lockedTerritoryId: string;

async function submitAmbassadorApplication(page: Page, email: string, lastName: string) {
  await page.goto("/become-an-ambassador");
  await page.getByPlaceholder("Jane", { exact: true }).fill("QA");
  await page.getByPlaceholder("Smith").fill(lastName);
  await page.getByPlaceholder("jane@example.com").fill(email);
  await page.getByPlaceholder("(555) 000-0000").fill("5555550123");
  await page.getByRole("button", { name: "Continue" }).click();
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Continue" }).click();
  }
  await expect(page.getByText("Step 6 of 6")).toBeVisible();
  await page.getByText("The information in this application is accurate").click();
  await page.getByText("I agree to Fixer Nation's community guidelines").click();
  await page.getByText("I agree to be contacted by Fixer Nation").click();
  await page.getByPlaceholder("Type your full legal name").fill(`QA ${lastName}`);
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page).toHaveURL(/\/apply\/confirmed\?type=ambassador/, { timeout: 30000 });

  await signInAsTestAdmin(page);
  await page.goto("/admin/applications");
  await page.getByPlaceholder("Search by name, email, phone, business, or category…").fill(email);
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(email)}`));
  const row = page.getByRole("button").filter({ hasText: email });
  await expect(row).toBeVisible();
  await row.click();
  await page.getByRole("link", { name: "View full application →" }).click();
  await expect(page).toHaveURL(/\/admin\/applications\/[^/]+$/);
  return page.url().split("/").pop() as string;
}

// The "Assign territory" <select> also lists every other active/reserved
// territory, so scope by the option text rather than relying on a fixed
// position — a <select>'s textContent includes all its options' text.
function territorySelect(page: Page, territoryName: string) {
  return page.locator("select", { hasText: territoryName });
}

async function assignTerritoryByName(page: Page, territoryName: string) {
  const select = territorySelect(page, territoryName);
  const value = await select.locator("option", { hasText: territoryName }).first().getAttribute("value");
  await select.selectOption(value as string);
  await page.getByRole("button", { name: "Assign territory" }).click();
  return value as string;
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();

  const EMAIL_A = `qa-territory-app-a-${STAMP}@example.com`;
  const EMAIL_B = `qa-territory-app-b-${STAMP}@example.com`;
  applicationAId = await submitAmbassadorApplication(page, EMAIL_A, `TerritoryA${STAMP}`);
  applicationBId = await submitAmbassadorApplication(page, EMAIL_B, `TerritoryB${STAMP}`);

  await page.close();
});

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage();
  await signInAsTestAdmin(page);
  // No UI control exists to deactivate a territory after creation (the
  // /admin/territories page only supports create + filter/list) — use the
  // API's plain field-update path directly for cleanup.
  if (exclusiveTerritoryId) {
    await page.request.patch(`/api/admin/territories/${exclusiveTerritoryId}`, { data: { status: "INACTIVE" } }).catch(() => {});
  }
  if (lockedTerritoryId) {
    await page.request.patch(`/api/admin/territories/${lockedTerritoryId}`, { data: { status: "INACTIVE" } }).catch(() => {});
  }
  await page.close();
});

test("admin creates a territory, assigns it, and revokes it", async ({ page }) => {
  test.setTimeout(30000);

  await signInAsTestAdmin(page);
  await page.goto("/admin/territories");

  await page.getByRole("button", { name: "+ New territory" }).click();
  await page.getByPlaceholder("e.g. Atlanta Metro — North Fulton County").fill(TERRITORY_NAME);
  await page.getByPlaceholder("e.g. Fulton County").fill(`QA County ${STAMP}`);
  await page.getByLabel("Exclusive territory").check();
  await page.getByRole("button", { name: "Create territory" }).click();
  const territoryRow = page.locator("tbody tr").filter({ hasText: TERRITORY_NAME });
  await expect(territoryRow).toBeVisible();
  await expect(territoryRow.getByText("Exclusive", { exact: true })).toBeVisible();

  await page.goto(`/admin/applications/${applicationAId}`);
  exclusiveTerritoryId = await assignTerritoryByName(page, TERRITORY_NAME);
  await expect(page.getByText("Territory assigned.")).toBeVisible();
  await expect(page.getByText(TERRITORY_NAME).first()).toBeVisible();

  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText(/^revoked on /)).toBeVisible();
});

test("an exclusive territory rejects a second active assignment until the first is revoked", async ({ page }) => {
  test.setTimeout(30000);
  expect(exclusiveTerritoryId, "the exclusive territory should exist from the previous test").toBeTruthy();

  // Re-assign to application A (was revoked at the end of the previous test).
  await signInAsTestAdmin(page);
  await page.goto(`/admin/applications/${applicationAId}`);
  await assignTerritoryByName(page, TERRITORY_NAME);
  await expect(page.getByText("Territory assigned.")).toBeVisible();

  // Application B attempts the same exclusive territory -> rejected.
  await page.goto(`/admin/applications/${applicationBId}`);
  await assignTerritoryByName(page, TERRITORY_NAME);
  await expect(page.getByText("This territory is exclusive and already has an active assignment.")).toBeVisible();

  // Revoke A's assignment, then B's assignment should now succeed.
  await page.goto(`/admin/applications/${applicationAId}`);
  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText(/^revoked on /)).toBeVisible();

  await page.goto(`/admin/applications/${applicationBId}`);
  await assignTerritoryByName(page, TERRITORY_NAME);
  await expect(page.getByText("Territory assigned.")).toBeVisible();

  // Clean up B's assignment so the territory is free again.
  await page.getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByText(/^revoked on /)).toBeVisible();
});

test("a locked territory cannot be assigned, even via a direct API call", async ({ page }) => {
  test.setTimeout(30000);

  await signInAsTestAdmin(page);
  await page.goto("/admin/territories");
  await page.getByRole("button", { name: "+ New territory" }).click();

  const createForm = page.locator("form").filter({ hasText: "New territory" });
  await createForm.getByPlaceholder("e.g. Atlanta Metro — North Fulton County").fill(LOCKED_TERRITORY_NAME);
  // Type, Scope, Status selects appear in that order in the create form.
  await createForm.locator("select").nth(2).selectOption("LOCKED");
  await createForm.getByRole("button", { name: "Create territory" }).click();

  const row = page.locator("tbody tr").filter({ hasText: LOCKED_TERRITORY_NAME });
  await expect(row).toBeVisible();
  await expect(row.getByText("Locked", { exact: true })).toBeVisible();

  // Locked territories are excluded from the assign dropdown entirely (the
  // application page's own getServerSideProps only fetches ACTIVE/RESERVED
  // territories), so this is only reachable via a direct API call.
  const listRes = await page.request.get("/api/admin/territories?q=" + encodeURIComponent(LOCKED_TERRITORY_NAME));
  const list = await listRes.json();
  lockedTerritoryId = list[0].id;

  const res = await page.request.patch(`/api/admin/territories/${lockedTerritoryId}`, {
    data: { action: "assign", applicationId: applicationAId },
  });
  expect(res.status()).toBe(409);
  const body = await res.json();
  expect(body.error).toBe("This territory is locked and cannot be assigned.");
});
