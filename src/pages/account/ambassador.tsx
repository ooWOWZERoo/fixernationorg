import Head from "next/head";
import Link from "next/link";
import { AccountNav } from "@/components/account/AccountNav";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateUniqueReferralCode } from "@/lib/referral";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface Props {
  initial: {
    territory: string | null;
    bio: string | null;
    website: string | null;
    phone: string | null;
    referralCode: string;
  };
  siteUrl: string;
}

const AmbassadorProfilePage: NextPageWithLayout<Props> = ({ initial, siteUrl }) => {
  const [territory, setTerritory] = useState(initial.territory ?? "");
  const [bio, setBio] = useState(initial.bio ?? "");
  const [website, setWebsite] = useState(initial.website ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const referralUrl = `${siteUrl}/register?ref=${initial.referralCode}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/account/ambassador", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ territory, bio, website, phone }),
    });
    const data = await res.json();
    setMsg(res.ok ? { ok: true, text: "Profile saved." } : { ok: false, text: data.error ?? "Something went wrong." });
    setSaving(false);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Head>
        <title>Ambassador Profile — Fixer Nation</title>
      </Head>
      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <AccountNav />

          <p className="mt-6 text-xs font-bold uppercase tracking-widest text-amber-dark">
            Brand Ambassador
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy">
            Your ambassador profile
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            This is what shows up on your public ambassador listing. Fill in whatever&apos;s useful.
          </p>

          {/* Referral link card */}
          <div className="mt-8 rounded-2xl border border-navy/8 bg-white p-6">
            <h2 className="mb-1 text-base font-extrabold text-navy">Your referral link</h2>
            <p className="mb-4 text-sm text-ink-soft">
              Share this when you tell people about Fixer Nation. Anyone who signs up through it gets counted as your referral.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-cream-panel px-3 py-2 text-sm font-mono text-navy">
                {referralUrl}
              </code>
              <button
                type="button"
                onClick={copyLink}
                className="shrink-0 rounded-lg border border-navy/15 px-4 py-2 text-sm font-semibold text-navy hover:bg-cream-panel transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              Your code: <span className="font-mono font-semibold">{initial.referralCode}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            <div className="rounded-2xl border border-navy/8 bg-white p-6 space-y-5">

              <div>
                <label className="block text-sm font-semibold text-ink mb-1" htmlFor="territory">Territory</label>
                <p className="text-xs text-ink-soft mb-1.5">
                  The area you cover. City, state, or whatever makes sense for you.
                </p>
                <input
                  id="territory"
                  type="text"
                  value={territory}
                  onChange={(e) => setTerritory(e.target.value)}
                  placeholder="e.g. Southeast Atlanta, North Georgia"
                  maxLength={100}
                  className="w-full rounded-xl border border-navy/12 px-4 py-2.5 text-sm text-ink placeholder-muted focus:border-navy/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-ink mb-1" htmlFor="bio">About you</label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell people a bit about yourself and why you joined Fixer Nation."
                  rows={4}
                  maxLength={1000}
                  className="w-full rounded-xl border border-navy/12 px-4 py-2.5 text-sm text-ink placeholder-muted focus:border-navy/30 focus:outline-none resize-none"
                />
                <p className="mt-1 text-right text-xs text-ink-soft">{bio.length}/1000</p>
              </div>

            </div>

            <div className="rounded-2xl border border-navy/8 bg-white p-6 space-y-5">

              <div>
                <label className="block text-sm font-semibold text-ink mb-1" htmlFor="website">Website</label>
                <input
                  id="website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                  maxLength={255}
                  className="w-full rounded-xl border border-navy/12 px-4 py-2.5 text-sm text-ink placeholder-muted focus:border-navy/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-ink mb-1" htmlFor="phone">Phone</label>
                <p className="text-xs text-ink-soft mb-1.5">Shown on your public profile.</p>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  maxLength={30}
                  className="w-full rounded-xl border border-navy/12 px-4 py-2.5 text-sm text-ink placeholder-muted focus:border-navy/30 focus:outline-none"
                />
              </div>

            </div>

            {msg && (
              <p className={`text-sm font-medium ${msg.ok ? "text-green-600" : "text-red-600"}`}>
                {msg.text}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-[10px] bg-navy px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-navy-dark disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
};

AmbassadorProfilePage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default AmbassadorProfilePage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent("/account/ambassador")}`, permanent: false } };
  }

  if (session.user.role !== "AMBASSADOR") {
    return { redirect: { destination: "/account", permanent: false } };
  }

  let profile = await db.ambassadorProfile.findUnique({
    where: { userId: session.user.id },
    select: { territory: true, bio: true, website: true, phone: true, referralCode: true },
  });

  if (!profile) {
    const referralCode = await generateUniqueReferralCode();
    profile = await db.ambassadorProfile.create({
      data: { userId: session.user.id, referralCode },
      select: { territory: true, bio: true, website: true, phone: true, referralCode: true },
    });
  }

  const siteUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://fixernation.org";

  return {
    props: {
      initial: {
        territory: profile.territory,
        bio: profile.bio,
        website: profile.website,
        phone: profile.phone,
        referralCode: profile.referralCode,
      },
      siteUrl,
    },
  };
};
