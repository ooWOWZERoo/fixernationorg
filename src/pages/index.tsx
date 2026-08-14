import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const TAGS = [
  "Resilience", "Clarity", "Confidence", "Decision-Making",
  "Positivity", "Boundaries", "Purpose", "Self-Trust",
];

const CHECK_CARDS = [
  {
    title: "Morning Boost™",
    body: "Instead of letting your phone decide what gets your attention first thing in the morning, you decide. Start the day with something that actually helps you think.",
  },
  {
    title: "FN Network",
    body: "A private community built around growth, encouragement, and people who believe their time online should mean something.",
  },
  {
    title: "FN Library",
    body: "Books and resources selected to feed your mind, with new titles added regularly. Chosen content, not random content.",
  },
  {
    title: "Ask The Fixer",
    body: "Direct access when you need help thinking through what you're facing.",
  },
  {
    title: "Vetted Pro Network",
    body: "A trusted directory of service providers for when you need real help.",
  },
  {
    title: "Mobile Access",
    body: "Take Fixer Nation and your positive community with you wherever you go.",
  },
];

const BENEFITS = [
  {
    title: "Greater sense of clarity",
    body: "Members describe feeling less overwhelmed once the Morning Boost becomes a daily habit.",
    accent: "bg-navy",
  },
  {
    title: "Stronger support system",
    body: "The FN Network and Vetted Pro Network give members somewhere real to turn.",
    accent: "bg-amber",
  },
  {
    title: "More confident decisions",
    body: "The books' frameworks help members think things through before deciding.",
    accent: "bg-coral",
  },
];

const WHY_CARDS = [
  {
    symbol: "✦",
    title: "Real-life frameworks",
    body: "Grounded in lived experience, not theory.",
  },
  {
    symbol: "◎",
    title: "Community support",
    body: "The FN Network and Vetted Pro Network, in one place.",
  },
  {
    symbol: "◷",
    title: "Daily habits that fit",
    body: "Short, repeatable routines that work with a real schedule.",
  },
  {
    symbol: "✉",
    title: "Ask The Fixer, anytime",
    body: "Direct access when you need a real answer.",
  },
];

const BOOKS = [
  {
    src: "/images/cover-kill-the-bully.png",
    alt: "Kill the Bully",
    cls: "-rotate-2 translate-y-3",
  },
  {
    src: "/images/cover-your-past.png",
    alt: "Your Past Doesn't Define You",
    cls: "rotate-2",
  },
  {
    src: "/images/cover-5-brains.png",
    alt: "Think with 5 Brains",
    cls: "rotate-1",
  },
  {
    src: "/images/cover-how-to-lie.png",
    alt: "How to Lie & Get Away With It",
    cls: "-rotate-1 -translate-y-3",
  },
];

const HomePage: NextPageWithLayout = () => {
  return (
    <>
      <Head>
        <title>Fixer Nation — Positivity. Health. Wellness.</title>
        <meta
          name="description"
          content="Fixer Nation is a community built around real skills for everyday life. Daily tools, direct access to Anthony J. Placito's mentorship, and a private network for people who want actual answers."
        />
      </Head>

      {/* Hero */}
      <section className="overflow-hidden px-6 pb-14 pt-16 lg:px-8">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="eyebrow">Positivity · Health · Wellness</span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-navy lg:text-[52px]">
              The Health Club for Your Mind, Body &amp; Soul™
            </h1>
            <p className="mt-5 max-w-[520px] text-lg leading-relaxed text-ink-soft">
              What if the time you spend online actually helped you become better? Fixer Nation is a first-of-its-kind online health club and positive community built to strengthen your mindset, improve your well-being, and give your time online a real purpose.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/join"
                className="inline-flex items-center justify-center rounded-[10px] bg-amber px-6 py-3.5 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
              >
                Join Fixer Nation
              </Link>
              <Link
                href="/ask-the-fixer"
                className="inline-flex items-center justify-center rounded-[10px] border-2 border-navy px-6 py-3.5 text-sm font-bold text-navy no-underline transition-all hover:bg-navy hover:text-white"
              >
                Ask The Fixer
              </Link>
            </div>
          </div>

          {/* Book cover grid */}
          <div className="grid grid-cols-2 gap-4 lg:gap-5">
            {BOOKS.map((book) => (
              <div
                key={book.src}
                className={`${book.cls} overflow-hidden rounded-[14px] bg-white shadow-[0_20px_45px_-20px_rgba(20,40,56,0.3)] transition-transform`}
              >
                <Image
                  src={book.src}
                  alt={book.alt}
                  width={280}
                  height={370}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story / Video */}
      <section className="bg-cream-panel px-6 py-16 lg:px-8">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div
            className="relative overflow-hidden rounded-[18px] bg-navy-dark shadow-[0_20px_45px_-20px_rgba(20,40,56,0.3)]"
            style={{ aspectRatio: "16/10" }}
          >
            <Image
              src="/images/anthony.png"
              alt="Anthony J. Placito"
              fill
              className="object-cover object-top opacity-80"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber text-xl text-navy-dark shadow-[0_14px_30px_-8px_rgba(242,169,60,0.7)]">
                ▶
              </div>
            </div>
          </div>
          <div>
            <span className="eyebrow">A Different Kind of Online</span>
            <h2 className="mt-4 text-3xl font-extrabold text-navy">
              This is what your time online can become
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              Most platforms are designed to keep you scrolling. Fixer Nation is designed to help you grow. Open it and you're in a community where the people around you want to become better, and the content you consume is there to help you do the same.
            </p>
          </div>
        </div>
      </section>

      {/* What's Inside */}
      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <span className="eyebrow">What's Inside</span>
            <h2 className="mt-4 text-3xl font-extrabold text-navy">
              What you get with a Fixer Nation membership
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CHECK_CARDS.map((card) => (
              <div
                key={card.title}
                className="rounded-2xl bg-white p-6 shadow-[0_14px_30px_-22px_rgba(20,40,56,0.25)]"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-navy font-extrabold text-amber">
                  ✓
                </div>
                <h4 className="mb-2 text-base font-bold text-navy">{card.title}</h4>
                <p className="text-sm leading-relaxed text-ink-soft">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Life Skills Tags */}
      <section className="px-6 py-16 text-center lg:px-8">
        <div className="mx-auto max-w-6xl">
          <span className="eyebrow">Life Skills You'll Build</span>
          <h2 className="mt-4 text-3xl font-extrabold text-navy">For every stage of the journey</h2>
          <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-3">
            {TAGS.map((tag, i) => (
              <span
                key={tag}
                className={`rounded-full px-5 py-2.5 text-sm font-bold ${
                  i % 3 === 0
                    ? "bg-amber text-navy-dark"
                    : i % 3 === 1
                    ? "bg-coral text-white"
                    : "bg-navy text-white"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-cream-panel px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <span className="eyebrow">How Members Benefit</span>
            <h2 className="mt-4 text-3xl font-extrabold text-navy">
              What members say changes for them
            </h2>
            <p className="mt-3 text-sm text-ink-soft">
              These are common themes members share after building a daily habit with Fixer Nation.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {BENEFITS.map((card) => (
              <div
                key={card.title}
                className="overflow-hidden rounded-2xl bg-white shadow-[0_16px_34px_-22px_rgba(20,40,56,0.25)]"
              >
                <div className={`h-24 w-full opacity-15 ${card.accent}`} />
                <div className="p-6">
                  <h3 className="mb-2 text-lg font-bold text-navy">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-ink-soft">{card.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Skills Block — navy bg */}
      <section className="bg-navy px-6 py-20 lg:px-8">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <Image
            src="/images/anthony.png"
            alt="Anthony J. Placito"
            width={560}
            height={420}
            className="w-full rounded-[18px] object-cover shadow-[0_24px_50px_-20px_rgba(0,0,0,0.5)]"
          />
          <div>
            <span
              className="eyebrow"
              style={{ background: "rgba(255,255,255,0.14)", color: "#F2D9AE" }}
            >
              Skills That Power Growth
            </span>
            <h2 className="mt-4 text-3xl font-extrabold text-white">
              Built on Anthony J. Placito's real-life frameworks
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/75">
              Every book, blog post, and Morning Boost email connects back to the same core idea: there are no problems in life, only issues and answers.
            </p>
            <Link
              href="/about"
              className="mt-7 inline-flex items-center justify-center rounded-[10px] bg-amber px-6 py-3 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
            >
              Meet Anthony
            </Link>
          </div>
        </div>
      </section>

      {/* Member Story */}
      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-10 max-w-xl text-center">
            <span className="eyebrow">Member Story</span>
            <h2 className="mt-4 text-3xl font-extrabold text-navy">Real results from real members</h2>
          </div>
          <div className="grid overflow-hidden rounded-3xl bg-white shadow-[0_20px_45px_-20px_rgba(20,40,56,0.3)] lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative min-h-[280px]">
              <Image
                src="/images/anthony.png"
                alt="Fixer Nation member"
                fill
                className="object-cover object-top"
              />
            </div>
            <div className="p-10 lg:p-12">
              <span className="eyebrow">Member Quote</span>
              <p className="mt-5 text-xl font-semibold leading-snug text-navy">
                "Fixer Nation gave me a daily habit I could actually stick to. It was also the first place I felt comfortable asking real questions when I got stuck."
              </p>
              <p className="mt-5 text-sm font-bold text-ink-soft">Fixer Nation Community Member</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose */}
      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <span className="eyebrow">Why Members Choose Fixer Nation</span>
            <h2 className="mt-4 text-3xl font-extrabold text-navy">Simple to start, easy to stick with</h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_CARDS.map((card) => (
              <div key={card.title} className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-cream-panel text-2xl font-bold text-navy">
                  {card.symbol}
                </div>
                <h4 className="mb-2 text-base font-bold text-navy">{card.title}</h4>
                <p className="text-sm text-ink-soft">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Band */}
      <section className="bg-amber px-6 py-20 text-center lg:px-8">
        <div className="mx-auto max-w-6xl">
          <span
            className="eyebrow"
            style={{ background: "rgba(20,40,56,0.1)", color: "#142838" }}
          >
            Ready to Join?
          </span>
          <h2 className="mx-auto mt-4 max-w-xl text-3xl font-extrabold text-navy-dark">
            Stop mindlessly scrolling. Start purposefully growing.™
          </h2>
          <Link
            href="/join"
            className="mt-6 inline-flex items-center justify-center rounded-[10px] bg-white px-8 py-3.5 text-sm font-bold text-navy no-underline transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            Join Fixer Nation
          </Link>
        </div>
      </section>

      {/* Newsletter Band */}
      <section className="bg-navy-dark px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-lg text-center">
          <span
            className="eyebrow"
            style={{ background: "rgba(255,255,255,0.14)", color: "#F2D9AE" }}
          >
            Stay Connected
          </span>
          <h2 className="mt-4 text-2xl font-extrabold text-white">
            Get the Fixer Nation newsletter
          </h2>
          <p className="mt-3 text-sm text-white/70">
            A monthly email with book news, mindset prompts, and whatever Anthony is thinking about. No spam.
          </p>
          <form className="mt-6 flex flex-wrap justify-center gap-2" onSubmit={(e) => e.preventDefault()}>
            <input
              type="text"
              placeholder="First name (optional)"
              className="min-w-[160px] flex-1 rounded-[10px] border-0 px-4 py-3 text-sm font-medium text-ink placeholder-ink-soft focus:outline-none focus:ring-2 focus:ring-amber"
            />
            <input
              type="email"
              placeholder="you@email.com"
              required
              className="min-w-[200px] flex-1 rounded-[10px] border-0 px-4 py-3 text-sm font-medium text-ink placeholder-ink-soft focus:outline-none focus:ring-2 focus:ring-amber"
            />
            <button
              type="submit"
              className="rounded-[10px] bg-amber px-6 py-3 text-sm font-bold text-navy-dark shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
            >
              Subscribe
            </button>
          </form>
        </div>
      </section>
    </>
  );
};

HomePage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default HomePage;
