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
};

type JourneyRow = {
  id: string;
  name: string;
  trigger: string;
  active: boolean;
  description: string | null;
  createdAt: string;
  _count: { steps: number; enrollments: number };
  activeEnrollments: number;
};

interface Props {
  journeys: JourneyRow[];
}

const AutomationsPage: NextPageWithLayout<Props> = ({ journeys: initial }) => {
  const [journeys, setJourneys] = useState(initial);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTrigger, setNewTrigger] = useState("APPLICATION_ACCEPTED");
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/admin/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), trigger: newTrigger, active: false }),
    });
    if (res.ok) {
      const journey = await res.json();
      window.location.href = `/admin/automations/${journey.id}`;
    }
    setCreating(false);
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

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Automation journeys</h1>
          <p className="mt-1 text-sm text-slate-500">
            {journeys.length} journey{journeys.length !== 1 ? "s" : ""} &mdash;{" "}
            {activeCount} active &mdash; {totalEnrollments} running enrollment{totalEnrollments !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90"
        >
          New journey
        </button>
      </div>

      {showNew && (
        <div className="mb-6 rounded-xl border border-navy/20 bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-slate-800">Create journey</h2>
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
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Journey</th>
                <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 sm:table-cell">Trigger</th>
                <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 md:table-cell">Steps</th>
                <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 lg:table-cell">Active</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {journeys.map((j) => (
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
                  <td className="hidden px-4 py-3 lg:table-cell">
                    <span className={j.activeEnrollments > 0 ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                      {j.activeEnrollments} running
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggleActive(j)}
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
      )}
    </div>
  );
};

AutomationsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

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

  const journeys = await db.automationJourney.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { steps: true, enrollments: true } } },
  });

  const activeEnrollmentCounts = await db.automationEnrollment.groupBy({
    by: ["journeyId"],
    where: { status: "ACTIVE" },
    _count: { id: true },
  });

  const activeMap: Record<string, number> = {};
  for (const row of activeEnrollmentCounts) {
    activeMap[row.journeyId] = row._count.id;
  }

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
      })),
    },
  };
};

export default AutomationsPage;
