import Head from "next/head";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

const FIELD_TYPES = ["TEXT", "NUMBER", "DATE", "DROPDOWN", "CHECKBOX", "URL", "TEXTAREA"] as const;
type FieldType = typeof FIELD_TYPES[number];

const TYPE_LABELS: Record<FieldType, string> = {
  TEXT: "Text",
  NUMBER: "Number",
  DATE: "Date",
  DROPDOWN: "Dropdown",
  CHECKBOX: "Checkbox",
  URL: "URL",
  TEXTAREA: "Long text",
};

interface FieldRow {
  id: string;
  slug: string;
  label: string;
  type: FieldType;
  options: string[] | null;
  required: boolean;
  active: boolean;
  sortOrder: number;
  valueCount: number;
  updatedAt: string;
}

interface Props { fields: FieldRow[] }

const blankForm = { label: "", type: "TEXT" as FieldType, options: "", required: false };

const CustomFieldsPage: NextPageWithLayout<Props> = ({ fields: initial }) => {
  const [fields, setFields] = useState<FieldRow[]>(initial);
  const [creating, setCreating] = useState(false);
  const [savingNew, setSavingNew] = useState(false);
  const [newForm, setNewForm] = useState(blankForm);
  const [newError, setNewError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: "", options: "", required: false });
  const [savingEdit, setSavingEdit] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newForm.label.trim()) return;
    setSavingNew(true);
    setNewError("");
    try {
      const options = newForm.type === "DROPDOWN"
        ? newForm.options.split(",").map(s => s.trim()).filter(Boolean)
        : undefined;
      const r = await fetch("/api/admin/custom-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newForm.label.trim(),
          type: newForm.type,
          required: newForm.required,
          options: options?.length ? options : undefined,
          sortOrder: fields.length,
        }),
      });
      const data = await r.json();
      if (r.ok) {
        setFields(prev => [...prev, { ...data, options: data.options ?? null, valueCount: 0 }]);
        setNewForm(blankForm);
        setCreating(false);
      } else {
        setNewError(data?.error?.formErrors?.[0] ?? "Create failed.");
      }
    } finally {
      setSavingNew(false);
    }
  }

  function startEdit(f: FieldRow) {
    setEditingId(f.id);
    setEditForm({
      label: f.label,
      options: f.options?.join(", ") ?? "",
      required: f.required,
    });
  }

  async function handleEdit(id: string) {
    const f = fields.find(x => x.id === id)!;
    setSavingEdit(true);
    try {
      const options = f.type === "DROPDOWN"
        ? editForm.options.split(",").map(s => s.trim()).filter(Boolean)
        : null;
      const r = await fetch(`/api/admin/custom-fields/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: editForm.label.trim(), options, required: editForm.required }),
      });
      if (r.ok) {
        const updated = await r.json();
        setFields(prev => prev.map(x => x.id === id ? { ...x, label: updated.label, options: updated.options ?? null, required: updated.required } : x));
        setEditingId(null);
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleToggleActive(id: string, current: boolean) {
    setTogglingId(id);
    try {
      const r = await fetch(`/api/admin/custom-fields/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !current }),
      });
      if (r.ok) {
        setFields(prev => prev.map(x => x.id === id ? { ...x, active: !current } : x));
      }
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const r = await fetch(`/api/admin/custom-fields/${id}`, { method: "DELETE" });
      if (r.ok) {
        setFields(prev => prev.filter(x => x.id !== id));
      } else {
        const data = await r.json();
        alert(data?.error ?? "Delete failed.");
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <Head><title>Custom fields — Admin</title></Head>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-navy">Custom fields</h1>
          <p className="mt-1 text-sm text-ink-soft">Define extra data fields that appear on every contact record.</p>
        </div>
        <button type="button" onClick={() => setCreating(v => !v)}
          className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark">
          {creating ? "Cancel" : "+ New field"}
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <form onSubmit={handleCreate} className="mb-6 rounded-2xl border border-navy/8 bg-white p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-ink-soft">New field</h2>
          {newError && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{newError}</div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-semibold text-navy mb-1">Label <span className="text-red-400">*</span></label>
              <input type="text" value={newForm.label} onChange={e => setNewForm(f => ({ ...f, label: e.target.value }))} required
                placeholder="e.g. Lead score"
                className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1">Type</label>
              <select value={newForm.type} onChange={e => setNewForm(f => ({ ...f, type: e.target.value as FieldType }))}
                className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30">
                {FIELD_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            {newForm.type === "DROPDOWN" && (
              <div>
                <label className="block text-sm font-semibold text-navy mb-1">Options <span className="text-ink-soft font-normal">(comma-separated)</span></label>
                <input type="text" value={newForm.options} onChange={e => setNewForm(f => ({ ...f, options: e.target.value }))}
                  placeholder="Hot lead, Warm, Cold"
                  className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
              </div>
            )}
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="req" checked={newForm.required} onChange={e => setNewForm(f => ({ ...f, required: e.target.checked }))}
                className="accent-navy" />
              <label htmlFor="req" className="text-sm text-ink">Required field</label>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={savingNew || !newForm.label.trim()}
              className="rounded-xl bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-50">
              {savingNew ? "Creating…" : "Create field"}
            </button>
            <button type="button" onClick={() => { setCreating(false); setNewForm(blankForm); setNewError(""); }}
              className="rounded-xl border border-navy/15 px-4 py-2 text-sm text-ink-soft hover:bg-cream-panel">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Field list */}
      {fields.length === 0 ? (
        <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
          <p className="text-sm text-ink-soft">No custom fields defined. Add one to extend contact records.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-navy/8 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/8 text-left text-xs font-bold uppercase tracking-widest text-ink-soft">
                <th className="px-5 py-3">Label / slug</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Options</th>
                <th className="px-5 py-3 text-center">Required</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Contacts</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/5">
              {fields.map(f => (
                <tr key={f.id} className={f.active ? "" : "opacity-50"}>
                  <td className="px-5 py-3">
                    {editingId === f.id ? (
                      <input autoFocus type="text" value={editForm.label} onChange={e => setEditForm(x => ({ ...x, label: e.target.value }))}
                        className="w-full rounded-lg border border-navy/15 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                    ) : (
                      <>
                        <span className="font-semibold text-navy">{f.label}</span>
                        <span className="ml-2 text-xs text-ink-soft">{f.slug}</span>
                      </>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-navy/8 px-2 py-0.5 text-xs font-semibold text-navy">
                      {TYPE_LABELS[f.type]}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {f.type === "DROPDOWN" ? (
                      editingId === f.id ? (
                        <input type="text" value={editForm.options} onChange={e => setEditForm(x => ({ ...x, options: e.target.value }))}
                          placeholder="opt1, opt2, opt3"
                          className="w-full rounded-lg border border-navy/15 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-navy/30" />
                      ) : (
                        <span className="text-xs text-ink-soft">{f.options?.join(", ") || "—"}</span>
                      )
                    ) : (
                      <span className="text-xs text-ink-soft">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {editingId === f.id ? (
                      <input type="checkbox" checked={editForm.required} onChange={e => setEditForm(x => ({ ...x, required: e.target.checked }))}
                        className="accent-navy" />
                    ) : (
                      <span className={f.required ? "text-navy font-bold" : "text-ink-soft"}>
                        {f.required ? "Yes" : "No"}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button type="button"
                      onClick={() => handleToggleActive(f.id, f.active)}
                      disabled={togglingId === f.id}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors ${
                        f.active ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}>
                      {togglingId === f.id ? "…" : f.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right text-ink-soft">{f.valueCount.toLocaleString()}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      {editingId === f.id ? (
                        <>
                          <button type="button" onClick={() => handleEdit(f.id)} disabled={savingEdit}
                            className="text-xs font-semibold text-navy hover:underline disabled:opacity-50">
                            {savingEdit ? "…" : "Save"}
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} className="text-xs text-ink-soft hover:underline">
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEdit(f)} className="text-xs text-navy hover:underline">
                            Edit
                          </button>
                          <button type="button" onClick={() => handleDelete(f.id, f.label)}
                            disabled={deletingId === f.id || f.valueCount > 0}
                            title={f.valueCount > 0 ? `${f.valueCount} contacts have values — deactivate instead` : undefined}
                            className="text-xs text-red-400 hover:underline disabled:opacity-30 disabled:cursor-not-allowed">
                            {deletingId === f.id ? "…" : "Delete"}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

CustomFieldsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: "/signin", permanent: false } };
  }

  const raw = await (db as never as {
    customFieldDefinition: {
      findMany: (a: unknown) => Promise<{
        id: string; slug: string; label: string; type: string;
        options: unknown; required: boolean; active: boolean; sortOrder: number; updatedAt: Date;
        _count: { values: number };
      }[]>;
    };
  }).customFieldDefinition.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { values: true } } },
  } as never);

  return {
    props: {
      fields: raw.map(f => ({
        id: f.id,
        slug: f.slug,
        label: f.label,
        type: f.type,
        options: Array.isArray(f.options) ? f.options : null,
        required: f.required,
        active: f.active,
        sortOrder: f.sortOrder,
        valueCount: f._count.values,
        updatedAt: f.updatedAt.toISOString(),
      })),
    },
  };
};

export default CustomFieldsPage;
