import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

type BlockedRow = {
  id: string;
  email: string;
  reason: string | null;
  blockedBy: string;
  createdAt: string;
};

interface Props {
  initial: BlockedRow[];
}

const BlockedEmailsPage: NextPageWithLayout<Props> = ({ initial }) => {
  const [rows, setRows] = useState(initial);
  const [addEmail, setAddEmail] = useState("");
  const [addReason, setAddReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Set<string>>(new Set());

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    const res = await fetch("/api/admin/blocked-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: addEmail.trim(), reason: addReason.trim() || undefined }),
    });
    const data = await res.json();
    if (res.ok) {
      setRows((prev) => [data, ...prev.filter((r) => r.email !== data.email)]);
      setAddEmail("");
      setAddReason("");
    } else {
      setAddError(data.error ?? "Failed to block email.");
    }
    setAdding(false);
  };

  const handleRemove = async (id: string) => {
    setRemoving((prev) => new Set(prev).add(id));
    const res = await fetch(`/api/admin/blocked-emails/${id}`, { method: "DELETE" });
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    }
    setRemoving((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Blocked emails</h1>
        <p className="mt-1 text-sm text-slate-500">
          {rows.length} blocked &mdash; applications from these addresses are rejected at submission.
        </p>
      </div>

      {/* Add form */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-bold text-slate-800">Block an email address</h2>
        {addError && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{addError}</div>
        )}
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email address *</label>
            <input
              required
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="someone@example.com"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-600 mb-1">Reason</label>
            <input
              value={addReason}
              onChange={(e) => setAddReason(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            />
          </div>
          <button
            type="submit"
            disabled={adding || !addEmail.trim()}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-40"
          >
            {adding ? "Blocking…" : "Block email"}
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-14 text-center">
          <p className="text-sm font-semibold text-slate-500">No blocked emails yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Email</th>
                <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 sm:table-cell">Reason</th>
                <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 md:table-cell">Blocked by</th>
                <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 lg:table-cell">Date</th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-sm text-slate-900">{r.email}</td>
                  <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">{r.reason ?? "—"}</td>
                  <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell truncate max-w-[180px]">{r.blockedBy}</td>
                  <td className="hidden px-4 py-3 text-xs text-slate-500 lg:table-cell">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRemove(r.id)}
                      disabled={removing.has(r.id)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-red-300 hover:text-red-600 disabled:opacity-40 transition-colors"
                    >
                      {removing.has(r.id) ? "…" : "Unblock"}
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

BlockedEmailsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

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

  const rows = await db.blockedEmail.findMany({ orderBy: { createdAt: "desc" } });

  return {
    props: {
      initial: rows.map((r) => ({
        id: r.id,
        email: r.email,
        reason: r.reason,
        blockedBy: r.blockedBy,
        createdAt: r.createdAt.toISOString(),
      })),
    },
  };
};

export default BlockedEmailsPage;
