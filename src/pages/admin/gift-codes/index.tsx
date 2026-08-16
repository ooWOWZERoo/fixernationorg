import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface GiftCodeRow {
  id: string;
  code: string;
  grantedRole: string;
  description: string | null;
  expiresAt: string | null;
  redeemedAt: string | null;
  redeemedByName: string | null;
  redeemedByEmail: string | null;
  createdAt: string;
}

interface Props {
  codes: GiftCodeRow[];
}

const ROLE_OPTIONS = [
  { value: "MEMBER", label: "Member" },
  { value: "PROVIDER", label: "Provider" },
  { value: "AMBASSADOR", label: "Ambassador" },
];

const AdminGiftCodesPage: NextPageWithLayout<Props> = ({ codes: initialCodes }) => {
  const [codes, setCodes] = useState(initialCodes);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genForm, setGenForm] = useState({ quantity: "1", grantedRole: "MEMBER", description: "", expiresAt: "" });

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/gift-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quantity: parseInt(genForm.quantity),
          grantedRole: genForm.grantedRole,
          description: genForm.description.trim() || undefined,
          expiresAt: genForm.expiresAt ? new Date(genForm.expiresAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setGenError(data.error ?? "Failed."); return; }
      const newRows: GiftCodeRow[] = data.map((c: { id: string; code: string; grantedRole: string; description: string | null; expiresAt: string | null; createdAt: string; }) => ({
        id: c.id, code: c.code, grantedRole: c.grantedRole, description: c.description,
        expiresAt: c.expiresAt, redeemedAt: null, redeemedByName: null, redeemedByEmail: null,
        createdAt: c.createdAt,
      }));
      setCodes((prev) => [...newRows, ...prev]);
    } catch { setGenError("Something went wrong."); }
    finally { setGenerating(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this code?")) return;
    const res = await fetch(`/api/admin/gift-codes/${id}`, { method: "DELETE" });
    if (res.ok) setCodes((prev) => prev.filter((c) => c.id !== id));
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Delete failed.");
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
  }

  const available = codes.filter((c) => !c.redeemedAt);
  const redeemed = codes.filter((c) => c.redeemedAt);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-navy">Gift codes</h1>
        <p className="mt-1 text-sm text-ink-soft">{available.length} available, {redeemed.length} redeemed</p>
      </div>

      {/* Generate form */}
      <div className="mb-8 rounded-2xl border border-navy/8 bg-white p-6">
        <h2 className="mb-4 font-bold text-navy">Generate codes</h2>
        <form onSubmit={handleGenerate} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Quantity</label>
            <input type="number" min="1" max="100" value={genForm.quantity}
              onChange={(e) => setGenForm((f) => ({ ...f, quantity: e.target.value }))}
              className="w-full rounded-xl border border-navy/15 bg-cream px-3 py-2 text-sm text-navy focus:border-amber focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Grants role</label>
            <select value={genForm.grantedRole}
              onChange={(e) => setGenForm((f) => ({ ...f, grantedRole: e.target.value }))}
              className="w-full rounded-xl border border-navy/15 bg-cream px-3 py-2 text-sm text-navy focus:border-amber focus:outline-none">
              {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Description</label>
            <input type="text" value={genForm.description} placeholder="Optional note"
              onChange={(e) => setGenForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border border-navy/15 bg-cream px-3 py-2 text-sm text-navy focus:border-amber focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Expires</label>
            <input type="date" value={genForm.expiresAt}
              onChange={(e) => setGenForm((f) => ({ ...f, expiresAt: e.target.value }))}
              className="w-full rounded-xl border border-navy/15 bg-cream px-3 py-2 text-sm text-navy focus:border-amber focus:outline-none" />
          </div>
          <div className="col-span-2 sm:col-span-4 flex items-center gap-3">
            <button type="submit" disabled={generating}
              className="rounded-xl bg-amber px-5 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50">
              {generating ? "Generating..." : "Generate"}
            </button>
            {genError && <p className="text-sm font-semibold text-red-600">{genError}</p>}
          </div>
        </form>
      </div>

      {/* Available codes */}
      {available.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-extrabold uppercase tracking-widest text-ink-soft">Available ({available.length})</h2>
          <div className="overflow-hidden rounded-2xl border border-navy/8 bg-white">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy/8">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Grants</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Note</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Expires</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {available.map((c) => (
                  <tr key={c.id} className="border-b border-navy/5 last:border-0 hover:bg-cream-panel/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-navy">{c.code}</span>
                        <button onClick={() => copyCode(c.code)} className="text-xs text-ink-soft hover:text-navy" title="Copy">
                          ⎘
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink">{c.grantedRole}</td>
                    <td className="px-4 py-3 text-ink-soft">{c.description ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Never"}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(c.id)} className="text-xs font-semibold text-red-400 hover:text-red-600">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {/* Redeemed codes */}
      {redeemed.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-extrabold uppercase tracking-widest text-ink-soft">Redeemed ({redeemed.length})</h2>
          <div className="overflow-hidden rounded-2xl border border-navy/8 bg-white opacity-75">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy/8">
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Grants</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Redeemed by</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Redeemed</th>
                </tr>
              </thead>
              <tbody>
                {redeemed.map((c) => (
                  <tr key={c.id} className="border-b border-navy/5 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">{c.code}</td>
                    <td className="px-4 py-3 text-ink-soft">{c.grantedRole}</td>
                    <td className="px-4 py-3 text-ink-soft">{c.redeemedByName ?? c.redeemedByEmail ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {c.redeemedAt ? new Date(c.redeemedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {codes.length === 0 && (
        <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
          <p className="text-sm text-ink-soft">No codes yet. Use the form above to generate some.</p>
        </div>
      )}
    </div>
  );
};

AdminGiftCodesPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default AdminGiftCodesPage;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const codes = await db.giftCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { redeemedBy: { select: { name: true, email: true } } },
  });

  return {
    props: {
      codes: codes.map((c) => ({
        id: c.id, code: c.code, grantedRole: c.grantedRole, description: c.description,
        expiresAt: c.expiresAt?.toISOString() ?? null,
        redeemedAt: c.redeemedAt?.toISOString() ?? null,
        redeemedByName: c.redeemedBy?.name ?? null,
        redeemedByEmail: c.redeemedBy?.email ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
    },
  };
};
