import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import type { GetServerSideProps } from "next";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface PriceData {
  id: string;
  interval: string;
  amount: number;
  trialDays: number | null;
}

interface ProductData {
  name: string;
  description: string | null;
  features: string[];
  prices: PriceData[];
}

interface Props {
  freeWithBook: ProductData | null;
  consumerMembership: ProductData | null;
}

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

const JoinPage: NextPageWithLayout<Props> = ({ freeWithBook, consumerMembership }) => {
  const [billing, setBilling] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");

  const monthlyPrice = consumerMembership?.prices.find((p) => p.interval === "MONTHLY");
  const annualPrice = consumerMembership?.prices.find((p) => p.interval === "ANNUAL");
  const selectedPrice = billing === "MONTHLY" ? monthlyPrice : annualPrice;

  const priceDisplay = selectedPrice ? `$${selectedPrice.amount / 100}` : "—";
  const priceNote = billing === "MONTHLY" ? "/mo intro" : "/yr";
  const priceSub =
    billing === "MONTHLY"
      ? "30-day free trial, then $10/mo."
      : "30-day free trial, then $60/yr — $5/mo, save 50%.";

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
        <div className="mx-auto max-w-3xl">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

            {/* Free with Book card */}
            {freeWithBook && (
              <div className="relative rounded-2xl border-2 border-transparent bg-white p-8 shadow-[0_16px_34px_-22px_rgba(20,40,56,0.25)]">
                <h3 className="text-lg font-extrabold text-navy">{freeWithBook.name}</h3>
                <p className="mt-2 text-sm text-ink-soft">{freeWithBook.description}</p>

                <div className="mt-5 flex items-end gap-1">
                  <span className="text-[42px] font-extrabold leading-none tracking-tight text-navy">$0</span>
                </div>

                <ul className="mt-6 space-y-3">
                  {freeWithBook.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 font-extrabold text-amber">✓</span>
                      <span className={i === 0 && f.endsWith(":") ? "font-bold text-navy" : "text-ink"}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/books"
                  className="mt-8 flex w-full items-center justify-center rounded-[10px] border-2 border-navy px-6 py-3 text-sm font-bold text-navy no-underline transition-all hover:-translate-y-0.5 hover:bg-navy hover:text-white"
                >
                  Buy the Book
                </Link>
              </div>
            )}

            {/* Consumer Membership card with billing toggle */}
            {consumerMembership && (
              <div className="relative rounded-2xl border-2 border-amber bg-white p-8 shadow-[0_20px_45px_-18px_rgba(242,169,60,0.35)]">
                <span className="absolute -top-3.5 right-6 rounded-full bg-amber px-4 py-1.5 text-xs font-extrabold uppercase tracking-wide text-navy-dark shadow-[0_10px_20px_-8px_rgba(242,169,60,0.6)]">
                  Most popular
                </span>

                <h3 className="text-lg font-extrabold text-navy">{consumerMembership.name}</h3>
                <p className="mt-2 min-h-[2.5rem] text-sm text-ink-soft">{priceSub}</p>

                {/* Billing toggle */}
                <div className="mt-4 flex rounded-lg bg-slate-100 p-1">
                  <button
                    onClick={() => setBilling("MONTHLY")}
                    className={[
                      "flex-1 rounded-md py-1.5 text-xs font-bold transition-colors",
                      billing === "MONTHLY"
                        ? "bg-white text-navy shadow-sm"
                        : "text-ink-soft hover:text-navy",
                    ].join(" ")}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBilling("ANNUAL")}
                    className={[
                      "flex-1 rounded-md py-1.5 text-xs font-bold transition-colors",
                      billing === "ANNUAL"
                        ? "bg-white text-navy shadow-sm"
                        : "text-ink-soft hover:text-navy",
                    ].join(" ")}
                  >
                    Annual
                  </button>
                </div>

                <div className="mt-4 flex items-end gap-1">
                  <span className="text-[42px] font-extrabold leading-none tracking-tight text-navy">
                    {priceDisplay}
                  </span>
                  <span className="mb-1 text-sm font-semibold text-ink-soft">{priceNote}</span>
                </div>

                <ul className="mt-6 space-y-3">
                  {consumerMembership.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 font-extrabold text-amber">✓</span>
                      <span className={i === 0 && f.endsWith(":") ? "font-bold text-navy" : "text-ink"}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/signin"
                  className="mt-8 flex w-full items-center justify-center rounded-[10px] bg-amber px-6 py-3 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
                >
                  Start free trial
                </Link>
              </div>
            )}
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

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const memberships = await db.product.findMany({
    where: { type: "MEMBERSHIP", active: true },
    select: {
      slug: true,
      name: true,
      description: true,
      features: true,
      prices: {
        where: { active: true },
        select: { id: true, interval: true, amount: true, trialDays: true },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  const freeWithBook = memberships.find((p) => p.slug === "free-with-book") ?? null;
  const consumerMembership = memberships.find((p) => p.slug === "consumer-membership") ?? null;

  return {
    props: {
      freeWithBook: freeWithBook ? JSON.parse(JSON.stringify(freeWithBook)) : null,
      consumerMembership: consumerMembership ? JSON.parse(JSON.stringify(consumerMembership)) : null,
    },
  };
};

export default JoinPage;
