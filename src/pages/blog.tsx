import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

type Category = "all" | "weekend-energy" | "books-blog" | "mindset";

const FEATURED = {
  eyebrow: "Weekend Energy",
  title: "Turning Your Issue Into an Answer, One Morning Boost at a Time",
  excerpt:
    "How a five-minute daily habit can reset your mindset and carry you through the week's hardest moments.",
  author: "Anthony J. Placito",
  img: "https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=900&q=80",
  href: "#",
};

const POSTS = [
  {
    category: "Mindset",
    key: "mindset" as Category,
    title: "Silencing the Inner Critic",
    excerpt: "Practical steps for redirecting self-doubt into forward motion.",
    img: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&q=80",
    href: "#",
  },
  {
    category: "Books Blog",
    key: "books-blog" as Category,
    title: "Behind the Pages of Kill the Bully",
    excerpt: "What inspired the book, and how readers are using it to stand their ground.",
    img: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=600&q=80",
    href: "#",
  },
  {
    category: "Weekend Energy",
    key: "weekend-energy" as Category,
    title: "Resetting Before Monday",
    excerpt: "A short ritual to close out the week and walk into the next one with clarity.",
    img: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=600&q=80",
    href: "#",
  },
];

const FILTERS: { label: string; value: Category }[] = [
  { label: "All Posts", value: "all" },
  { label: "Weekend Energy", value: "weekend-energy" },
  { label: "Books Blog", value: "books-blog" },
  { label: "Mindset", value: "mindset" },
];

const BlogPage: NextPageWithLayout = () => {
  const [active, setActive] = useState<Category>("all");
  const visible = active === "all" ? POSTS : POSTS.filter((p) => p.key === active);

  return (
    <>
      <Head>
        <title>FN Blog — Fixer Nation</title>
        <meta
          name="description"
          content="Positivity, health, and wellness content from Fixer Nation. Real talk, mindset tools, and Morning Boost inspiration."
        />
      </Head>

      {/* Header */}
      <section className="px-6 pb-4 pt-16 text-center lg:px-8">
        <div className="mx-auto max-w-2xl">
          <span className="eyebrow">FN Blog</span>
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

          {/* Featured post */}
          <div className="mb-12 grid overflow-hidden rounded-2xl bg-white shadow-[0_20px_45px_-20px_rgba(20,40,56,0.3)] lg:grid-cols-2">
            <div className="min-h-[260px] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={FEATURED.img}
                alt={FEATURED.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-col justify-center p-8 lg:p-10">
              <span className="eyebrow self-start">{FEATURED.eyebrow}</span>
              <h2 className="mt-4 text-2xl font-extrabold leading-snug text-navy">
                {FEATURED.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{FEATURED.excerpt}</p>
              <Link
                href={FEATURED.href}
                className="mt-6 inline-flex self-start items-center rounded-[10px] bg-amber px-6 py-3 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
              >
                Read the Post
              </Link>
              <p className="mt-6 text-xs font-bold text-ink-soft">{FEATURED.author}</p>
            </div>
          </div>

          {/* Filter chips */}
          <div className="mb-9 flex flex-wrap justify-center gap-3">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setActive(f.value)}
                className={[
                  "rounded-full px-5 py-2.5 text-sm font-bold transition-colors",
                  active === f.value
                    ? "bg-navy text-white"
                    : "bg-white text-ink-soft shadow-[0_6px_16px_-10px_rgba(20,40,56,0.25)] hover:text-navy",
                ].join(" ")}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((post) => (
              <div
                key={post.title}
                className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_16px_34px_-22px_rgba(20,40,56,0.25)] transition-transform hover:-translate-y-1.5"
              >
                <div className="aspect-video overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.img}
                    alt={post.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <span className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-amber-dark">
                    {post.category}
                  </span>
                  <h3 className="mb-2 text-[17px] font-extrabold leading-snug text-navy">
                    {post.title}
                  </h3>
                  <p className="flex-1 text-sm leading-relaxed text-ink-soft">{post.excerpt}</p>
                  <Link
                    href={post.href}
                    className="mt-5 inline-flex items-center rounded-[8px] border-2 border-navy px-4 py-2 text-xs font-bold text-navy no-underline transition-all hover:bg-navy hover:text-white"
                  >
                    Read More
                  </Link>
                </div>
              </div>
            ))}
          </div>
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
            Unlock the full Positivity, Health &amp; Wellness Library
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
export default BlogPage;
