import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { POSITIVITY_BOOST_CATEGORIES } from "@/lib/positivityBoostCategories";
import type { NextPageWithLayout } from "@/types/next";

interface BoostRow {
  id: string;
  content: string;
  category: string;
  status: string;
  validationStatus: string;
  isFallback: boolean;
  displayCount: number;
  lastDisplayedAt: string | null;
  updatedAt: string;
}

interface Props { boosts: BoostRow[] }

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-navy/8 text-navy",
  APPROVED: "bg-blue-100 text-blue-800",
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-slate-100 text-slate-500",
  REJECTED: "bg-red-100 text-red-700",
};

const STATUSES = ["ALL", "DRAFT", "APPROVED", "ACTIVE", "INACTIVE", "REJECTED"];

const AdminPositivityBoostsPage: NextPageWithLayout<Props> = ({ boosts: initial }) => {
  const [boosts] = useState(initial);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [q, setQ] = useState("");

  const visible = boosts.filter((b) => {
    if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
    if (categoryFilter !== "ALL" && b.category !== categoryFilter) return false;
    if (q && !b.content.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <Head><title>Positivity Boost — Admin</title></Head>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy">Your Daily Positivity Boost</h1>
          <p className="mt-1 text-sm text-ink-soft">{boosts.length} message{boosts.length !== 1 ? "s" : ""} in the library.</p>
        </div>
        <Link
          href="/admin/positivity-boosts/new"
          className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark no-underline hover:bg-amber-dark"
        >
          + New message
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                statusFilter === s ? "bg-navy text-white" : "border border-navy/15 text-ink-soft hover:bg-cream-panel"
              }`}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
        >
          <option value="ALL">All categories</option>
          {POSITIVITY_BOOST_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search messages…"
          className="ml-auto w-60 rounded-lg border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
        />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
          <p className="text-sm text-ink-soft">
            {boosts.length === 0 ? "No messages yet. Create one to get started." : "No messages match your filters."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Message</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Validation</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Shown</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Last shown</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="max-w-md px-4 py-3">
                      <p className="truncate text-sm font-medium text-slate-900">{b.content}</p>
                      {b.isFallback && <span className="text-xs text-ink-soft">Fallback</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{b.category}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[b.status] ?? STATUS_STYLES.DRAFT}`}>
                        {b.status.charAt(0) + b.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {b.validationStatus === "PASSED" ? (
                        <span className="text-green-700">Passed</span>
                      ) : b.validationStatus === "FAILED" ? (
                        <span className="text-red-600">Failed</span>
                      ) : (
                        <span className="text-slate-400">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{b.displayCount}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {b.lastDisplayedAt ? new Date(b.lastDisplayedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/positivity-boosts/${b.id}`} className="text-sm font-medium text-navy no-underline hover:text-navy-dark">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
};

AdminPositivityBoostsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(ctx.resolvedUrl)}`, permanent: false } };
  }

  const boosts = await db.positivityBoost.findMany({ orderBy: { updatedAt: "desc" } });

  return {
    props: {
      boosts: boosts.map((b) => ({
        id: b.id,
        content: b.content,
        category: b.category,
        status: b.status,
        validationStatus: b.validationStatus,
        isFallback: b.isFallback,
        displayCount: b.displayCount,
        lastDisplayedAt: b.lastDisplayedAt ? b.lastDisplayedAt.toISOString() : null,
        updatedAt: b.updatedAt.toISOString(),
      })),
    },
  };
};

export default AdminPositivityBoostsPage;
