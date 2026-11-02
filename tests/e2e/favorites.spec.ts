import { test, expect, type Page, type Locator } from "@playwright/test";
import { signInAsTestMember } from "./helpers/auth";
import {
  clearFavoritesForUser,
  closeTestDb,
  countFavorites,
  createBlogPostFixture,
  createConsumerUser,
  createMorningBoostFixture,
  deleteBlogPostFixture,
  deleteMorningBoostFixture,
  deleteTestUser,
  getUserId,
} from "./helpers/db";

const STAMP = Date.now();
const OLD = new Date("2021-01-15T12:00:00Z");
const OLDER = new Date("2021-01-10T12:00:00Z");

// The newest published item is the "featured" slot, so each fixture set seeds
// one entry dated now (featured) plus older ones that land in the grid/archive.
const BLOG = {
  featured: { title: `QA e2e fav blog featured ${STAMP}`, slug: `qa-e2e-fav-blog-featured-${STAMP}`, at: new Date() },
  older: { title: `QA e2e fav blog older ${STAMP}`, slug: `qa-e2e-fav-blog-older-${STAMP}`, at: OLD },
  unstarred: { title: `QA e2e fav blog unstarred ${STAMP}`, slug: `qa-e2e-fav-blog-unstarred-${STAMP}`, at: OLDER },
};
const BOOST = {
  featured: { title: `QA e2e fav boost featured ${STAMP}`, slug: `qa-e2e-fav-boost-featured-${STAMP}`, at: new Date() },
  older: { title: `QA e2e fav boost older ${STAMP}`, slug: `qa-e2e-fav-boost-older-${STAMP}`, at: OLD },
  unstarred: { title: `QA e2e fav boost unstarred ${STAMP}`, slug: `qa-e2e-fav-boost-unstarred-${STAMP}`, at: OLDER },
};

const CONSUMER_EMAIL = `qa-fav-consumer-${STAMP}@fixernation-e2e.test`;
const CONSUMER_PASSWORD = `Qa-${STAMP}-${Math.random().toString(36).slice(2)}Aa1!`;

const ids: Record<string, string> = {};
let memberId = "";
let consumerCreated = false;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ids.blogFeatured = await createBlogPostFixture(BLOG.featured.title, BLOG.featured.slug, BLOG.featured.at);
  ids.blogOlder = await createBlogPostFixture(BLOG.older.title, BLOG.older.slug, BLOG.older.at);
  ids.blogUnstarred = await createBlogPostFixture(BLOG.unstarred.title, BLOG.unstarred.slug, BLOG.unstarred.at);
  ids.boostFeatured = await createMorningBoostFixture(BOOST.featured.title, BOOST.featured.slug, BOOST.featured.at);
  ids.boostOlder = await createMorningBoostFixture(BOOST.older.title, BOOST.older.slug, BOOST.older.at);
  ids.boostUnstarred = await createMorningBoostFixture(BOOST.unstarred.title, BOOST.unstarred.slug, BOOST.unstarred.at);

  const email = process.env.TEST_MEMBER_EMAIL;
  if (!email) throw new Error("TEST_MEMBER_EMAIL not set — see .env.test");
  const id = await getUserId(email);
  if (!id) throw new Error("Test member not found");
  memberId = id;
  await clearFavoritesForUser(memberId);
});

test.afterAll(async () => {
  try {
    if (memberId) await clearFavoritesForUser(memberId);
    for (const id of [ids.blogFeatured, ids.blogOlder, ids.blogUnstarred]) if (id) await deleteBlogPostFixture(id);
    for (const id of [ids.boostFeatured, ids.boostOlder, ids.boostUnstarred]) if (id) await deleteMorningBoostFixture(id);
    if (consumerCreated) await deleteTestUser(CONSUMER_EMAIL);
  } finally {
    await closeTestDb();
  }
});

// The smallest element holding both the item's title and a star button.
function starFor(page: Page, title: string, name: "Save to favorites" | "Remove from favorites"): Locator {
  return page
    .locator("div, article")
    .filter({ has: page.getByText(title, { exact: true }) })
    .filter({ has: page.getByRole("button", { name }) })
    .last()
    .getByRole("button", { name });
}

async function openList(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
}

async function clickAndWaitForSave(page: Page, button: Locator) {
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/account/favorites") && r.request().method() === "POST"),
    button.click(),
  ]);
  expect(res.ok()).toBe(true);
}

async function star(page: Page, title: string) {
  await clickAndWaitForSave(page, starFor(page, title, "Save to favorites"));
  await expect(starFor(page, title, "Remove from favorites")).toHaveAttribute("aria-pressed", "true");
}

test("signed-out visitors see no star or toggle and the API returns 401", async ({ page, request }) => {
  await openList(page, "/blog");
  await expect(page.getByRole("button", { name: "Save to favorites" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Favorites", exact: true })).toHaveCount(0);

  await openList(page, "/morning-boost");
  await expect(page.getByRole("button", { name: "Save to favorites" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Favorites", exact: true })).toHaveCount(0);

  const res = await request.post("/api/account/favorites", {
    data: { type: "blog", itemId: ids.blogOlder, favorited: true },
  });
  expect(res.status()).toBe(401);
});

test("non-members see no star or toggle and the API returns 403", async ({ page }) => {
  await createConsumerUser(CONSUMER_EMAIL, CONSUMER_PASSWORD);
  consumerCreated = true;

  await page.goto("/signin");
  await page.getByLabel("Email address").fill(CONSUMER_EMAIL);
  await page.getByLabel("Password").fill(CONSUMER_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/signin/, { timeout: 15000 });

  await openList(page, "/blog");
  await expect(page.getByRole("button", { name: "Save to favorites" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Favorites", exact: true })).toHaveCount(0);

  await openList(page, "/morning-boost");
  await expect(page.getByRole("button", { name: "Save to favorites" })).toHaveCount(0);

  const res = await page.request.post("/api/account/favorites", {
    data: { type: "boost", itemId: ids.boostOlder, favorited: true },
  });
  expect(res.status()).toBe(403);
  expect(await countFavorites(memberId, "boost", ids.boostOlder)).toBe(0);
});

test("member stars and unstars a blog post, and the star survives a reload", async ({ page }) => {
  await signInAsTestMember(page);
  await openList(page, "/blog");

  await star(page, BLOG.older.title);

  await page.reload({ waitUntil: "networkidle" });
  await expect(starFor(page, BLOG.older.title, "Remove from favorites")).toHaveAttribute("aria-pressed", "true");

  await clickAndWaitForSave(page, starFor(page, BLOG.older.title, "Remove from favorites"));
  await expect(starFor(page, BLOG.older.title, "Save to favorites")).toHaveAttribute("aria-pressed", "false");

  await page.reload({ waitUntil: "networkidle" });
  await expect(starFor(page, BLOG.older.title, "Save to favorites")).toBeVisible();
});

test("member stars and unstars a Morning Boost entry, and the star survives a reload", async ({ page }) => {
  await signInAsTestMember(page);
  await openList(page, "/morning-boost");

  await star(page, BOOST.older.title);

  await page.reload({ waitUntil: "networkidle" });
  await expect(starFor(page, BOOST.older.title, "Remove from favorites")).toHaveAttribute("aria-pressed", "true");

  await clickAndWaitForSave(page, starFor(page, BOOST.older.title, "Remove from favorites"));
  await expect(starFor(page, BOOST.older.title, "Save to favorites")).toHaveAttribute("aria-pressed", "false");
});

test("blog Favorites view lists only starred posts, newest-starred first, including the featured post", async ({ page }) => {
  await signInAsTestMember(page);
  await openList(page, "/blog");

  // Star the older post first, then the featured one: featured must lead.
  await star(page, BLOG.older.title);
  await star(page, BLOG.featured.title);

  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(page).toHaveURL(/view=favorites/);
  await expect(page.getByRole("button", { name: "Favorites", exact: true })).toHaveAttribute("aria-pressed", "true");

  const titles = page.getByRole("heading", { level: 3, name: /QA e2e fav blog/ });
  await expect(titles).toHaveText([BLOG.featured.title, BLOG.older.title]);
  await expect(page.getByText(BLOG.unstarred.title, { exact: true })).toHaveCount(0);

  // Deep link keeps the view, and a reload keeps the stars.
  await page.goto("/blog?view=favorites", { waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Favorites", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(titles).toHaveText([BLOG.featured.title, BLOG.older.title]);

  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page).not.toHaveURL(/view=favorites/);
  await expect(page.getByText(BLOG.unstarred.title, { exact: true })).toBeVisible();
});

test("Morning Boost Favorites view lists only starred entries, newest-starred first, including today's boost", async ({ page }) => {
  await signInAsTestMember(page);
  await openList(page, "/morning-boost");

  await star(page, BOOST.older.title);
  await star(page, BOOST.featured.title);

  await page.getByRole("button", { name: "Favorites", exact: true }).click();
  await expect(page).toHaveURL(/view=favorites/);

  const rows = page.locator("a[href^='/morning-boost/qa-e2e-fav-boost-']");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText(BOOST.featured.title);
  await expect(rows.nth(1)).toContainText(BOOST.older.title);
  await expect(page.getByText(BOOST.unstarred.title, { exact: true })).toHaveCount(0);

  await page.goto("/morning-boost?view=favorites", { waitUntil: "networkidle" });
  await expect(rows.nth(0)).toContainText(BOOST.featured.title);
});

test("detail pages show Save / Saved", async ({ page }) => {
  await signInAsTestMember(page);
  await clearFavoritesForUser(memberId);

  await page.goto(`/blog/${BLOG.older.slug}`, { waitUntil: "networkidle" });
  await clickAndWaitForSave(page, page.getByRole("button", { name: "Save", exact: true }));
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible();

  await page.goto(`/morning-boost/${BOOST.older.slug}`, { waitUntil: "networkidle" });
  await clickAndWaitForSave(page, page.getByRole("button", { name: "Save", exact: true }));
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
});

test("empty Favorites views show the empty state", async ({ page }) => {
  await signInAsTestMember(page);
  await clearFavoritesForUser(memberId);

  await page.goto("/blog?view=favorites", { waitUntil: "networkidle" });
  await expect(page.getByText("No favorites yet.")).toBeVisible();
  await expect(page.getByText("Tap the star on any post you want to come back to.")).toBeVisible();

  await page.goto("/morning-boost?view=favorites", { waitUntil: "networkidle" });
  await expect(page.getByText("No favorites yet.")).toBeVisible();
  await expect(page.getByText("Tap the star on any boost you want to watch again.")).toBeVisible();
});

test("adding the same favorite twice is a no-op", async ({ page }) => {
  await signInAsTestMember(page);
  await clearFavoritesForUser(memberId);

  const body = { type: "blog", itemId: ids.blogOlder, favorited: true };
  const first = await page.request.post("/api/account/favorites", { data: body });
  const second = await page.request.post("/api/account/favorites", { data: body });
  expect(first.ok()).toBe(true);
  expect(second.ok()).toBe(true);
  expect(await countFavorites(memberId, "blog", ids.blogOlder)).toBe(1);

  const list = await page.request.get("/api/account/favorites?type=blog");
  expect((await list.json()).ids).toEqual([ids.blogOlder]);

  const missing = await page.request.post("/api/account/favorites", {
    data: { type: "blog", itemId: "does-not-exist", favorited: true },
  });
  expect(missing.status()).toBe(404);
});
