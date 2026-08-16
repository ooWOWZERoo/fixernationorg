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

interface BoostFull {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  imageUrl: string | null;
  authorName: string;
  publishedAt: string;
}

interface Props {
  entry: BoostFull;
  gated: boolean;
}

const MorningBoostEntryPage: NextPageWithLayout<Props> = ({ entry, gated }) => {
  const date = new Date(entry.publishedAt).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <Head>
        <title>{entry.title} — Morning Boost</title>
        <meta
          name="description"
          content={entry.excerpt ?? `${entry.title} — Morning Boost from Fixer Nation`}
        />
      </Head>

      {/* Back nav */}
      <div className="px-6 pt-8 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/morning-boost"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-navy no-underline hover:opacity-70"
          >
            ← Morning Boost
          </Link>
        </div>
      </div>

      {/* Header */}
      <section className="px-6 pt-8 pb-4 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <span className="eyebrow">Morning Boost</span>
          <h1 className="mt-4 text-3xl font-extrabold leading-snug text-navy lg:text-4xl">
            {entry.title}
          </h1>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm font-semibold text-ink">{entry.authorName}</span>
            <span className="text-ink-soft">·</span>
            <span className="text-sm text-ink-soft">{date}</span>
          </div>
        </div>
      </section>

      {/* Cover image */}
      {entry.imageUrl && (
        <div className="px-6 py-6 lg:px-8">
          <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl">
            <Image
              src={entry.imageUrl}
              alt={entry.title}
              width={800}
              height={400}
              className="h-auto w-full object-cover"
            />
          </div>
        </div>
      )}

      {/* Body or gate */}
      {gated ? (
        <section className="px-6 pb-20 pt-4 lg:px-8">
          <div className="mx-auto max-w-2xl">
            {entry.body && (
              <div className="relative mb-6 overflow-hidden rounded-xl">
                <p className="select-none blur-sm text-base leading-relaxed text-ink line-clamp-4">
                  {entry.body.split("\n\n")[0]}
                </p>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/60 to-white" />
              </div>
            )}
            <div className="rounded-2xl border border-navy/10 bg-white p-8 text-center shadow-[0_16px_34px_-22px_rgba(20,40,56,0.25)]">
              <span className="mb-3 inline-block text-2xl">☀️</span>
              <h3 className="text-xl font-extrabold text-navy">Members only</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                Sign up to read every Morning Boost entry, plus blog posts and Ask The Fixer answers.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href={`/join?callbackUrl=${encodeURIComponent(`/morning-boost/${entry.slug}`)}`}
                  className="inline-flex items-center justify-center rounded-[10px] bg-amber px-7 py-3 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
                >
                  Join Fixer Nation
                </Link>
                <Link
                  href={`/signin?callbackUrl=${encodeURIComponent(`/morning-boost/${entry.slug}`)}`}
                  className="inline-flex items-center justify-center rounded-[10px] border border-navy/20 bg-white px-7 py-3 text-sm font-bold text-navy no-underline transition-all hover:border-navy/40 hover:bg-cream-panel"
                >
                  Sign in
                </Link>
              </div>
              <Link href="/morning-boost" className="mt-5 block text-xs font-semibold text-ink-soft no-underline hover:text-navy">
                ← Back to Morning Boost
              </Link>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="px-6 pb-16 pt-4 lg:px-8">
            <div className="mx-auto max-w-2xl">
              {entry.body.split("\n\n").map((paragraph, i) => (
                <p key={i} className="mb-5 text-base leading-relaxed text-ink">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>

          <section className="border-t border-navy/10 px-6 py-10 lg:px-8">
            <div className="mx-auto flex max-w-2xl items-center justify-between">
              <Link
                href="/morning-boost"
                className="text-sm font-bold text-navy no-underline hover:opacity-70"
              >
                ← All boosts
              </Link>
              <Link
                href="/ask-the-fixer"
                className="text-sm font-bold text-navy no-underline hover:opacity-70"
              >
                Ask The Fixer →
              </Link>
            </div>
          </section>
        </>
      )}
    </>
  );
};

MorningBoostEntryPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const slug = context.params?.slug as string;

  const entry = await db.morningBoost.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      body: true,
      imageUrl: true,
      authorName: true,
      publishedAt: true,
    },
  });

  if (!entry || !entry.publishedAt) {
    return { notFound: true };
  }

  const session = await getServerSession(context.req, context.res, authOptions);
  const gated = !session || !isMember(session.user.role, session.user.adminRole);

  return {
    props: { entry: JSON.parse(JSON.stringify(entry)), gated },
  };
};

export default MorningBoostEntryPage;
