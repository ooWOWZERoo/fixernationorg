import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTotalPoints } from "@/lib/loyalty";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

type TerritoryInfo = {
  id: string;
  name: string;
  scope: string;
  location: string | null;
};

type PromoCodeInfo = {
  code: string;
  discountType: string;
  discountValue: number;
};

type CommissionTotals = {
  pending: number;
  approved: number;
  paid: number;
};

type AmbassadorData = {
  referralCode: string | null;
  totalReferrals: number;
  convertedReferrals: number;
  affiliateStatus: string | null;
  taxOnboardingDone: boolean;
  payoutOnboardingDone: boolean;
  promoCodes: PromoCodeInfo[];
  commissionTotals: CommissionTotals;
  territories: TerritoryInfo[];
};

interface Props {
  name: string | null;
  email: string;
  role: string;
  pendingApplication: { type: "PROVIDER" | "AMBASSADOR"; submittedAt: string } | null;
  totalPoints: number;
  ambassadorData: AmbassadorData | null;
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MEMBER: "Member",
  PROVIDER: "Service Provider",
  AMBASSADOR: "Brand Ambassador",
  CONSUMER: "Consumer",
};

const AFFILIATE_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Active", color: "bg-green-100 text-green-800" },
  PENDING: { label: "Being set up", color: "bg-amber/20 text-amber-dark" },
  ON_HOLD: { label: "On hold", color: "bg-yellow-100 text-yellow-800" },
  SUSPENDED: { label: "Suspended", color: "bg-red-100 text-red-700" },
  REVOKED: { label: "Revoked", color: "bg-red-100 text-red-700" },
  CLOSED: { label: "Closed", color: "bg-gray-100 text-gray-600" },
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 rounded-lg border border-navy/15 bg-white px-3 py-1.5 text-xs font-semibold text-navy transition hover:bg-navy/5"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

function AmbassadorDashboard({ data, email }: { data: AmbassadorData; email: string }) {
  const referralLink = data.referralCode
    ? `https://fixernation.org/join?ref=${data.referralCode}`
    : null;

  const affiliateBadge = data.affiliateStatus
    ? (AFFILIATE_STATUS_LABEL[data.affiliateStatus] ?? { label: data.affiliateStatus, color: "bg-gray-100 text-gray-600" })
    : null;

  const onboardingComplete = data.taxOnboardingDone && data.payoutOnboardingDone;
  const hasCommissions = data.commissionTotals.pending > 0 || data.commissionTotals.approved > 0 || data.commissionTotals.paid > 0;

  return (
    <div className="mb-6 space-y-4">

      {/* Territory */}
      <div className="rounded-2xl border border-navy/10 bg-white p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-amber-dark">Territory</p>
        {data.territories.length === 0 ? (
          <p className="text-sm text-ink-soft">
            No territory assigned yet. Our team will reach out once that's ready.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.territories.map((t) => (
              <li key={t.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-white text-[10px] font-bold">✓</span>
                <div>
                  <p className="font-semibold text-navy">{t.name}</p>
                  <p className="text-xs text-ink-soft">
                    {t.scope.charAt(0) + t.scope.slice(1).toLowerCase()}
                    {t.location ? ` · ${t.location}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Referral tools */}
      <div className="rounded-2xl border border-navy/10 bg-white p-5">
        <div className="mb-3 flex items-center gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-dark">Referral tools</p>
          {affiliateBadge && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${affiliateBadge.color}`}>
              {affiliateBadge.label}
            </span>
          )}
        </div>

        {data.referralCode ? (
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-medium text-ink-soft">Referral code</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-navy/10 bg-cream px-3 py-2 text-sm font-mono font-bold text-navy">
                  {data.referralCode}
                </code>
                <CopyButton value={data.referralCode} />
              </div>
            </div>

            {referralLink && (
              <div>
                <p className="mb-1 text-xs font-medium text-ink-soft">Shareable link</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg border border-navy/10 bg-cream px-3 py-2 text-sm font-mono text-navy">
                    {referralLink}
                  </code>
                  <CopyButton value={referralLink} />
                </div>
              </div>
            )}

            {data.promoCodes.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-ink-soft">Promo codes</p>
                <div className="space-y-1.5">
                  {data.promoCodes.map((pc) => (
                    <div key={pc.code} className="flex items-center justify-between gap-2 rounded-lg border border-navy/8 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono font-bold text-navy">{pc.code}</code>
                        <span className="text-xs text-ink-soft">
                          {pc.discountType === "PERCENTAGE"
                            ? `${pc.discountValue}% off`
                            : `$${pc.discountValue} off`}
                        </span>
                      </div>
                      <CopyButton value={pc.code} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">
            Your referral code will appear here once your affiliate account is set up.
          </p>
        )}
      </div>

      {/* Activity */}
      <div className="rounded-2xl border border-navy/10 bg-white p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-amber-dark">Referral activity</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-extrabold text-navy">{data.totalReferrals}</p>
            <p className="mt-0.5 text-xs text-ink-soft">Total sent</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-navy">{data.convertedReferrals}</p>
            <p className="mt-0.5 text-xs text-ink-soft">Converted</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-navy">
              {data.totalReferrals > 0
                ? `${Math.round((data.convertedReferrals / data.totalReferrals) * 100)}%`
                : "—"}
            </p>
            <p className="mt-0.5 text-xs text-ink-soft">Rate</p>
          </div>
        </div>
      </div>

      {/* Commission */}
      {(hasCommissions || data.affiliateStatus) && (
        <div className="rounded-2xl border border-navy/10 bg-white p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-amber-dark">Commissions</p>

          {hasCommissions ? (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xl font-extrabold text-navy">{fmt(data.commissionTotals.pending)}</p>
                <p className="mt-0.5 text-xs text-ink-soft">Pending</p>
              </div>
              <div>
                <p className="text-xl font-extrabold text-navy">{fmt(data.commissionTotals.approved)}</p>
                <p className="mt-0.5 text-xs text-ink-soft">Ready to pay</p>
              </div>
              <div>
                <p className="text-xl font-extrabold text-navy">{fmt(data.commissionTotals.paid)}</p>
                <p className="mt-0.5 text-xs text-ink-soft">Paid out</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">No commission activity yet.</p>
          )}

          {!onboardingComplete && (
            <div className="mt-4 rounded-xl border border-amber/30 bg-amber/8 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-dark">
                Complete to receive payouts
              </p>
              <ul className="space-y-1.5">
                <li className="flex items-center gap-2 text-sm">
                  <span className={`h-4 w-4 shrink-0 rounded-full text-center text-[10px] leading-4 font-bold ${data.taxOnboardingDone ? "bg-green-500 text-white" : "bg-navy/15 text-navy"}`}>
                    {data.taxOnboardingDone ? "✓" : "1"}
                  </span>
                  <span className={data.taxOnboardingDone ? "text-ink-soft line-through" : "text-ink"}>
                    Submit tax information
                  </span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className={`h-4 w-4 shrink-0 rounded-full text-center text-[10px] leading-4 font-bold ${data.payoutOnboardingDone ? "bg-green-500 text-white" : "bg-navy/15 text-navy"}`}>
                    {data.payoutOnboardingDone ? "✓" : "2"}
                  </span>
                  <span className={data.payoutOnboardingDone ? "text-ink-soft line-through" : "text-ink"}>
                    Connect payout account
                  </span>
                </li>
              </ul>
              <p className="mt-2 text-xs text-ink-soft">
                Questions? Email{" "}
                <a href="mailto:support@fixernation.org" className="underline underline-offset-2">
                  support@fixernation.org
                </a>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Profile link */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link
          href="/account/ambassador"
          className="text-sm font-semibold text-navy underline underline-offset-2 hover:text-navy-dark"
        >
          Edit your profile →
        </Link>
        <Link
          href="/account/ambassador/materials"
          className="text-sm font-semibold text-ink-soft underline underline-offset-2 hover:text-navy"
        >
          Campaign materials →
        </Link>
        <Link
          href="/ambassadors"
          className="text-sm font-semibold text-ink-soft underline underline-offset-2 hover:text-navy"
        >
          View directory →
        </Link>
      </div>
    </div>
  );
}

const DashboardPage: NextPageWithLayout<Props> = ({ name, email, role, pendingApplication, totalPoints, ambassadorData }) => {
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const roleLabel = ROLE_LABEL[role] ?? role;

  return (
    <>
    <Head>
      <title>Dashboard — Fixer Nation</title>
    </Head>
    <div className="min-h-screen bg-cream py-12 px-4">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-navy">
            Welcome back{name ? `, ${name.split(" ")[0]}` : ""}.
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{email}</p>
        </div>

        {/* Membership card */}
        <div className="mb-6 rounded-2xl border border-navy/10 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Membership
              </p>
              <p className="mt-1 text-xl font-extrabold text-navy">{roleLabel}</p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-amber text-xl font-extrabold">
              ✓
            </span>
          </div>
        </div>

        {/* Admin shortcut */}
        {isAdmin && (
          <div className="mb-6 rounded-2xl border border-amber/40 bg-amber/8 p-5">
            <p className="text-sm font-semibold text-navy">
              You have admin access.{" "}
              <Link href="/admin" className="underline underline-offset-2 hover:text-navy-dark">
                Go to Admin Dashboard →
              </Link>
            </p>
          </div>
        )}

        {pendingApplication && (
          <div className="mb-6 rounded-2xl border border-navy/10 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-dark mb-1">
              Application pending
            </p>
            <p className="font-bold text-navy">
              Your {pendingApplication.type === "PROVIDER" ? "service provider" : "ambassador"} application is under review
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              We review every application personally. We'll email you at {email} once a decision is made.
              Submitted {new Date(pendingApplication.submittedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
            </p>
          </div>
        )}

        {role === "PROVIDER" && (
          <div className="mb-6 rounded-2xl border border-navy/10 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-dark mb-1">
              Service Provider
            </p>
            <p className="font-bold text-navy">Your business profile</p>
            <p className="mt-1 text-sm text-ink-soft">
              Add your specialty, services, and contact info so members can find you on the{" "}
              <Link href="/providers" className="underline underline-offset-2 hover:text-navy-dark">
                provider directory
              </Link>
              .
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <Link
                href="/account/business"
                className="text-sm font-semibold text-navy underline underline-offset-2 hover:text-navy-dark"
              >
                Set up your listing →
              </Link>
              <Link
                href="/account/provider/contacts"
                className="text-sm font-semibold text-ink-soft underline underline-offset-2 hover:text-navy"
              >
                My contacts →
              </Link>
              <Link
                href="/account/provider/campaigns"
                className="text-sm font-semibold text-ink-soft underline underline-offset-2 hover:text-navy"
              >
                My campaigns →
              </Link>
            </div>
          </div>
        )}

        {role === "AMBASSADOR" && ambassadorData && (
          <>
            <div className="mb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-dark">Brand Ambassador</p>
            </div>
            <AmbassadorDashboard data={ambassadorData} email={email} />
          </>
        )}

        {/* Loyalty points */}
        {totalPoints > 0 && (
          <div className="mb-6 rounded-2xl border border-navy/10 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-dark mb-1">Community points</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-extrabold text-navy">{totalPoints}</p>
              <p className="mb-0.5 text-sm text-ink-soft">pts</p>
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              Earned by showing up: posting, RSVPing, and referring people.
            </p>
          </div>
        )}

        {/* Feature tiles */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { label: "Morning Boost", desc: "One short read every morning to reset, refocus, and move forward.", href: "/morning-boost", soon: false },
            { label: "Ask The Fixer", desc: "Submit a question to our expert network.", href: "/ask-the-fixer", soon: false },
            { label: "FN Blog", desc: "Full access to all articles.", href: "/blog", soon: false },
            { label: "Resources Library", desc: "Guides, worksheets, and tools — members only.", href: "/resources", soon: false },
            { label: "Mobile App", desc: "Access Fixer Nation on the go.", soon: true },
          ].map((tile) => (
            <div
              key={tile.label}
              className="rounded-2xl border border-navy/10 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-navy">{tile.label}</p>
                {tile.soon && (
                  <span className="shrink-0 rounded-full bg-amber/20 px-2 py-0.5 text-xs font-semibold text-amber-dark">
                    Coming soon
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-ink-soft">{tile.desc}</p>
              {tile.href && (
                <Link
                  href={tile.href}
                  className="mt-3 inline-block text-xs font-semibold text-navy underline underline-offset-2 hover:text-navy-dark no-underline"
                >
                  Go →
                </Link>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
    </>
  );
};

DashboardPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }

  const [pendingApp, totalPoints] = await Promise.all([
    db.userApplication.findFirst({
      where: {
        OR: [
          { userId: session.user.id },
          { email: session.user.email ?? "" },
        ],
        status: "PENDING",
      },
      select: { type: true, createdAt: true },
    }),
    getTotalPoints(session.user.id),
  ]);

  let ambassadorData: AmbassadorData | null = null;

  if (session.user.role === "AMBASSADOR") {
    const [ambassadorProfile, affiliateAssignment, territories] = await Promise.all([
      db.ambassadorProfile.findUnique({
        where: { userId: session.user.id },
        include: {
          referrals: { select: { id: true, convertedAt: true } },
        },
      }),
      db.affiliateAssignment.findFirst({
        where: { userId: session.user.id, affiliateType: "AMBASSADOR" },
        include: {
          promoCodes: {
            where: { status: "ACTIVE" },
            select: { code: true, discountType: true, discountValue: true },
          },
          ledgerEntries: {
            select: { commissionAmount: true, status: true },
          },
        },
      }),
      db.territoryAssignment.findMany({
        where: { userId: session.user.id, status: "ACTIVE" },
        include: {
          territory: {
            select: { name: true, scope: true, county: true, city: true, state: true },
          },
        },
      }),
    ]);

    const commissionTotals: CommissionTotals = { pending: 0, approved: 0, paid: 0 };
    if (affiliateAssignment) {
      for (const entry of affiliateAssignment.ledgerEntries) {
        const amount = Number(entry.commissionAmount);
        if (entry.status === "PENDING" || entry.status === "ON_HOLD") {
          commissionTotals.pending += amount;
        } else if (entry.status === "APPROVED") {
          commissionTotals.approved += amount;
        } else if (entry.status === "PAID") {
          commissionTotals.paid += amount;
        }
      }
    }

    ambassadorData = {
      referralCode: ambassadorProfile?.referralCode ?? null,
      totalReferrals: ambassadorProfile?.referrals.length ?? 0,
      convertedReferrals: ambassadorProfile?.referrals.filter((r) => r.convertedAt !== null).length ?? 0,
      affiliateStatus: affiliateAssignment?.status ?? null,
      taxOnboardingDone: affiliateAssignment?.taxOnboardingDone ?? false,
      payoutOnboardingDone: affiliateAssignment?.payoutOnboardingDone ?? false,
      promoCodes: (affiliateAssignment?.promoCodes ?? []).map((p) => ({
        code: p.code,
        discountType: p.discountType,
        discountValue: Number(p.discountValue),
      })),
      commissionTotals,
      territories: territories.map((t) => {
        const parts = [t.territory.city, t.territory.county, t.territory.state].filter(Boolean);
        return {
          id: t.id,
          name: t.territory.name,
          scope: t.territory.scope,
          location: parts.length > 0 ? parts.join(", ") : null,
        };
      }),
    };
  }

  return {
    props: {
      name: session.user.name ?? null,
      email: session.user.email ?? "",
      role: session.user.role,
      pendingApplication: pendingApp
        ? { type: pendingApp.type as "PROVIDER" | "AMBASSADOR", submittedAt: pendingApp.createdAt.toISOString() }
        : null,
      totalPoints,
      ambassadorData,
    },
  };
};

export default DashboardPage;
