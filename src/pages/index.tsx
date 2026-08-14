import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const CHECK_CARDS = [
  {
    title: "Books",
    href: "/books",
    body: "Books and resources selected to feed your mind, with new titles added regularly. Chosen content, not random content.",
  },
  {
    title: "FN Blogs",
    href: "/blog",
    body: "Practical perspective on mindset, well-being, and getting unstuck — written for people who want to grow.",
  },
  {
    title: "FN Network",
    href: "/network",
    body: "A private community built around growth, encouragement, and people who believe their time online should mean something.",
  },
  {
    title: "Morning Boost™",
    href: "/morning-boost",
    body: "Instead of letting your phone decide what gets your attention first thing in the morning, you decide. Start the day with something that actually helps you think.",
  },
  {
    title: "Find a Provider",
    href: "/providers",
    body: "A trusted directory of vetted service providers for when you need real, qualified help.",
  },
  {
    title: "Ask The Fixer",
    href: "/ask-the-fixer",
    body: "Direct access when you need help thinking through what you're facing.",
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
    body: "Better thinking leads to better choices. Members use FN's daily content to work through decisions before making them.",
    accent: "bg-coral",
  },
];

const HomePage: NextPageWithLayout = () => {
  return (
    <>
      <Head>
        <title>Fixer Nation — The Health Club for Your Mind, Body &amp; Soul™</title>
        <meta
          name="description"
          content="Fixer Nation is a first-of-its-kind online health club and positive community built to strengthen your mindset, improve your well-being, and give your time online a real purpose."
        />
      </Head>

      {/* 1. Hero */}
      <section className="overflow-hidden px-6 pb-14 pt-16 lg:px-8">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="eyebrow">Positivity · Health · Wellness</span>
            <h1 className="mt-4 font-display text-5xl font-normal leading-[1.1] tracking-tight text-navy lg:text-[64px]">
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

          <div className="overflow-hidden rounded-[18px] shadow-[0_20px_45px_-20px_rgba(20,40,56,0.3)]">
            <Image
              src="/images/hero-wellness.jpg"
              alt="Morning calm — positivity, health, and wellness"
              width={1200}
              height={900}
              className="w-full object-cover"
              priority
            />
          </div>
        </div>
      </section>

      {/* 2. Social media contrast */}
      <section className="bg-cream-panel px-6 py-16 lg:px-8">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div className="overflow-hidden rounded-[18px] shadow-[0_20px_45px_-20px_rgba(20,40,56,0.3)]">
            <Image
              src="/images/community.jpg"
              alt="People helping each other reach the top — Fixer Nation community"
              width={1586}
              height={992}
              className="w-full object-cover"
            />
          </div>
          <div>
            <span className="eyebrow">A Different Kind of Online</span>
            <h2 className="mt-4 font-display text-4xl font-normal leading-[1.15] text-navy lg:text-5xl">
              This is what your time online can become
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              Most platforms are designed to keep you scrolling. Fixer Nation is designed to help you grow. Open it and you're in a community where the people around you want to become better, and the content you consume is there to help you do the same.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Anthony + philosophy */}
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
              The founder
            </span>
            <h2 className="mt-4 font-display text-4xl font-normal leading-[1.15] text-white lg:text-5xl">
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

      {/* 4. Benefits */}
      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <span className="eyebrow">How Members Benefit</span>
            <h2 className="mt-4 text-3xl font-extrabold text-navy">
              What changes for members
            </h2>
            <p className="mt-3 text-sm text-ink-soft">
              Common themes from members who've built a daily habit with Fixer Nation.
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

      {/* 5. What's Inside */}
      <section className="bg-cream-panel px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-xl text-center">
            <span className="eyebrow">What's Inside</span>
            <h2 className="mt-4 text-3xl font-extrabold text-navy">
              What you get with a Fixer Nation membership
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {CHECK_CARDS.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="group rounded-2xl bg-white p-6 shadow-[0_14px_30px_-22px_rgba(20,40,56,0.25)] no-underline transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-20px_rgba(20,40,56,0.3)]"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-navy font-extrabold text-amber">
                  ✓
                </div>
                <h4 className="mb-2 text-base font-bold text-navy">{card.title}</h4>
                <p className="text-sm leading-relaxed text-ink-soft">{card.body}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 6. The Statement — signature section */}
      <section className="bg-amber px-6 py-28 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-display text-[clamp(2rem,4.5vw,4rem)] font-normal italic leading-[1.25] text-white">
            "There are no problems in life...
          </p>
          <p className="font-display text-[clamp(2rem,4.5vw,4rem)] font-normal italic leading-[1.25] text-white">
            only issues and answers."
          </p>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-navy-dark/60">
            The Fixer Nation philosophy
          </p>
        </div>
      </section>

      {/* 7. Member Story */}
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

      {/* 8. CTA Band */}
      <section className="bg-navy px-6 py-20 text-center lg:px-8">
        <div className="mx-auto max-w-6xl">
          <span
            className="eyebrow"
            style={{ background: "rgba(255,255,255,0.14)", color: "#F2D9AE" }}
          >
            Ready to join?
          </span>
          <h2 className="mx-auto mt-4 max-w-xl text-3xl font-extrabold text-white">
            Stop mindlessly scrolling. Start purposefully growing.™
          </h2>
          <Link
            href="/join"
            className="mt-6 inline-flex items-center justify-center rounded-[10px] bg-amber px-8 py-3.5 text-sm font-bold text-navy-dark no-underline transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
          >
            Join Fixer Nation
          </Link>
        </div>
      </section>

      {/* 9. Newsletter Band */}
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
