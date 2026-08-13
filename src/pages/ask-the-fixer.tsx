import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Submit your question",
    body: "Share what you're dealing with — as much or as little detail as you want.",
  },
  {
    step: "2",
    title: "The Fixer reads it",
    body: "Every message is read individually. No automated responses.",
  },
  {
    step: "3",
    title: "You get a real reply",
    body: "A personal response grounded in real experience and the Fixer Nation approach.",
  },
];

const AskTheFixerPage: NextPageWithLayout = () => {
  const [submitted, setSubmitted] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/ask-the-fixer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${firstName} ${lastName}`.trim(),
          email,
          body,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Ask The Fixer — Fixer Nation</title>
        <meta
          name="description"
          content="Submit a personal question or challenge and get a real, personal response from The Fixer."
        />
      </Head>

      {/* Hero */}
      <section className="px-6 pb-4 pt-16 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <span className="eyebrow">Member Support</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-navy lg:text-5xl">
            Ask The Fixer
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Submit what's on your mind. Every message gets a real, personal response — no bots, no canned replies.
          </p>
        </div>
      </section>

      {/* Form panel */}
      <section className="bg-cream-panel px-6 py-16 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 className="text-2xl font-extrabold text-navy">Send your question</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink">
              Every message goes directly to The Fixer. Submit your question and you'll get a
              response grounded in real experience — not a template.
            </p>
            <div className="mt-8 space-y-5">
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[8px] bg-navy text-xs font-extrabold text-amber">
                  ✓
                </div>
                <div>
                  <p className="text-sm font-bold text-navy">No judgment</p>
                  <p className="text-sm text-ink-soft">Share whatever's on your mind, however you want to say it.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[8px] bg-navy text-xs font-extrabold text-amber">
                  ✓
                </div>
                <div>
                  <p className="text-sm font-bold text-navy">Completely personal</p>
                  <p className="text-sm text-ink-soft">Responses are tailored to your actual situation, not a generic answer.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-8 shadow-[0_20px_45px_-20px_rgba(20,40,56,0.3)]">
            {submitted ? (
              <div className="rounded-xl bg-[#E4EEF6] p-6 text-center">
                <p className="font-bold text-navy">Message received.</p>
                <p className="mt-1 text-sm text-ink-soft">
                  The Fixer will follow up with you shortly.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="mt-5 text-xs font-bold text-navy underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-ink-soft">
                      First Name
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      required
                      placeholder="Jane"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-[10px] border-2 border-[rgba(20,40,56,0.12)] bg-cream px-4 py-3 text-sm focus:border-amber focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-ink-soft">
                      Last Name
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-[10px] border-2 border-[rgba(20,40,56,0.12)] bg-cream px-4 py-3 text-sm focus:border-amber focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-ink-soft">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="jane@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-[10px] border-2 border-[rgba(20,40,56,0.12)] bg-cream px-4 py-3 text-sm focus:border-amber focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-ink-soft">
                    Your Message
                  </label>
                  <textarea
                    name="body"
                    required
                    placeholder="Tell The Fixer what's on your mind..."
                    rows={5}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    className="w-full resize-none rounded-[10px] border-2 border-[rgba(20,40,56,0.12)] bg-cream px-4 py-3 text-sm focus:border-amber focus:outline-none"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-[10px] bg-amber px-7 py-3 text-sm font-bold text-navy-dark shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {submitting ? "Sending…" : "Send"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <span className="eyebrow">How It Works</span>
            <h2 className="mt-4 text-3xl font-extrabold text-navy">
              Real answers, from a real person
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.step}
                className="rounded-2xl bg-white p-7 shadow-[0_14px_30px_-22px_rgba(20,40,56,0.25)]"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[10px] bg-navy text-sm font-extrabold text-amber">
                  {item.step}
                </div>
                <h4 className="mb-2 text-base font-extrabold text-navy">{item.title}</h4>
                <p className="text-sm leading-relaxed text-ink-soft">{item.body}</p>
              </div>
            ))}
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
            Membership
          </span>
          <h2 className="mt-4 text-3xl font-extrabold text-white">
            Ask The Fixer is included with every membership
          </h2>
          <Link
            href="/join"
            className="mt-7 inline-flex items-center justify-center rounded-[10px] bg-amber px-8 py-3.5 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
          >
            Join Fixer Nation
          </Link>
        </div>
      </section>
    </>
  );
};

AskTheFixerPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default AskTheFixerPage;
