import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMember } from "@/lib/access";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface PostFull {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  category: string | null;
  imageUrl: string | null;
  authorName: string;
  publishedAt: string;
}

interface Props {
  post: PostFull;
  gated: boolean;
}

const BlogPostPage: NextPageWithLayout<Props> = ({ post, gated }) => {
  const date = new Date(post.publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <Head>
        <title>{post.title} — FN Blog</title>
        <meta
          name="description"
          content={post.excerpt ?? `${post.title} — Fixer Nation Blog`}
        />
      </Head>

      {/* Back nav */}
      <div className="px-6 pt-8 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-navy no-underline hover:opacity-70"
          >
            ← All Posts
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="px-6 pt-8 pb-4 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {post.category && (
            <span className="mb-3 inline-block text-xs font-extrabold uppercase tracking-wider text-amber-dark">
              {post.category}
            </span>
          )}
          <h1 className="text-3xl font-extrabold leading-snug text-navy lg:text-4xl">
            {post.title}
          </h1>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm font-semibold text-ink">{post.authorName}</span>
            <span className="text-ink-soft">·</span>
            <span className="text-sm text-ink-soft">{date}</span>
          </div>
        </div>
      </section>

      {/* Cover image */}
      {post.imageUrl && (
        <div className="px-6 py-6 lg:px-8">
          <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl">
            <Image
              src={post.imageUrl}
              alt={post.title}
              width={800}
              height={450}
              className="h-auto w-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Body or gate */}
      {gated ? (
        <section className="px-6 pb-20 pt-4 lg:px-8">
          <div className="mx-auto max-w-3xl">
            {/* Blurred preview of opening paragraph */}
            {post.body && (
              <div className="relative mb-6 overflow-hidden rounded-xl">
                <p className="select-none blur-sm text-base leading-relaxed text-ink line-clamp-4">
                  {post.body.split("\n\n")[0]}
                </p>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/60 to-white" />
              </div>
            )}
            {/* Gate panel */}
            <div className="rounded-2xl border border-navy/10 bg-white p-8 text-center shadow-[0_16px_34px_-22px_rgba(20,40,56,0.25)]">
              <span className="mb-3 inline-block text-2xl">🔒</span>
              <h3 className="text-xl font-extrabold text-navy">This article is for members</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Join Fixer Nation to read the full archive — every article, Morning Boost, Ask The Fixer, and more.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href={`/join?callbackUrl=${encodeURIComponent(`/blog/${post.slug}`)}`}
                  className="inline-flex items-center justify-center rounded-[10px] bg-amber px-7 py-3 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
                >
                  Join Fixer Nation
                </Link>
                <Link
                  href={`/signin?callbackUrl=${encodeURIComponent(`/blog/${post.slug}`)}`}
                  className="inline-flex items-center justify-center rounded-[10px] border border-navy/20 bg-white px-7 py-3 text-sm font-bold text-navy no-underline transition-all hover:border-navy/40 hover:bg-cream-panel"
                >
                  Sign in
                </Link>
              </div>
              <Link href="/blog" className="mt-5 block text-xs font-semibold text-ink-soft no-underline hover:text-navy">
                ← Back to Blog
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="px-6 pb-20 pt-4 lg:px-8">
            <div className="mx-auto max-w-3xl">
              <div className="prose prose-navy max-w-none">
                {post.body.split("\n\n").map((paragraph, i) => (
                  <p key={i} className="mb-5 text-base leading-relaxed text-ink">
                    {paragraph}
                  </p>
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
                More from FN
              </span>
              <h2 className="mt-4 text-3xl font-extrabold text-white">
                Want more content like this?
              </h2>
              <p className="mt-4 text-base text-white/75">
                Members get full access to every article, the Ask The Fixer feature, and Morning Boost emails.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-4">
                <Link
                  href="/blog"
                  className="inline-flex items-center justify-center rounded-[10px] bg-white px-8 py-3.5 text-sm font-bold text-navy no-underline transition-all hover:-translate-y-0.5 hover:shadow-lg"
                >
                  Back to Blog
                </Link>
                <Link
                  href="/join"
                  className="inline-flex items-center justify-center rounded-[10px] bg-amber px-8 py-3.5 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
                >
                  Join Fixer Nation
                </Link>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
};

BlogPostPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const slug = context.params?.slug as string;

  const post = await db.blogPost.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true, excerpt: true, body: true, category: true, imageUrl: true, authorName: true, publishedAt: true },
  });

  if (!post || !post.publishedAt) {
    return { notFound: true };
  }

  const session = await getServerSession(context.req, context.res, authOptions);
  const gated = !session || !isMember(session.user.role, session.user.adminRole);

  return {
    props: { post: JSON.parse(JSON.stringify(post)), gated },
  };
};

export default BlogPostPage;
