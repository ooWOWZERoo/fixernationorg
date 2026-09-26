import { test, expect, type Page } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";
import {
  getApplicationByEmail,
  getAffiliateAssignmentByApplicationId,
  getContactByUserId,
  isContactInNamedList,
  getConsentOptIn,
  getPromoCodeByCode,
  deleteAffiliateAssignmentDeep,
  deleteTestUser,
  closeTestDb,
} from "./helpers/db";
import { deleteStripeCoupon } from "./helpers/stripe";

// ── Known, permanent coverage gap ────────────────────────────────────────────
// Stripe is in LIVE mode on this project (not test mode), so this suite
// cannot exercise the actual promo-code -> commission-creation path:
//   - Completing a real Stripe Checkout needs a real card; no test-card
//     number works in live mode.
//   - Forging a valid `stripe-signature` header for
//     POST /api/webhooks/stripe isn't possible without STRIPE_WEBHOOK_SECRET,
//     which is a Sensitive Vercel env var never exposed to test code.
//     Disabling signature verification to work around that would be a real
//     security regression, not a test convenience — not done here.
// That means attributeAffiliateCommission() in src/lib/commission.ts — the
// function that actually turns a redeemed promo code's first successful
// charge into a CommissionLedger row — has ZERO automated coverage, in this
// suite or anywhere else. What IS covered below, end to end: application
// submission -> admin approval -> invite claim -> role grant ->
// AffiliateAssignment provisioning -> Affiliates list membership ->
// Morning Boost consent -> admin-managed commission rule + promo code
// (a real Stripe Coupon) -> the SP-71 self-service /account/affiliate
// visibility -> the manual ledger entry approve/pay lifecycle that the
// admin "Owed"/"Paid out" balance stats depend on. None of that touches
// the webhook.

const STAMP = Date.now();
const EMAIL = `qa-affiliate-loop-${STAMP}@example.com`;
const NAME = `QA Affiliate Loop ${STAMP}`;
const PASSWORD = "Affiliate-Loop-Pw!23";
const PROMO_CODE = `QAE2ELOOP${STAMP}`;
const LEDGER_DESCRIPTION = `QA e2e loop ledger entry ${STAMP}`;

test.describe.configure({ mode: "serial" });

let applicationId: string;
let assignmentId: string;

test.afterAll(async () => {
  const promo = await getPromoCodeByCode(PROMO_CODE);
  await deleteStripeCoupon(promo?.stripeCouponId);
  if (assignmentId) await deleteAffiliateAssignmentDeep(assignmentId);
  await deleteTestUser(EMAIL);
  await closeTestDb();
});

async function openLedgerTab(page: Page) {
  await page.getByRole("button", { name: "Ledger" }).click();
}

test("submit application -> admin accepts -> invite claim grants AFFILIATE role, AffiliateAssignment, list membership, and consent", async ({ page }) => {
  test.setTimeout(90000);

  // Seed via the real public endpoint (become-an-affiliate.tsx posts here) --
  // the full 4-step UI form is already covered end to end by
  // affiliate-application.spec.ts, so re-driving it here would just add
  // brittleness without adding coverage.
  const submitRes = await page.request.post("/api/applications/affiliate", {
    data: {
      firstName: "QA",
      lastName: `AffiliateLoop${STAMP}`,
      email: EMAIL,
      phone: "5555550125",
      agreedToAccuracy: true,
      agreedToPolicy: true,
      agreedToContact: true,
      signatureName: NAME,
    },
  });
  expect(submitRes.ok()).toBeTruthy();

  const application = await getApplicationByEmail(EMAIL, "AFFILIATE");
  expect(application, "affiliate application should exist right after submission").toBeTruthy();
  applicationId = application!.id;
  expect(application!.status).toBe("SUBMITTED");

  await signInAsTestAdmin(page);
  await page.goto("/admin/applications");
  await page.getByPlaceholder("Search by name, email, phone, business, or category…").fill(EMAIL);
  // The search box debounces 400ms before pushing the filtered URL -- give
  // this more room than the 5s default, since this test does a lot of
  // network round-tripping beforehand.
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(EMAIL)}`), { timeout: 10000 });

  const row = page.getByRole("button").filter({ hasText: EMAIL });
  await expect(row).toBeVisible();
  await row.click();
  // "Accept" is a substring of both the "Accepted" tab filter button and
  // the "Conditionally accept" review action -- exact match is required.
  await page.getByRole("button", { name: "Accept", exact: true }).click();

  // Accepting an application with no linked account defers the role grant
  // until invite claim, but auto-generates + emails the account invite
  // token in the same PATCH (src/pages/api/admin/applications/[id].ts's
  // "Account invite on acceptance when no userId yet" branch), which also
  // awaits a real SMTP send -- poll rather than assume a fixed delay.
  let inviteToken: string | null = null;
  await expect
    .poll(async () => {
      const app = await getApplicationByEmail(EMAIL, "AFFILIATE");
      inviteToken = app?.accountInviteToken ?? null;
      return inviteToken;
    }, { timeout: 40000, intervals: [2000, 3000, 5000, 5000, 5000] })
    .not.toBeNull();

  // Confirm the UI agrees, on the Accepted tab.
  await page.goto("/admin/applications?tab=ACCEPTED");
  await page.getByPlaceholder("Search by name, email, phone, business, or category…").fill(EMAIL);
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(EMAIL)}`), { timeout: 10000 });
  const acceptedRow = page.getByRole("button").filter({ hasText: EMAIL });
  await expect(acceptedRow).toBeVisible();
  await expect(acceptedRow.getByText("Accepted")).toBeVisible();

  // Claim the invite as a brand-new user -- the "form" phase of
  // src/pages/invite/[token].tsx.
  await page.goto(`/invite/${inviteToken}`);
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.getByLabel("Full name").fill(NAME);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create my account" }).click();
  await expect(page.getByRole("heading", { name: "Account created" })).toBeVisible();

  // Verify the grant chain directly via DB -- list/consent membership have
  // no UI surface at all today, and re-deriving role via another sign-in
  // here would just duplicate the dedicated self-service test below.
  const assignment = await getAffiliateAssignmentByApplicationId(applicationId);
  expect(assignment, "AffiliateAssignment should be provisioned on invite claim").toBeTruthy();
  expect(assignment!.affiliateType).toBe("AFFILIATE");
  assignmentId = assignment!.id;

  // enrollAffiliateList/enrollMorningBoost (src/pages/api/invite/[token].ts)
  // are fire-and-forget in the new-user path -- the "Account created"
  // response can land before their Contact/list/consent side effects have
  // actually committed. Poll for the Contact itself too, not just the
  // list/consent state that depends on it, instead of assuming it already
  // exists the instant the UI shows success.
  let contactId: string | null = null;
  await expect
    .poll(async () => {
      const contact = await getContactByUserId(assignment!.userId);
      contactId = contact?.id ?? null;
      return contactId;
    }, { timeout: 15000 })
    .not.toBeNull();

  await expect
    .poll(async () => isContactInNamedList(contactId!, "Affiliates"), { timeout: 15000 })
    .toBe(true);
  await expect
    .poll(async () => getConsentOptIn(contactId!, "MORNING_BOOST"), { timeout: 15000 })
    .toBe(true);
});

test("admin creates a commission rule and a promo code for the new affiliate", async ({ page }) => {
  test.setTimeout(30000);
  await signInAsTestAdmin(page);
  await page.goto(`/admin/affiliates/${assignmentId}`);

  await page.getByRole("button", { name: "Commission rules" }).click();
  await page.getByPlaceholder("e.g. Standard referral 10%").fill("QA e2e loop rate");
  await page.getByPlaceholder("10", { exact: true }).fill("15");
  await page.getByRole("button", { name: "Add rule" }).click();
  await expect(page.getByText("QA e2e loop rate")).toBeVisible();

  // Real, live call to stripe.coupons.create() -- see
  // src/pages/api/admin/affiliates/[id].ts. Cleaned up in afterAll via
  // helpers/stripe.ts, since nothing in the app itself ever deletes it.
  await page.getByRole("button", { name: "Promo codes" }).click();
  await page.getByPlaceholder("10", { exact: true }).fill("10");
  await page.getByPlaceholder("Auto-generated if blank").fill(PROMO_CODE);
  await page.getByRole("button", { name: "Create code" }).click();
  await expect(page.getByText(`Code ${PROMO_CODE} created.`)).toBeVisible();

  const promo = await getPromoCodeByCode(PROMO_CODE);
  expect(promo, "promo code row should exist").toBeTruthy();
  expect(promo!.affiliateId).toBe(assignmentId);
  expect(promo!.stripeCouponId, "a real Stripe Coupon should have been minted").toBeTruthy();
});

test("the new affiliate's self-service page shows the promo code, join link, and commission rate", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email address").fill(EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/signin/, { timeout: 15000 });

  await page.goto("/account/affiliate");
  await expect(page.getByText(PROMO_CODE)).toBeVisible();
  await expect(page.getByText(`/join?promo=${PROMO_CODE}`)).toBeVisible();
  await expect(page.getByText("You earn 15% on all products.")).toBeVisible();
});

test("manual ledger entry -> approve -> mark paid updates the Owed / Paid out balance", async ({ page }) => {
  test.setTimeout(30000);
  await signInAsTestAdmin(page);
  await page.goto(`/admin/affiliates/${assignmentId}`);

  // Balance amounts render from GSSP props, not the client-side affiliate
  // state each mutation updates -- a full reload is required to see them
  // move, same as affiliate-commissions.spec.ts's "reload before re-opening
  // the tab" note.
  const balanceCard = () => page.getByText("Owed = APPROVED entries awaiting payout.").locator("xpath=..");
  const balanceAmounts = () => balanceCard().locator("span").filter({ hasText: "$" });

  await expect(balanceAmounts().nth(0)).toHaveText("$0.00"); // Owed
  await expect(balanceAmounts().nth(1)).toHaveText("$0.00"); // Paid out

  await openLedgerTab(page);
  await page.locator("select").selectOption("MANUAL");
  await page.getByPlaceholder("e.g. Q3 performance bonus").fill(LEDGER_DESCRIPTION);
  const amountInputs = page.locator('input[type="number"][step="0.01"]');
  await amountInputs.nth(0).fill("100");
  await amountInputs.nth(1).fill("15");
  // Pending days must be > 0, or the server auto-approves the entry
  // immediately (src/pages/api/admin/affiliates/[id].ts: status:
  // pendingUntil ? "PENDING" : "APPROVED") -- skip straight past PENDING.
  await page.locator('input[type="number"][min="0"]').fill("1");
  await page.getByRole("button", { name: "Add entry" }).click();
  await expect(page.getByText("Entry added.")).toBeVisible();

  await page.reload();
  // Still PENDING, not APPROVED -- doesn't count toward Owed yet.
  await expect(balanceAmounts().nth(0)).toHaveText("$0.00");
  await expect(balanceAmounts().nth(1)).toHaveText("$0.00");

  await openLedgerTab(page);
  const row = page.locator("tbody tr").filter({ hasText: LEDGER_DESCRIPTION }).first();
  await expect(row).toBeVisible();
  await expect(row.getByText("PENDING", { exact: true })).toBeVisible();

  await row.getByRole("button", { name: "Approve" }).click();
  await expect(row.getByText("APPROVED", { exact: true })).toBeVisible();

  await page.reload();
  await expect(balanceAmounts().nth(0)).toHaveText("$15.00"); // now Owed
  await expect(balanceAmounts().nth(1)).toHaveText("$0.00");

  await openLedgerTab(page);
  const approvedRow = page.locator("tbody tr").filter({ hasText: LEDGER_DESCRIPTION }).first();
  await approvedRow.getByRole("button", { name: "Mark paid" }).click();
  await expect(approvedRow.getByText("PAID", { exact: true })).toBeVisible();

  await page.reload();
  await expect(balanceAmounts().nth(0)).toHaveText("$0.00"); // no longer Owed
  await expect(balanceAmounts().nth(1)).toHaveText("$15.00"); // now Paid out
});
