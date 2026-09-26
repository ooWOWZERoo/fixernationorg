import { test, expect, type Page } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";
import { getVerificationToken, getActivePriceId, getPromoCodeByCode, deleteTestUser, closeTestDb } from "./helpers/db";
import { deleteStripeCoupon } from "./helpers/stripe";

// Stripe is in LIVE mode on this project, so this suite only ever calls
// POST /api/checkout/create-session and asserts on its response shape/status
// -- it never navigates to the returned Stripe url or completes a checkout
// (no test-card number works against a live account). See the top-of-file
// comment in affiliate-closed-loop.spec.ts for the full rationale and what
// that leaves uncovered downstream (webhook -> commission attribution).

// Seeded via a one-time admin endpoint against the qa-ambassador test user
// (see promo-codes.spec.ts / affiliate-commissions.spec.ts) -- reused here
// rather than provisioning a whole new AffiliateAssignment, since this
// suite only needs *a* valid promo code to exist. Its PromoCode rows are
// already swept by global-teardown's namedFixture-keyed "promoCodes" task.
const AFFILIATE_ID = "cmszf2ebi0002naq90i72v7ms";

const STAMP = Date.now();
const CODE = `QAE2ECHECKOUT${STAMP}`;
const MEMBER_EMAIL = `qa-checkout-promo-${STAMP}@fixernation-e2e.test`;
const MEMBER_NAME = "QA Checkout Promo Test";
const MEMBER_PASSWORD = "Checkout-Promo-Pw!23";

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  const promo = await getPromoCodeByCode(CODE);
  await deleteStripeCoupon(promo?.stripeCouponId);
  await deleteTestUser(MEMBER_EMAIL);
  await closeTestDb();
});

async function signInAsFreshMember(page: Page) {
  await page.goto("/signin");
  await page.getByLabel("Email address").fill(MEMBER_EMAIL);
  await page.getByLabel("Password").fill(MEMBER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/signin/, { timeout: 15000 });
}

test("register a fresh member with no membership + admin creates a valid promo code", async ({ page }) => {
  test.setTimeout(60000);

  // A fresh, disposable member is used instead of a shared named fixture --
  // any existing QA fixture that already carries an active membership would
  // trip create-session.ts's "You already have an active membership" 409
  // before the promo-code logic under test even runs.
  await page.setExtraHTTPHeaders({ "x-e2e-bypass-secret": process.env.E2E_TEST_BYPASS_SECRET ?? "" });
  await page.goto("/register");
  await page.getByLabel("Full name").fill(MEMBER_NAME);
  await page.getByLabel("Email address").fill(MEMBER_EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(MEMBER_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  // No mailbox to read in this environment -- read the real verification
  // token straight from the DB, same as register-verify.spec.ts.
  const token = await getVerificationToken(MEMBER_EMAIL);
  expect(token, "expected a pending VerificationToken row for the newly registered account").toBeTruthy();
  await page.goto(`/api/auth/verify-email?token=${token}`);
  await expect(page).toHaveURL(/\/signin\?verified=1/);

  await signInAsTestAdmin(page);
  const promoRes = await page.request.patch(`/api/admin/affiliates/${AFFILIATE_ID}`, {
    data: { action: "promo", discountType: "PERCENTAGE", discountValue: 10, customCode: CODE },
  });
  expect(promoRes.ok()).toBeTruthy();
  const promoBody = await promoRes.json();
  expect(promoBody.code).toBe(CODE);
});

test("an invalid promo code is rejected -- 400, no Stripe session created", async ({ page }) => {
  test.setTimeout(30000);
  await signInAsFreshMember(page);

  const priceId = await getActivePriceId();
  expect(priceId, "expected at least one active Price with a live stripePriceId").toBeTruthy();

  const res = await page.request.post("/api/checkout/create-session", {
    data: { priceId, promoCode: "NOT-A-REAL-CODE" },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBe("This promo code is invalid or has expired.");
  // The 400 is returned before stripe.checkout.sessions.create() is ever
  // called (src/pages/api/checkout/create-session.ts) -- no `url` on the
  // response is the observable proof of that from here.
  expect(body.url).toBeUndefined();
});

test("a valid promo code is accepted -- 200, a real Stripe Checkout session url", async ({ page }) => {
  test.setTimeout(30000);
  await signInAsFreshMember(page);

  const priceId = await getActivePriceId();
  expect(priceId).toBeTruthy();

  const res = await page.request.post("/api/checkout/create-session", {
    data: { priceId, promoCode: CODE },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  // Intentionally not navigating to this url or completing checkout --
  // Stripe is live, so no test-card number would work. The response shape
  // is as far as this can safely go.
  expect(typeof body.url).toBe("string");
  expect(body.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
});
