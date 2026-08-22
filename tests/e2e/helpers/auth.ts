import { Page, expect } from "@playwright/test";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/signin");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/signin/, { timeout: 15000 });
}

export async function signInAsTestMember(page: Page) {
  const email = process.env.TEST_MEMBER_EMAIL;
  const password = process.env.TEST_MEMBER_PASSWORD;
  if (!email || !password) {
    throw new Error("TEST_MEMBER_EMAIL / TEST_MEMBER_PASSWORD not set — see .env.test");
  }
  await signIn(page, email, password);
}

// A second dedicated QA account, used only as a target for flows that can't
// act on the primary test member (e.g. recognitions block self-recognition).
export async function signInAsTestRecipient(page: Page) {
  const email = process.env.TEST_RECIPIENT_EMAIL;
  const password = process.env.TEST_RECIPIENT_PASSWORD;
  if (!email || !password) {
    throw new Error("TEST_RECIPIENT_EMAIL / TEST_RECIPIENT_PASSWORD not set — see .env.test");
  }
  await signIn(page, email, password);
}

// A dedicated PROVIDER-role QA account, used for the provider campaign flow.
export async function signInAsTestProvider(page: Page) {
  const email = process.env.TEST_PROVIDER_EMAIL;
  const password = process.env.TEST_PROVIDER_PASSWORD;
  if (!email || !password) {
    throw new Error("TEST_PROVIDER_EMAIL / TEST_PROVIDER_PASSWORD not set — see .env.test");
  }
  await signIn(page, email, password);
}

// A dedicated AMBASSADOR-role QA account, used for the ambassador materials flow.
export async function signInAsTestAmbassador(page: Page) {
  const email = process.env.TEST_AMBASSADOR_EMAIL;
  const password = process.env.TEST_AMBASSADOR_PASSWORD;
  if (!email || !password) {
    throw new Error("TEST_AMBASSADOR_EMAIL / TEST_AMBASSADOR_PASSWORD not set — see .env.test");
  }
  await signIn(page, email, password);
}

// A dedicated ADMIN-role QA account, used for admin-only flows (e.g.
// affiliate commission management).
export async function signInAsTestAdmin(page: Page) {
  const email = process.env.TEST_ADMIN_EMAIL;
  const password = process.env.TEST_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set — see .env.test");
  }
  await signIn(page, email, password);
}

// A dedicated SUPER_ADMIN QA account, distinct from the plain-ADMIN
// qa-admin account, for flows that require the higher privilege level
// (e.g. staff-access changes, "last super admin" protections).
export async function signInAsTestSuperAdmin(page: Page) {
  const email = process.env.TEST_SUPER_ADMIN_EMAIL;
  const password = process.env.TEST_SUPER_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("TEST_SUPER_ADMIN_EMAIL / TEST_SUPER_ADMIN_PASSWORD not set — see .env.test");
  }
  await signIn(page, email, password);
}

// A dedicated MEMBER-role QA account used ONLY by the MFA flow. It briefly
// enables real two-factor auth, which would break signInAsTestMember for
// every other test running concurrently against the shared qa-member
// account — this account exists solely to keep that blast radius to zero.
export async function signInAsTestMfa(page: Page) {
  const email = process.env.TEST_MFA_EMAIL;
  const password = process.env.TEST_MFA_PASSWORD;
  if (!email || !password) {
    throw new Error("TEST_MFA_EMAIL / TEST_MFA_PASSWORD not set — see .env.test");
  }
  await signIn(page, email, password);
}
