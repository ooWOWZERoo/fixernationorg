import { test, expect } from "@playwright/test";
import { signInAsTestAdmin, signInAsTestMember } from "./helpers/auth";

const STAMP = Date.now();
const AWARD_POINTS = 7;
const NOTE = `QA e2e loyalty award ${STAMP}`;

test.describe.configure({ mode: "serial" });

test("admin awards points to a member -> reflected in admin table and member's history", async ({ page }) => {
  test.setTimeout(30000);

  await signInAsTestAdmin(page);
  await page.goto("/admin/loyalty");
  await page.getByPlaceholder("Search by name or email").fill(process.env.TEST_MEMBER_EMAIL!);
  await page.getByRole("button", { name: "Search" }).click();

  const row = page.locator("tbody tr").filter({ hasText: process.env.TEST_MEMBER_EMAIL! });
  await expect(row).toBeVisible();
  const beforeText = await row.locator("td").nth(2).innerText();
  const before = parseInt(beforeText.replace(/,/g, ""), 10);

  await row.getByRole("button", { name: "Award points" }).click();
  await page.getByPlaceholder("e.g. 25").fill(String(AWARD_POINTS));
  await page.getByPlaceholder("Reason for the award").fill(NOTE);
  await page.getByRole("button", { name: "Award", exact: true }).click();

  await expect(page.getByText(`${AWARD_POINTS} pts awarded.`)).toBeVisible();
  await expect(row.locator("td").nth(2)).toHaveText((before + AWARD_POINTS).toLocaleString());

  await signInAsTestMember(page);
  await page.goto("/account/points");
  const historyRow = page.locator("div.flex.items-center.justify-between").filter({ hasText: NOTE });
  await expect(historyRow).toBeVisible();
  await expect(historyRow.getByText("Admin award")).toBeVisible();
  await expect(historyRow.getByText(`+${AWARD_POINTS} pts`)).toBeVisible();
});
