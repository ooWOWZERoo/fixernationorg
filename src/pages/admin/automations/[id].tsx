import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

// Import canvas client-only (React Flow doesn't support SSR)
const JourneyCanvas = dynamic(
  () => import("@/components/automation/JourneyCanvas").then((m) => ({ default: m.JourneyCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[620px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
        <span className="text-sm text-slate-400">Loading canvas…</span>
      </div>
    ),
  }
);

const TRIGGER_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  SIGNUP: "User signup",
  ROLE_CHANGE: "Role change",
  TAG_ADDED: "Tag added",
  APPLICATION_ACCEPTED: "Application accepted",
  GROUP_JOIN: "Group join",
  EVENT_RSVP: "Event RSVP",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-slate-100 text-slate-600",
  PAUSED: "bg-amber-100 text-amber-700",
  CANCELLED: "bg-red-100 text-red-600",
  FAILED: "bg-red-100 text-red-700",
};

type Step = {
  id: string;
  order: number;
  type: string;
  config: Record<string, unknown>;
  posX: number | null;
  posY: number | null;
};

type Template = { id: string; name: string; subject: string };

type EnrollmentRow = {
  id: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  enrolledAt: string;
  completedAt: string | null;
  nextRunAt: string | null;
  user: { id: string; email: string; name: string | null } | null;
  contact: { id: string; email: string; firstName: string | null; lastName: string | null } | null;
};

interface Props {
  journey: {
    id: string;
    name: string;
    trigger: string;
    triggerConfig: Record<string, string> | null;
    active: boolean;
    description: string | null;
    steps: Step[];
    _count: { enrollments: number };
  };
  templates: Template[];
}

const AutomationDetailPage: NextPageWithLayout<Props> = ({ journey: initial, templates }) => {
  const [journey, setJourney] = useState(initial);
  const [steps, setSteps] = useState<Step[]>(initial.steps);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaName, setMetaName] = useState(initial.name);
  const [metaDesc, setMetaDesc] = useState(initial.description ?? "");
  const [savingMeta, setSavingMeta] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [activeTab, setActiveTab] = useState<"steps" | "enrollments">("steps");
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [editingTriggerConfig, setEditingTriggerConfig] = useState(false);
  const [triggerConfigValue, setTriggerConfigValue] = useState<string>(
    initial.triggerConfig?.role ?? initial.triggerConfig?.tag ??
    initial.triggerConfig?.groupId ?? initial.triggerConfig?.eventId ?? ""
  );
  const [savingTriggerConfig, setSavingTriggerConfig] = useState(false);
  const [groupOptions, setGroupOptions] = useState<{ id: string; name: string }[]>([]);
  const [eventOptions, setEventOptions] = useState<{ id: string; title: string }[]>([]);

  const saveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMeta(true);
    const res = await fetch(`/api/admin/automations/${journey.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: metaName.trim(), description: metaDesc.trim() || null }),
    });
    if (res.ok) {
      setJourney((prev) => ({ ...prev, name: metaName.trim(), description: metaDesc.trim() || null }));
      setEditingMeta(false);
    }
    setSavingMeta(false);
  };

  const toggleActive = async () => {
    setTogglingActive(true);
    const res = await fetch(`/api/admin/automations/${journey.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !journey.active }),
    });
    if (res.ok) {
      setJourney((prev) => ({ ...prev, active: !prev.active }));
    }
    setTogglingActive(false);
  };

  const loadEnrollments = async () => {
    setLoadingEnrollments(true);
    const res = await fetch(`/api/admin/automations/enrollments?journeyId=${journey.id}`);
    if (res.ok) {
      setEnrollments(await res.json());
    }
    setLoadingEnrollments(false);
  };

  useEffect(() => {
    if (activeTab === "enrollments" && enrollments.length === 0) {
      loadEnrollments();
    }
  }, [activeTab]);

  useEffect(() => {
    if (journey.trigger === "GROUP_JOIN" && groupOptions.length === 0) {
      fetch("/api/admin/groups")
        .then((r) => r.json())
        .then((d) => setGroupOptions(Array.isArray(d.groups) ? d.groups : []))
        .catch(() => {});
    }
    if (journey.trigger === "EVENT_RSVP" && eventOptions.length === 0) {
      fetch("/api/admin/events")
        .then((r) => r.json())
        .then((d) => setEventOptions(Array.isArray(d) ? d : []))
        .catch(() => {});
    }
  }, [journey.trigger]);

  const cancelEnrollment = async (id: string) => {
    setCancellingId(id);
    const res = await fetch(`/api/admin/automations/enrollments?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    if (res.ok) {
      setEnrollments((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: "CANCELLED" } : e))
      );
    }
    setCancellingId(null);
  };

  const saveTriggerConfig = async () => {
    setSavingTriggerConfig(true);
    let newConfig: Record<string, string> | null = null;
    if (journey.trigger === "ROLE_CHANGE" && triggerConfigValue) {
      newConfig = { role: triggerConfigValue };
    } else if (journey.trigger === "TAG_ADDED" && triggerConfigValue) {
      newConfig = { tag: triggerConfigValue };
    } else if (journey.trigger === "GROUP_JOIN" && triggerConfigValue) {
      newConfig = { groupId: triggerConfigValue };
    } else if (journey.trigger === "EVENT_RSVP" && triggerConfigValue) {
      newConfig = { eventId: triggerConfigValue };
    }
    const res = await fetch(`/api/admin/automations/${journey.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ triggerConfig: newConfig }),
    });
    if (res.ok) {
      setJourney((prev) => ({ ...prev, triggerConfig: newConfig }));
      setEditingTriggerConfig(false);
    }
    setSavingTriggerConfig(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/automations" className="text-xs font-semibold text-slate-400 hover:text-slate-600">
          ← Automations
        </Link>
        <div className="mt-2 flex items-start gap-3">
          <div className="flex-1">
            {editingMeta ? (
              <form onSubmit={saveMeta} className="space-y-2">
                <input
                  autoFocus
                  value={metaName}
                  onChange={(e) => setMetaName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xl font-bold text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
                <textarea
                  rows={2}
                  value={metaDesc}
                  onChange={(e) => setMetaDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingMeta || !metaName.trim()}
                    className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90 disabled:opacity-40"
                  >
                    {savingMeta ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingMeta(false); setMetaName(journey.name); setMetaDesc(journey.description ?? ""); }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">{journey.name}</h1>
                  <button
                    onClick={() => setEditingMeta(true)}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-700"
                  >
                    Edit
                  </button>
                </div>
                <div className="mt-1 flex items-center gap-3 text-sm text-slate-500">
                  <span>Trigger: <strong className="text-slate-700">{TRIGGER_LABELS[journey.trigger] ?? journey.trigger}</strong></span>
                  <span>&bull;</span>
                  <span>{journey._count.enrollments} total enrollment{journey._count.enrollments !== 1 ? "s" : ""}</span>
                  {journey.description && (
                    <>
                      <span>&bull;</span>
                      <span className="truncate max-w-[300px]">{journey.description}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={toggleActive}
            disabled={togglingActive}
            className={[
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition-colors disabled:opacity-40",
              journey.active
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200",
            ].join(" ")}
          >
            {togglingActive ? "…" : journey.active ? "Active" : "Inactive"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-slate-200">
        {(["steps", "enrollments"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              "px-4 py-2 text-sm font-semibold capitalize transition-colors",
              activeTab === tab
                ? "border-b-2 border-navy text-navy"
                : "text-slate-500 hover:text-slate-700",
            ].join(" ")}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Steps tab */}
      {activeTab === "steps" && (
        <div>
          {/* Trigger config (configurable triggers only) */}
          {(journey.trigger === "ROLE_CHANGE" || journey.trigger === "TAG_ADDED" || journey.trigger === "GROUP_JOIN" || journey.trigger === "EVENT_RSVP") && (
            <div className="mb-4 rounded-xl border border-navy/20 bg-navy/5 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Trigger filter</span>
                  <div className="mt-0.5 text-sm text-slate-700">
                    {journey.trigger === "ROLE_CHANGE" && (
                      journey.triggerConfig?.role
                        ? <>When role changes to <strong>{journey.triggerConfig.role}</strong></>
                        : "Any role change (no filter set)"
                    )}
                    {journey.trigger === "TAG_ADDED" && (
                      journey.triggerConfig?.tag
                        ? <>When tag <strong>"{journey.triggerConfig.tag}"</strong> is added</>
                        : "Any tag added (no filter set)"
                    )}
                    {journey.trigger === "GROUP_JOIN" && (
                      journey.triggerConfig?.groupId
                        ? <>When a user joins group <strong>{groupOptions.find((g) => g.id === journey.triggerConfig?.groupId)?.name ?? journey.triggerConfig.groupId}</strong></>
                        : "Any group join (no filter set)"
                    )}
                    {journey.trigger === "EVENT_RSVP" && (
                      journey.triggerConfig?.eventId
                        ? <>When a user RSVPs to <strong>{eventOptions.find((e) => e.id === journey.triggerConfig?.eventId)?.title ?? journey.triggerConfig.eventId}</strong></>
                        : "Any event RSVP (no filter set)"
                    )}
                  </div>
                </div>
                {!editingTriggerConfig && (
                  <button
                    onClick={() => setEditingTriggerConfig(true)}
                    className="shrink-0 text-xs font-semibold text-navy hover:underline"
                  >
                    Configure
                  </button>
                )}
              </div>

              {editingTriggerConfig && (
                <div className="mt-3 border-t border-navy/10 pt-3 space-y-2">
                  {journey.trigger === "ROLE_CHANGE" ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Trigger when role changes to</label>
                      <select
                        value={triggerConfigValue}
                        onChange={(e) => setTriggerConfigValue(e.target.value)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                      >
                        <option value="">Any role change</option>
                        <option value="CONSUMER">Consumer</option>
                        <option value="MEMBER">Member</option>
                        <option value="PROVIDER">Provider</option>
                        <option value="AMBASSADOR">Ambassador</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </div>
                  ) : journey.trigger === "TAG_ADDED" ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Trigger when this tag is added</label>
                      <input
                        value={triggerConfigValue}
                        onChange={(e) => setTriggerConfigValue(e.target.value)}
                        placeholder="e.g. ambassador-prospect"
                        className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                      />
                    </div>
                  ) : journey.trigger === "GROUP_JOIN" ? (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Trigger when a user joins</label>
                      <select
                        value={triggerConfigValue}
                        onChange={(e) => setTriggerConfigValue(e.target.value)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                      >
                        <option value="">Any group</option>
                        {groupOptions.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Trigger when a user RSVPs to</label>
                      <select
                        value={triggerConfigValue}
                        onChange={(e) => setTriggerConfigValue(e.target.value)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                      >
                        <option value="">Any event</option>
                        {eventOptions.map((e) => (
                          <option key={e.id} value={e.id}>{e.title}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={saveTriggerConfig}
                      disabled={savingTriggerConfig}
                      className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90 disabled:opacity-40"
                    >
                      {savingTriggerConfig ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingTriggerConfig(false);
                        setTriggerConfigValue(journey.triggerConfig?.role ?? journey.triggerConfig?.tag ?? journey.triggerConfig?.groupId ?? journey.triggerConfig?.eventId ?? "");
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Visual canvas */}
          <JourneyCanvas
            journeyId={journey.id}
            trigger={journey.trigger}
            triggerConfig={journey.triggerConfig}
            initialSteps={steps}
            templates={templates}
            onStepsChange={setSteps}
          />
        </div>
      )}

      {/* Enrollments tab */}
      {activeTab === "enrollments" && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {loadingEnrollments ? "Loading…" : `${enrollments.length} recent enrollment${enrollments.length !== 1 ? "s" : ""}`}
            </p>
            <button
              onClick={loadEnrollments}
              className="text-xs font-semibold text-navy hover:underline"
            >
              Refresh
            </button>
          </div>

          {enrollments.length === 0 && !loadingEnrollments ? (
            <div className="rounded-xl border border-slate-200 bg-white py-12 text-center">
              <p className="text-sm font-semibold text-slate-500">No enrollments yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Person</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 sm:table-cell">Progress</th>
                    <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 md:table-cell">Next run</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrollments.map((e) => {
                    const email = e.user?.email ?? e.contact?.email ?? "—";
                    const name = e.user?.name ?? [e.contact?.firstName, e.contact?.lastName].filter(Boolean).join(" ") ?? null;
                    return (
                      <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-slate-700">{email}</div>
                          {name && <div className="text-xs text-slate-500">{name}</div>}
                        </td>
                        <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                          {e.currentStep} / {e.totalSteps} step{e.totalSteps !== 1 ? "s" : ""}
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">
                          {e.nextRunAt ? new Date(e.nextRunAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_COLORS[e.status] ?? "bg-slate-100 text-slate-600"}`}>
                            {e.status.toLowerCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {e.status === "ACTIVE" && (
                            <button
                              onClick={() => cancelEnrollment(e.id)}
                              disabled={cancellingId === e.id}
                              className="text-xs font-semibold text-red-500 hover:underline disabled:opacity-40"
                            >
                              {cancellingId === e.id ? "…" : "Cancel"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

AutomationDetailPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

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

  const { id } = context.params as { id: string };

  const journey = await db.automationJourney.findUnique({
    where: { id },
    include: {
      steps: { orderBy: { order: "asc" } },
      _count: { select: { enrollments: true } },
    },
  });

  if (!journey) return { notFound: true };

  const templates = await db.emailTemplate.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, subject: true },
  });

  return {
    props: {
      journey: {
        id: journey.id,
        name: journey.name,
        trigger: journey.trigger,
        triggerConfig: (journey.triggerConfig as Record<string, string> | null) ?? null,
        active: journey.active,
        description: journey.description,
        steps: journey.steps.map((s) => ({
          id: s.id,
          order: s.order,
          type: s.type,
          config: s.config as Record<string, unknown>,
          posX: s.posX ?? null,
          posY: s.posY ?? null,
        })),
        _count: journey._count,
      },
      templates,
    },
  };
};

export default AutomationDetailPage;
