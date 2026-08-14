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
}

const MorningBoostEntryPage: NextPageWithLayout<Props> = ({ entry }) => {
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

      {/* Body */}
      <section className="px-6 pb-16 pt-4 lg:px-8">
        <div className="mx-auto max-w-2xl">
          {entry.body.split("\n\n").map((paragraph, i) => (
            <p key={i} className="mb-5 text-base leading-relaxed text-ink">
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      {/* Bottom nav */}
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

  // The most recent published entry is always public.
  // All past entries require membership.
  const latest = await db.morningBoost.findFirst({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    select: { slug: true },
  });

  const isLatest = latest?.slug === slug;

  if (!isLatest) {
    const session = await getServerSession(context.req, context.res, authOptions);
    if (!session || !isMember(session.user.role)) {
      return {
        redirect: {
          destination: `/join?callbackUrl=${encodeURIComponent(`/morning-boost/${slug}`)}`,
          permanent: false,
        },
      };
    }
  }

  return {
    props: { entry: JSON.parse(JSON.stringify(entry)) },
  };
};

export default MorningBoostEntryPage;
