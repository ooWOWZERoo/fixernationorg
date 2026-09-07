import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { TB_GAME_REGISTRY, CORE_GAME_KEYS } from "@/lib/tuneBrain/registry";
import type { NextPageWithLayout } from "@/types/next";

interface ContentRow {
  id: string;
  gameKey: string;
  category: string | null;
  difficulty: number | null;
  prompt: string;
  status: string;
  validationStatus: string;
  optionCount: number;
  sessionCount: number;
  updatedAt: string;
}

interface Props { items: ContentRow[] }

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-navy/8 text-navy",
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-slate-100 text-slate-500",
  REJECTED: "bg-red-100 text-red-700",
};

const STATUSES = ["ALL", "DRAFT", "ACTIVE", "INACTIVE", "REJECTED"];

const AdminTuneBrainContentPage: NextPageWithLayout<Props> = ({ items: initial }) => {
  const [items] = useState(initial);
  const [gameFilter, setGameFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [q, setQ] = useState("");

  const visible = items.filter((i) => {
    if (gameFilter !== "ALL" && i.gameKey !== gameFilter) return false;
    if (statusFilter !== "ALL" && i.status !== statusFilter) return false;
    if (q && !i.prompt.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <Head><title>Tune Your Brain — Admin</title></Head>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy">Tune Your Brain</h1>
          <p className="mt-1 text-sm text-ink-soft">{items.length} content item{items.length !== 1 ? "s" : ""} across {CORE_GAME_KEYS.length} games.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/tune-your-brain/badges"
            className="rounded-xl border border-navy/15 px-4 py-2 text-sm font-medium text-navy no-underline hover:bg-cream-panel"
          >
            Badges
          </Link>
          <Link
            href="/admin/tune-your-brain/content/new"
            className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark no-underline hover:bg-amber-dark"
          >
            + New content
          </Link>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={gameFilter}
          onChange={(e) => setGameFilter(e.target.value)}
          className="rounded-lg border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
        >
          <option value="ALL">All games</option>
          {CORE_GAME_KEYS.map((k) => (
            <option key={k} value={k}>{TB_GAME_REGISTRY[k].label}</option>
          ))}
        </select>
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
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search prompts…"
          className="ml-auto w-60 rounded-lg border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
        />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
          <p className="text-sm text-ink-soft">
            {items.length === 0 ? "No content yet. Create some to get started." : "No content matches your filters."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Prompt</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Game</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Difficulty</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Validation</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td className="max-w-md px-4 py-3">
                      <p className="truncate text-sm font-medium text-slate-900">{i.prompt}</p>
                      {i.sessionCount > 0 && <span className="text-xs text-ink-soft">{i.sessionCount} play{i.sessionCount !== 1 ? "s" : ""}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{TB_GAME_REGISTRY[i.gameKey]?.label ?? i.gameKey}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{i.category ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{i.difficulty ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[i.status] ?? STATUS_STYLES.DRAFT}`}>
                        {i.status.charAt(0) + i.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {i.validationStatus === "PASSED" ? (
                        <span className="text-green-700">Passed</span>
                      ) : i.validationStatus === "FAILED" ? (
                        <span className="text-red-600">Failed</span>
                      ) : (
                        <span className="text-slate-400">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/tune-your-brain/content/${i.id}`} className="text-sm font-medium text-navy no-underline hover:text-navy-dark">
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

AdminTuneBrainContentPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.adminRole || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(ctx.resolvedUrl)}`, permanent: false } };
  }

  const items = await db.tbContentItem.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { options: true, sessions: true } } },
  });

  return {
    props: {
      items: items.map((i) => ({
        id: i.id,
        gameKey: i.gameKey,
        category: i.category,
        difficulty: i.difficulty,
        prompt: i.prompt,
        status: i.status,
        validationStatus: i.validationStatus,
        optionCount: i._count.options,
        sessionCount: i._count.sessions,
        updatedAt: i.updatedAt.toISOString(),
      })),
    },
  };
};

export default AdminTuneBrainContentPage;
