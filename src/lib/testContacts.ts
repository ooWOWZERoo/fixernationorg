// Shared definition of what counts as e2e/QA test data, so admin UI filtering
// and campaign audience suppression (src/lib/audience.ts) can't drift apart.

export const TEST_CONTACT_EMAIL_OR = [
  { email: { endsWith: "@example.com" } },
  { AND: [{ email: { startsWith: "qa-" } }, { email: { endsWith: "@fixernation.org" } }] },
];

export function isTestEmail(email: string): boolean {
  return (
    email.toLowerCase().endsWith("@example.com") ||
    (email.toLowerCase().startsWith("qa-") && email.toLowerCase().endsWith("@fixernation.org"))
  );
}
