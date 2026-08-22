import { test, expect } from "@playwright/test";
import { signInAsTestAdmin } from "./helpers/auth";

const STAMP = Date.now();
const TITLE = `QA e2e morning boost ${STAMP}`;
const EDITED_TITLE = `${TITLE} edited`;
const BODY = `QA e2e morning boost body content, stamp ${STAMP}.`;

// The single most-recently-published entry is the "featured" boost shown to
// everyone, including signed-out visitors — dating this test entry in 2021
// keeps it far behind any real content and out of that slot.
const PUBLISHED_AT = "2021-01-15T08:00";

const toSlug = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

test.describe.configure({ mode: "serial" });

test("admin creates, edits, and deletes a Morning Boost entry", async ({ page }) => {
  test.setTimeout(45000);

  await signInAsTestAdmin(page);
  await page.goto("/admin/morning-boost/new");

  await page.getByLabel("Title").fill(TITLE);
  await page.locator(".ProseMirror").fill(BODY);
  await page.locator('input[type="datetime-local"]').fill(PUBLISHED_AT);
  await page.getByRole("button", { name: "Create Entry" }).click();

  // Exclude "new" explicitly — under concurrent load this assertion can
  // resolve while the redirect off /admin/morning-boost/new is still in flight.
  await expect(page).toHaveURL(/\/admin\/morning-boost\/(?!new$)[a-z0-9-]+$/);

  try {
    await page.goto("/admin/morning-boost");
    const row = page.locator("tbody tr").filter({ hasText: TITLE });
    await expect(row).toBeVisible();
    await expect(row.getByText("Published", { exact: true })).toBeVisible();

    await row.getByRole("link", { name: "Edit" }).click();
    await expect(page.getByLabel("Title")).toHaveValue(TITLE);

    await page.getByLabel("Title").fill(EDITED_TITLE);
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();

    await page.reload();
    await expect(page.getByLabel("Title")).toHaveValue(EDITED_TITLE);

    await page.goto("/admin/morning-boost");
    await expect(page.locator("tbody tr").filter({ hasText: EDITED_TITLE })).toBeVisible();
  } finally {
    await page.goto("/admin/morning-boost");
    const row = page.locator("tbody tr").filter({ hasText: TITLE }).first();
    if (await row.isVisible().catch(() => false)) {
      await row.getByRole("link", { name: "Edit" }).click();
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page).toHaveURL(/\/admin\/morning-boost$/);
    }
  }

  await expect(page.locator("tbody tr").filter({ hasText: TITLE })).not.toBeVisible();
});

test("rich text formatting round-trips from the editor to the public page", async ({ page }) => {
  test.setTimeout(45000);

  const richTitle = `QA e2e rich text boost ${STAMP}`;
  const slug = toSlug(richTitle);

  await signInAsTestAdmin(page);
  await page.goto("/admin/morning-boost/new");

  await page.getByLabel("Title").fill(richTitle);

  const editor = page.locator(".ProseMirror");
  await editor.click();
  await page.keyboard.type("before ");
  await page.getByRole("button", { name: "Bold" }).click();
  await page.keyboard.type("bold");
  await page.getByRole("button", { name: "Bold" }).click();
  await page.keyboard.type(" after");

  await page.locator('input[type="datetime-local"]').fill(PUBLISHED_AT);

  try {
    await page.getByRole("button", { name: "Create Entry" }).click();
    await expect(page).toHaveURL(/\/admin\/morning-boost\/(?!new$)[a-z0-9-]+$/);

    await page.goto(`/morning-boost/${slug}`);
    await expect(page.locator("strong", { hasText: "bold" })).toBeVisible();
  } finally {
    await page.goto("/admin/morning-boost");
    const row = page.locator("tbody tr").filter({ hasText: richTitle }).first();
    if (await row.isVisible().catch(() => false)) {
      await row.getByRole("link", { name: "Edit" }).click();
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page).toHaveURL(/\/admin\/morning-boost$/);
    }
  }
});

test("a video URL saved on an entry renders with download deterrence on the public page", async ({ page }) => {
  test.setTimeout(45000);

  const videoTitle = `QA e2e video boost ${STAMP}`;
  const slug = toSlug(videoTitle);
  // Cloudinary's long-standing public demo asset — used here instead of a real
  // upload so this test exercises our own save/render path without depending
  // on fabricating a video file or hitting Cloudinary's upload API in CI.
  const VIDEO_URL = "https://res.cloudinary.com/demo/video/upload/dog.mp4";

  await signInAsTestAdmin(page);
  await page.goto("/admin/morning-boost/new");

  await page.getByLabel("Title").fill(videoTitle);
  await page.locator(".ProseMirror").fill(BODY);
  await page.getByPlaceholder("or paste a video URL…").fill(VIDEO_URL);
  await page.locator('input[type="datetime-local"]').fill(PUBLISHED_AT);

  try {
    await page.getByRole("button", { name: "Create Entry" }).click();
    await expect(page).toHaveURL(/\/admin\/morning-boost\/(?!new$)[a-z0-9-]+$/);

    await page.goto(`/morning-boost/${slug}`);
    const video = page.locator("video");
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute("src", VIDEO_URL);
    await expect(video).toHaveAttribute("controlslist", "nodownload");
  } finally {
    await page.goto("/admin/morning-boost");
    const row = page.locator("tbody tr").filter({ hasText: videoTitle }).first();
    if (await row.isVisible().catch(() => false)) {
      await row.getByRole("link", { name: "Edit" }).click();
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page).toHaveURL(/\/admin\/morning-boost$/);
    }
  }
});
