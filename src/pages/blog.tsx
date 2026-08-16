import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMember } from "@/lib/access";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface PostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  imageUrl: string | null;
  authorName: string;
  publishedAt: string;
}

interface Props {
  featured: PostSummary | null;
  posts: PostSummary[];
  categories: string[];
  userIsMember: boolean;
}

const BlogPage: NextPageWithLayout<Props> = ({ featured, posts, categories, userIsMember }) => {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const visible = activeCategory === "all"
    ? posts
    : posts.filter((p) => p.category === activeCategory);

  const hasPosts = featured !== null || posts.length > 0;

  return (
    <>
      <Head>
        <title>Blog — Fixer Nation</title>
        <meta
          name="description"
          content="Positivity, health, and wellness content from Fixer Nation. Real talk, mindset tools, and Morning Boost inspiration."
        />
      </Head>

      {/* Header */}
      <section className="px-6 pb-4 pt-16 text-center lg:px-8">
        <div className="mx-auto max-w-2xl">
          <span className="eyebrow">Blog</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-navy lg:text-5xl">
            Positivity, Health &amp; Wellness
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Real talk, mindset tools, and Morning Boost inspiration — written for people working through something.
          </p>
        </div>
      </section>

      <section className="px-6 pb-20 pt-10 lg:px-8">
        <div className="mx-auto max-w-6xl">

          {!hasPosts && (
            <div className="rounded-2xl bg-white p-14 text-center shadow-[0_16px_34px_-22px_rgba(20,40,56,0.25)]">
              <p className="text-lg font-bold text-navy">Posts coming soon.</p>
              <p className="mt-2 text-sm text-ink-soft">
                The first articles are on their way. Check back shortly.
              </p>
            </div>
          )}

          {/* Featured post */}
          {featured && (
            <div className="mb-12 grid overflow-hidden rounded-2xl bg-white shadow-[0_20px_45px_-20px_rgba(20,40,56,0.3)] lg:grid-cols-2">
              <div className="min-h-[260px] overflow-hidden">
                {featured.imageUrl ? (
                  <Image
                    src={featured.imageUrl}
                    alt={featured.title}
                    width={640}
                    height={420}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full min-h-[260px] bg-cream-panel" />
                )}
              </div>
              <div className="flex flex-col justify-center p-8 lg:p-10">
                {featured.category && (
                  <span className="eyebrow self-start">{featured.category}</span>
                )}
                <h2 className="mt-4 text-2xl font-extrabold leading-snug text-navy">
                  {featured.title}
                </h2>
                {featured.excerpt && (
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">{featured.excerpt}</p>
                )}
                {userIsMember ? (
                  <Link
                    href={`/blog/${featured.slug}`}
                    className="mt-6 inline-flex self-start items-center rounded-[10px] bg-amber px-6 py-3 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
                  >
                    Read the Post
                  </Link>
                ) : (
                  <Link
                    href={`/join?callbackUrl=${encodeURIComponent(`/blog/${featured.slug}`)}`}
                    className="mt-6 inline-flex self-start items-center gap-2 rounded-[10px] border-2 border-navy/30 bg-navy/5 px-6 py-3 text-sm font-bold text-navy/60 no-underline"
                  >
                    <span>🔒</span> Members only
                  </Link>
                )}
                <p className="mt-6 text-xs font-bold text-ink-soft">{featured.authorName}</p>
              </div>
            </div>
          )}

          {/* Category filter chips */}
          {categories.length > 0 && (
            <div className="mb-9 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setActiveCategory("all")}
                className={[
                  "rounded-full px-5 py-2.5 text-sm font-bold transition-colors",
                  activeCategory === "all"
                    ? "bg-navy text-white"
                    : "bg-white text-ink-soft shadow-[0_6px_16px_-10px_rgba(20,40,56,0.25)] hover:text-navy",
                ].join(" ")}
              >
                All Posts
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={[
                    "rounded-full px-5 py-2.5 text-sm font-bold transition-colors",
                    activeCategory === cat
                      ? "bg-navy text-white"
                      : "bg-white text-ink-soft shadow-[0_6px_16px_-10px_rgba(20,40,56,0.25)] hover:text-navy",
                  ].join(" ")}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Grid */}
          {visible.length > 0 && (
            <div className="relative">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((post) => {
                  const locked = !userIsMember;
                  return (
                    <div
                      key={post.id}
                      className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_16px_34px_-22px_rgba(20,40,56,0.25)] transition-transform hover:-translate-y-1.5"
                    >
                      <div className="aspect-video overflow-hidden bg-cream-panel">
                        {post.imageUrl && (
                          <Image
                            src={post.imageUrl}
                            alt={post.title}
                            width={480}
                            height={270}
                            className={`h-full w-full object-cover${locked ? " blur-sm" : ""}`}
                          />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-5">
                        {post.category && (
                          <span className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-amber-dark">
                            {post.category}
                          </span>
                        )}
                        <h3 className="mb-2 text-[17px] font-extrabold leading-snug text-navy">
                          {post.title}
                        </h3>
                        {post.excerpt && (
                          <p className="flex-1 text-sm leading-relaxed text-ink-soft">{post.excerpt}</p>
                        )}
                        {locked ? (
                          <Link
                            href={`/join?callbackUrl=${encodeURIComponent(`/blog/${post.slug}`)}`}
                            className="mt-5 inline-flex items-center gap-1.5 rounded-[8px] border-2 border-navy/30 bg-navy/5 px-4 py-2 text-xs font-bold text-navy/60 no-underline"
                          >
                            <span>🔒</span> Members only
                          </Link>
                        ) : (
                          <Link
                            href={`/blog/${post.slug}`}
                            className="mt-5 inline-flex items-center rounded-[8px] border-2 border-navy px-4 py-2 text-xs font-bold text-navy no-underline transition-all hover:bg-navy hover:text-white"
                          >
                            Read More
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Gate overlay for non-members */}
              {!userIsMember && visible.length > 0 && (
                <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-cream via-cream/90 to-transparent" />
              )}
            </div>
          )}

          {/* Member gate CTA */}
          {!userIsMember && posts.length > 0 && (
            <div className="mt-6 rounded-2xl border border-navy/10 bg-white p-8 text-center shadow-[0_16px_34px_-22px_rgba(20,40,56,0.25)]">
              <p className="text-sm font-bold uppercase tracking-wide text-ink-soft">Members only</p>
              <h3 className="mt-2 text-xl font-extrabold text-navy">
                Full access to every article
              </h3>
              <p className="mt-2 text-sm text-ink-soft">
                Join Fixer Nation to read the complete blog archive, Morning Boost, and more.
              </p>
              <Link
                href="/join"
                className="mt-5 inline-flex items-center justify-center rounded-[10px] bg-amber px-7 py-3 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
              >
                Join Fixer Nation
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-navy px-6 py-20 text-center lg:px-8">
        <div className="mx-auto max-w-xl">
          <span
            className="eyebrow"
            style={{ background: "rgba(255,255,255,0.12)", color: "#F2D9AE" }}
          >
            Full Access
          </span>
          <h2 className="mt-4 text-3xl font-extrabold text-white">
            Get full access to the Positivity, Health &amp; Wellness Library
          </h2>
          <Link
            href="/join"
            className="mt-7 inline-flex items-center justify-center rounded-[10px] bg-amber px-8 py-3.5 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
          >
            Join Fixer Nation
          </Link>
        </div>
      </section>
    </>
  );
};

BlogPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  const userIsMember = session ? isMember(session.user.role) : false;

  const allPosts = await db.blogPost.findMany({
    where: { publishedAt: { not: null } },
    select: { id: true, slug: true, title: true, excerpt: true, category: true, imageUrl: true, authorName: true, publishedAt: true },
    orderBy: { publishedAt: "desc" },
  });

  const serialized: PostSummary[] = JSON.parse(JSON.stringify(allPosts));

  const featured = serialized[0] ?? null;
  const posts = serialized.slice(1);

  const categories = Array.from(
    new Set(serialized.map((p) => p.category).filter(Boolean) as string[])
  );

  return { props: { featured, posts, categories, userIsMember } };
};

export default BlogPage;
