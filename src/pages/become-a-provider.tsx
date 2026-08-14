import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface Props {
  prefillName: string;
  prefillEmail: string;
}

const BENEFITS = [
  { heading: "Reach qualified leads", body: "Your listing appears directly in front of Fixer Nation members who are actively looking for help." },
  { heading: "No cold outreach", body: "Members come to you through your profile. You handle the conversation on your terms." },
  { heading: "Trusted community backing", body: "Provider status shows members you've been vetted — not just anyone with a website." },
  { heading: "Simple monthly membership", body: "One flat rate. No commissions, no per-lead fees, no surprises." },
];

const BecomeAProviderPage: NextPageWithLayout<Props> = ({ prefillName, prefillEmail }) => {
  const [form, setForm] = useState({
    name: prefillName,
    email: prefillEmail,
    businessName: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: "PROVIDER" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Become a Service Provider — Fixer Nation</title>
        <meta name="description" content="Join the Fixer Nation Service Provider Network. Reach motivated clients who are already looking for the help you offer." />
      </Head>

      {/* Hero */}
      <section className="px-6 pb-10 pt-20 text-center lg:px-8">
        <div className="mx-auto max-w-2xl">
          <span className="eyebrow">Service Providers</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-navy lg:text-5xl">
            Put your services in front of the right people
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            Fixer Nation members are people working through real challenges — financial, personal, professional. They need what you offer. Apply to join our verified provider network.
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-cream-panel px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <div key={b.heading} className="rounded-2xl bg-white p-6 shadow-[0_8px_20px_-12px_rgba(20,40,56,0.18)]">
                <h3 className="mb-2 font-extrabold text-navy">{b.heading}</h3>
                <p className="text-sm leading-relaxed text-ink-soft">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Application form */}
      <section className="px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-extrabold text-navy">Apply now</h2>
            <p className="mt-2 text-sm text-ink-soft">Tell us a little about yourself and your work. We review every application personally.</p>
          </div>

          {done ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
              <p className="text-lg font-extrabold text-green-800">Application received.</p>
              <p className="mt-2 text-sm text-green-700">
                We'll review your application and follow up at {form.email}. Thanks for your interest in the provider network.
              </p>
              <Link href="/" className="mt-6 inline-block text-sm font-bold text-navy underline underline-offset-2 no-underline hover:opacity-70">
                Back to Fixer Nation →
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-navy/10 bg-white p-8 shadow-[0_16px_34px_-22px_rgba(20,40,56,0.25)]">
              {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink">Your name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  minLength={2}
                  maxLength={100}
                  className="w-full rounded-xl border border-navy/15 px-4 py-3 text-sm text-ink placeholder-ink-soft/60 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink">Email address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-navy/15 px-4 py-3 text-sm text-ink placeholder-ink-soft/60 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink">
                  Business or practice name <span className="font-normal text-ink-soft">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.businessName}
                  onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                  maxLength={150}
                  placeholder="Your business name or DBA"
                  className="w-full rounded-xl border border-navy/15 px-4 py-3 text-sm text-ink placeholder-ink-soft/60 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-ink">Tell us about your work</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  required
                  minLength={20}
                  maxLength={2000}
                  rows={5}
                  placeholder="What services do you offer? Who do you typically help? What makes your approach different?"
                  className="w-full resize-none rounded-xl border border-navy/15 px-4 py-3 text-sm text-ink placeholder-ink-soft/60 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
                <p className="mt-1 text-xs text-ink-soft">Minimum 20 characters. Be specific — it helps us match you with the right members.</p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-[10px] bg-amber py-3.5 text-sm font-bold text-navy-dark shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              >
                {submitting ? "Submitting…" : "Submit application"}
              </button>

              <p className="text-center text-xs text-ink-soft">
                Already applied or have questions?{" "}
                <Link href="/contact" className="font-semibold text-navy underline underline-offset-2 no-underline hover:opacity-70">Contact us</Link>.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* CTA band */}
      <section className="bg-navy px-6 py-16 text-center lg:px-8">
        <div className="mx-auto max-w-xl">
          <h2 className="text-2xl font-extrabold text-white">Not a service provider?</h2>
          <p className="mt-3 text-sm text-white/75">
            Members get access to the library, Morning Boost, the community, and more.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link href="/join" className="inline-flex items-center justify-center rounded-[10px] bg-amber px-7 py-3 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark">
              Join as a member
            </Link>
            <Link href="/become-an-ambassador" className="inline-flex items-center justify-center rounded-[10px] border-2 border-white/30 px-7 py-3 text-sm font-bold text-white no-underline transition-all hover:border-white/60 hover:bg-white/10">
              Become an ambassador
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

BecomeAProviderPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  return {
    props: {
      prefillName: session?.user?.name ?? "",
      prefillEmail: session?.user?.email ?? "",
    },
  };
};

export default BecomeAProviderPage;
