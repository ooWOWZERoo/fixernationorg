import { useState } from "react";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

type EntryRow = {
  id: string;
  status: string;
  sourceType: string;
  description: string | null;
  grossAmount: string;
  commissionAmount: string;
  currency: string;
  approvedAt: string | null;
  pendingUntil: string | null;
  createdAt: string;
};

type AffiliateGroup = {
  affiliateId: string;
  affiliateType: string;
  userName: string | null;
  userEmail: string;
  applicationId: string | null;
  totalApproved: number;
  entries: EntryRow[];
};

type SummaryRow = {
  status: string;
  total: number;
  count: number;
};

interface Props {
  groups: AffiliateGroup[];
  summary: SummaryRow[];
}

const LEDGER_BADGE: Record<string, string> = {
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

const CommissionsPage: NextPageWithLayout<Props> = ({ groups: initialGroups, summary }) => {
  const [groups, setGroups] = useState(initialGroups);
  const [transitioning, setTransitioning] = useState<Set<string>>(new Set());
  const [batchId, setBatchId] = useState("");

  const totalApproved = groups.reduce((sum, g) => sum + g.totalApproved, 0);
  const approvedCount = groups.reduce((sum, g) => sum + g.entries.length, 0);

  const transition = async (
    entryId: string,
    action: "pay" | "approve" | "hold" | "reverse",
    extra?: Record<string, string>
  ) => {
    setTransitioning((prev) => new Set(prev).add(entryId));
    try {
      const res = await fetch(`/api/admin/commissions/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payoutBatchId: batchId.trim() || undefined, ...extra }),
      });
      if (res.ok) {
        const updated = await res.json();
        setGroups((prev) =>
          prev
            .map((g) => ({
              ...g,
              entries: g.entries.map((e) =>
                e.id === entryId ? { ...e, status: updated.status } : e
              ),
            }))
            .map((g) => ({
              ...g,
              totalApproved: g.entries
                .filter((e) => e.status === "APPROVED")
                .reduce((sum, e) => sum + parseFloat(e.commissionAmount), 0),
            }))
            .filter((g) => g.entries.some((e) => e.status === "APPROVED"))
        );
      }
    } finally {
      setTransitioning((prev) => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
    }
  };

  const payAll = async (affiliateId: string) => {
    const group = groups.find((g) => g.affiliateId === affiliateId);
    if (!group) return;
    const approvedEntries = group.entries.filter((e) => e.status === "APPROVED");
    for (const entry of approvedEntries) {
      await transition(entry.id, "pay");
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Commission payout queue</h1>
        <p className="mt-1 text-sm text-slate-500">
          {approvedCount} entries ready &middot; {fmt(totalApproved)} total approved
        </p>
      </div>

      {/* Summary bar */}
      {summary.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summary.map((s) => (
            <div key={s.status} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-lg font-extrabold text-slate-900">{fmt(s.total)}</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${LEDGER_BADGE[s.status] ?? "bg-slate-100 text-slate-500"}`}>
                  {s.status}
                </span>
                <span className="text-xs text-slate-400">{s.count} entries</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Batch ID input */}
      <div className="mb-5 flex items-center gap-3">
        <label className="text-sm font-semibold text-slate-700 shrink-0">Payout batch ID</label>
        <input
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          placeholder="Optional — e.g. AUG-2026"
          className="max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        />
        <p className="text-xs text-slate-400">Applied to all "Mark paid" actions below</p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <p className="text-sm font-semibold text-slate-500">No approved commissions to pay out.</p>
          <p className="mt-1 text-xs text-slate-400">Entries appear here once they reach Approved status.</p>
          <Link
            href="/admin/affiliates"
            className="mt-4 inline-block text-sm font-semibold text-navy underline underline-offset-2"
          >
            Go to Affiliates →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => {
            const approvedEntries = g.entries.filter((e) => e.status === "APPROVED");
            if (approvedEntries.length === 0) return null;
            return (
              <div key={g.affiliateId} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {/* Affiliate header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{g.userName ?? g.userEmail}</p>
                      <p className="text-xs text-slate-400">{g.userEmail}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${g.affiliateType === "AMBASSADOR" ? "bg-purple-100 text-purple-700" : "bg-navy/10 text-navy"}`}>
                      {g.affiliateType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-slate-800">
                      {fmt(g.totalApproved)} ready
                    </p>
                    <button
                      onClick={() => payAll(g.affiliateId)}
                      disabled={approvedEntries.some((e) => transitioning.has(e.id))}
                      className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90 disabled:opacity-40 transition-colors"
                    >
                      Pay all
                    </button>
                    <Link
                      href={`/admin/affiliates/${g.affiliateId}`}
                      className="text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-navy"
                    >
                      View affiliate
                    </Link>
                  </div>
                </div>

                {/* Entries */}
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Description</th>
                      <th className="hidden px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-500 sm:table-cell">Transaction</th>
                      <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Commission</th>
                      <th className="hidden px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500 md:table-cell">Approved</th>
                      <th className="px-4 py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {approvedEntries.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{e.description ?? e.sourceType}</p>
                          <p className="text-xs text-slate-400">{e.sourceType}</p>
                        </td>
                        <td className="hidden px-4 py-3 text-right text-slate-600 sm:table-cell">
                          {fmt(parseFloat(e.grossAmount))}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {fmt(parseFloat(e.commissionAmount))}
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">
                          {e.approvedAt ? new Date(e.approvedAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => transition(e.id, "pay")}
                              disabled={transitioning.has(e.id)}
                              className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
                            >
                              {transitioning.has(e.id) ? "…" : "Mark paid"}
                            </button>
                            <button
                              onClick={() => transition(e.id, "hold")}
                              disabled={transitioning.has(e.id)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                            >
                              Hold
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

CommissionsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

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

  // Load all non-terminal ledger entries for the summary + all APPROVED for the queue
  const [allEntries, affiliates] = await Promise.all([
    db.commissionLedger.findMany({
      where: { status: { notIn: ["CANCELLED"] } },
      select: { status: true, commissionAmount: true },
    }),
    db.affiliateAssignment.findMany({
      select: {
        id: true,
        affiliateType: true,
        user: { select: { name: true, email: true } },
        application: { select: { id: true } },
        ledgerEntries: {
          where: { status: "APPROVED" },
          orderBy: { approvedAt: "asc" },
          select: {
            id: true,
            status: true,
            sourceType: true,
            description: true,
            grossAmount: true,
            commissionAmount: true,
            currency: true,
            approvedAt: true,
            pendingUntil: true,
            createdAt: true,
          },
        },
      },
    }),
  ]);

  // Summary across all statuses
  const summaryMap: Record<string, { total: number; count: number }> = {};
  for (const e of allEntries) {
    if (!summaryMap[e.status]) summaryMap[e.status] = { total: 0, count: 0 };
    summaryMap[e.status].total += Number(e.commissionAmount);
    summaryMap[e.status].count += 1;
  }
  const STATUS_ORDER = ["APPROVED", "PENDING", "ON_HOLD", "PAID", "REVERSED"];
  const summary: SummaryRow[] = STATUS_ORDER.filter((s) => summaryMap[s]).map((s) => ({
    status: s,
    total: summaryMap[s].total,
    count: summaryMap[s].count,
  }));

  // Build affiliate groups — only those with approved entries
  const groups: AffiliateGroup[] = affiliates
    .filter((a) => a.ledgerEntries.length > 0)
    .map((a) => ({
      affiliateId: a.id,
      affiliateType: a.affiliateType,
      userName: a.user.name,
      userEmail: a.user.email,
      applicationId: a.application?.id ?? null,
      totalApproved: a.ledgerEntries.reduce((sum, e) => sum + Number(e.commissionAmount), 0),
      entries: a.ledgerEntries.map((e) => ({
        ...e,
        grossAmount: String(e.grossAmount),
        commissionAmount: String(e.commissionAmount),
        approvedAt: e.approvedAt?.toISOString() ?? null,
        pendingUntil: e.pendingUntil?.toISOString() ?? null,
        createdAt: e.createdAt.toISOString(),
      })),
    }));

  return { props: { groups, summary } };
};

export default CommissionsPage;
