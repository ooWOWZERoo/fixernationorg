import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { TB_GAME_REGISTRY, CORE_GAME_KEYS } from "@/lib/tuneBrain/registry";
import type { NextPageWithLayout } from "@/types/next";

interface OptionDraft {
  label: string;
  isCorrectOrBest: boolean;
  explanation: string;
}

interface ValidationResult { passed: boolean; notes: string[] }

const EMPTY_OPTIONS: OptionDraft[] = [
  { label: "", isCorrectOrBest: true, explanation: "" },
  { label: "", isCorrectOrBest: false, explanation: "" },
  { label: "", isCorrectOrBest: false, explanation: "" },
  { label: "", isCorrectOrBest: false, explanation: "" },
];

const AdminTuneBrainContentNew: NextPageWithLayout = () => {
  const router = useRouter();
  const [gameKey, setGameKey] = useState<string>(CORE_GAME_KEYS[0]);
  const [category, setCategory] = useState("");
  const [difficulty, setDifficulty] = useState<number>(1);
  const [prompt, setPrompt] = useState("");
  const [payloadText, setPayloadText] = useState("{}");
  const [options, setOptions] = useState<OptionDraft[]>(EMPTY_OPTIONS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const gameDef = TB_GAME_REGISTRY[gameKey];
  const isScenario = gameDef?.kind === "SCENARIO";
  const isCalmFocus = gameDef?.kind === "CALM_FOCUS";

  const validOptions = useMemo(() => options.filter((o) => o.label.trim().length > 0), [options]);

  function updateOption(idx: number, patch: Partial<OptionDraft>) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
    setValidation(null);
  }

  function setBestOption(idx: number) {
    setOptions((prev) => prev.map((o, i) => ({ ...o, isCorrectOrBest: i === idx })));
    setValidation(null);
  }

  async function handleRunValidation() {
    setChecking(true);
    try {
      const res = await fetch("/api/admin/tune-your-brain/content/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          options: isScenario ? validOptions.map((o) => ({ label: o.label, explanation: o.explanation })) : [],
        }),
      });
      setValidation(await res.json());
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (isScenario && validOptions.length < 2) {
      setError("Add at least 2 answer options for this game.");
      return;
    }
    if (isScenario && !validOptions.some((o) => o.isCorrectOrBest)) {
      setError("Mark one option as the best/correct answer.");
      return;
    }

    let payload: Record<string, unknown> = {};
    if (isCalmFocus) {
      try {
        payload = JSON.parse(payloadText);
      } catch {
        setError("Payload must be valid JSON.");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/tune-your-brain/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameKey,
          category: category.trim() || undefined,
          difficulty: gameDef?.supportsDifficulty ? difficulty : undefined,
          prompt: prompt.trim(),
          payload,
          options: isScenario
            ? validOptions.map((o) => ({
                label: o.label.trim(),
                isCorrectOrBest: o.isCorrectOrBest,
                explanation: o.explanation.trim() || undefined,
              }))
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setSaving(false);
        return;
      }
      await router.push(`/admin/tune-your-brain/content/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/admin/tune-your-brain/content" className="text-sm text-slate-500 no-underline hover:text-navy">
          ← Tune Your Brain
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">New content</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="gameKey">Game</label>
          <select
            id="gameKey"
            value={gameKey}
            onChange={(e) => { setGameKey(e.target.value); setValidation(null); }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          >
            {CORE_GAME_KEYS.map((k) => (
              <option key={k} value={k}>{TB_GAME_REGISTRY[k].label}</option>
            ))}
          </select>
          {gameDef && <p className="mt-1 text-xs text-ink-soft">{gameDef.shortDescription}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="prompt">Prompt</label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setValidation(null); }}
            rows={3}
            required
            placeholder="Scenario, question, or instruction text shown to the member."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="category">Category (optional)</label>
            <input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Work, Confidence, breathing"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            />
          </div>
          {gameDef?.supportsDifficulty && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="difficulty">Difficulty</label>
              <select
                id="difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
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
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Answer options</label>
            <p className="mb-2 text-xs text-ink-soft">Pick the best/correct option, and add an explanation shown after the member answers.</p>
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
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="payload">Mode config (JSON)</label>
            <textarea
              id="payload"
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            />
            <p className="mt-1 text-xs text-ink-soft">e.g. {"{ \"durationOptions\": [30, 60, 120] }"}</p>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Content safety validation</p>
            <button
              type="button"
              onClick={handleRunValidation}
              disabled={checking || !prompt.trim()}
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
          <Link href="/admin/tune-your-brain/content" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors"
          >
            {saving ? "Creating…" : "Create content"}
          </button>
        </div>
      </form>
    </div>
  );
};

AdminTuneBrainContentNew.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session?.user?.adminRole || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }
  return { props: {} };
};

export default AdminTuneBrainContentNew;
