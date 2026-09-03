import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

// TEMPORARY, throwaway test — proves the multi-hop send-continuation path in
// sendCampaignNow actually engages and completes correctly. Only meaningful
// while TIME_BUDGET_MS in src/lib/send-campaign.ts is deliberately lowered
// for this one deploy; delete this file (and revert the budget) once it's
// confirmed passing.
const STAMP = Date.now();
const CONTACT_COUNT = 45;

test("chunked send: multi-hop continuation completes and accounts for every contact", async ({ page }) => {
  test.setTimeout(120000);
  await signInAsTestAdmin(page);

  const listName = `qa-chunked-send-${STAMP}`;
  const listRes = await page.request.post("/api/admin/lists", { data: { name: listName } });
  expect(listRes.ok()).toBeTruthy();
  const list = await listRes.json();

  const contacts = Array.from({ length: CONTACT_COUNT }, (_, i) => ({
    email: `qa-chunk-${STAMP}-${i}@example.com`,
    firstName: "QA",
    lastName: `Chunk${i}`,
    labels: [listName],
  }));
  const importRes = await page.request.post("/api/admin/contacts/import", {
    data: { contacts },
  });
  expect(importRes.ok()).toBeTruthy();
  const importBody = await importRes.json();
  expect(importBody.created).toBe(CONTACT_COUNT);

  const campaignRes = await page.request.post("/api/admin/campaigns", {
    data: {
      name: `QA chunked send test ${STAMP}`,
      subject: "QA chunked send test",
      htmlBody: "<p>QA chunked send test body.</p>",
      audienceRules: { logic: "OR", include: [{ type: "list", listId: list.id }], exclude: [] },
    },
  });
  expect(campaignRes.ok()).toBeTruthy();
  const campaignId = (await campaignRes.json()).id as string;

  const sendRes = await page.request.post(`/api/admin/campaigns/${campaignId}`, {
    data: { action: "send" },
  });
  expect(sendRes.ok()).toBeTruthy();
  const sendBody = await sendRes.json();
  console.log("First send response:", JSON.stringify(sendBody));

  // The whole point of this test: with the budget deliberately lowered,
  // a 45-contact send should NOT finish in one hop.
  expect(sendBody.message).toContain("continuing in the background");

  await expect.poll(async () => {
    const res = await page.request.get(`/api/admin/campaigns/${campaignId}`);
    const body = await res.json();
    return body.status;
  }, { timeout: 90000, intervals: [2000, 3000, 5000] }).toBe("SENT");

  const finalRes = await page.request.get(`/api/admin/campaigns/${campaignId}`);
  const final = await finalRes.json();
  const statCounts: Record<string, number> = {};
  for (const s of final.stats) statCounts[s.status] = s._count.status;
  const totalAccounted = Object.values(statCounts).reduce((a, b) => a + b, 0);
  console.log("Final stats:", JSON.stringify(statCounts));

  expect(totalAccounted).toBe(CONTACT_COUNT);
});
