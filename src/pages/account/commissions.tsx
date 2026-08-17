import Head from "next/head";
import Link from "next/link";
import { AccountNav } from "@/components/account/AccountNav";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface EntryRow {
  id: string;
  status: string;
  sourceType: string;
  description: string | null;
  commissionAmount: number;
  currency: string;
  pendingUntil: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface AffiliateInfo {
  status: string;
  payoutCycle: string;
  payoutThreshold: number | null;
}

interface Props {
  affiliate: AffiliateInfo;
  totals: { pending: number; approved: number; paid: number };
  entries: EntryRow[];
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber/20 text-amber-dark",
  APPROVED: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  REVERSED: "bg-red-100 text-red-600",
  ON_HOLD: "bg-slate-100 text-slate-500",
  CANCELLED: "bg-slate-100 text-slate-400",
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const CommissionsPage: NextPageWithLayout<Props> = ({ affiliate, totals, entries }) => {
  const readyToPay = totals.approved;
  const belowThreshold =
    affiliate.payoutThreshold !== null && readyToPay < affiliate.payoutThreshold;

  return (
    <>
      <Head>
        <title>My Earnings — Fixer Nation</title>
      </Head>
      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-3xl">

          <AccountNav />

          <p className="mt-6 text-xs font-bold uppercase tracking-widest text-amber-dark">
            Brand Ambassador
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy">My earnings</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Commission earned from referrals and other activity. Paid out {affiliate.payoutCycle.toLowerCase()}.
          </p>

          {/* Totals */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="rounded-2xl border border-navy/8 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Pending</p>
              <p className="mt-1 text-2xl font-extrabold text-navy">{fmt(totals.pending)}</p>
              <p className="mt-0.5 text-xs text-ink-soft">In review period</p>
            </div>
            <div className="rounded-2xl border border-navy/8 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Approved</p>
              <p className="mt-1 text-2xl font-extrabold text-navy">{fmt(totals.approved)}</p>
              <p className="mt-0.5 text-xs text-ink-soft">Ready to pay out</p>
            </div>
            <div className="rounded-2xl border border-navy/8 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Paid out</p>
              <p className="mt-1 text-2xl font-extrabold text-navy">{fmt(totals.paid)}</p>
              <p className="mt-0.5 text-xs text-ink-soft">All time</p>
            </div>
          </div>

          {/* Payout info */}
          {affiliate.payoutThreshold !== null && (
            <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${belowThreshold ? "bg-amber/10 text-amber-dark" : "bg-green-50 text-green-700"}`}>
              {belowThreshold
                ? `Minimum payout is ${fmt(affiliate.payoutThreshold)}. You have ${fmt(readyToPay)} approved — ${fmt(affiliate.payoutThreshold - readyToPay)} more to go.`
                : `You've reached the ${fmt(affiliate.payoutThreshold)} payout minimum. Your approved balance will be included in the next ${affiliate.payoutCycle.toLowerCase()} payout.`}
            </div>
          )}

          {/* History */}
          <div className="mt-8">
            <h2 className="mb-4 text-sm font-extrabold uppercase tracking-widest text-ink-soft">Earnings history</h2>

            {entries.length === 0 ? (
              <div className="rounded-2xl border border-navy/8 bg-white p-8 text-center">
                <p className="text-sm text-ink-soft">No earnings recorded yet. Commissions appear here after your referrals convert.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-navy/8 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-navy/8 text-left">
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">Description</th>
                      <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-ink-soft">Amount</th>
                      <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">Status</th>
                      <th className="hidden px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-soft sm:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy/6">
                    {entries.map((e) => (
                      <tr key={e.id}>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-navy">{e.description ?? e.sourceType}</p>
                          {e.pendingUntil && e.status === "PENDING" && (
                            <p className="text-xs text-ink-soft">
                              Clears {new Date(e.pendingUntil).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </p>
                          )}
                          {e.paidAt && (
                            <p className="text-xs text-ink-soft">
                              Paid {new Date(e.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-navy">
                          {fmt(e.commissionAmount)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[e.status] ?? "bg-slate-100 text-slate-500"}`}>
                            {e.status.charAt(0) + e.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                        <td className="hidden px-5 py-3.5 text-ink-soft sm:table-cell">
                          {new Date(e.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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

CommissionsPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default CommissionsPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent("/account/commissions")}`, permanent: false } };
  }
  if (session.user.role !== "AMBASSADOR") {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }

  const res = await fetch(`${process.env.NEXTAUTH_URL}/api/account/commissions`, {
    headers: { cookie: ctx.req.headers.cookie ?? "" },
  });

  if (!res.ok) {
    return { redirect: { destination: "/account/ambassador", permanent: false } };
  }

  const data = await res.json();

  return {
    props: {
      affiliate: data.affiliate,
      totals: data.totals,
      entries: data.entries,
    },
  };
};
