import { useState, useEffect } from "react";
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

const STEP_TYPE_LABELS: Record<string, string> = {
  WAIT: "Wait",
  SEND_EMAIL: "Send email",
  ADD_TAG: "Add tag",
  WEBHOOK: "Webhook",
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

function stepSummary(step: Step): string {
  const c = step.config;
  switch (step.type) {
    case "WAIT": return `Wait ${c.days ?? 1} day${(c.days as number) !== 1 ? "s" : ""}`;
    case "SEND_EMAIL": return c.templateId ? "Email (template)" : `Email: ${(c.subject as string) || "(no subject)"}`;
    case "ADD_TAG": return `Add tag: ${(c.tag as string) || "(no tag)"}`;
    case "WEBHOOK": return `${(c.method as string) ?? "POST"} ${(c.url as string) || "(no url)"}`;
    default: return step.type;
  }
}

function StepConfigForm({
  type,
  config,
  templates,
  onChange,
}: {
  type: string;
  config: Record<string, unknown>;
  templates: Template[];
  onChange: (c: Record<string, unknown>) => void;
}) {
  if (type === "WAIT") {
    return (
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Days to wait</label>
        <input
          type="number"
          min={1}
          value={(config.days as number) ?? 1}
          onChange={(e) => onChange({ ...config, days: Math.max(1, parseInt(e.target.value) || 1) })}
          className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        />
      </div>
    );
  }

  if (type === "SEND_EMAIL") {
    const useTemplate = !!config.templateId;
    return (
      <div className="space-y-3">
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={!useTemplate}
              onChange={() => onChange({ subject: config.subject ?? "", htmlBody: config.htmlBody ?? "", textBody: config.textBody ?? "" })}
            />
            <span className="font-medium text-slate-700">Inline content</span>
          </label>
          {templates.length > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={useTemplate}
                onChange={() => onChange({ templateId: templates[0].id })}
              />
              <span className="font-medium text-slate-700">Use template</span>
            </label>
          )}
        </div>

        {useTemplate ? (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email template</label>
            <select
              value={(config.templateId as string) ?? ""}
              onChange={(e) => onChange({ ...config, templateId: e.target.value })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name} — {t.subject}</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Subject *</label>
              <input
                value={(config.subject as string) ?? ""}
                onChange={(e) => onChange({ ...config, subject: e.target.value })}
                placeholder="e.g. Welcome to Fixer Nation"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">HTML body *</label>
              <textarea
                rows={5}
                value={(config.htmlBody as string) ?? ""}
                onChange={(e) => onChange({ ...config, htmlBody: e.target.value })}
                placeholder="<p>Hi {{first_name}},</p><p>...</p>"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
              <p className="mt-1 text-xs text-slate-400">Use {"{{first_name}}"} for personalization.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Plain text (optional)</label>
              <textarea
                rows={3}
                value={(config.textBody as string) ?? ""}
                onChange={(e) => onChange({ ...config, textBody: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>
          </>
        )}
      </div>
    );
  }

  if (type === "ADD_TAG") {
    return (
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Tag to add</label>
        <input
          value={(config.tag as string) ?? ""}
          onChange={(e) => onChange({ ...config, tag: e.target.value })}
          placeholder="e.g. onboarded-provider"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        />
        <p className="mt-1 text-xs text-slate-400">Only applies to enrollments with a linked CRM contact.</p>
      </div>
    );
  }

  if (type === "WEBHOOK") {
    return (
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">URL *</label>
          <input
            value={(config.url as string) ?? ""}
            onChange={(e) => onChange({ ...config, url: e.target.value })}
            placeholder="https://example.com/webhook"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Method</label>
          <select
            value={(config.method as string) ?? "POST"}
            onChange={(e) => onChange({ ...config, method: e.target.value })}
            className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          >
            <option value="POST">POST</option>
            <option value="GET">GET</option>
          </select>
        </div>
      </div>
    );
  }

  return null;
}

const defaultConfig: Record<string, Record<string, unknown>> = {
  WAIT: { days: 1 },
  SEND_EMAIL: { subject: "", htmlBody: "" },
  ADD_TAG: { tag: "" },
  WEBHOOK: { url: "", method: "POST" },
};

const AutomationDetailPage: NextPageWithLayout<Props> = ({ journey: initial, templates }) => {
  const [journey, setJourney] = useState(initial);
  const [steps, setSteps] = useState<Step[]>(initial.steps);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaName, setMetaName] = useState(initial.name);
  const [metaDesc, setMetaDesc] = useState(initial.description ?? "");
  const [savingMeta, setSavingMeta] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState<Record<string, unknown>>({});
  const [savingStep, setSavingStep] = useState(false);
  const [deletingStep, setDeletingStep] = useState<Set<string>>(new Set());
  const [movingStep, setMovingStep] = useState<Set<string>>(new Set());
  const [addingStep, setAddingStep] = useState(false);
  const [newStepType, setNewStepType] = useState("WAIT");
  const [newStepConfig, setNewStepConfig] = useState<Record<string, unknown>>({ days: 1 });
  const [addingSaving, setAddingSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [activeTab, setActiveTab] = useState<"steps" | "enrollments">("steps");
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const startEditStep = (step: Step) => {
    setEditingStepId(step.id);
    setEditConfig({ ...step.config });
  };

  const cancelEditStep = () => {
    setEditingStepId(null);
    setEditConfig({});
  };

  const saveStep = async (stepId: string) => {
    setSavingStep(true);
    const res = await fetch("/api/admin/automations/step", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: stepId, config: editConfig }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, config: updated.config } : s)));
      setEditingStepId(null);
    }
    setSavingStep(false);
  };

  const deleteStep = async (stepId: string) => {
    if (!confirm("Remove this step?")) return;
    setDeletingStep((prev) => new Set(prev).add(stepId));
    const res = await fetch(`/api/admin/automations/step?id=${stepId}`, { method: "DELETE" });
    if (res.ok) {
      setSteps((prev) => prev.filter((s) => s.id !== stepId));
    }
    setDeletingStep((prev) => {
      const next = new Set(prev);
      next.delete(stepId);
      return next;
    });
  };

  const moveStep = async (stepId: string, direction: "move_up" | "move_down") => {
    setMovingStep((prev) => new Set(prev).add(stepId));
    const res = await fetch("/api/admin/automations/step", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: stepId, action: direction }),
    });
    if (res.ok) {
      const updated: Step[] = await res.json();
      setSteps(updated);
    }
    setMovingStep((prev) => {
      const next = new Set(prev);
      next.delete(stepId);
      return next;
    });
  };

  const addStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingSaving(true);
    const res = await fetch("/api/admin/automations/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ journeyId: journey.id, type: newStepType, config: newStepConfig }),
    });
    if (res.ok) {
      const step: Step = await res.json();
      setSteps((prev) => [...prev, step]);
      setAddingStep(false);
      setNewStepType("WAIT");
      setNewStepConfig({ days: 1 });
    }
    setAddingSaving(false);
  };

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
        <div className="space-y-3">
          {steps.length === 0 && !addingStep && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center">
              <p className="text-sm font-semibold text-slate-500">No steps yet.</p>
              <p className="mt-1 text-xs text-slate-400">Add a step below to start building the sequence.</p>
            </div>
          )}

          {steps.map((step, idx) => (
            <div key={step.id} className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-400 mr-2">
                    {STEP_TYPE_LABELS[step.type] ?? step.type}
                  </span>
                  <span className="text-sm text-slate-700">{stepSummary(step)}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => moveStep(step.id, "move_up")}
                    disabled={idx === 0 || movingStep.has(step.id)}
                    className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveStep(step.id, "move_down")}
                    disabled={idx === steps.length - 1 || movingStep.has(step.id)}
                    className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() =>
                      editingStepId === step.id ? cancelEditStep() : startEditStep(step)
                    }
                    className="rounded px-2 py-1 text-xs font-semibold text-navy hover:bg-navy/5"
                  >
                    {editingStepId === step.id ? "Cancel" : "Edit"}
                  </button>
                  <button
                    onClick={() => deleteStep(step.id)}
                    disabled={deletingStep.has(step.id)}
                    className="rounded px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-40"
                  >
                    {deletingStep.has(step.id) ? "…" : "Remove"}
                  </button>
                </div>
              </div>

              {editingStepId === step.id && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                  <StepConfigForm
                    type={step.type}
                    config={editConfig}
                    templates={templates}
                    onChange={setEditConfig}
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => saveStep(step.id)}
                      disabled={savingStep}
                      className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90 disabled:opacity-40"
                    >
                      {savingStep ? "Saving…" : "Save step"}
                    </button>
                    <button
                      onClick={cancelEditStep}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add step form */}
          {addingStep ? (
            <div className="rounded-xl border border-navy/20 bg-white p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-800">Add step</h3>
              <form onSubmit={addStep} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Step type</label>
                  <select
                    value={newStepType}
                    onChange={(e) => {
                      setNewStepType(e.target.value);
                      setNewStepConfig({ ...(defaultConfig[e.target.value] ?? {}) });
                    }}
                    className="w-48 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                  >
                    {Object.entries(STEP_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <StepConfigForm
                  type={newStepType}
                  config={newStepConfig}
                  templates={templates}
                  onChange={setNewStepConfig}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={addingSaving}
                    className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy/90 disabled:opacity-40"
                  >
                    {addingSaving ? "Adding…" : "Add step"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddingStep(false); setNewStepType("WAIT"); setNewStepConfig({ days: 1 }); }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <button
              onClick={() => setAddingStep(true)}
              className="w-full rounded-xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-400 hover:border-navy/40 hover:text-navy transition-colors"
            >
              + Add step
            </button>
          )}
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
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
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
        })),
        _count: journey._count,
      },
      templates,
    },
  };
};

export default AutomationDetailPage;
