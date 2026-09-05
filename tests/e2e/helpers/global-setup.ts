// Paired with global-teardown.ts: records when this run started so teardown
// can delete only what THIS run created, never pre-existing data (including
// the named qa-* fixtures, which predate any run and are never touched).
export default async function globalSetup() {
  process.env.E2E_RUN_STARTED_AT = new Date().toISOString();
}
