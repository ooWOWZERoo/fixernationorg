import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { TB_GAME_REGISTRY } from "@/lib/tuneBrain/registry";
import type { NextPageWithLayout } from "@/types/next";

interface OptionDraft {
  label: string;
  isCorrectOrBest: boolean;
  explanation: string;
}

interface ContentData {
  id: string;
  gameKey: string;
  category: string | null;
  difficulty: number | null;
  prompt: string;
  payload: Record<string, unknown>;
  status: string;
  validationStatus: string;
  validationNotes: string | null;
  sessionCount: number;
  options: OptionDraft[];
}

interface Props { item: ContentData }

interface ValidationResult { passed: boolean; notes: string[] }

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-navy/8 text-navy",
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-slate-100 text-slate-500",
  REJECTED: "bg-red-100 text-red-700",
};

const EditTuneBrainContentPage: NextPageWithLayout<Props> = ({ item: initial }) => {
  const router = useRouter();
  const gameDef = TB_GAME_REGISTRY[initial.gameKey];
  const isScenario = gameDef?.kind === "SCENARIO";
  const isCalmFocus = gameDef?.kind === "CALM_FOCUS";

  const [category, setCategory] = useState(initial.category ?? "");
  const [difficulty, setDifficulty] = useState<number>(initial.difficulty ?? 1);
  const [prompt, setPrompt] = useState(initial.prompt);
  const [payloadText, setPayloadText] = useState(JSON.stringify(initial.payload ?? {}, null, 2));
  const [options, setOptions] = useState<OptionDraft[]>(
    initial.options.length > 0
      ? initial.options
      : [
          { label: "", isCorrectOrBest: true, explanation: "" },
          { label: "", isCorrectOrBest: false, explanation: "" },
          { label: "", isCorrectOrBest: false, explanation: "" },
          { label: "", isCorrectOrBest: false, explanation: "" },
        ]
  );

  const [status, setStatus] = useState(initial.status);
  const [validationStatus, setValidationStatus] = useState(initial.validationStatus);
  const [validationNotes, setValidationNotes] = useState(initial.validationNotes);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<ValidationResult | null>(null);

  const validOptions = useMemo(() => options.filter((o) => o.label.trim().length > 0), [options]);

  function updateOption(idx: number, patch: Partial<OptionDraft>) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
    setSaved(false);
    setDryRunResult(null);
  }

  function setBestOption(idx: number) {
    setOptions((prev) => prev.map((o, i) => ({ ...o, isCorrectOrBest: i === idx })));
    setSaved(false);
    setDryRunResult(null);
  }

  async function handleRunValidation() {
    setChecking(true);
    try {
      const r = await fetch("/api/admin/tune-your-brain/content/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          options: isScenario ? validOptions.map((o) => ({ label: o.label, explanation: o.explanation })) : [],
        }),
      });
      setDryRunResult(await r.json());
    } finally {
      setChecking(false);
    }
  }

  async function saveWithBody(body: Record<string, unknown>) {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const r = await fetch(`/api/admin/tune-your-brain/content/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  async function handleSave() {
    if (isScenario && validOptions.length < 2) {
      setError("Add at least 2 answer options for this game.");
      return;
    }
    if (isScenario && !validOptions.some((o) => o.isCorrectOrBest)) {
      setError("Mark one option as the best/correct answer.");
      return;
    }
    let payload: Record<string, unknown> | undefined;
    if (isCalmFocus) {
      try {
        payload = JSON.parse(payloadText);
      } catch {
        setError("Payload must be valid JSON.");
        return;
      }
    }
    await saveWithBody({
      category: category.trim() || null,
      difficulty: gameDef?.supportsDifficulty ? difficulty : null,
      prompt: prompt.trim(),
      ...(payload !== undefined && { payload }),
      ...(isScenario && {
        options: validOptions.map((o) => ({
          label: o.label.trim(),
          isCorrectOrBest: o.isCorrectOrBest,
          explanation: o.explanation.trim() || undefined,
        })),
      }),
    });
  }

  async function handleStatusChange(newStatus: string) {
    await saveWithBody({ status: newStatus });
  }

  async function handleDelete() {
    if (!confirm("Delete this content item? This cannot be undone.")) return;
    const r = await fetch(`/api/admin/tune-your-brain/content/${initial.id}`, { method: "DELETE" });
    if (r.ok) router.push("/admin/tune-your-brain/content");
    else {
      const data = await r.json();
      alert(data.error ?? "Delete failed.");
    }
  }

  return (
    <>
      <Head><title>Edit content — Tune Your Brain — Admin</title></Head>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/admin/tune-your-brain/content" className="text-sm text-ink-soft hover:text-navy">← Tune Your Brain</Link>
        <span className="text-ink-soft/40">/</span>
        <span className="text-sm text-ink-soft">{gameDef?.label ?? initial.gameKey}</span>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT}`}>
          {status.charAt(0) + status.slice(1).toLowerCase()}
        </span>
        <span className="text-xs text-ink-soft">
          {validationStatus === "PASSED" ? "Validation: Passed" : validationStatus === "FAILED" ? "Not Eligible for Publishing" : "Validation pending"}
        </span>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleSave} disabled={saving}
          className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50">
          {saving ? "Saving…" : "Save changes"}
        </button>

        {status === "DRAFT" && validationStatus === "PASSED" && (
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
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft">Content</h2>
          <div>
            <label className="block text-sm font-semibold text-navy mb-1">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); setSaved(false); setDryRunResult(null); }}
              rows={3}
              className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-navy mb-1">Category</label>
              <input
                value={category}
                onChange={(e) => { setCategory(e.target.value); setSaved(false); }}
                className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
            {gameDef?.supportsDifficulty && (
              <div>
                <label className="block text-sm font-semibold text-navy mb-1">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => { setDifficulty(Number(e.target.value)); setSaved(false); }}
                  className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
                >
                  <option value={1}>1 — Easier</option>
                  <option value={2}>2 — Medium</option>
                  <option value={3}>3 — Harder</option>
                </select>
              </div>
            )}
          </div>

          {isScenario && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-navy">Answer options</label>
              <div className="space-y-3">
                {options.map((opt, idx) => (
                  <div key={idx} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="bestOption"
                        checked={opt.isCorrectOrBest}
                        onChange={() => setBestOption(idx)}
                        className="mt-2"
                        aria-label={`Mark option ${idx + 1} as best`}
                      />
                      <div className="flex-1 space-y-2">
                        <input
                          value={opt.label}
                          onChange={(e) => updateOption(idx, { label: e.target.value })}
                          placeholder={`Option ${idx + 1} text`}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                        />
                        {opt.isCorrectOrBest && (
                          <textarea
                            value={opt.explanation}
                            onChange={(e) => updateOption(idx, { explanation: e.target.value })}
                            rows={2}
                            placeholder="Explanation shown after answering (best option only)"
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isCalmFocus && (
            <div>
              <label className="block text-sm font-semibold text-navy mb-1">Mode config (JSON)</label>
              <textarea
                value={payloadText}
                onChange={(e) => { setPayloadText(e.target.value); setSaved(false); }}
                rows={5}
                className="w-full rounded-lg border border-navy/15 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">Content safety validation</p>
              <button type="button" onClick={handleRunValidation} disabled={checking}
                className="rounded-lg border border-navy/15 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-white disabled:opacity-50">
                {checking ? "Checking…" : "Run validation"}
              </button>
            </div>
            {dryRunResult ? (
              <p className={`mt-2 text-sm font-semibold ${dryRunResult.passed ? "text-green-700" : "text-red-600"}`}>
                {dryRunResult.passed ? "Validation: Passed" : "Not Eligible for Publishing"}
                {!dryRunResult.passed && dryRunResult.notes.length > 0 && (
                  <span className="mt-1 block text-xs font-normal text-red-500">{dryRunResult.notes.join("; ")}</span>
                )}
              </p>
            ) : validationNotes ? (
              <p className="mt-2 text-xs text-ink-soft">Last known issue(s): {validationNotes}</p>
            ) : null}
          </div>
        </div>

        {initial.sessionCount === 0 ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-red-400">Danger zone</h2>
            <button type="button" onClick={handleDelete}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100">
              Delete this content item
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-navy/8 bg-white p-5">
            <p className="text-sm text-ink-soft">This content has {initial.sessionCount} play{initial.sessionCount !== 1 ? "s" : ""} on record and can't be deleted. Set it to Inactive instead.</p>
          </div>
        )}
      </div>
    </>
  );
};

EditTuneBrainContentPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.adminRole || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: "/signin", permanent: false } };
  }

  const { id } = ctx.params as { id: string };
  const item = await db.tbContentItem.findUnique({
    where: { id },
    include: {
      options: { orderBy: { order: "asc" } },
      _count: { select: { sessions: true } },
    },
  });
  if (!item) return { notFound: true };

  return {
    props: {
      item: {
        id: item.id,
        gameKey: item.gameKey,
        category: item.category,
        difficulty: item.difficulty,
        prompt: item.prompt,
        payload: (item.payload ?? {}) as Record<string, unknown>,
        status: item.status,
        validationStatus: item.validationStatus,
        validationNotes: item.validationNotes,
        sessionCount: item._count.sessions,
        options: item.options.map((o) => ({
          label: o.label,
          isCorrectOrBest: o.isCorrectOrBest,
          explanation: o.explanation ?? "",
        })),
      } satisfies ContentData,
    },
  };
};

export default EditTuneBrainContentPage;
