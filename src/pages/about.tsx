import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const BOOKS = [
  {
    title: "Kill the Bully",
    cover: "/images/cover-kill-the-bully.png",
    href: "/books",
  },
  {
    title: "Your Past Doesn't Define You",
    cover: "/images/cover-your-past.png",
    href: "/books",
  },
  {
    title: "Think with 5 Brains",
    cover: "/images/cover-5-brains.png",
    href: "/books",
  },
  {
    title: "How to Lie & Get Away With It",
    cover: "/images/cover-how-to-lie.png",
    href: "/books",
  },
];

const AboutPage: NextPageWithLayout = () => {
  return (
    <>
      <Head>
        <title>About Anthony J. Placito — Fixer Nation</title>
        <meta
          name="description"
          content="Meet Anthony J. Placito — the Fixer. Author, mentor, and founder of Fixer Nation. Helping you build confidence, overcome challenge, and find your answers."
        />
      </Head>

      {/* Hero */}
      <section className="px-6 pb-10 pt-16 lg:px-8">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Photo */}
          <div className="overflow-hidden rounded-[20px] shadow-[0_20px_45px_-20px_rgba(20,40,56,0.3)]" style={{ aspectRatio: "3/3.6" }}>
            <Image
              src="/images/anthony.png"
              alt="Anthony J. Placito"
              width={540}
              height={648}
              className="h-full w-full object-cover"
              priority
            />
          </div>

          {/* Content */}
          <div>
            <span className="eyebrow">Meet the Fixer</span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-navy lg:text-5xl">
              Anthony J. Placito
            </h1>
            <p className="mt-4 text-[16.5px] leading-relaxed text-ink-soft">
              Helping you build confidence, overcome challenge, and cultivate resilience — through real-life experience, psychological insight, and strategic thinking.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/books"
                className="inline-flex items-center justify-center rounded-[10px] bg-amber px-6 py-3 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
              >
                Explore Books
              </Link>
              <Link
                href="/ask-the-fixer"
                className="inline-flex items-center justify-center rounded-[10px] border-2 border-navy bg-transparent px-6 py-3 text-sm font-bold text-navy no-underline transition-all hover:bg-navy hover:text-white"
              >
                Ask The Fixer
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-8 flex flex-wrap gap-10">
              <div>
                <b className="block text-2xl font-extrabold text-navy">4</b>
                <span className="text-xs font-bold uppercase tracking-[0.06em] text-ink-soft">Books Published</span>
              </div>
              <div>
                <b className="block text-2xl font-extrabold text-navy">1</b>
                <span className="text-xs font-bold uppercase tracking-[0.06em] text-ink-soft">Fixer Nation Credo</span>
              </div>
              <div>
                <b className="block text-2xl font-extrabold text-navy">PHW</b>
                <span className="text-xs font-bold uppercase tracking-[0.06em] text-ink-soft">Positivity · Health · Wellness</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-[760px] text-base leading-relaxed text-ink">
          <p className="mb-5">
            Anthony J. Placito is dedicated to helping individuals overcome obstacles, build confidence, and make smarter decisions. With a passion for personal growth and resilience, he shares powerful insights through his books: <em>Your Past Doesn't Define You</em>, <em>Kill the Bully</em>, <em>Think with 5 Brains Then Make Up Your Mind</em>, and <em>How to Lie and Get Away with It Every Time</em>.
          </p>
          <p className="mb-5">
            Drawing from real-life experiences, psychological principles, and strategic thinking, his work gives readers the tools they need to break free from self-doubt, silence their inner and outer critics, and work through life's toughest challenges with clarity.
          </p>

          <blockquote className="my-11 rounded-[18px] bg-navy px-10 py-9 text-center text-xl font-bold leading-snug text-white">
            "There are no problems in life... only issues and answers."
          </blockquote>

          <p>
            Through his writing, Anthony challenges readers to rethink their past, redefine their future, and approach decision-making with purpose.
          </p>
        </div>
      </section>

      {/* Books */}
      <section className="bg-cream-panel px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <span className="eyebrow">The Books</span>
            <h2 className="mt-3 text-3xl font-extrabold text-navy">Four Titles, One Philosophy</h2>
          </div>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {BOOKS.map((book) => (
              <Link
                key={book.title}
                href={book.href}
                className="group block overflow-hidden rounded-[14px] bg-white no-underline shadow-[0_20px_45px_-20px_rgba(20,40,56,0.3)] transition-transform hover:-translate-y-1"
                style={{ aspectRatio: "3/2" }}
              >
                <Image
                  src={book.cover}
                  alt={book.title}
                  width={360}
                  height={240}
                  className="h-full w-full object-contain p-2"
                />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-amber px-6 py-16 text-center lg:px-8">
        <div className="mx-auto max-w-6xl">
          <span className="eyebrow" style={{ background: "rgba(20,40,56,0.1)", color: "#142838" }}>
            Join Fixer Nation
          </span>
          <h2 className="mt-4 text-3xl font-extrabold text-navy-dark">
            Ready to turn your issues into answers?
          </h2>
          <Link
            href="/join"
            className="mt-6 inline-flex items-center justify-center rounded-[10px] bg-white px-8 py-3.5 text-sm font-bold text-navy no-underline transition-all hover:-translate-y-0.5"
          >
            Join Fixer Nation
          </Link>
        </div>
      </section>
    </>
  );
};

AboutPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export default AboutPage;
