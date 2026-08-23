import { test, expect } from "@playwright/test";
import {
  getContactMessageByEmail,
  getFixerQuestionByEmail,
  resetRateLimit,
} from "./helpers/db";

const STAMP = Date.now();

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  // Both endpoints share a 5-requests/hour-per-IP limit (SP-42). Since these
  // tests hit the real production endpoints and this spec re-runs isolated
  // then again as part of the full suite, reset the counters up front rather
  // than relying on 5/hour being enough headroom across both runs.
  await resetRateLimit("contact");
  await resetRateLimit("atf");
});

test.describe("Contact form (/contact)", () => {
  test("required fields block submission client-side — no request is sent", async ({ page }) => {
    let requestFired = false;
    await page.route("**/api/contact", (route) => {
      requestFired = true;
      route.continue();
    });

    await page.goto("/contact");
    await page.getByRole("button", { name: "Send message" }).click();

    // All four visible fields are HTML5-required; the browser blocks
    // submission natively, so the page never leaves the empty form.
    await expect(page.getByRole("heading", { name: "Message sent" })).not.toBeVisible();
    expect(requestFired).toBe(false);
  });

  test("valid submission stores a ContactMessage and shows confirmation", async ({ page }) => {
    const email = `qa-contact-${STAMP}@example.com`;

    await page.goto("/contact");
    await page.getByPlaceholder("Your name").fill(`QA Contact ${STAMP}`);
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.locator("select").selectOption("Membership");
    await page.getByPlaceholder("What's on your mind?").fill("This is a QA e2e test message body.");
    await page.getByRole("button", { name: "Send message" }).click();

    await expect(page.getByRole("heading", { name: "Message sent" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    // Same eventually-consistent-read lag documented elsewhere in this suite
    // (e.g. automation enrollments) between the app's write and a read over
    // TEST_DATABASE_URL — generous poll rather than an immediate assert.
    await expect.poll(
      () => getContactMessageByEmail(email),
      { timeout: 40000, intervals: [2000, 3000, 5000, 5000, 5000] }
    ).not.toBeNull();
    const row = await getContactMessageByEmail(email);
    expect(row?.subject).toBe("Membership");
    expect(row?.message).toBe("This is a QA e2e test message body.");
  });

  test("server-side validation rejects a too-short message that slips past client checks", async ({ page }) => {
    const email = `qa-contact-short-${STAMP}@example.com`;

    // The textarea has no minlength, only `required` — a 3-char message
    // passes client-side HTML5 validation and reaches the zod schema
    // (min 10) on the server, which should reject it.
    const res = await page.request.post("/api/contact", {
      data: { name: "QA Contact", email, subject: "General question", message: "hi!" },
    });
    expect(res.status()).toBe(400);

    const row = await getContactMessageByEmail(email);
    expect(row).toBeNull();
  });

  test("honeypot field silently succeeds without storing a ContactMessage", async ({ page }) => {
    const email = `qa-contact-honeypot-${STAMP}@example.com`;

    const res = await page.request.post("/api/contact", {
      data: {
        name: "Bot",
        email,
        subject: "General question",
        message: "This should never be stored.",
        _hp: "filled-in-by-a-bot",
      },
    });
    expect(res.ok()).toBeTruthy();

    const row = await getContactMessageByEmail(email);
    expect(row).toBeNull();
  });
});

test.describe("Ask The Fixer (/ask-the-fixer)", () => {
  test("required fields block submission client-side — no request is sent", async ({ page }) => {
    let requestFired = false;
    await page.route("**/api/ask-the-fixer", (route) => {
      requestFired = true;
      route.continue();
    });

    await page.goto("/ask-the-fixer");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByText("Message received.")).not.toBeVisible();
    expect(requestFired).toBe(false);
  });

  test("valid submission stores a FixerQuestion and shows confirmation — accessible with no sign-in or membership check", async ({ page }) => {
    const email = `qa-atf-${STAMP}@example.com`;

    await page.goto("/ask-the-fixer");
    // getByPlaceholder does case-insensitive substring matching by default,
    // so "Jane" also matches the email field's "jane@email.com" placeholder
    // — use the name attribute instead for an unambiguous match.
    await page.locator('input[name="firstName"]').fill("QA");
    await page.locator('input[name="lastName"]').fill(`Fixer${STAMP}`);
    await page.locator('input[name="email"]').fill(email);
    await page.locator('textarea[name="body"]').fill("This is a QA e2e test question.");
    await page.getByRole("button", { name: "Send" }).click();

    // Unlike /api/contact, /api/ask-the-fixer awaits an admin-notification
    // email (SMTP) before responding — give it more room than the default
    // 5s so a slow SMTP handshake doesn't look like a broken submit button.
    await expect(page.getByText("Message received.")).toBeVisible({ timeout: 20000 });

    await expect.poll(
      () => getFixerQuestionByEmail(email),
      { timeout: 40000, intervals: [2000, 3000, 5000, 5000, 5000] }
    ).not.toBeNull();
    const row = await getFixerQuestionByEmail(email);
    expect(row?.body).toBe("This is a QA e2e test question.");
  });

  test("server-side validation rejects a too-short question that slips past client checks", async ({ page }) => {
    const email = `qa-atf-short-${STAMP}@example.com`;

    // The textarea has no minlength, only `required` — a short body passes
    // client-side HTML5 validation and reaches the zod schema (min 10).
    const res = await page.request.post("/api/ask-the-fixer", {
      data: { name: "QA Fixer", email, body: "hi!" },
    });
    expect(res.status()).toBe(400);

    const row = await getFixerQuestionByEmail(email);
    expect(row).toBeNull();
  });

  test("honeypot field silently succeeds without storing a FixerQuestion", async ({ page }) => {
    const email = `qa-atf-honeypot-${STAMP}@example.com`;

    const res = await page.request.post("/api/ask-the-fixer", {
      data: { name: "Bot", email, body: "This should never be stored.", _hp: "filled-in-by-a-bot" },
    });
    expect(res.ok()).toBeTruthy();

    const row = await getFixerQuestionByEmail(email);
    expect(row).toBeNull();
  });
});

test.describe("Rate limiting (shared 5/hour-per-IP window)", () => {
  test.beforeAll(async () => {
    await resetRateLimit("contact");
  });

  test("6th contact submission within the window is rejected with 429", async ({ page }) => {
    test.setTimeout(30000);

    for (let i = 0; i < 5; i++) {
      const res = await page.request.post("/api/contact", {
        data: {
          name: "QA Rate Limit",
          email: `qa-contact-ratelimit-${STAMP}-${i}@example.com`,
          subject: "General question",
          message: "This is a QA e2e rate-limit probe message.",
        },
      });
      expect(res.ok()).toBeTruthy();
    }

    const sixth = await page.request.post("/api/contact", {
      data: {
        name: "QA Rate Limit",
        email: `qa-contact-ratelimit-${STAMP}-blocked@example.com`,
        subject: "General question",
        message: "This 6th request should be blocked.",
      },
    });
    expect(sixth.status()).toBe(429);

    const blockedRow = await getContactMessageByEmail(`qa-contact-ratelimit-${STAMP}-blocked@example.com`);
    expect(blockedRow).toBeNull();
  });

  test.afterAll(async () => {
    // Leave the shared IP's quota clean for any other spec/run that might
    // touch these endpoints, rather than leaving it maxed out for an hour.
    await resetRateLimit("contact");
  });
});
