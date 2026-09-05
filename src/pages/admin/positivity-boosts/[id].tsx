import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { POSITIVITY_BOOST_CATEGORIES } from "@/lib/positivityBoostCategories";
import type { NextPageWithLayout } from "@/types/next";

interface AssignmentRow { id: string; displayDate: string }

interface BoostData {
  id: string;
  content: string;
  category: string;
  status: string;
  validationStatus: string;
  validationNotes: string | null;
  isFallback: boolean;
  displayCount: number;
  lastDisplayedAt: string | null;
  assignmentCount: number;
  assignments: AssignmentRow[];
}

interface Props { boost: BoostData }

interface ValidationResult { passed: boolean; notes: string[]; wordCount: number }

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-navy/8 text-navy",
  APPROVED: "bg-blue-100 text-blue-800",
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-slate-100 text-slate-500",
  REJECTED: "bg-red-100 text-red-700",
};

const EditPositivityBoostPage: NextPageWithLayout<Props> = ({ boost: initial }) => {
  const router = useRouter();
  const [content, setContent] = useState(initial.content);
  const [category, setCategory] = useState(initial.category);
  const [isFallback, setIsFallback] = useState(initial.isFallback);
  const [status, setStatus] = useState(initial.status);
  const [validationStatus, setValidationStatus] = useState(initial.validationStatus);
  const [validationNotes, setValidationNotes] = useState(initial.validationNotes);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<ValidationResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function handleRunValidation() {
    setChecking(true);
    try {
      const r = await fetch("/api/admin/positivity-boosts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
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
      const r = await fetch(`/api/admin/positivity-boosts/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), category, isFallback }),
      });
      const data = await r.json();
      if (r.ok) {
        setStatus(data.status);
        setValidationStatus(data.validationStatus);
        setValidationNotes(data.validationNotes);
        setSaved(true);
      } else {
        setError(data.error ?? "Save failed.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/positivity-boosts/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await r.json();
      if (r.ok) {
        setStatus(data.status);
        setValidationStatus(data.validationStatus);
      } else {
        setError(data.error ?? "Status change failed.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePreview() {
    setShowPreview(true);
    setPreviewLoading(true);
    try {
      const r = await fetch(`/api/admin/positivity-boosts/${initial.id}/preview`);
      const data = await r.json();
      setPreviewHtml(data.html ?? null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this message? This cannot be undone.")) return;
    const r = await fetch(`/api/admin/positivity-boosts/${initial.id}`, { method: "DELETE" });
    if (r.ok) router.push("/admin/positivity-boosts");
    else {
      const data = await r.json();
      alert(data.error ?? "Delete failed.");
    }
  }

  return (
    <>
      <Head><title>Edit message — Positivity Boost — Admin</title></Head>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/admin/positivity-boosts" className="text-sm text-ink-soft hover:text-navy">← Positivity Boost</Link>
        <span className="text-ink-soft/40">/</span>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT}`}>
          {status.charAt(0) + status.slice(1).toLowerCase()}
        </span>
        <span className="text-xs text-ink-soft">
          {validationStatus === "PASSED" ? "Positivity Validation: Passed" : validationStatus === "FAILED" ? "Not Eligible for Public Display" : "Validation pending"}
        </span>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleSave} disabled={saving}
          className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50">
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={handlePreview}
          className="rounded-xl border border-navy/15 px-4 py-2 text-sm font-medium text-navy hover:bg-cream-panel">
          Preview on homepage
        </button>

        {status === "DRAFT" && validationStatus === "PASSED" && (
          <button type="button" onClick={() => handleStatusChange("APPROVED")} disabled={saving}
            className="ml-auto rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
            Approve
          </button>
        )}
        {status === "APPROVED" && (
          <button type="button" onClick={() => handleStatusChange("ACTIVE")} disabled={saving}
            className="ml-auto rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
            Activate
          </button>
        )}
        {status === "ACTIVE" && (
          <button type="button" onClick={() => handleStatusChange("INACTIVE")} disabled={saving}
            className="ml-auto rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50">
            Deactivate
          </button>
        )}
        {status === "INACTIVE" && (
          <button type="button" onClick={() => handleStatusChange("ACTIVE")} disabled={saving}
            className="ml-auto rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
            Activate
          </button>
        )}
        {status !== "REJECTED" && (
          <button type="button" onClick={() => handleStatusChange("REJECTED")} disabled={saving}
            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
            Reject
          </button>
        )}
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {saved && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">Changes saved.</div>}

      <div className="space-y-5">
        <div className="rounded-2xl border border-navy/8 bg-white p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft">Message</h2>
          <div>
            <label className="block text-sm font-semibold text-navy mb-1">Content</label>
            <textarea
              value={content}
              onChange={(e) => { setContent(e.target.value); setSaved(false); setDryRunResult(null); }}
              rows={3}
              className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-navy mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setSaved(false); }}
                className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              >
                {POSITIVITY_BOOST_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 self-end text-sm text-navy">
              <input type="checkbox" checked={isFallback} onChange={(e) => { setIsFallback(e.target.checked); setSaved(false); }} className="rounded border-navy/30" />
              Hard-safe fallback message
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Positivity validation</p>
              <button type="button" onClick={handleRunValidation} disabled={checking}
                className="rounded-lg border border-navy/15 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-white disabled:opacity-50">
                {checking ? "Checking…" : "Run validation"}
              </button>
            </div>
            {dryRunResult ? (
              <p className={`mt-2 text-sm font-semibold ${dryRunResult.passed ? "text-green-700" : "text-red-600"}`}>
                {dryRunResult.passed ? "Positivity Validation: Passed" : "Not Eligible for Public Display"}
                {!dryRunResult.passed && dryRunResult.notes.length > 0 && (
                  <span className="mt-1 block text-xs font-normal text-red-500">{dryRunResult.notes.join("; ")}</span>
                )}
              </p>
            ) : validationNotes ? (
              <p className="mt-2 text-xs text-ink-soft">Last known issue(s): {validationNotes}</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-navy/8 bg-white p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-ink-soft">
            Display history ({initial.assignmentCount})
          </h2>
          {initial.assignments.length === 0 ? (
            <p className="text-sm text-ink-soft">Never shown on the homepage yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy/8 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">
                  <th className="py-2">Date shown</th>
                </tr>
              </thead>
              <tbody>
                {initial.assignments.map((a) => (
                  <tr key={a.id} className="border-b border-navy/5">
                    <td className="py-2 text-ink">{new Date(a.displayDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {initial.assignmentCount === 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-red-400">Danger zone</h2>
            <button type="button" onClick={handleDelete}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100">
              Delete this message
            </button>
          </div>
        )}
      </div>

      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowPreview(false)}>
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-navy/8 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-navy/8 px-5 py-4">
              <h3 className="text-sm font-bold text-navy">Homepage preview</h3>
              <button type="button" onClick={() => setShowPreview(false)} className="rounded-lg border border-navy/15 px-3 py-1 text-xs text-ink-soft hover:bg-cream-panel">
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-4">
              {previewLoading ? (
                <p className="py-8 text-center text-sm text-ink-soft">Loading preview…</p>
              ) : (
                <iframe
                  srcDoc={previewHtml ?? ""}
                  title="Positivity Boost preview"
                  className="mx-auto w-full max-w-xl rounded-lg border border-navy/8 bg-white"
                  style={{ minHeight: 320 }}
                  sandbox="allow-same-origin"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

EditPositivityBoostPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: "/signin", permanent: false } };
  }

  const { id } = ctx.params as { id: string };
  const boost = await db.positivityBoost.findUnique({
    where: { id },
    include: {
      assignments: { orderBy: { displayDate: "desc" } },
      _count: { select: { assignments: true } },
    },
  });
  if (!boost) return { notFound: true };

  return {
    props: {
      boost: {
        id: boost.id,
        content: boost.content,
        category: boost.category,
        status: boost.status,
        validationStatus: boost.validationStatus,
        validationNotes: boost.validationNotes,
        isFallback: boost.isFallback,
        displayCount: boost.displayCount,
        lastDisplayedAt: boost.lastDisplayedAt ? boost.lastDisplayedAt.toISOString() : null,
        assignmentCount: boost._count.assignments,
        assignments: boost.assignments.map((a) => ({ id: a.id, displayDate: a.displayDate.toISOString() })),
      } satisfies BoostData,
    },
  };
};

export default EditPositivityBoostPage;
