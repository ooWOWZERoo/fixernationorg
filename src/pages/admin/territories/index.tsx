import { useState } from "react";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

// ── types ─────────────────────────────────────────────────────────────────────

type TerritoryRow = {
  id: string;
  name: string;
  type: string;
  scope: string;
  county: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  region: string | null;
  description: string | null;
  status: string;
  isExclusive: boolean;
  createdAt: string;
  _count: { assignments: number };
};

interface Props {
  territories: TerritoryRow[];
}

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  RESERVED: "bg-amber/20 text-amber-dark",
  LOCKED: "bg-red-100 text-red-700",
  INACTIVE: "bg-slate-100 text-slate-400",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  RESERVED: "Reserved",
  LOCKED: "Locked",
  INACTIVE: "Inactive",
};

const SCOPE_LABEL: Record<string, string> = {
  ZIP: "ZIP",
  CITY: "City",
  COUNTY: "County",
  STATE: "State",
  REGION: "Region",
  NATIONAL: "National",
  CUSTOM: "Custom",
};

const TYPE_LABEL: Record<string, string> = {
  GEOGRAPHIC: "Geographic",
  INDUSTRY: "Industry",
  ORGANIZATION: "Organization",
  CUSTOM: "Custom",
};

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const BLANK_FORM = {
  name: "",
  type: "GEOGRAPHIC",
  scope: "COUNTY",
  county: "",
  city: "",
  state: "",
  zip: "",
  region: "",
  description: "",
  status: "ACTIVE",
  isExclusive: false,
  notes: "",
};

// ── component ─────────────────────────────────────────────────────────────────

const TerritoriesPage: NextPageWithLayout<Props> = ({ territories: initial }) => {
  const [territories, setTerritories] = useState(initial);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterState, setFilterState] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const visible = territories.filter((t) => {
    if (filterStatus !== "ALL" && t.status !== filterStatus) return false;
    if (filterType !== "ALL" && t.type !== filterType) return false;
    if (filterState && t.state !== filterState) return false;
    if (q) {
      const lq = q.toLowerCase();
      if (
        !t.name.toLowerCase().includes(lq) &&
        !(t.county ?? "").toLowerCase().includes(lq) &&
        !(t.city ?? "").toLowerCase().includes(lq)
      ) return false;
    }
    return true;
  });

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...form,
        county: form.county.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state || undefined,
        zip: form.zip.trim() || undefined,
        region: form.region.trim() || undefined,
        description: form.description.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      const res = await fetch("/api/admin/territories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setTerritories((prev) => [{ ...data, _count: { assignments: 0 } }, ...prev]);
        setForm(BLANK_FORM);
        setShowCreate(false);
      } else {
        setFormError(data.error ?? "Something went wrong.");
      }
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Territories</h1>
          <p className="mt-1 text-sm text-slate-500">
            {territories.length} total &middot; {territories.filter((t) => t.status === "ACTIVE").length} active
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 transition-colors"
        >
          {showCreate ? "Cancel" : "+ New territory"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-xl border border-slate-200 bg-white p-6 space-y-5"
        >
          <h2 className="text-base font-bold text-slate-900">New territory</h2>

          {formError && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Territory name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Atlanta Metro — North Fulton County"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
              <select value={form.type} onChange={(e) => set("type", e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy">
                <option value="GEOGRAPHIC">Geographic</option>
                <option value="INDUSTRY">Industry</option>
                <option value="ORGANIZATION">Organization</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Scope</label>
              <select value={form.scope} onChange={(e) => set("scope", e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy">
                <option value="COUNTY">County</option>
                <option value="CITY">City</option>
                <option value="ZIP">ZIP code</option>
                <option value="STATE">State</option>
                <option value="REGION">Region</option>
                <option value="NATIONAL">National</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy">
                <option value="ACTIVE">Active</option>
                <option value="RESERVED">Reserved</option>
                <option value="LOCKED">Locked</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            {form.type === "GEOGRAPHIC" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">State</label>
                  <select value={form.state} onChange={(e) => set("state", e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy">
                    <option value="">— select —</option>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {(form.scope === "COUNTY" || form.scope === "CITY") && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      {form.scope === "COUNTY" ? "County" : "City"}
                    </label>
                    <input
                      value={form.scope === "COUNTY" ? form.county : form.city}
                      onChange={(e) => set(form.scope === "COUNTY" ? "county" : "city", e.target.value)}
                      placeholder={form.scope === "COUNTY" ? "e.g. Fulton County" : "e.g. Atlanta"}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                    />
                  </div>
                )}

                {form.scope === "ZIP" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">ZIP code</label>
                    <input value={form.zip} onChange={(e) => set("zip", e.target.value)} placeholder="e.g. 30301" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
                  </div>
                )}

                {form.scope === "REGION" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Region name</label>
                    <input value={form.region} onChange={(e) => set("region", e.target.value)} placeholder="e.g. Southeast" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
                  </div>
                )}
              </>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
              <input
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Optional — shown to admin on assignment"
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="exclusive"
                checked={form.isExclusive}
                onChange={(e) => set("isExclusive", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-navy focus:ring-navy"
              />
              <label htmlFor="exclusive" className="text-sm text-slate-700">Exclusive territory</label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-40">
              {saving ? "Creating…" : "Create territory"}
            </button>
            <button type="button" onClick={() => { setShowCreate(false); setForm(BLANK_FORM); setFormError(null); }} className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search territories…"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy w-52"
        />

        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy">
          <option value="ALL">All types</option>
          <option value="GEOGRAPHIC">Geographic</option>
          <option value="INDUSTRY">Industry</option>
          <option value="ORGANIZATION">Organization</option>
          <option value="CUSTOM">Custom</option>
        </select>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy">
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="RESERVED">Reserved</option>
          <option value="LOCKED">Locked</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        <select value={filterState} onChange={(e) => setFilterState(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy">
          <option value="">All states</option>
          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        {visible.length !== territories.length && (
          <span className="text-sm text-slate-500">{visible.length} shown</span>
        )}
      </div>

      {/* Table */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <p className="text-sm font-semibold text-slate-500">No territories found.</p>
          <p className="mt-1 text-xs text-slate-400">Create one above to get started.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Name</th>
                <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 md:table-cell">Type / Scope</th>
                <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 sm:table-cell">State</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Status</th>
                <th className="hidden px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500 sm:table-cell">Ambassadors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-slate-900">{t.name}</div>
                    {t.description && (
                      <div className="mt-0.5 truncate max-w-xs text-xs text-slate-400">{t.description}</div>
                    )}
                    {t.isExclusive && (
                      <span className="mt-0.5 inline-block text-xs font-semibold text-orange-600">Exclusive</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3.5 text-slate-600 md:table-cell">
                    <div>{TYPE_LABEL[t.type] ?? t.type}</div>
                    <div className="text-xs text-slate-400">{SCOPE_LABEL[t.scope] ?? t.scope}</div>
                  </td>
                  <td className="hidden px-4 py-3.5 text-slate-600 sm:table-cell">
                    {t.state ?? <span className="text-slate-300">—</span>}
                    {t.county && <div className="text-xs text-slate-400">{t.county}</div>}
                    {t.city && <div className="text-xs text-slate-400">{t.city}</div>}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[t.status] ?? "bg-slate-100 text-slate-500"}`}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3.5 text-right sm:table-cell">
                    <span className={`text-sm font-semibold ${t._count.assignments > 0 ? "text-slate-800" : "text-slate-300"}`}>
                      {t._count.assignments}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

TerritoriesPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

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

  const territories = await db.territory.findMany({
    include: {
      _count: { select: { assignments: { where: { status: "ACTIVE" } } } },
    },
    orderBy: [{ state: "asc" }, { name: "asc" }],
  });

  return {
    props: { territories: JSON.parse(JSON.stringify(territories)) },
  };
};

export default TerritoriesPage;
