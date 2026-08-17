import Head from "next/head";
import Link from "next/link";
import { AccountNav } from "@/components/account/AccountNav";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface ReferralRow {
  id: string;
  referredUserName: string | null;
  referredUserEmail: string | null;
  convertedAt: string | null;
  createdAt: string;
}

interface Props {
  referralCode: string;
  referrals: ReferralRow[];
  siteUrl: string;
  commissionBalance: { pending: number; approved: number } | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const ReferralsPage: NextPageWithLayout<Props> = ({ referralCode, referrals, siteUrl, commissionBalance }) => {
  const referralUrl = `${siteUrl}/register?ref=${referralCode}`;
  const conversions = referrals.filter((r) => r.convertedAt !== null).length;
  const conversionRate = referrals.length > 0 ? Math.round((conversions / referrals.length) * 100) : 0;

  return (
    <>
      <Head>
        <title>My Referrals — Fixer Nation</title>
      </Head>
      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <AccountNav />

          <p className="mt-6 text-xs font-bold uppercase tracking-widest text-amber-dark">
            Brand Ambassador
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy">Your referrals</h1>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-navy/8 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Total referrals</p>
              <p className="mt-1 text-3xl font-extrabold text-navy">{referrals.length}</p>
            </div>
            <div className="rounded-2xl border border-navy/8 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Converted</p>
              <p className="mt-1 text-3xl font-extrabold text-navy">{conversions}</p>
            </div>
            <div className="rounded-2xl border border-navy/8 bg-white p-5 col-span-2 sm:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Conversion rate</p>
              <p className="mt-1 text-3xl font-extrabold text-navy">{conversionRate}%</p>
            </div>
          </div>

          {commissionBalance !== null && (
            <Link
              href="/account/commissions"
              className="mt-4 flex items-center justify-between rounded-2xl border border-navy/8 bg-white px-5 py-4 no-underline hover:border-navy/20 hover:shadow-sm transition-shadow"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Commission balance</p>
                <p className="mt-0.5 text-sm font-bold text-navy">
                  {fmt(commissionBalance.pending + commissionBalance.approved)} available
                  {commissionBalance.approved > 0 && (
                    <span className="ml-2 text-xs font-semibold text-green-700">
                      ({fmt(commissionBalance.approved)} approved)
                    </span>
                  )}
                </p>
              </div>
              <span className="text-sm font-semibold text-navy">View earnings →</span>
            </Link>
          )}

          <div className="mt-6 rounded-2xl border border-navy/8 bg-white p-6">
            <h2 className="mb-1 text-base font-extrabold text-navy">Your referral link</h2>
            <code className="mt-2 block truncate rounded-lg bg-cream-panel px-3 py-2 text-sm font-mono text-navy">
              {referralUrl}
            </code>
            <p className="mt-2 text-xs text-ink-soft">
              Code: <span className="font-mono font-semibold">{referralCode}</span>
            </p>
          </div>

          <div className="mt-6">
            <h2 className="mb-4 text-sm font-extrabold uppercase tracking-widest text-ink-soft">Referral history</h2>

            {referrals.length === 0 ? (
              <div className="rounded-2xl border border-navy/8 bg-white p-8 text-center">
                <p className="text-sm text-ink-soft">No referrals yet. Start sharing your link.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-navy/8 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy/8 text-left">
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">Name</th>
                      <th className="hidden px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft sm:table-cell">Email</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">Signed up</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy/6">
                    {referrals.map((r) => (
                      <tr key={r.id}>
                        <td className="px-5 py-3.5 font-medium text-navy">
                          {r.referredUserName ?? "—"}
                        </td>
                        <td className="hidden px-5 py-3.5 text-ink-soft sm:table-cell">
                          {r.referredUserEmail ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 text-ink-soft">
                          {r.convertedAt
                            ? new Date(r.convertedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
};

ReferralsPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default ReferralsPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent("/account/referrals")}`, permanent: false } };
  }

  if (session.user.role !== "AMBASSADOR") {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }

  const [ambassadorProfile, commissionsRes] = await Promise.all([
    db.ambassadorProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        referrals: {
          include: {
            referredUser: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    fetch(`${process.env.NEXTAUTH_URL}/api/account/commissions`, {
      headers: { cookie: ctx.req.headers.cookie ?? "" },
    }),
  ]);

  if (!ambassadorProfile) {
    return { redirect: { destination: "/account/ambassador", permanent: false } };
  }

  let commissionBalance: { pending: number; approved: number } | null = null;
  if (commissionsRes.ok) {
    const data = await commissionsRes.json();
    commissionBalance = { pending: data.totals.pending, approved: data.totals.approved };
  }

  const siteUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://fixernation.org";

  return {
    props: {
      referralCode: ambassadorProfile.referralCode,
      siteUrl,
      commissionBalance,
      referrals: ambassadorProfile.referrals.map((r) => ({
        id: r.id,
        referredUserName: r.referredUser?.name ?? null,
        referredUserEmail: r.referredUser?.email ?? null,
        convertedAt: r.convertedAt ? r.convertedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      })),
    },
  };
};
