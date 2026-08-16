import Head from "next/head";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

const TYPE_LABELS: Record<string, string> = {
  BOUNCE: "Bounce",
  COMPLAINT: "Complaint",
  UNSUBSCRIBE: "Unsubscribe",
  ADMIN: "Manual",
};

const TYPE_STYLES: Record<string, string> = {
  BOUNCE:      "bg-red-100 text-red-800",
  COMPLAINT:   "bg-orange-100 text-orange-800",
  UNSUBSCRIBE: "bg-slate-100 text-slate-700",
  ADMIN:       "bg-navy/8 text-navy",
};

interface SuppressionRow {
  id: string;
  email: string;
  type: string;
  reason: string | null;
  source: string | null;
  suppressedAt: string;
  liftedAt: string | null;
  active: boolean;
}

interface Props { records: SuppressionRow[]; total: number }

const SuppressionPage: NextPageWithLayout<Props> = ({ records: initial, total }) => {
  const [records, setRecords] = useState<SuppressionRow[]>(initial);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("active");

  const [adding, setAdding] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newReason, setNewReason] = useState("");
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [liftingId, setLiftingId] = useState<string | null>(null);

  const filtered = records.filter((r) => {
    if (q && !r.email.toLowerCase().includes(q.toLowerCase())) return false;
    if (typeFilter !== "all" && r.type !== typeFilter) return false;
    if (activeFilter === "active" && !r.active) return false;
    if (activeFilter === "lifted" && r.active) return false;
    return true;
  });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setAddSaving(true);
    setAddError("");
    try {
      const r = await fetch("/api/admin/suppression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), reason: newReason.trim() || undefined }),
      });
      const data = await r.json();
      if (r.ok) {
        setRecords((prev) => [data, ...prev]);
        setNewEmail("");
        setNewReason("");
        setAdding(false);
      } else {
        setAddError(data?.error?.formErrors?.[0] ?? "Failed to add suppression.");
      }
    } finally {
      setAddSaving(false);
    }
  }

  async function handleLift(id: string) {
    if (!confirm("Lift this suppression? The address will be eligible to receive emails again.")) return;
    setLiftingId(id);
    try {
      const r = await fetch(`/api/admin/suppression/${id}`, { method: "DELETE" });
      if (r.ok) {
        setRecords((prev) =>
          prev.map((x) => x.id === id ? { ...x, active: false, liftedAt: new Date().toISOString() } : x)
        );
      }
    } finally {
      setLiftingId(null);
    }
  }

  return (
    <>
      <Head><title>Suppression list — Admin</title></Head>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy">Suppression list</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {total.toLocaleString()} total records — email addresses blocked from receiving campaigns.
          </p>
        </div>
        <button onClick={() => setAdding((v) => !v)}
          className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark">
          {adding ? "Cancel" : "+ Add suppression"}
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <form onSubmit={handleAdd} className="mb-6 rounded-2xl border border-navy/8 bg-white p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-ink-soft">Manually suppress an address</h2>
          {addError && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{addError}</div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-semibold text-navy">Email address <span className="text-red-400">*</span></label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required
                placeholder="contact@example.com"
                className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-navy">Reason <span className="text-ink-soft font-normal">(optional)</span></label>
              <input type="text" value={newReason} onChange={(e) => setNewReason(e.target.value)}
                placeholder="e.g. requested by contact"
                className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={addSaving || !newEmail.trim()}
              className="rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-50">
              {addSaving ? "Adding…" : "Add suppression"}
            </button>
            <button type="button" onClick={() => { setAdding(false); setAddError(""); setNewEmail(""); setNewReason(""); }}
              className="rounded-xl border border-navy/15 px-4 py-2 text-sm text-ink-soft hover:bg-cream-panel">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email…"
          className="rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 w-64" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30">
          <option value="all">All types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}
          className="rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30">
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="lifted">Lifted only</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
          <p className="text-sm text-ink-soft">No records match your filters.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-navy/8 bg-white">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/8 text-left text-xs font-bold uppercase tracking-widest text-ink-soft">
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Reason</th>
                <th className="px-5 py-3">Suppressed</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {filtered.map((r) => (
                <tr key={r.id} className={r.active ? "" : "opacity-50"}>
                  <td className="px-5 py-3 font-medium text-navy">{r.email}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_STYLES[r.type] ?? "bg-navy/8 text-navy"}`}>
                      {TYPE_LABELS[r.type] ?? r.type}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-ink-soft">{r.reason ?? "—"}</td>
                  <td className="px-5 py-3 text-ink-soft">
                    {new Date(r.suppressedAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    {r.active ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">Active</span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                        Lifted {r.liftedAt ? new Date(r.liftedAt).toLocaleDateString() : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {r.active && (
                      <button onClick={() => handleLift(r.id)} disabled={liftingId === r.id}
                        className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
                        {liftingId === r.id ? "…" : "Lift"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </>
  );
};

SuppressionPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: "/signin", permanent: false } };
  }

  type SupDb = {
    suppressionRecord: {
      findMany: (a: unknown) => Promise<{
        id: string; email: string; type: string; reason: string | null;
        source: string | null; suppressedAt: Date; liftedAt: Date | null;
      }[]>;
      count: (a: unknown) => Promise<number>;
    };
  };
  const supDb = db as never as SupDb;

  const [records, total] = await Promise.all([
    supDb.suppressionRecord.findMany({
      orderBy: { suppressedAt: "desc" } as never,
      take: 200,
    } as never),
    supDb.suppressionRecord.count({} as never),
  ]);

  return {
    props: {
      records: records.map((r) => ({
        id: r.id,
        email: r.email,
        type: r.type,
        reason: r.reason,
        source: r.source,
        suppressedAt: r.suppressedAt.toISOString(),
        liftedAt: r.liftedAt?.toISOString() ?? null,
        active: r.liftedAt === null,
      })),
      total,
    },
  };
};

export default SuppressionPage;
