import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";
import { createEmailFailure } from "./helpers/db";

const STAMP = Date.now();

// Only tests the banner's own detection/rendering logic via a direct DB
// fixture — not a real SMTP send failure, which right now would always be
// true in production (there's a live outage as of this writing) and won't
// always be. A "no banner when healthy" negative case isn't testable here
// while that's the case; skipped rather than asserted against real,
// currently-broken production state.
test("dashboard shows an email delivery warning when recent sends have failed", async ({ page }) => {
  await signInAsTestAdmin(page);
  await createEmailFailure(
    `qa-email-health-${STAMP}@example.com`,
    "QA dashboard banner check",
    `QA test failure ${STAMP}`
  );

  await page.goto("/admin");
  await expect(page.getByText(/Outgoing email is failing/)).toBeVisible();
  await expect(page.getByText(/failed sends? in the last 24 hours/)).toBeVisible();
});
