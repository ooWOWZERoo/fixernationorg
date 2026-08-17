import Head from "next/head";
import Link from "next/link";
import { AccountNav } from "@/components/account/AccountNav";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface Props {
  initial: {
    businessName: string | null;
    specialty: string | null;
    services: string | null;
    website: string | null;
    phone: string | null;
    serviceArea: string | null;
  };
}

const BusinessProfilePage: NextPageWithLayout<Props> = ({ initial }) => {
  const [businessName, setBusinessName] = useState(initial.businessName ?? "");
  const [specialty, setSpecialty] = useState(initial.specialty ?? "");
  const [services, setServices] = useState(initial.services ?? "");
  const [website, setWebsite] = useState(initial.website ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [serviceArea, setServiceArea] = useState(initial.serviceArea ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/account/business", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName, specialty, services, website, phone, serviceArea }),
    });
    const data = await res.json();
    setMsg(res.ok ? { ok: true, text: "Profile saved." } : { ok: false, text: data.error ?? "Something went wrong." });
    setSaving(false);
  }

  return (
    <>
      <Head>
        <title>Business Profile — Fixer Nation</title>
      </Head>
      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <AccountNav />

          <p className="mt-6 text-xs font-bold uppercase tracking-widest text-amber-dark">
            Service Provider
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy">
            Your business profile
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            This is what shows up on your public provider listing. Fill in whatever&apos;s
            relevant and come back to update it anytime.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="rounded-2xl border border-navy/8 bg-white p-6 space-y-5">

              <div>
                <label className="block text-sm font-semibold text-ink mb-1">
                  Business name
                </label>
                <p className="text-xs text-ink-soft mb-1.5">The name customers would search for.</p>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Shaw Electrical Services"
                  maxLength={120}
                  className="w-full rounded-xl border border-navy/12 px-4 py-2.5 text-sm text-ink placeholder-muted focus:border-navy/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-ink mb-1">
                  Specialty
                </label>
                <p className="text-xs text-ink-soft mb-1.5">
                  One line. What you do. (e.g. Licensed Electrician, HVAC Contractor)
                </p>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  placeholder="e.g. Licensed Electrician"
                  maxLength={100}
                  className="w-full rounded-xl border border-navy/12 px-4 py-2.5 text-sm text-ink placeholder-muted focus:border-navy/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-ink mb-1">
                  Services
                </label>
                <p className="text-xs text-ink-soft mb-1.5">
                  Describe what you offer. This shows up on your listing.
                </p>
                <textarea
                  value={services}
                  onChange={(e) => setServices(e.target.value)}
                  placeholder="Panel upgrades, EV charger installation, residential rewiring..."
                  rows={4}
                  maxLength={1000}
                  className="w-full rounded-xl border border-navy/12 px-4 py-2.5 text-sm text-ink placeholder-muted focus:border-navy/30 focus:outline-none resize-none"
                />
              </div>

            </div>

            <div className="rounded-2xl border border-navy/8 bg-white p-6 space-y-5">

              <div>
                <label className="block text-sm font-semibold text-ink mb-1">Website</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                  maxLength={255}
                  className="w-full rounded-xl border border-navy/12 px-4 py-2.5 text-sm text-ink placeholder-muted focus:border-navy/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-ink mb-1">Phone</label>
                <p className="text-xs text-ink-soft mb-1.5">Shown on your public profile.</p>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 555-5555"
                  maxLength={30}
                  className="w-full rounded-xl border border-navy/12 px-4 py-2.5 text-sm text-ink placeholder-muted focus:border-navy/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-ink mb-1">Service area</label>
                <p className="text-xs text-ink-soft mb-1.5">Cities, counties, or region you serve.</p>
                <input
                  type="text"
                  value={serviceArea}
                  onChange={(e) => setServiceArea(e.target.value)}
                  placeholder="e.g. Dallas-Fort Worth metro"
                  maxLength={150}
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

BusinessProfilePage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default BusinessProfilePage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent("/account/business")}`, permanent: false } };
  }

  if (session.user.role !== "PROVIDER") {
    return { redirect: { destination: "/account", permanent: false } };
  }

  const profile = await db.providerProfile.findUnique({
    where: { userId: session.user.id },
    select: { businessName: true, specialty: true, services: true, website: true, phone: true, serviceArea: true },
  });

  return {
    props: {
      initial: {
        businessName: profile?.businessName ?? null,
        specialty: profile?.specialty ?? null,
        services: profile?.services ?? null,
        website: profile?.website ?? null,
        phone: profile?.phone ?? null,
        serviceArea: profile?.serviceArea ?? null,
      },
    },
  };
};
