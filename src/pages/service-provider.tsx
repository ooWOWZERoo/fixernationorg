import Head from "next/head";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const BENEFITS = [
  {
    label: "Warm referrals",
    description: "Clients come through trusted community connections, not cold searches.",
    icon: "🤝",
  },
  {
    label: "Vetted network access",
    description: "Work alongside other credentialed professionals who've been through the same review process.",
    icon: "✅",
  },
  {
    label: "Community visibility",
    description: "Your profile lives in a directory that members actually use when they need help.",
    icon: "📍",
  },
  {
    label: "Affiliate earnings",
    description: "Eligible providers can earn referral commissions when they bring in new business.",
    icon: "💰",
  },
];

const STEPS = [
  "Fill out the application. It takes about 10 minutes.",
  "Our team reviews your credentials and background.",
  "If accepted, you'll complete onboarding and get set up.",
  "Your profile goes live and referrals can start flowing.",
];

const ServiceProviderPage: NextPageWithLayout = () => {
  return (
    <>
      <Head>
        <title>Become a Service Provider — Fixer Nation</title>
        <meta
          name="description"
          content="Join a vetted network of professionals in financial services, legal, real estate, insurance, and more. Apply to become a Fixer Nation Service Provider."
        />
      </Head>

      <main>
        {/* Hero */}
        <section className="bg-navy px-6 py-20 text-white lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="mb-3 text-sm font-bold uppercase tracking-widest text-amber">
              For Professionals
            </p>
            <h1 className="mb-5 text-4xl font-extrabold leading-tight lg:text-5xl">
              Become a Fixer Nation Service Provider
            </h1>
            <p className="mx-auto max-w-xl text-lg text-white/80">
              Join a vetted network of professionals who show up for their community.
              People find you through real relationships, not paid placements or cold searches.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/become-a-provider"
                className="rounded-xl bg-amber px-8 py-3 text-sm font-bold text-navy no-underline transition-colors hover:bg-amber-dark"
              >
                Start your application
              </Link>
              <Link
                href="/providers"
                className="rounded-xl border border-white/30 px-8 py-3 text-sm font-semibold text-white no-underline transition-colors hover:bg-white/10"
              >
                Browse current providers
              </Link>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="bg-white px-6 py-16 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-10 text-center text-2xl font-extrabold text-navy">
              What you get as a provider
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

        {/* Eligibility */}
        <section className="bg-slate-50 px-6 py-16 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-5 text-2xl font-extrabold text-navy">What we look for</h2>
            <p className="text-base leading-relaxed text-ink-soft">
              We accept licensed or credentialed professionals in financial services, legal,
              real estate, insurance, health and wellness, and related fields. All applicants
              go through a review process. Applying doesn&apos;t guarantee acceptance.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="bg-white px-6 py-16 lg:px-8">
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
              href="/become-a-provider"
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

ServiceProviderPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export default ServiceProviderPage;
