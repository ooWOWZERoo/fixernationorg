import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { BadgeFrame } from "@/components/tuneBrain/BadgeFrame";
import { TB_GAME_REGISTRY } from "@/lib/tuneBrain/registry";
import type { NextPageWithLayout } from "@/types/next";

interface BadgeRow {
  id: string;
  key: string;
  gameKey: string | null;
  name: string;
  tier: string | null;
  iconKey: string;
  sortOrder: number;
  pointsReward: number;
  isActive: boolean;
  earnedCount: number;
}

interface Props { badges: BadgeRow[] }

const AdminTuneBrainBadgesPage: NextPageWithLayout<Props> = ({ badges }) => {
  const [gameFilter, setGameFilter] = useState("ALL");

  const games = Array.from(new Set(badges.map((b) => b.gameKey).filter((g): g is string => !!g)));
  const visible = badges.filter((b) => {
    if (gameFilter === "ALL") return true;
    if (gameFilter === "CROSS_GAME") return b.gameKey === null;
    return b.gameKey === gameFilter;
  });

  return (
    <>
      <Head><title>Badges — Tune Your Brain — Admin</title></Head>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/tune-your-brain/content" className="text-sm text-slate-500 no-underline hover:text-navy">
            ← Tune Your Brain
          </Link>
          <h1 className="mt-2 text-2xl font-extrabold text-navy">Badges</h1>
          <p className="mt-1 text-sm text-ink-soft">{badges.length} badge{badges.length !== 1 ? "s" : ""} configured.</p>
        </div>
        <Link
          href="/admin/tune-your-brain/badges/new"
          className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark no-underline hover:bg-amber-dark"
        >
          + New badge
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setGameFilter("ALL")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
            gameFilter === "ALL" ? "bg-navy text-white" : "border border-navy/15 text-ink-soft hover:bg-cream-panel"
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setGameFilter("CROSS_GAME")}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
            gameFilter === "CROSS_GAME" ? "bg-navy text-white" : "border border-navy/15 text-ink-soft hover:bg-cream-panel"
          }`}
        >
          Cross-game
        </button>
        {games.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGameFilter(g)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
              gameFilter === g ? "bg-navy text-white" : "border border-navy/15 text-ink-soft hover:bg-cream-panel"
            }`}
          >
            {TB_GAME_REGISTRY[g]?.label ?? g}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
          <p className="text-sm text-ink-soft">No badges match this filter.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Badge</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Key</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Game</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tier</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Points</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Earned</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Active</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <BadgeFrame iconKey={b.iconKey} name={b.name} tier={b.tier} state={b.isActive ? "earned" : "locked"} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{b.key}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{b.gameKey ? (TB_GAME_REGISTRY[b.gameKey]?.label ?? b.gameKey) : "Cross-game"}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{b.tier ?? "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{b.pointsReward}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{b.earnedCount}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${b.isActive ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"}`}>
                        {b.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/tune-your-brain/badges/${b.id}`} className="text-sm font-medium text-navy no-underline hover:text-navy-dark">
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

AdminTuneBrainBadgesPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.adminRole || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(ctx.resolvedUrl)}`, permanent: false } };
  }

  const badges = await db.tbBadge.findMany({
    orderBy: [{ gameKey: "asc" }, { sortOrder: "asc" }],
    include: { _count: { select: { userBadges: true } } },
  });

  return {
    props: {
      badges: badges.map((b) => ({
        id: b.id,
        key: b.key,
        gameKey: b.gameKey,
        name: b.name,
        tier: b.tier,
        iconKey: b.iconKey,
        sortOrder: b.sortOrder,
        pointsReward: b.pointsReward,
        isActive: b.isActive,
        earnedCount: b._count.userBadges,
      })),
    },
  };
};

export default AdminTuneBrainBadgesPage;
