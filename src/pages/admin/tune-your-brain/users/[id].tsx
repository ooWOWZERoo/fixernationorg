import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { BadgeFrame } from "@/components/tuneBrain/BadgeFrame";
import { TB_GAME_REGISTRY, CORE_GAME_KEYS } from "@/lib/tuneBrain/registry";
import { GOAL_LABELS } from "@/lib/tuneBrain/goalConstants";
import {
  RESET_SCOPES,
  RESET_SCOPE_LABELS,
  RESET_REASONS,
  RESET_REASON_LABELS,
  RESET_CONFIRMATION_WORD,
  TB_ALL_POINT_REASONS,
  TB_RESET_POINT_REASON,
  type ResetScope,
  type ResetReasonCode,
} from "@/lib/tuneBrain/resetConstants";
import type { NextPageWithLayout } from "@/types/next";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

interface PerGameRow {
  gameKey: string;
  label: string;
  tier: string;
  xp: number;
  sessionsPlayed: number;
  lastSessionAt: string | null;
}
interface BadgeRow { id: string; key: string; name: string; iconKey: string; tier: string | null; gameKey: string | null; earnedAt: string }
interface GoalRow { id: string; key: string; period: string; target: number; progress: number; status: string }
interface StreakRow { scope: string; current: number; longest: number; lastActiveDate: string }
interface SessionRow { id: string; gameKey: string; startedAt: string; completedAt: string | null }
interface ResetHistoryRow { id: string; action: string; actorEmail: string | null; metadata: unknown; createdAt: string }

interface Props {
  user: { id: string; name: string | null; email: string; role: string; adminRole: string };
  perGame: PerGameRow[];
  badges: BadgeRow[];
  goals: GoalRow[];
  streaks: StreakRow[];
  tybPoints: number;
  recentSessions: SessionRow[];
  lastActivityAt: string | null;
  resetHistory: ResetHistoryRow[];
  isSuperAdmin: boolean;
}

interface PreviewResult {
  preview: {
    sessionsAffected: number;
    badgesAffected: { key: string; name: string }[];
    pointsToReverse: number;
    goalsAffected: number;
    streaksAffected: string[];
  };
  neverTouched: string[];
}

const streakLabel = (scope: string) => (scope === "GLOBAL" ? "Overall (all games)" : TB_GAME_REGISTRY[scope]?.label ?? scope);
const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

const AdminTuneBrainUserDetailPage: NextPageWithLayout<Props> = ({
  user, perGame, badges, goals, streaks, tybPoints, recentSessions, lastActivityAt, resetHistory, isSuperAdmin,
}) => {
  const [scope, setScope] = useState<ResetScope | null>(null);
  const [gameKey, setGameKey] = useState<string>(CORE_GAME_KEYS[0]);
  const [badgeId, setBadgeId] = useState<string>(badges[0]?.id ?? "");
  const [goalId, setGoalId] = useState<string>(""); // "" = all active goals (GOAL scope only)
  const [reasonCode, setReasonCode] = useState<ResetReasonCode>("USER_REQUESTED");
  const [note, setNote] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<string | null>(null);

  const availableScopes = RESET_SCOPES.filter((s) => s !== "FULL" || isSuperAdmin);

  function resetPanelState() {
    setPreview(null);
    setConfirmText("");
    setError(null);
    setSuccessSummary(null);
  }

  function chooseScope(next: ResetScope) {
    setScope(next);
    resetPanelState();
  }

  async function fetchPreview() {
    if (!scope) return;
    setPreviewLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ userId: user.id, scope });
      if (scope === "SINGLE_GAME") params.set("gameKey", gameKey);
      if (scope === "BADGE") params.set("badgeId", badgeId);
      if (scope === "GOAL" && goalId) params.set("goalId", goalId);
      const res = await fetch(`/api/admin/tune-your-brain/reset/preview?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load preview");
        setPreview(null);
        return;
      }
      setPreview(data);
      setConfirmText("");
    } catch {
      setError("Network error loading preview");
    } finally {
      setPreviewLoading(false);
    }
  }

  const requiredConfirmation = scope === "FULL" ? user.email : RESET_CONFIRMATION_WORD;
  const confirmMatches = confirmText === requiredConfirmation;
  const noteOk = reasonCode !== "OTHER" || note.trim().length > 0;
  const canSubmit = !!preview && confirmMatches && noteOk && !submitting;

  async function submitReset() {
    if (!scope || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tune-your-brain/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          scope,
          gameKey: scope === "SINGLE_GAME" ? gameKey : undefined,
          badgeId: scope === "BADGE" ? badgeId : undefined,
          goalId: scope === "GOAL" && goalId ? goalId : undefined,
          reason: reasonCode,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Reset failed");
        return;
      }
      setSuccessSummary(data.summary);
      setPreview(null);
      setConfirmText("");
    } catch {
      setError("Network error submitting reset");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head><title>{user.name ?? user.email} — Tune Your Brain — Admin</title></Head>

      <div className="mb-6">
        <Link href="/admin/tune-your-brain/users" className="text-sm text-slate-500 no-underline hover:text-navy">
          ← Member search
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold text-navy">{user.name ?? "(no name)"}</h1>
        <p className="mt-1 text-sm text-ink-soft">{user.email} · {user.role} · Last TYB activity: {fmt(lastActivityAt)}</p>
      </div>

      {/* Per-game progress */}
      <section className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Game</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Tier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">XP</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Sessions played</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Last played</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {perGame.map((g) => (
                <tr key={g.gameKey}>
                  <td className="px-4 py-3 text-sm text-slate-700">{g.label}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{g.tier}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{g.xp}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{g.sessionsPlayed}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{fmt(g.lastSessionAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mb-8 grid gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Community Points (Tune Your Brain)</p>
          <p className="mt-1 text-2xl font-bold text-navy">{tybPoints}</p>
        </div>
        {streaks.map((s) => (
          <div key={s.scope} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{streakLabel(s.scope)} streak</p>
            <p className="mt-1 text-2xl font-bold text-navy">{s.current} <span className="text-sm font-normal text-slate-400">current</span></p>
            <p className="text-xs text-slate-400">Longest: {s.longest} · Last active {fmt(s.lastActiveDate)}</p>
          </div>
        ))}
      </div>

      {/* Badges */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-navy">Badges earned ({badges.length})</h2>
        {badges.length === 0 ? (
          <p className="text-sm text-ink-soft">No badges earned yet.</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {badges.map((b) => (
              <div key={b.id} className="flex flex-col items-center gap-1">
                <BadgeFrame iconKey={b.iconKey} name={b.name} tier={b.tier} state="earned" />
                <button
                  type="button"
                  onClick={() => { setScope("BADGE"); setBadgeId(b.id); resetPanelState(); }}
                  className="text-[11px] font-medium text-red-600 hover:underline"
                >
                  Remove badge
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Goals */}
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-navy">Active goals ({goals.length})</h2>
          {goals.length > 0 && (
            <button
              type="button"
              onClick={() => { setScope("GOAL"); setGoalId(""); resetPanelState(); }}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              Reset all active goals
            </button>
          )}
        </div>
        {goals.length === 0 ? (
          <p className="text-sm text-ink-soft">No active goals.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {goals.map((g) => (
              <li key={g.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-slate-700">{GOAL_LABELS[g.key] ?? g.key}</p>
                  <p className="text-xs text-slate-400">{g.period} · progress {g.progress}/{g.target}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setScope("GOAL"); setGoalId(g.id); resetPanelState(); }}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Reset this goal
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent sessions */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-navy">Recent session activity</h2>
        {recentSessions.length === 0 ? (
          <p className="text-sm text-ink-soft">No sessions yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Game</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Started</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentSessions.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-2 text-slate-700">{TB_GAME_REGISTRY[s.gameKey]?.label ?? s.gameKey}</td>
                      <td className="px-4 py-2 text-slate-500">{fmt(s.startedAt)}</td>
                      <td className="px-4 py-2 text-slate-500">{s.completedAt ? fmt(s.completedAt) : <span className="italic text-slate-300">in progress</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Reset panel */}
      <section className="mb-8 rounded-2xl border-2 border-red-200 bg-red-50/40 p-5">
        <h2 className="text-lg font-bold text-red-800">Reset progress</h2>
        <p className="mt-1 text-sm text-red-700">
          Resets are permanent and cannot be undone. Choose a scope, review exactly what will and won&apos;t be affected, then confirm.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {availableScopes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => chooseScope(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                scope === s ? "bg-red-600 text-white" : "border border-red-300 text-red-700 hover:bg-red-100"
              }`}
            >
              {RESET_SCOPE_LABELS[s]}
            </button>
          ))}
        </div>

        {scope && (
          <div className="mt-4 space-y-4">
            {scope === "SINGLE_GAME" && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Game</label>
                <select value={gameKey} onChange={(e) => { setGameKey(e.target.value); resetPanelState(); }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                  {CORE_GAME_KEYS.map((k) => <option key={k} value={k}>{TB_GAME_REGISTRY[k]?.label ?? k}</option>)}
                </select>
              </div>
            )}
            {scope === "BADGE" && (
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Badge</label>
                {badges.length === 0 ? (
                  <p className="text-sm text-slate-500">This member has no badges to remove.</p>
                ) : (
                  <select value={badgeId} onChange={(e) => { setBadgeId(e.target.value); resetPanelState(); }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                    {badges.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                )}
              </div>
            )}
            {scope === "GOAL" && (
              <p className="text-sm text-slate-600">
                {goalId ? `Targeting: ${GOAL_LABELS[goals.find((g) => g.id === goalId)?.key ?? ""] ?? "selected goal"}` : "Targeting: all of this member's active goals"}
              </p>
            )}
            {scope === "FULL" && (
              <p className="text-sm font-semibold text-red-700">This wipes every Tune Your Brain record for this member -- all games, all badges, all goals, all streaks.</p>
            )}

            <button
              type="button"
              onClick={fetchPreview}
              disabled={previewLoading || (scope === "BADGE" && badges.length === 0)}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-50"
            >
              {previewLoading ? "Loading preview..." : "Preview impact"}
            </button>

            {error && <p className="text-sm font-medium text-red-700">{error}</p>}

            {preview && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-bold text-slate-800">This WILL affect:</h3>
                <ul className="mt-1 list-inside list-disc text-sm text-slate-600">
                  <li>{preview.preview.sessionsAffected} game session{preview.preview.sessionsAffected === 1 ? "" : "s"}</li>
                  <li>{preview.preview.badgesAffected.length} badge{preview.preview.badgesAffected.length === 1 ? "" : "s"}{preview.preview.badgesAffected.length > 0 ? `: ${preview.preview.badgesAffected.map((b) => b.name).join(", ")}` : ""}</li>
                  <li>{preview.preview.goalsAffected} goal{preview.preview.goalsAffected === 1 ? "" : "s"}</li>
                  <li>{preview.preview.pointsToReverse} Community Point{preview.preview.pointsToReverse === 1 ? "" : "s"} reversed</li>
                  {preview.preview.streaksAffected.map((s) => <li key={s}>{s}</li>)}
                </ul>

                <h3 className="mt-3 text-sm font-bold text-slate-800">This will NOT affect:</h3>
                <ul className="mt-1 list-inside list-disc text-sm text-slate-500">
                  {preview.neverTouched.map((n) => <li key={n}>{n}</li>)}
                </ul>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Reason</label>
                    <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value as ResetReasonCode)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                      {RESET_REASONS.map((r) => <option key={r} value={r}>{RESET_REASON_LABELS[r]}</option>)}
                    </select>
                  </div>
                  {reasonCode === "OTHER" && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Note (required)</label>
                      <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                    Type {scope === "FULL" ? <code className="rounded bg-slate-100 px-1">{user.email}</code> : <code className="rounded bg-slate-100 px-1">{RESET_CONFIRMATION_WORD}</code>} to confirm
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>

                <button
                  type="button"
                  onClick={submitReset}
                  disabled={!canSubmit}
                  className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-40"
                >
                  {submitting ? "Resetting..." : "Confirm reset"}
                </button>
              </div>
            )}

            {successSummary && (
              <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm font-medium text-green-800">
                {successSummary}
                <div className="mt-2">
                  <button type="button" onClick={() => window.location.reload()} className="text-xs font-semibold text-green-700 underline">
                    Reload this member&apos;s record
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Reset history */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-navy">Reset history for this member</h2>
        {resetHistory.length === 0 ? (
          <p className="text-sm text-ink-soft">No resets have been performed for this member.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {resetHistory.map((h) => (
              <li key={h.id} className="px-4 py-3 text-sm">
                <span className="font-semibold text-slate-700">{h.action}</span>
                <span className="ml-2 text-slate-400">{fmt(h.createdAt)}</span>
                <span className="ml-2 text-slate-400">by {h.actorEmail ?? "system"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
};

AdminTuneBrainUserDetailPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.adminRole || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(ctx.resolvedUrl)}`, permanent: false } };
  }

  const id = ctx.params?.id as string;

  const targetUser = await db.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, adminRole: true } });
  if (!targetUser) return { notFound: true };

  const [levels, sessionAgg, badgeRows, goalRows, streakRows, pointsAgg, recentSessions, resetHistory] = await Promise.all([
    db.tbGameLevel.findMany({ where: { userId: id } }),
    db.tbGameSession.groupBy({
      by: ["gameKey"],
      where: { userId: id, completedAt: { not: null } },
      _count: { _all: true },
      _max: { completedAt: true },
    }),
    db.tbUserBadge.findMany({ where: { userId: id }, include: { badge: true }, orderBy: { earnedAt: "desc" } }),
    db.tbGoal.findMany({ where: { userId: id, status: "ACTIVE" } }),
    db.streak.findMany({ where: { userId: id } }),
    db.loyaltyPoint.aggregate({
      where: { userId: id, reason: { in: [...TB_ALL_POINT_REASONS, TB_RESET_POINT_REASON] } },
      _sum: { points: true },
    }),
    db.tbGameSession.findMany({ where: { userId: id }, orderBy: { startedAt: "desc" }, take: 20 }),
    db.auditLog.findMany({
      where: { resource: "User", resourceId: id, action: { startsWith: "tunebrain." } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const levelByGame = new Map<string, (typeof levels)[number]>(levels.map((l) => [l.gameKey as string, l]));
  const aggByGame = new Map<string, (typeof sessionAgg)[number]>(sessionAgg.map((a) => [a.gameKey as string, a]));

  const perGame: PerGameRow[] = CORE_GAME_KEYS.map((gameKey) => {
    const level = levelByGame.get(gameKey);
    const agg = aggByGame.get(gameKey);
    return {
      gameKey,
      label: TB_GAME_REGISTRY[gameKey]?.label ?? gameKey,
      tier: level?.tier ?? "STARTER",
      xp: level?.xp ?? 0,
      sessionsPlayed: agg?._count._all ?? 0,
      lastSessionAt: agg?._max.completedAt ? agg._max.completedAt.toISOString() : null,
    };
  });

  const lastActivityAt = sessionAgg.reduce<Date | null>((max, a) => {
    if (!a._max.completedAt) return max;
    return !max || a._max.completedAt > max ? a._max.completedAt : max;
  }, null);

  return {
    props: JSON.parse(JSON.stringify({
      user: targetUser,
      perGame,
      badges: badgeRows.map((b) => ({ id: b.badgeId, key: b.badge.key, name: b.badge.name, iconKey: b.badge.iconKey, tier: b.badge.tier, gameKey: b.badge.gameKey, earnedAt: b.earnedAt })),
      goals: goalRows.map((g) => ({ id: g.id, key: g.key, period: g.period, target: g.target, progress: g.progress, status: g.status })),
      streaks: streakRows.map((s) => ({ scope: s.scope, current: s.current, longest: s.longest, lastActiveDate: s.lastActiveDate })),
      tybPoints: pointsAgg._sum.points ?? 0,
      recentSessions: recentSessions.map((s) => ({ id: s.id, gameKey: s.gameKey, startedAt: s.startedAt, completedAt: s.completedAt })),
      lastActivityAt,
      resetHistory: resetHistory.map((h) => ({ id: h.id, action: h.action, actorEmail: h.actorEmail, metadata: h.metadata, createdAt: h.createdAt })),
      isSuperAdmin: session.user.adminRole === "SUPER_ADMIN",
    })),
  };
};

export default AdminTuneBrainUserDetailPage;
