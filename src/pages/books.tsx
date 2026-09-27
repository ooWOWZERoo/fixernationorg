import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import type { GetServerSideProps } from "next";
import { db } from "@/lib/db";
import { fetchBookFormats, toPublicFormats, type PublicBookFormat } from "@/lib/book-formats";
import { BOOK_PRESENTATION, type BookFilter as Filter } from "@/lib/book-presentation";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const FILTERS: { label: string; value: Filter }[] = [
  { label: "All Books", value: "all" },
  { label: "Short Story Series", value: "series" },
  { label: "New Arrivals", value: "new" },
];

interface BookItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  formats: PublicBookFormat[];
}

interface Props {
  books: BookItem[];
}

const BooksPage: NextPageWithLayout<Props> = ({ books }) => {
  const [active, setActive] = useState<Filter>("all");

  const visible = books.filter((b) => {
    const meta = BOOK_PRESENTATION[b.slug];
    return meta ? meta.filter.includes(active) : active === "all";
  });

  return (
    <>
      <Head>
        <title>Books — Fixer Nation</title>
        <meta
          name="description"
          content="Four short story books by Anthony J. Placito, each grounded in real experience and built around the idea that every problem has an answer."
        />
      </Head>

      {/* Hero */}
      <section className="px-6 pb-4 pt-16 text-center lg:px-8">
        <div className="mx-auto max-w-2xl">
          <span className="eyebrow">Short Story Book Series</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-navy lg:text-5xl">
            Books from Fixer Nation
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Four short story books by Anthony J. Placito, each grounded in real experience and built around the idea that every problem has an answer.
          </p>
        </div>
      </section>

      {/* Books section */}
      <section className="px-6 pb-20 pt-10 lg:px-8">
        <div className="mx-auto max-w-6xl">

          {/* Filter chips */}
          <div className="mb-10 flex flex-wrap justify-center gap-3">
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
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {visible.map((book) => {
              const meta = BOOK_PRESENTATION[book.slug] ?? { tag: "Book", tagNew: false, filter: [] };
              const amazonFormats = book.formats.filter((f) => f.amazonUrl);
              return (
                <div
                  key={book.id}
                  className="flex flex-col overflow-hidden rounded-[18px] bg-white shadow-[0_16px_34px_-22px_rgba(20,40,56,0.28)]"
                >
                  {/* Cover */}
                  <div className="flex items-center justify-center bg-white p-4" style={{ aspectRatio: "3/4" }}>
                    {book.imageUrl && (
                      <Image
                        src={book.imageUrl}
                        alt={`${book.name} book cover`}
                        width={220}
                        height={293}
                        className="h-full w-full object-contain drop-shadow-md"
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <span className={`text-xs font-extrabold uppercase tracking-wider ${meta.tagNew ? "text-coral" : "text-amber-dark"}`}>
                      {meta.tag}
                    </span>
                    <h3 className="text-sm font-extrabold leading-snug text-navy">{book.name}</h3>
                    <p className="flex-1 text-sm leading-relaxed text-ink-soft">{book.description}</p>

                    {book.formats.length > 0 && (
                      <p className="text-xs font-semibold text-ink-soft">
                        {book.formats.map((f) => f.label).join(" · ")}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link
                        href={`/books/${book.slug}`}
                        className="flex flex-1 items-center justify-center rounded-[8px] border-2 border-navy px-3 py-2 text-xs font-bold text-navy no-underline transition-all hover:bg-navy hover:text-white"
                      >
                        Details
                      </Link>
                      {amazonFormats.length === 1 && (
                        <a
                          href={amazonFormats[0].amazonUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex flex-1 items-center justify-center rounded-[8px] bg-amber px-3 py-2 text-xs font-bold text-navy-dark no-underline shadow-[0_8px_16px_-8px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
                        >
                          Amazon
                        </a>
                      )}
                      {book.formats.length === 0 && (
                        <span className="flex flex-1 items-center justify-center rounded-[8px] bg-cream-panel px-3 py-2 text-xs font-bold text-ink-soft cursor-default">
                          Coming Soon
                        </span>
                      )}
                    </div>

                    {amazonFormats.length > 1 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                          On Amazon
                        </span>
                        {amazonFormats.map((f) => (
                          <a
                            key={f.format}
                            href={f.amazonUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full bg-amber px-3 py-1.5 text-[11px] font-bold text-navy-dark no-underline transition-all hover:bg-amber-dark"
                          >
                            {f.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
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

BooksPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const books = await db.product.findMany({
    where: { type: "BOOK", active: true },
    select: { id: true, slug: true, name: true, description: true, imageUrl: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const rows = await fetchBookFormats(books.map((b) => b.id));
  const withFormats = books.map((b) => ({
    ...b,
    formats: toPublicFormats(rows.filter((r) => r.productId === b.id)),
  }));

  return { props: { books: JSON.parse(JSON.stringify(withFormats)) } };
};

export default BooksPage;
