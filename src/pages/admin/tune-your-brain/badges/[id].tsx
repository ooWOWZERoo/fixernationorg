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

interface BadgeData {
  id: string;
  key: string;
  gameKey: string | null;
  tier: string | null;
  name: string;
  description: string;
  iconKey: string;
  sortOrder: number;
  pointsReward: number;
  isActive: boolean;
  earnedCount: number;
}

interface Props { badge: BadgeData }

interface ValidationResult { passed: boolean; notes: string[] }

const EditTuneBrainBadgePage: NextPageWithLayout<Props> = ({ badge: initial }) => {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [sortOrder, setSortOrder] = useState(initial.sortOrder);
  const [pointsReward, setPointsReward] = useState(initial.pointsReward);
  const [isActive, setIsActive] = useState(initial.isActive);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<ValidationResult | null>(null);

  async function handleRunValidation() {
    setChecking(true);
    try {
      const r = await fetch("/api/admin/tune-your-brain/content/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: name, options: [{ label: description }] }),
      });
      setDryRunResult(await r.json());
    } finally {
      setChecking(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const r = await fetch(`/api/admin/tune-your-brain/badges/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          sortOrder,
          pointsReward,
          isActive,
        }),
      });
      const data = await r.json();
      if (r.ok) {
        setIsActive(data.isActive);
        setSaved(true);
      } else {
        setError(data.error ?? "Save failed.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head><title>Edit badge — Brain Builder — Admin</title></Head>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/admin/tune-your-brain/badges" className="text-sm text-ink-soft hover:text-navy">← Badges</Link>
        <span className="text-ink-soft/40">/</span>
        <span className="text-sm text-ink-soft">{initial.key}</span>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold ${isActive ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"}`}>
          {isActive ? "Active" : "Inactive"}
        </span>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {saved && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">Changes saved.</div>}

      <div className="space-y-5">
        <div className="rounded-2xl border border-navy/8 bg-white p-5 space-y-4">
          <div className="flex items-center gap-4">
            <BadgeFrame iconKey={initial.iconKey} name={name} tier={initial.tier} size="lg" state={isActive ? "earned" : "locked"} />
            <div className="text-xs text-ink-soft">
              <p><span className="font-semibold text-navy">Game:</span> {initial.gameKey ? (TB_GAME_REGISTRY[initial.gameKey]?.label ?? initial.gameKey) : "Cross-game"} (fixed)</p>
              <p><span className="font-semibold text-navy">Tier:</span> {initial.tier ?? "None"} (fixed)</p>
              <p><span className="font-semibold text-navy">Icon key:</span> {initial.iconKey} (fixed)</p>
              <p><span className="font-semibold text-navy">Earned by:</span> {initial.earnedCount} member{initial.earnedCount !== 1 ? "s" : ""}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setSaved(false); setDryRunResult(null); }}
              className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setSaved(false); setDryRunResult(null); }}
              rows={2}
              className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-navy mb-1">Points reward</label>
              <input
                type="number"
                min={0}
                value={pointsReward}
                onChange={(e) => { setPointsReward(Number(e.target.value)); setSaved(false); }}
                className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1">Sort order</label>
              <input
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => { setSortOrder(Number(e.target.value)); setSaved(false); }}
                className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-navy">
            <input type="checkbox" checked={isActive} onChange={(e) => { setIsActive(e.target.checked); setSaved(false); }} className="rounded border-navy/30" />
            Active (visible/awardable to members)
          </label>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Content safety validation</p>
              <button type="button" onClick={handleRunValidation} disabled={checking}
                className="rounded-lg border border-navy/15 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-white disabled:opacity-50">
                {checking ? "Checking…" : "Run validation"}
              </button>
            </div>
            {dryRunResult && (
              <p className={`mt-2 text-sm font-semibold ${dryRunResult.passed ? "text-green-700" : "text-red-600"}`}>
                {dryRunResult.passed ? "Validation: Passed" : "Not Eligible for Publishing"}
                {!dryRunResult.passed && dryRunResult.notes.length > 0 && (
                  <span className="mt-1 block text-xs font-normal text-red-500">{dryRunResult.notes.join("; ")}</span>
                )}
              </p>
            )}
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button type="button" onClick={handleSave} disabled={saving}
              className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50">
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

EditTuneBrainBadgePage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.adminRole || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: "/signin", permanent: false } };
  }

  const { id } = ctx.params as { id: string };
  const badge = await db.tbBadge.findUnique({
    where: { id },
    include: { _count: { select: { userBadges: true } } },
  });
  if (!badge) return { notFound: true };

  return {
    props: {
      badge: {
        id: badge.id,
        key: badge.key,
        gameKey: badge.gameKey,
        tier: badge.tier,
        name: badge.name,
        description: badge.description,
        iconKey: badge.iconKey,
        sortOrder: badge.sortOrder,
        pointsReward: badge.pointsReward,
        isActive: badge.isActive,
        earnedCount: badge._count.userBadges,
      } satisfies BadgeData,
    },
  };
};

export default EditTuneBrainBadgePage;
