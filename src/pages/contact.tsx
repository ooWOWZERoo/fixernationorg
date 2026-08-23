import Head from "next/head";
import { useState } from "react";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const SUBJECTS = [
  "General question",
  "Membership",
  "Books & orders",
  "Media & press",
  "Partnerships",
  "Technical support",
  "Other",
];

const ContactPage: NextPageWithLayout = () => {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", _hp: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
        <title>Contact — Fixer Nation</title>
        <meta name="description" content="Get in touch with the Fixer Nation team." />
      </Head>

      <div className="mx-auto max-w-[680px] px-6 py-16 lg:px-8">
        <div className="mb-10">
          <span className="eyebrow">Get in touch</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-navy">
            Contact us
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-ink-soft">
            Questions about membership, books, press inquiries, or anything else — send us a message and we'll get back to you.
          </p>
        </div>

        {submitted ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-8 py-10 text-center">
            <div className="mb-3 flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl text-green-600">
                ✓
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-navy">Message sent</h2>
            <p className="mt-2 text-ink-soft">
              We got it. Someone from the team will follow up at {form.email}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Honeypot: hidden from real users, only a naive bot filling every field will trip it */}
            <input
              type="text"
              name="website"
              value={form._hp}
              onChange={set("_hp")}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
            />

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-navy">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set("name")}
                  required
                  placeholder="Your name"
                  className="w-full rounded-xl border border-navy/20 bg-white px-4 py-3 text-sm text-ink placeholder-ink-soft/60 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-navy">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set("email")}
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-navy/20 bg-white px-4 py-3 text-sm text-ink placeholder-ink-soft/60 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-navy">Subject</label>
              <select
                value={form.subject}
                onChange={set("subject")}
                required
                className="w-full rounded-xl border border-navy/20 bg-white px-4 py-3 text-sm text-ink focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              >
                <option value="">Select a topic...</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-navy">Message</label>
              <textarea
                value={form.message}
                onChange={set("message")}
                required
                rows={6}
                placeholder="What's on your mind?"
                className="w-full resize-none rounded-xl border border-navy/20 bg-white px-4 py-3 text-sm text-ink placeholder-ink-soft/60 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-navy px-6 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:bg-navy-dark disabled:opacity-50 disabled:translate-y-0"
            >
              {submitting ? "Sending..." : "Send message"}
            </button>
          </form>
        )}
      </div>
    </>
  );
};

ContactPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export default ContactPage;
