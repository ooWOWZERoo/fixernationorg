import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { useState } from "react";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const BOOK_META: Record<string, { amazon: string | null; tagNew: boolean }> = {
  "kill-the-bully": { amazon: "https://www.amazon.com", tagNew: false },
  "your-past-doesnt-define-you": { amazon: "https://www.amazon.com", tagNew: false },
  "think-with-5-brains": { amazon: null, tagNew: true },
  "how-to-lie": { amazon: null, tagNew: true },
};

interface BookProps {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  features: string[];
  buyNowPriceId: string | null;
  buyNowAmount: number | null;
}

interface Props {
  book: BookProps;
  isSignedIn: boolean;
}

const BookDetailPage: NextPageWithLayout<Props> = ({ book, isSignedIn }) => {
  const meta = BOOK_META[book.slug] ?? { amazon: null, tagNew: false };
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  async function buyNow() {
    if (!book.buyNowPriceId) return;

    if (!isSignedIn) {
      window.location.href = `/signin?callbackUrl=/books/${book.slug}`;
      return;
    }

    setBuyLoading(true);
    setBuyError(null);
    try {
      const res = await fetch("/api/checkout/create-book-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId: book.buyNowPriceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = `/signin?callbackUrl=/books/${book.slug}`;
          return;
        }
        throw new Error(data.error ?? "Something went wrong");
      }
      window.location.href = data.url;
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : "Something went wrong");
      setBuyLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>{book.name} — Fixer Nation</title>
        <meta
          name="description"
          content={book.description ?? `${book.name} by Anthony J. Placito — available from Fixer Nation.`}
        />
      </Head>

      {/* Back nav */}
      <div className="px-6 pt-8 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/books"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-navy no-underline hover:opacity-70"
          >
            ← All Books
          </Link>
        </div>
      </div>

      {/* Main content */}
      <section className="px-6 py-12 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-start">

            {/* Cover */}
            <div className="flex items-center justify-center rounded-2xl bg-white p-10 shadow-[0_20px_45px_-20px_rgba(20,40,56,0.25)]">
              {book.imageUrl ? (
                <Image
                  src={book.imageUrl}
                  alt={`${book.name} book cover`}
                  width={300}
                  height={400}
                  className="h-auto w-full max-w-[280px] object-contain drop-shadow-xl"
                />
              ) : (
                <div className="flex h-80 w-56 items-center justify-center rounded-lg bg-cream-panel text-sm text-ink-soft">
                  No cover image
                </div>
              )}
            </div>

            {/* Info */}
            <div>
              {meta.tagNew && (
                <span className="mb-3 inline-block text-xs font-extrabold uppercase tracking-wider text-coral">
                  New Arrival
                </span>
              )}
              {!meta.tagNew && (
                <span className="mb-3 inline-block text-xs font-extrabold uppercase tracking-wider text-amber-dark">
                  Also on Amazon Kindle
                </span>
              )}

              <h1 className="text-3xl font-extrabold leading-snug text-navy lg:text-4xl">
                {book.name}
              </h1>
              <p className="mt-2 text-sm font-semibold text-ink-soft">
                By Anthony J. Placito
              </p>

              {book.description && (
                <p className="mt-5 text-base leading-relaxed text-ink">
                  {book.description}
                </p>
              )}

              {book.features.length > 0 && (
                <ul className="mt-6 space-y-3">
                  {book.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 font-extrabold text-amber">✓</span>
                      <span className="text-ink">{f}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-8 flex flex-wrap gap-3">
                {book.buyNowPriceId && book.buyNowAmount !== null && (
                  <button
                    onClick={buyNow}
                    disabled={buyLoading}
                    className="inline-flex items-center justify-center rounded-[10px] bg-navy px-7 py-3 text-sm font-bold text-white no-underline shadow-[0_12px_24px_-10px_rgba(20,40,56,0.45)] transition-all hover:-translate-y-0.5 hover:bg-navy-dark disabled:opacity-60"
                  >
                    {buyLoading ? "Redirecting…" : `Buy now — $${(book.buyNowAmount / 100).toFixed(2)}`}
                  </button>
                )}
                {meta.amazon ? (
                  <a
                    href={meta.amazon}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-[10px] bg-amber px-7 py-3 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
                  >
                    Buy on Amazon
                  </a>
                ) : !book.buyNowPriceId ? (
                  <span className="inline-flex items-center justify-center rounded-[10px] bg-cream-panel px-7 py-3 text-sm font-bold text-ink-soft cursor-default">
                    Amazon — Coming Soon
                  </span>
                ) : null}
                <Link
                  href="/join"
                  className="inline-flex items-center justify-center rounded-[10px] border-2 border-navy px-7 py-3 text-sm font-bold text-navy no-underline transition-all hover:bg-navy hover:text-white"
                >
                  Get Free Membership
                </Link>
              </div>

              {buyError && <p className="mt-3 text-sm text-red-600">{buyError}</p>}

              <p className="mt-5 text-xs text-ink-soft">
                {book.buyNowPriceId
                  ? "Buying direct ships the physical book and turns on a free 90-day Fixer Nation membership automatically. No QR code needed."
                  : "Every book includes a 90-day free Fixer Nation membership via QR code inside the cover."}
              </p>
            </div>
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
            Free Membership
          </span>
          <h2 className="mt-4 text-3xl font-extrabold text-white">
            Every book comes with a 90-day membership
          </h2>
          <p className="mt-4 text-base text-white/75">
            Scan the QR code inside the cover to get free access to the Fixer Nation community for 90 days.
          </p>
          <Link
            href="/join"
            className="mt-7 inline-flex items-center justify-center rounded-[10px] bg-white px-8 py-3.5 text-sm font-bold text-navy no-underline transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            See Membership Options
          </Link>
        </div>
      </section>
    </>
  );
};

BookDetailPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const slug = context.params?.slug as string;
  const session = await getServerSession(context.req, context.res, authOptions);

  const book = await db.product.findUnique({
    where: { slug, type: "BOOK" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      imageUrl: true,
      features: true,
      prices: {
        where: { interval: "ONE_TIME", active: true },
        select: { id: true, amount: true },
        take: 1,
      },
    },
  });

  if (!book) {
    return { notFound: true };
  }

  const buyNowPrice = book.prices[0] ?? null;
  const { prices, ...bookFields } = book;

  return {
    props: {
      book: JSON.parse(
        JSON.stringify({
          ...bookFields,
          buyNowPriceId: buyNowPrice?.id ?? null,
          buyNowAmount: buyNowPrice?.amount ?? null,
        })
      ),
      isSignedIn: !!session?.user?.id,
    },
  };
};

export default BookDetailPage;
