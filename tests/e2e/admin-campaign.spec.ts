import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";
import { forceCampaignStuckSending, forceCampaignOverdueScheduled } from "./helpers/db";

const STAMP = Date.now();
const CONTACT_EMAIL = `qa-campaign-contact-${STAMP}@example.com`;
const TAG = `qa-campaign-${STAMP}`;
const CAMPAIGN_NAME = `QA e2e admin campaign ${STAMP}`;
const SUBJECT = "QA e2e admin campaign subject";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ page }) => {
  await signInAsTestAdmin(page);
});

test("subject line has an option to insert a Morning Boost title", async ({ page }) => {
  await page.goto("/admin/campaigns/new");
  await page.getByPlaceholder("August newsletter").fill(`QA e2e MB subject test ${STAMP}`);
  await page.getByRole("button", { name: /^Next:/ }).click();

  const picker = page.locator("select").filter({ has: page.locator("option", { hasText: "Insert Morning Boost title" }) });
  await expect(picker).toBeVisible();

  const firstTitle = await picker.locator("option").nth(1).textContent();
  await picker.selectOption({ index: 1 });

  await expect(page.getByPlaceholder("Your monthly update from Fixer Nation")).toHaveValue(firstTitle ?? "");

  // Picking a second time appends rather than replacing.
  const secondTitle = await picker.locator("option").nth(2).textContent();
  await picker.selectOption({ index: 2 });
  await expect(page.getByPlaceholder("Your monthly update from Fixer Nation"))
    .toHaveValue(`${firstTitle} ${secondTitle}`);
});

test("preview-audience API correctly unions two separate list rules", async ({ page }) => {
  // Regression check for the wizard's "Preview audience size" button, which
  // read a `count` field the API has never returned (real field is
  // totalIncluded) — always silently showed 0. Tests the underlying
  // resolution directly since driving the AudienceBuilder's own multi-select
  // UI to add two rules of the same type is fragile; this exercises exactly
  // what the fixed wizard code now calls.
  test.setTimeout(30000);

  async function createContact(email: string, lastName: string) {
    await page.goto("/admin/contacts/new");
    await page.locator('input[type="email"]').first().fill(email);
    await page.locator('input[type="text"]').nth(0).fill("QA");
    await page.locator('input[type="text"]').nth(1).fill(lastName);
    await page.getByRole("button", { name: "Create contact" }).click();
    await expect(page).toHaveURL(/\/admin\/contacts\/(?!new$)[a-z0-9]+$/);
    return page.url().split("/").pop() as string;
  }
  const contactA = await createContact(`qa-preview-a-${STAMP}@example.com`, `PreviewA${STAMP}`);
  const contactB = await createContact(`qa-preview-b-${STAMP}@example.com`, `PreviewB${STAMP}`);

  async function createListWithMember(name: string, contactId: string) {
    const res = await page.request.post("/api/admin/lists", { data: { name } });
    expect(res.ok()).toBeTruthy();
    const list = await res.json();
    const patchRes = await page.request.patch(`/api/admin/lists/${list.id}`, {
      data: { action: "add-contacts", contactIds: [contactId] },
    });
    expect(patchRes.ok()).toBeTruthy();
    return list.id as string;
  }
  const listAId = await createListWithMember(`QA Preview List A ${STAMP}`, contactA);
  const listBId = await createListWithMember(`QA Preview List B ${STAMP}`, contactB);

  const res = await page.request.post("/api/admin/campaigns/preview-audience", {
    data: {
      rules: {
        logic: "OR",
        include: [
          { type: "list", listId: listAId },
          { type: "list", listId: listBId },
        ],
        exclude: [],
      },
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.totalIncluded).toBe(2);
});

test("wizard's Preview audience size button shows the real count, not 0", async ({ page }) => {
  test.setTimeout(30000);

  async function createContact(email: string, lastName: string) {
    await page.goto("/admin/contacts/new");
    await page.locator('input[type="email"]').first().fill(email);
    await page.locator('input[type="text"]').nth(0).fill("QA");
    await page.locator('input[type="text"]').nth(1).fill(lastName);
    await page.getByRole("button", { name: "Create contact" }).click();
    await expect(page).toHaveURL(/\/admin\/contacts\/(?!new$)[a-z0-9]+$/);
    return page.url().split("/").pop() as string;
  }
  await createContact(`qa-preview-single-${STAMP}@example.com`, `PreviewSingle${STAMP}`);
  const TAG = `qa-preview-single-${STAMP}`;
  await page.getByPlaceholder("Add tag…").fill(TAG);
  await page.getByRole("button", { name: "Add tag" }).click();
  await expect(page.getByText(TAG).first()).toBeVisible();

  await page.goto("/admin/campaigns/new");
  await page.getByPlaceholder("August newsletter").fill(`QA wizard preview fix ${STAMP}`);
  await page.getByRole("button", { name: /^Next:/ }).click();
  await page.getByPlaceholder("Your monthly update from Fixer Nation").fill("QA subject");
  await page.getByRole("button", { name: "HTML", exact: true }).first().click();
  await page.getByPlaceholder("Paste your HTML email body here…").fill("<p>x</p>");
  await page.getByRole("button", { name: /^Next:/ }).click();
  await page.getByRole("button", { name: /^Next:/ }).click();
  await page.getByRole("button", { name: /^Next:/ }).click();

  await expect(page.getByRole("heading", { name: "Audience" })).toBeVisible();
  await page.getByRole("button", { name: "+ Add include rule" }).click();
  await page.locator("select").first().selectOption("tag");
  await page.getByPlaceholder("e.g. member-onboarded").fill(TAG);
  await page.getByRole("button", { name: "Add", exact: true }).click();

  await page.getByRole("button", { name: "Preview audience size" }).click();
  await expect(page.getByText("Estimated audience: 1 contact")).toBeVisible({ timeout: 10000 });
});

test("create contact + tag -> build campaign -> send -> verify", async ({ page }) => {
  test.setTimeout(60000);

  // Create a single test contact and tag it, so the campaign audience can be
  // scoped to exactly this one contact rather than any real member list.
  await page.goto("/admin/contacts/new");
  await page.locator('input[type="email"]').first().fill(CONTACT_EMAIL);
  await page.locator('input[type="text"]').nth(0).fill("QA");
  await page.locator('input[type="text"]').nth(1).fill("Campaign");
  await page.getByRole("button", { name: "Create contact" }).click();

  await expect(page).toHaveURL(/\/admin\/contacts\/[a-z0-9]+$/);
  await page.getByPlaceholder("Add tag…").fill(TAG);
  await page.getByRole("button", { name: "Add tag" }).click();
  await expect(page.getByText(TAG).first()).toBeVisible();

  // Build the campaign through the wizard.
  await page.goto("/admin/campaigns/new");

  // Step 0: Details
  await page.getByPlaceholder("August newsletter").fill(CAMPAIGN_NAME);
  await page.getByRole("button", { name: /^Next:/ }).click();

  // Step 1: Content — switch to raw HTML so we don't depend on the block composer
  await page.getByPlaceholder("Your monthly update from Fixer Nation").fill(SUBJECT);
  await page.getByRole("button", { name: "HTML", exact: true }).first().click();
  await page.getByPlaceholder("Paste your HTML email body here…").fill("<p>QA e2e test email body.</p>");
  await page.getByRole("button", { name: /^Next:/ }).click();

  // Step 2: UTM & Tracking — defaults are fine
  await page.getByRole("button", { name: /^Next:/ }).click();

  // Step 3: Test Send — skip
  await page.getByRole("button", { name: /^Next:/ }).click();

  // Step 4: Audience — scope to contacts tagged with our unique tag
  await expect(page.getByRole("heading", { name: "Audience" })).toBeVisible();
  await page.getByRole("button", { name: "+ Add include rule" }).click();
  await page.getByRole("combobox").first().selectOption("tag");
  await page.getByPlaceholder("e.g. member-onboarded").fill(TAG);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(TAG)).toBeVisible();

  // Use the AudienceBuilder's own "Preview audience" button. The wizard
  // page also renders a second, redundant "Preview audience size" button
  // just below it that reads a `data.count` field the preview API never
  // returns (the API returns `totalIncluded`) — that button always shows
  // "Estimated audience: 0 contacts" regardless of the real audience size.
  await page.getByRole("button", { name: "Preview audience", exact: true }).click();
  await expect(page.getByText("1 contact will receive this email")).toBeVisible();

  await page.getByRole("button", { name: /^Next:/ }).click();

  // Step 5: Schedule — leave blank (save as draft)
  await page.getByRole("button", { name: /^Next:/ }).click();

  // Step 6: Review & Launch
  await expect(page.getByText(CAMPAIGN_NAME)).toBeVisible();
  await page.getByRole("button", { name: "Save as draft" }).click();

  await expect(page).toHaveURL(/\/admin\/campaigns\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: CAMPAIGN_NAME })).toBeVisible();
  await expect(page.getByText("draft", { exact: true })).toBeVisible();

  // Send now — the admin send path always finalizes the campaign as SENT
  // server-side (unlike the provider campaign flow), even if the test
  // contact's @example.com address can't actually accept mail.
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Send now" }).click();
  await expect(page.getByText(/^Sent to \d+ contact/)).toBeVisible({ timeout: 30000 });

  await page.reload();
  await expect(page.getByText("sent", { exact: true })).toBeVisible();

  await page.goto("/admin/campaigns");
  const row = page.locator("tbody tr").filter({ hasText: CAMPAIGN_NAME });
  await expect(row).toBeVisible();
  await expect(row.getByText("sent", { exact: true })).toBeVisible();

  // Clean up the campaign (contacts have no delete UI, so the tagged test
  // contact is left behind like other timestamp-unique QA contacts).
  await row.getByText(CAMPAIGN_NAME).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/admin\/campaigns$/);
});

test("campaigns list surfaces stuck-sending and overdue-scheduled campaigns under Needs attention", async ({ page }) => {
  test.setTimeout(30000);

  async function createDraftCampaign(name: string) {
    const res = await page.request.post("/api/admin/campaigns", {
      data: { name, subject: "QA e2e overview subject", htmlBody: "<p>QA e2e overview body.</p>" },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    return body.id as string;
  }

  const stuckName = `QA e2e stuck-sending ${STAMP}`;
  const overdueName = `QA e2e overdue-scheduled ${STAMP}`;
  const stuckId = await createDraftCampaign(stuckName);
  const overdueId = await createDraftCampaign(overdueName);

  // Force the two "needs attention" conditions directly rather than
  // waiting out a real 30-minute serverless timeout or a real cron cycle —
  // this test verifies the list page's detection/display, not the
  // underlying send pipeline.
  await forceCampaignStuckSending(stuckId);
  await forceCampaignOverdueScheduled(overdueId);

  await page.goto("/admin/campaigns");

  const stuckRow = page.locator("tbody tr").filter({ hasText: stuckName });
  await expect(stuckRow).toBeVisible();
  await expect(stuckRow.getByText("Stuck sending — over 30 min")).toBeVisible();

  const overdueRow = page.locator("tbody tr").filter({ hasText: overdueName });
  await expect(overdueRow).toBeVisible();
  await expect(overdueRow.getByText("Overdue — scheduled send hasn't started")).toBeVisible();

  // Both rows should be inside the same "Needs attention" group, not
  // scattered across the Sending/Scheduled sections.
  const attentionHeading = page.getByRole("heading", { name: /^Needs attention/ });
  await expect(attentionHeading).toBeVisible();
});
