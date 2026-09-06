// Shared definition of what counts as e2e/QA test data, so admin UI filtering
// and campaign audience suppression (src/lib/audience.ts) can't drift apart.

export const TEST_CONTACT_EMAIL_OR = [
  { email: { endsWith: "@example.com" } },
  { email: { endsWith: "@fixernation-e2e.test" } },
  { AND: [{ email: { startsWith: "qa-" } }, { email: { endsWith: "@fixernation.org" } }] },
];

export function isTestEmail(email: string): boolean {
  const e = email.toLowerCase();
  return (
    e.endsWith("@example.com") ||
    e.endsWith("@fixernation-e2e.test") ||
    (e.startsWith("qa-") && e.endsWith("@fixernation.org"))
  );
}

// A separate domain for e2e specs that need a contact to actually resolve
// into a real campaign audience (testing AND/OR/exclude/opt-out logic,
// dispatch, send-now). Deliberately NOT part of TEST_CONTACT_EMAIL_OR /
// isTestEmail: those exist specifically to suppress QA-pattern contacts from
// every real send (see audience.ts's "test_contact" suppression, added
// after a leftover QA contact caused a real bounce storm), so a fixture
// contact using this domain is exempt from that suppression and can
// exercise the real resolution path. global-teardown.ts cleans these up by
// createdAt window the same way it does everything else -- they are not
// exempt from cleanup, only from send suppression.
export const E2E_AUDIENCE_FIXTURE_DOMAIN = "fixernation-e2e-audience.test";

// The long-lived named e2e fixtures the test suite signs in as (see
// tests/e2e/helpers/auth.ts). These must never be deleted -- only the
// accumulated side-content they generate during test runs gets cleaned up.
export const NAMED_FIXTURE_EMAILS = [
  "qa-admin@fixernation.org",
  "qa-ambassador@fixernation.org",
  "qa-member@fixernation.org",
  "qa-mfa-test@fixernation.org",
  "qa-provider@fixernation.org",
  "qa-recipient@fixernation.org",
  "qa-super-admin@fixernation.org",
];
