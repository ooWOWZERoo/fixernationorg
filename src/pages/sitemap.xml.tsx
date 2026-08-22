import type { GetServerSideProps } from "next";
import { db } from "@/lib/db";

const BASE_URL = "https://fixernation.org";

// Public marketing/informational pages only — no auth-gated, password-gated
// (/design), or purely-functional pages (signin, register, dashboard, etc.).
const STATIC_PATHS = [
  "/",
  "/about",
  "/ambassadors",
  "/ask-the-fixer",
  "/become-a-provider",
  "/become-an-ambassador",
  "/blog",
  "/books",
  "/brand-ambassador",
  "/challenges",
  "/contact",
  "/cookie-policy",
  "/developers",
  "/events",
  "/issues",
  "/join",
  "/morning-boost",
  "/pathways",
  "/privacy",
  "/providers",
  "/resources",
  "/service-provider",
  "/terms",
];

type UrlEntry = { loc: string; lastmod?: Date };

function toXml(urls: UrlEntry[]): string {
  const items = urls
    .map((u) => {
      const lastmod = u.lastmod ? `\n    <lastmod>${u.lastmod.toISOString()}</lastmod>` : "";
      return `  <url>\n    <loc>${u.loc}</loc>${lastmod}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>`;
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const now = new Date();

  const [blogPosts, boosts, books, events, challenges, pathways, issues] = await Promise.all([
    db.blogPost.findMany({ where: { publishedAt: { not: null } }, select: { slug: true, updatedAt: true } }),
    db.morningBoost.findMany({ where: { publishedAt: { not: null } }, select: { slug: true, updatedAt: true } }),
    db.product.findMany({ where: { type: "BOOK" }, select: { slug: true, updatedAt: true } }),
    db.event.findMany({ where: { publishedAt: { not: null, lte: now } }, select: { slug: true, updatedAt: true } }),
    db.challenge.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }),
    db.growthPathway.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }),
    db.issueTopic.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } }),
  ]);

  const urls: UrlEntry[] = [
    ...STATIC_PATHS.map((path) => ({ loc: `${BASE_URL}${path}` })),
    ...blogPosts.map((p) => ({ loc: `${BASE_URL}/blog/${p.slug}`, lastmod: p.updatedAt })),
    ...boosts.map((p) => ({ loc: `${BASE_URL}/morning-boost/${p.slug}`, lastmod: p.updatedAt })),
    ...books.map((p) => ({ loc: `${BASE_URL}/books/${p.slug}`, lastmod: p.updatedAt })),
    ...events.map((p) => ({ loc: `${BASE_URL}/events/${p.slug}`, lastmod: p.updatedAt })),
    ...challenges.map((p) => ({ loc: `${BASE_URL}/challenges/${p.slug}`, lastmod: p.updatedAt })),
    ...pathways.map((p) => ({ loc: `${BASE_URL}/pathways/${p.slug}`, lastmod: p.updatedAt })),
    ...issues.map((p) => ({ loc: `${BASE_URL}/issues/${p.slug}`, lastmod: p.updatedAt })),
  ];

  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  res.write(toXml(urls));
  res.end();

  return { props: {} };
};

export default function Sitemap() {
  return null;
}
