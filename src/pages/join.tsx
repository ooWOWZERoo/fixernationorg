import Head from "next/head";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const PLANS = [
  {
    title: "Free with book purchase",
    sub: "Scan the QR code inside any Fixer Nation book to activate a 90-day membership.",
    price: "$0",
    priceNote: null,
    features: [
      "FN community access",
      "Daily Morning Boost emails",
      "Ask The Fixer",
      "Good for 3 months",
    ],
    cta: "Buy the Book",
    ctaHref: "/books",
    ctaStyle: "outline" as const,
    featured: false,
    badge: null,
  },
  {
    title: "Monthly membership",
    sub: "Starts with a 30-day free trial, then $10/mo. Introductory rate: $7/mo.",
    price: "$7",
    priceNote: "/mo intro",
    features: [
      "Everything in Free, plus:",
      "Full blog and library access",
      "Vetted Professional Network",
      "Mobile app",
    ],
    cta: "Start free trial",
    ctaHref: "/signin",
    ctaStyle: "primary" as const,
    featured: true,
    badge: "Most flexible",
  },
  {
    title: "Annual membership",
    sub: "Starts with a 30-day free trial, then $60/year ($5/mo).",
    price: "$60",
    priceNote: "/yr",
    features: [
      "Everything in Monthly, plus:",
      "Saves 50% vs monthly",
      "Member discounts and perks",
    ],
    cta: "Start free trial",
    ctaHref: "/signin",
    ctaStyle: "outline" as const,
    featured: false,
    badge: null,
  },
];

const FAQS = [
  {
    q: "What's included in all memberships?",
    a: "Every member gets the FN community, daily Morning Boost emails, the Vetted Professional Network, Ask The Fixer, the blog, the library, and the mobile app.",
  },
  {
    q: "How does the free trial work?",
    a: "Monthly and Annual plans both start with a 30-day free trial. Cancel before it ends and you won't be charged.",
  },
  {
    q: "I bought a book. How do I get my free membership?",
    a: "Open the book and scan the QR code on the inside cover. It activates a 90-day membership at no charge.",
  },
];

const JoinPage: NextPageWithLayout = () => {
  return (
    <>
      <Head>
        <title>Join Fixer Nation — Membership Plans</title>
        <meta
          name="description"
          content="Choose your Fixer Nation membership. Free with any book purchase, or start a 30-day free trial on monthly or annual plans from $7/mo."
        />
      </Head>

      {/* Hero */}
      <section className="px-6 pb-4 pt-16 text-center lg:px-8">
        <div className="mx-auto max-w-2xl">
          <span className="eyebrow">Membership</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-navy lg:text-5xl">
            Choose your path into Fixer Nation
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            Good mental health habits shouldn't cost much. A membership starts at $7/month. If you're dealing with something, Fixer Nation gives you a place to work through it.
          </p>
        </div>
      </section>

      {/* Pricing grid */}
      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:items-start">
            {PLANS.map((plan) => (
              <div
                key={plan.title}
                className={[
                  "relative rounded-2xl bg-white p-8 shadow-[0_16px_34px_-22px_rgba(20,40,56,0.25)]",
                  plan.featured
                    ? "border-2 border-amber md:scale-[1.03] md:shadow-[0_20px_45px_-18px_rgba(242,169,60,0.35)]"
                    : "border-2 border-transparent",
                ].join(" ")}
              >
                {plan.badge && (
                  <span className="absolute -top-3.5 right-6 rounded-full bg-amber px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide text-navy-dark shadow-[0_10px_20px_-8px_rgba(242,169,60,0.6)]">
                    {plan.badge}
                  </span>
                )}

                <h3 className="text-lg font-extrabold text-navy">{plan.title}</h3>
                <p className="mt-2 text-sm text-ink-soft">{plan.sub}</p>

                <div className="mt-5 flex items-end gap-1">
                  <span className="text-[42px] font-extrabold leading-none tracking-tight text-navy">
                    {plan.price}
                  </span>
                  {plan.priceNote && (
                    <span className="mb-1 text-sm font-semibold text-ink-soft">
                      {plan.priceNote}
                    </span>
                  )}
                </div>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 font-extrabold text-amber">✓</span>
                      <span className={i === 0 && f.endsWith(":") ? "font-bold text-navy" : "text-ink"}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.ctaHref}
                  className={[
                    "mt-8 flex w-full items-center justify-center rounded-[10px] px-6 py-3 text-sm font-bold no-underline transition-all hover:-translate-y-0.5",
                    plan.ctaStyle === "primary"
                      ? "bg-amber text-navy-dark shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] hover:bg-amber-dark"
                      : "border-2 border-navy text-navy hover:bg-navy hover:text-white",
                  ].join(" ")}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-20 pt-4 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-8 text-center text-3xl font-extrabold text-navy">Common questions</h2>
          <div className="space-y-4">
            {FAQS.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl bg-white p-6 shadow-[0_10px_24px_-18px_rgba(20,40,56,0.25)]"
              >
                <h4 className="mb-2 text-[15px] font-bold text-ink">{item.q}</h4>
                <p className="text-sm leading-relaxed text-ink-soft">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Band */}
      <section className="bg-navy px-6 py-20 text-center lg:px-8">
        <div className="mx-auto max-w-xl">
          <span
            className="eyebrow"
            style={{ background: "rgba(255,255,255,0.14)", color: "#F2D9AE" }}
          >
            You're worth it
          </span>
          <h2 className="mt-4 text-3xl font-extrabold text-white">
            We believe you, and your mental health, are worth the investment.
          </h2>
          <Link
            href="/signin"
            className="mt-7 inline-flex items-center justify-center rounded-[10px] bg-amber px-8 py-3.5 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
          >
            Start your free trial
          </Link>
        </div>
      </section>
    </>
  );
};

JoinPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default JoinPage;
