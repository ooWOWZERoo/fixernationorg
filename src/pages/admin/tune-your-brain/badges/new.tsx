import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { BadgeFrame } from "@/components/tuneBrain/BadgeFrame";
import { TB_GAME_REGISTRY, CORE_GAME_KEYS } from "@/lib/tuneBrain/registry";
import type { NextPageWithLayout } from "@/types/next";

interface ValidationResult { passed: boolean; notes: string[] }

const TIERS = ["STARTER", "EXPLORER", "BUILDER", "CHALLENGER", "SKILLED", "ADVANCED", "CHAMPION"];

const AdminTuneBrainBadgeNew: NextPageWithLayout = () => {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [gameKey, setGameKey] = useState<string>("");
  const [tier, setTier] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconKey, setIconKey] = useState("spark");
  const [sortOrder, setSortOrder] = useState(0);
  const [pointsReward, setPointsReward] = useState(10);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  async function handleRunValidation() {
    setChecking(true);
    try {
      const res = await fetch("/api/admin/tune-your-brain/content/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: name, options: [{ label: description }] }),
      });
      setValidation(await res.json());
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tune-your-brain/badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: key.trim(),
          gameKey: gameKey || null,
          tier: tier || null,
          name: name.trim(),
          description: description.trim(),
          iconKey: iconKey.trim(),
          sortOrder,
          pointsReward,
          isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setSaving(false);
        return;
      }
      await router.push(`/admin/tune-your-brain/badges/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/admin/tune-your-brain/badges" className="text-sm text-slate-500 no-underline hover:text-navy">
          ← Badges
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">New badge</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <BadgeFrame iconKey={iconKey || "spark"} name={name || "Preview"} tier={tier || null} size="lg" />
          <p className="text-xs text-ink-soft">Live preview using the icon key below (code-first SVG, no illustration upload).</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="key">Key</label>
            <input
              id="key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. gratitude_starter"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            />
            <p className="mt-1 text-xs text-ink-soft">Lowercase letters, numbers, underscores only. Cannot be changed later.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="iconKey">Icon key</label>
            <input
              id="iconKey"
              value={iconKey}
              onChange={(e) => setIconKey(e.target.value)}
              placeholder="e.g. reframe-3 or spark"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="gameKey">Game (or cross-game)</label>
            <select
              id="gameKey"
              value={gameKey}
              onChange={(e) => setGameKey(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            >
              <option value="">Cross-game</option>
              {CORE_GAME_KEYS.map((k) => (
                <option key={k} value={k}>{TB_GAME_REGISTRY[k].label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-soft">Cannot be changed later.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="tier">Tier (optional)</label>
            <select
              id="tier"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            >
              <option value="">No tier</option>
              {TIERS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-soft">Cannot be changed later.</p>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="name">Name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => { setName(e.target.value); setValidation(null); }}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => { setDescription(e.target.value); setValidation(null); }}
            rows={2}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="pointsReward">Points reward</label>
            <input
              id="pointsReward"
              type="number"
              min={0}
              value={pointsReward}
              onChange={(e) => setPointsReward(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="sortOrder">Sort order</label>
            <input
              id="sortOrder"
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-slate-300" />
          Active (visible/awardable to members)
        </label>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Content safety validation</p>
            <button
              type="button"
              onClick={handleRunValidation}
              disabled={checking || !name.trim()}
              className="rounded-lg border border-navy/15 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-white disabled:opacity-50"
            >
              {checking ? "Checking…" : "Run validation"}
            </button>
          </div>
          {validation && (
            <p className={`mt-2 text-sm font-semibold ${validation.passed ? "text-green-700" : "text-red-600"}`}>
              {validation.passed ? "Validation: Passed" : "Not Eligible for Publishing"}
              {!validation.passed && validation.notes.length > 0 && (
                <span className="mt-1 block text-xs font-normal text-red-500">{validation.notes.join("; ")}</span>
              )}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <Link href="/admin/tune-your-brain/badges" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors"
          >
            {saving ? "Creating…" : "Create badge"}
          </button>
        </div>
      </form>
    </div>
  );
};

AdminTuneBrainBadgeNew.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session?.user?.adminRole || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }
  return { props: {} };
};

export default AdminTuneBrainBadgeNew;
