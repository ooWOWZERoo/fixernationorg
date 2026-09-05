import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { POSITIVITY_BOOST_CATEGORIES } from "@/lib/positivityBoostCategories";
import type { NextPageWithLayout } from "@/types/next";

interface ValidationResult { passed: boolean; notes: string[]; wordCount: number }

const AdminPositivityBoostNew: NextPageWithLayout = () => {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>(POSITIVITY_BOOST_CATEGORIES[0]);
  const [isFallback, setIsFallback] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;

  async function handleRunValidation() {
    setChecking(true);
    try {
      const res = await fetch("/api/admin/positivity-boosts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      setValidation(data);
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/positivity-boosts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), category, isFallback }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setSaving(false);
        return;
      }
      await router.push(`/admin/positivity-boosts/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/admin/positivity-boosts" className="text-sm text-slate-500 no-underline hover:text-navy">
          ← Positivity Boost
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">New message</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
        {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="content">Message</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => { setContent(e.target.value); setValidation(null); }}
            rows={3}
            required
            placeholder="Original, positive-first Fixer Nation content."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
          <p className={`mt-1 text-xs ${wordCount >= 8 && wordCount <= 24 ? "text-green-600" : wordCount >= 6 && wordCount <= 30 ? "text-amber-dark" : "text-red-600"}`}>
            {wordCount} words (recommended 8–24)
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="category">Category</label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          >
            {POSITIVITY_BOOST_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={isFallback} onChange={(e) => setIsFallback(e.target.checked)} className="rounded border-slate-300" />
          Mark as a hard-safe fallback message
        </label>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">Positivity validation</p>
            <button
              type="button"
              onClick={handleRunValidation}
              disabled={checking || !content.trim()}
              className="rounded-lg border border-navy/15 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-white disabled:opacity-50"
            >
              {checking ? "Checking…" : "Run validation"}
            </button>
          </div>
          {validation && (
            <p className={`mt-2 text-sm font-semibold ${validation.passed ? "text-green-700" : "text-red-600"}`}>
              {validation.passed ? "Positivity Validation: Passed" : "Not Eligible for Public Display"}
              {!validation.passed && validation.notes.length > 0 && (
                <span className="mt-1 block text-xs font-normal text-red-500">{validation.notes.join("; ")}</span>
              )}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <Link href="/admin/positivity-boosts" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors"
          >
            {saving ? "Creating…" : "Create message"}
          </button>
        </div>
      </form>
    </div>
  );
};

AdminPositivityBoostNew.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }
  return { props: {} };
};

export default AdminPositivityBoostNew;
