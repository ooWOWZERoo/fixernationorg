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
