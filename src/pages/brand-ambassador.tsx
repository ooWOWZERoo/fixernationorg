import Head from "next/head";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const BENEFITS = [
  {
    label: "Territory recognition",
    description: "Ambassadors are assigned geographic or community territories, so your work and referrals are tied directly to you.",
    icon: "📍",
  },
  {
    label: "Referral commissions",
    description: "Earn commissions when the providers and members you refer join Fixer Nation and stay active.",
    icon: "💰",
  },
  {
    label: "Promo codes and links",
    description: "You get a personal referral link and promo code so your community can join through you.",
    icon: "🔗",
  },
  {
    label: "Real community standing",
    description: "Your ambassador profile is visible to members in your territory who are looking for a local contact they can trust.",
    icon: "🌐",
  },
];

const STEPS = [
  "Fill out the application and tell us about your community and territory interests.",
  "Our team reviews your background, reach, and fit for the program.",
  "If accepted, you'll complete onboarding including territory assignment and affiliate setup.",
  "You receive your referral link, promo code, and ambassador profile.",
];

const BrandAmbassadorPage: NextPageWithLayout = () => {
  return (
    <>
      <Head>
        <title>Become a Brand Ambassador — Fixer Nation</title>
        <meta
          name="description"
          content="Represent Fixer Nation in your community. Ambassadors hold territories, earn referral commissions, and connect people with the professionals they need."
        />
      </Head>

      <main>
        {/* Hero */}
        <section className="bg-navy px-6 py-20 text-white lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-widest text-amber">
              Brand Ambassadors
            </p>
            <h1 className="mb-5 text-4xl font-extrabold leading-tight lg:text-5xl">
              Represent Fixer Nation in your community
            </h1>
            <p className="mx-auto max-w-xl text-lg text-white/80">
              Ambassadors are connectors. You know your community and the people in it.
              This program gives you a way to turn that into something real, with territory
              recognition, referral commissions, and the tools to grow it.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/become-an-ambassador"
                className="rounded-xl bg-amber px-8 py-3 text-sm font-bold text-navy no-underline transition-colors hover:bg-amber-dark"
              >
                Start your application
              </Link>
              <Link
                href="/ambassadors"
                className="rounded-xl border border-white/30 px-8 py-3 text-sm font-semibold text-white no-underline transition-colors hover:bg-white/10"
              >
                Meet current ambassadors
              </Link>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="bg-white px-6 py-16 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-10 text-center text-2xl font-extrabold text-navy">
              What ambassadors get
            </h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {BENEFITS.map((b) => (
                <div
                  key={b.label}
                  className="rounded-2xl border border-slate-100 bg-slate-50 p-6"
                >
                  <div className="mb-3 text-2xl">{b.icon}</div>
                  <h3 className="mb-2 text-base font-bold text-navy">{b.label}</h3>
                  <p className="text-sm leading-relaxed text-ink-soft">{b.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Territory info */}
        <section className="bg-slate-50 px-6 py-16 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-5 text-center text-2xl font-extrabold text-navy">
              How territories work
            </h2>
            <div className="space-y-4 text-base leading-relaxed text-ink-soft">
              <p>
                Each ambassador is assigned a territory when they complete onboarding. Territories
                are usually defined by county, city, or community type, but we work with you to
                find the right fit.
              </p>
              <p>
                Territories are not exclusive by default. Multiple ambassadors can work the same
                area, and one ambassador can hold multiple territories. What matters is activity
                and relationships, not ownership.
              </p>
              <p>
                Referrals made through your link or promo code are attributed to you regardless
                of where the person is located.
              </p>
            </div>
          </div>
        </section>

        {/* Eligibility */}
        <section className="bg-white px-6 py-16 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-5 text-2xl font-extrabold text-navy">What we look for</h2>
            <p className="text-base leading-relaxed text-ink-soft">
              We look for people with a real presence in their community, whether that&apos;s
              through a social following, an organization, an employer network, or just a
              reputation for connecting people. You don&apos;t need to be a marketing professional.
              All applicants go through a review process, and applying doesn&apos;t guarantee acceptance.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="bg-slate-50 px-6 py-16 lg:px-8">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-10 text-center text-2xl font-extrabold text-navy">
              How it works
            </h2>
            <ol className="space-y-5">
              {STEPS.map((step, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="pt-1 text-base text-ink">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-amber/10 px-6 py-16 lg:px-8">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="mb-3 text-2xl font-extrabold text-navy">Ready to apply?</h2>
            <p className="mb-7 text-base text-ink-soft">
              Applications are reviewed by a real person. We&apos;ll be in touch after you submit.
            </p>
            <Link
              href="/become-an-ambassador"
              className="inline-block rounded-xl bg-navy px-8 py-3 text-sm font-bold text-white no-underline transition-colors hover:bg-navy-dark"
            >
              Start your application
            </Link>
          </div>
        </section>
      </main>
    </>
  );
};

BrandAmbassadorPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export default BrandAmbassadorPage;
