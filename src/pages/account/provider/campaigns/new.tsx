import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { useRouter } from "next/router";
import { authOptions } from "@/lib/auth";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const NewProviderCampaignPage: NextPageWithLayout = () => {
  const router = useRouter();
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [fromName, setFromName] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [textBody, setTextBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/provider/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          subject,
          fromName,
          htmlBody,
          textBody: textBody || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        router.push(`/account/provider/campaigns/${(data.campaign as { id: string }).id}`);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>New campaign — Fixer Nation</title>
      </Head>

      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-2xl">

          <div className="mb-2 flex flex-wrap items-center gap-3">
            <Link href="/account/provider/campaigns" className="text-sm font-semibold text-ink-soft no-underline hover:text-navy">
              ← My campaigns
            </Link>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-navy">Create a campaign</h1>
          <p className="mt-1 text-sm text-ink-soft">
            This goes to all your contacts. Save it as a draft, then send when you're ready.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">

            <div className="rounded-2xl border border-navy/8 bg-white p-6 space-y-5">
              <div>
                <label className="mb-1 block text-sm font-bold text-navy">Campaign name</label>
                <p className="mb-2 text-xs text-ink-soft">Internal only — your contacts won't see this.</p>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={200}
                  placeholder="e.g. August newsletter"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-navy">From name</label>
                <p className="mb-2 text-xs text-ink-soft">Who this email appears to come from. Sent via the Fixer Nation platform.</p>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  required
                  maxLength={100}
                  placeholder="e.g. Sarah at Smith Financial"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-navy">Subject line</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  maxLength={200}
                  placeholder="What's this email about?"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-navy/8 bg-white p-6 space-y-5">
              <div>
                <label className="mb-1 block text-sm font-bold text-navy">Email body (HTML)</label>
                <p className="mb-2 text-xs text-ink-soft">Paste or write HTML for your email. A footer with your name and an unsubscribe note is added automatically.</p>
                <textarea
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  required
                  rows={12}
                  placeholder="<p>Hi there,</p><p>Here's what I wanted to share...</p>"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-mono focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-bold text-navy">Plain text version <span className="font-normal text-ink-soft">(optional)</span></label>
                <p className="mb-2 text-xs text-ink-soft">For email clients that don't render HTML. If left blank, the subject line is used as a fallback.</p>
                <textarea
                  value={textBody}
                  onChange={(e) => setTextBody(e.target.value)}
                  rows={6}
                  placeholder="Hi there, here's what I wanted to share..."
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-mono focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm font-semibold text-red-600">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-navy px-6 py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save as draft"}
              </button>
              <Link
                href="/account/provider/campaigns"
                className="rounded-xl border border-navy/15 px-6 py-2.5 text-sm font-bold text-ink-soft no-underline hover:bg-cream-panel"
              >
                Cancel
              </Link>
            </div>

          </form>
        </div>
      </section>
    </>
  );
};

NewProviderCampaignPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default NewProviderCampaignPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) {
    return { redirect: { destination: `/signin?callbackUrl=/account/provider/campaigns/new`, permanent: false } };
  }
  if (session.user.role !== "PROVIDER") {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }
  return { props: {} };
};
