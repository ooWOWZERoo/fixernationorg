import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

const TRIGGER_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  SIGNUP: "User signup",
  ROLE_CHANGE: "Role change",
  TAG_ADDED: "Tag added",
  APPLICATION_ACCEPTED: "Application accepted",
  GROUP_JOIN: "Group join",
  EVENT_RSVP: "Event RSVP",
  LOYALTY_MILESTONE: "Loyalty milestone",
};

const JOURNEY_TEMPLATES = [
  {
    id: "welcome",
    name: "Welcome series",
    trigger: "SIGNUP",
    stepCount: 5,
    description: "3 emails over 4 days for new signups.",
  },
  {
    id: "loyalty_milestone",
    name: "Loyalty milestone reward",
    trigger: "LOYALTY_MILESTONE",
    stepCount: 2,
    description: "Email + tag when a member hits 100 points.",
  },
  {
    id: "event_followup",
    name: "Event follow-up",
    trigger: "EVENT_RSVP",
    stepCount: 3,
    description: "Confirmation + reminder after RSVP.",
  },
  {
    id: "member_onboarding",
    name: "New member onboarding",
    trigger: "APPLICATION_ACCEPTED",
    stepCount: 5,
    description: "4 emails over 7 days for newly accepted members.",
  },
];

type JourneyRow = {
  id: string;
  name: string;
  trigger: string;
  active: boolean;
  description: string | null;
  createdAt: string;
  _count: { steps: number; enrollments: number };
  activeEnrollments: number;
  completedLast7d: number;
  failedTotal: number;
};

type ActivityGroup = "attention" | "running" | "idle" | "inactive";

function classify(j: JourneyRow): ActivityGroup {
  if (j.failedTotal > 0) return "attention";
  if (!j.active) return "inactive";
  if (j.activeEnrollments > 0 || j.completedLast7d > 0) return "running";
  return "idle";
}

const STATUS_DOT: Record<ActivityGroup, string> = {
  attention: "bg-red-500",
  running: "bg-emerald-500",
  idle: "bg-slate-300",
  inactive: "bg-slate-200",
};

function ActivityCell({ journey }: { journey: JourneyRow }) {
  const group = classify(journey);
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[group]}`} />
      {group === "attention" ? (
        <span className="text-red-600 font-semibold">
          Needs attention &middot; {journey.failedTotal} failed
        </span>
      ) : group === "running" ? (
        <span className="text-emerald-700">
          {journey.activeEnrollments} running
          {journey.completedLast7d > 0 && ` · ${journey.completedLast7d} completed (7d)`}
        </span>
      ) : group === "idle" ? (
        <span className="text-slate-400">Idle &mdash; no activity</span>
      ) : (
        <span className="text-slate-400">Inactive</span>
      )}
    </div>
  );
}

interface Props {
  journeys: JourneyRow[];
}

const AutomationsPage: NextPageWithLayout<Props> = ({ journeys: initial }) => {
  const [journeys, setJourneys] = useState(initial);
  const [showNew, setShowNew] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState("APPLICATION_ACCEPTED");
  const [creating, setCreating] = useState(false);
  const [fromTemplate, setFromTemplate] = useState<string | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [showInactive, setShowInactive] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), trigger: newTrigger, active: false }),
      });
      if (res.ok) {
        const journey = await res.json();
        window.location.href = `/admin/automations/${journey.id}`;
        return;
      }
      const data = await res.json().catch(() => null);
      setCreateError(data?.error ?? "Could not create the journey.");
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleFromTemplate = async (templateId: string) => {
    setFromTemplate(templateId);
    const res = await fetch("/api/admin/automations/from-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    });
    if (res.ok) {
      const data = await res.json();
      window.location.href = `/admin/automations/${data.id}`;
    }
    setFromTemplate(null);
  };

  const handleToggleActive = async (journey: JourneyRow) => {
    setToggling((prev) => new Set(prev).add(journey.id));
    const res = await fetch(`/api/admin/automations/${journey.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !journey.active }),
    });
    if (res.ok) {
      setJourneys((prev) =>
        prev.map((j) => (j.id === journey.id ? { ...j, active: !j.active } : j))
      );
    }
    setToggling((prev) => {
      const next = new Set(prev);
      next.delete(journey.id);
      return next;
    });
  };

  const activeCount = journeys.filter((j) => j.active).length;
  const totalEnrollments = journeys.reduce((s, j) => s + j.activeEnrollments, 0);
  const totalCompleted7d = journeys.reduce((s, j) => s + j.completedLast7d, 0);
  const attentionJourneys = journeys.filter((j) => j.failedTotal > 0);
  const totalFailed = journeys.reduce((s, j) => s + j.failedTotal, 0);

  const grouped: Record<ActivityGroup, JourneyRow[]> = { attention: [], running: [], idle: [], inactive: [] };
  for (const j of journeys) grouped[classify(j)].push(j);
  const GROUP_ORDER: { key: ActivityGroup; label: string }[] = [
    { key: "attention", label: "Needs attention" },
    { key: "running", label: "Active — running" },
    { key: "idle", label: "Active — idle" },
  ];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Automation journeys</h1>
          <p className="mt-1 text-sm text-slate-500">
            {journeys.length} journey{journeys.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowTemplates(true); setShowNew(false); }}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            From template
          </button>
          <button
            onClick={() => { setShowNew(true); setShowTemplates(false); }}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90"
          >
            New journey
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Active journeys</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {activeCount}
            <span className="text-sm font-normal text-slate-400"> / {journeys.length}</span>
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Running now</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{totalEnrollments}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Completed (7d)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{totalCompleted7d}</p>
        </div>
        <div className={`rounded-xl border p-4 ${attentionJourneys.length > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${attentionJourneys.length > 0 ? "text-red-500" : "text-slate-400"}`}>
            Needs attention
          </p>
          <p className={`mt-1 text-2xl font-bold ${attentionJourneys.length > 0 ? "text-red-700" : "text-slate-900"}`}>
            {attentionJourneys.length}
          </p>
          {totalFailed > 0 && (
            <p className="mt-0.5 text-xs text-red-500">{totalFailed} failed enrollment{totalFailed !== 1 ? "s" : ""}</p>
          )}
        </div>
      </div>

      {showTemplates && (
        <div className="mb-6 rounded-xl border border-navy/20 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Start from a template</h2>
            <button onClick={() => setShowTemplates(false)} className="text-xs text-slate-400 hover:text-slate-600">Close</button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {JOURNEY_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => handleFromTemplate(t.id)}
                disabled={fromTemplate !== null}
                className="rounded-xl border border-slate-200 p-4 text-left hover:border-navy/30 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-navy">{t.name}</p>
                  {fromTemplate === t.id && <span className="shrink-0 text-xs text-slate-400">Creating…</span>}
                </div>
                <p className="mt-1 text-xs text-slate-500">{t.description}</p>
                <p className="mt-2 text-xs font-semibold text-slate-400">
                  {TRIGGER_LABELS[t.trigger] ?? t.trigger} · {t.stepCount} steps
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {showNew && (
        <div className="mb-6 rounded-xl border border-navy/20 bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-slate-800">Create journey</h2>
          {createError && (
            <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>
          )}
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Name *</label>
              <input
                required
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Provider welcome sequence"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>
            <div className="min-w-[200px]">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Trigger</label>
              <select
                value={newTrigger}
                onChange={(e) => setNewTrigger(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              >
                {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-40"
              >
                {creating ? "Creating…" : "Create & edit"}
              </button>
              <button
                type="button"
                onClick={() => { setShowNew(false); setNewName(""); }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {journeys.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <p className="text-sm font-semibold text-slate-500">No automation journeys yet.</p>
          <p className="mt-1 text-xs text-slate-400">Create a journey to start sending automated email sequences.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {GROUP_ORDER.map(({ key, label }) =>
            grouped[key].length === 0 ? null : (
              <div key={key}>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {label} <span className="font-normal text-slate-400">({grouped[key].length})</span>
                </h2>
                <JourneyTable rows={grouped[key]} toggling={toggling} onToggle={handleToggleActive} />
              </div>
            )
          )}

          {grouped.inactive.length > 0 && (
            <div>
              <button
                onClick={() => setShowInactive((v) => !v)}
                className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-700"
              >
                <span className={`transition-transform ${showInactive ? "rotate-90" : ""}`}>&rsaquo;</span>
                Inactive <span className="font-normal text-slate-400">({grouped.inactive.length})</span>
              </button>
              {showInactive && <JourneyTable rows={grouped.inactive} toggling={toggling} onToggle={handleToggleActive} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function JourneyTable({
  rows,
  toggling,
  onToggle,
}: {
  rows: JourneyRow[];
  toggling: Set<string>;
  onToggle: (journey: JourneyRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Journey</th>
              <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 sm:table-cell">Trigger</th>
              <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 md:table-cell">Steps</th>
              <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Activity</th>
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((j) => (
              <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/admin/automations/${j.id}`} className="font-semibold text-navy hover:underline">
                    {j.name}
                  </Link>
                  {j.description && (
                    <p className="mt-0.5 text-xs text-slate-500 truncate max-w-[280px]">{j.description}</p>
                  )}
                </td>
                <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                  {TRIGGER_LABELS[j.trigger] ?? j.trigger}
                </td>
                <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                  {j._count.steps} step{j._count.steps !== 1 ? "s" : ""}
                </td>
                <td className="px-4 py-3">
                  <ActivityCell journey={j} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onToggle(j)}
                    disabled={toggling.has(j.id)}
                    className={[
                      "rounded-full px-3 py-1 text-xs font-bold transition-colors disabled:opacity-40",
                      j.active
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                    ].join(" ")}
                  >
                    {toggling.has(j.id) ? "…" : j.active ? "Active" : "Inactive"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

AutomationsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [journeys, activeEnrollmentCounts, completedCounts, failedCounts] = await Promise.all([
    db.automationJourney.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { steps: true, enrollments: true } } },
    }),
    db.automationEnrollment.groupBy({
      by: ["journeyId"],
      where: { status: "ACTIVE" },
      _count: { id: true },
    }),
    db.automationEnrollment.groupBy({
      by: ["journeyId"],
      where: { status: "COMPLETED", completedAt: { gte: sevenDaysAgo } },
      _count: { id: true },
    }),
    db.automationEnrollment.groupBy({
      by: ["journeyId"],
      // All outstanding failures, not just the last 7 days — a failed
      // enrollment doesn't resolve itself, so it stays actionable
      // regardless of when it happened.
      where: { status: "FAILED" },
      _count: { id: true },
    }),
  ]);

  const toMap = (rows: { journeyId: string; _count: { id: number } }[]) => {
    const map: Record<string, number> = {};
    for (const row of rows) map[row.journeyId] = row._count.id;
    return map;
  };
  const activeMap = toMap(activeEnrollmentCounts);
  const completedMap = toMap(completedCounts);
  const failedMap = toMap(failedCounts);

  return {
    props: {
      journeys: journeys.map((j) => ({
        id: j.id,
        name: j.name,
        trigger: j.trigger,
        active: j.active,
        description: j.description,
        createdAt: j.createdAt.toISOString(),
        _count: j._count,
        activeEnrollments: activeMap[j.id] ?? 0,
        completedLast7d: completedMap[j.id] ?? 0,
        failedTotal: failedMap[j.id] ?? 0,
      })),
    },
  };
};

export default AutomationsPage;
