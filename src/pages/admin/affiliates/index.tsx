import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

type AffiliateRow = {
  id: string;
  affiliateType: string;
  status: string;
  activatedAt: string | null;
  createdAt: string;
  taxOnboardingDone: boolean;
  payoutOnboardingDone: boolean;
  user: { id: string; name: string | null; email: string };
  application: { id: string; type: string } | null;
  _count: { promoCodes: number; ledgerEntries: number };
};

interface Props {
  affiliates: AffiliateRow[];
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber/20 text-amber-dark",
  ACTIVE: "bg-green-100 text-green-700",
  ON_HOLD: "bg-blue-100 text-blue-700",
  SUSPENDED: "bg-orange-100 text-orange-700",
  REVOKED: "bg-slate-100 text-slate-500",
  CLOSED: "bg-slate-100 text-slate-400",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  SUSPENDED: "Suspended",
  REVOKED: "Revoked",
  CLOSED: "Closed",
};

const AffiliatePage: NextPageWithLayout<Props> = ({ affiliates }) => {
  const byStatus = (s: string) => affiliates.filter((a) => a.status === s).length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Affiliates</h1>
        <p className="mt-1 text-sm text-slate-500">
          {affiliates.length} total &middot; {byStatus("ACTIVE")} active &middot; {byStatus("PENDING")} pending setup
        </p>
      </div>

      {affiliates.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <p className="text-sm font-semibold text-slate-500">No affiliates yet.</p>
          <p className="mt-1 text-xs text-slate-400">Affiliates are provisioned automatically when ambassador applications are accepted.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Affiliate</th>
                <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 md:table-cell">Type</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Status</th>
                <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 sm:table-cell">Setup</th>
                <th className="hidden px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500 sm:table-cell">Promo codes</th>
                <th className="hidden px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500 lg:table-cell">Commissions</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {affiliates.map((a) => {
                const setupDone = a.taxOnboardingDone && a.payoutOnboardingDone;
                const setupPartial = a.taxOnboardingDone || a.payoutOnboardingDone;
                return (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-slate-900">{a.user.name ?? a.user.email}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{a.user.email}</p>
                    </td>
                    <td className="hidden px-4 py-3.5 text-slate-600 md:table-cell">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${a.affiliateType === "AMBASSADOR" ? "bg-purple-100 text-purple-700" : "bg-navy/10 text-navy"}`}>
                        {a.affiliateType}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[a.status] ?? "bg-slate-100 text-slate-500"}`}>
                        {STATUS_LABEL[a.status] ?? a.status}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3.5 sm:table-cell">
                      {setupDone ? (
                        <span className="text-xs font-semibold text-green-600">Complete</span>
                      ) : setupPartial ? (
                        <span className="text-xs font-semibold text-amber-600">Partial</span>
                      ) : (
                        <span className="text-xs text-slate-400">Not started</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3.5 text-right text-slate-600 sm:table-cell">
                      {a._count.promoCodes}
                    </td>
                    <td className="hidden px-4 py-3.5 text-right text-slate-600 lg:table-cell">
                      {a._count.ledgerEntries}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/admin/affiliates/${a.id}`}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

AffiliatePage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  const affiliates = await db.affiliateAssignment.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      application: { select: { id: true, type: true } },
      _count: { select: { promoCodes: true, ledgerEntries: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    props: { affiliates: JSON.parse(JSON.stringify(affiliates)) },
  };
};

export default AffiliatePage;
