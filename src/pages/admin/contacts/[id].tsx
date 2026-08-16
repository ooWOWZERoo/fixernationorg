import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

const TOPICS = ["MORNING_BOOST", "CAMPAIGNS", "NEWSLETTERS", "PRODUCT_UPDATES"] as const;
type Topic = typeof TOPICS[number];

const ADDRESS_TYPES = ["HOME", "WORK", "BILLING", "SHIPPING", "OTHER"] as const;

interface ConsentRow { topic: Topic; optedIn: boolean }
interface NoteRow { id: string; body: string; createdAt: string }
interface ListRow { id: string; name: string }
interface SendRow { id: string; campaignName: string; status: string; sentAt: string | null }
interface ListOption { id: string; name: string }
interface AddressRow {
  id: string;
  type: string | null;
  street: string | null;
  street2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  isPrimary: boolean;
}

interface AddrFormState {
  type: string;
  street: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  isPrimary: boolean;
}

const blankAddr: AddrFormState = {
  type: "", street: "", street2: "", city: "", state: "", zip: "", country: "", isPrimary: false,
};

const inputCls = "w-full rounded-xl border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30";

function AddressForm({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial?: Partial<AddrFormState>;
  saving: boolean;
  onSave: (data: AddrFormState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AddrFormState>({ ...blankAddr, ...initial });
  const field =
    (k: keyof AddrFormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-2 rounded-xl border border-navy/15 bg-cream-panel/40 p-3">
      <select value={form.type} onChange={field("type")} className={inputCls}>
        <option value="">— Address type —</option>
        {ADDRESS_TYPES.map((t) => (
          <option key={t} value={t}>
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </option>
        ))}
      </select>
      <input type="text" placeholder="Street" value={form.street} onChange={field("street")} className={inputCls} />
      <input type="text" placeholder="Street line 2 (optional)" value={form.street2} onChange={field("street2")} className={inputCls} />
      <div className="grid grid-cols-2 gap-2">
        <input type="text" placeholder="City" value={form.city} onChange={field("city")} className={inputCls} />
        <input type="text" placeholder="State / Region" value={form.state} onChange={field("state")} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" placeholder="Zip" value={form.zip} onChange={field("zip")} className={inputCls} />
        <input type="text" placeholder="Country" value={form.country} onChange={field("country")} className={inputCls} />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
        <input
          type="checkbox"
          checked={form.isPrimary}
          onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))}
          className="accent-navy"
        />
        Set as primary address
      </label>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={saving}
          className="rounded-xl bg-navy px-4 py-1.5 text-xs font-bold text-white hover:bg-navy-dark disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save address"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl border border-navy/15 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-panel"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface AttributionRow { source: string; attributedAt: string }
interface CustomFieldDef { id: string; slug: string; label: string; type: string; options: string[] | null; required: boolean }
interface CustomFieldVal { fieldId: string; value: string }

interface Props {
  contact: {
    id: string;
    email: string;
    email2: string | null;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    phone2: string | null;
    company: string | null;
    source: string | null;
    lastActivity: string | null;
    lastActivityAt: string | null;
    createdAt: string;
    userId: string | null;
    attribution: AttributionRow | null;
    consents: ConsentRow[];
    tags: string[];
    notes: NoteRow[];
    lists: ListRow[];
    sends: SendRow[];
    addresses: AddressRow[];
  };
  allLists: ListOption[];
  customFieldDefs: CustomFieldDef[];
  customFieldValues: CustomFieldVal[];
}

const AdminContactDetailPage: NextPageWithLayout<Props> = ({ contact: initial, allLists, customFieldDefs, customFieldValues: initialCfv }) => {
  const router = useRouter();
  const [contact, setContact] = useState(initial);
  const [cfValues, setCfValues] = useState<Record<string, string>>(
    Object.fromEntries(initialCfv.map(v => [v.fieldId, v.value]))
  );
  const [cfEditing, setCfEditing] = useState(false);
  const [cfDraft, setCfDraft] = useState<Record<string, string>>({});
  const [cfSaving, setCfSaving] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    email: initial.email,
    firstName: initial.firstName ?? "",
    lastName: initial.lastName ?? "",
    phone: initial.phone ?? "",
    phone2: initial.phone2 ?? "",
    email2: initial.email2 ?? "",
    company: initial.company ?? "",
  });

  const [addToListId, setAddToListId] = useState("");
  const [addingToList, setAddingToList] = useState(false);

  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [addrSaving, setAddrSaving] = useState(false);

  async function patch(action: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    if (!res.ok) throw new Error("Failed");
    return res;
  }

  async function saveEdit() {
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/admin/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editForm, email: editForm.email.toLowerCase().trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(res.status === 409 ? "This email is already used by another contact." : (data.error ?? "Save failed"));
        return;
      }
      setContact((c) => ({
        ...c,
        email: editForm.email.toLowerCase().trim(),
        firstName: editForm.firstName || null,
        lastName: editForm.lastName || null,
        phone: editForm.phone || null,
        phone2: editForm.phone2 || null,
        email2: editForm.email2 || null,
        company: editForm.company || null,
      }));
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveAddress(data: AddrFormState, addrId?: string) {
    setAddrSaving(true);
    try {
      const url = addrId
        ? `/api/admin/contacts/${contact.id}/addresses/${addrId}`
        : `/api/admin/contacts/${contact.id}/addresses`;
      const res = await fetch(url, {
        method: addrId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      const saved: AddressRow = await res.json();
      setContact((c) => {
        let addresses = addrId
          ? c.addresses.map((a) => (a.id === addrId ? saved : a))
          : [...c.addresses, saved];
        if (data.isPrimary) {
          addresses = addresses.map((a) => ({ ...a, isPrimary: a.id === saved.id }));
        }
        return { ...c, addresses };
      });
      setEditingAddressId(null);
      setAddingAddress(false);
    } finally {
      setAddrSaving(false);
    }
  }

  async function deleteAddress(addrId: string) {
    if (!confirm("Remove this address?")) return;
    await fetch(`/api/admin/contacts/${contact.id}/addresses/${addrId}`, { method: "DELETE" });
    setContact((c) => ({ ...c, addresses: c.addresses.filter((a) => a.id !== addrId) }));
  }

  async function addToList() {
    if (!addToListId) return;
    setAddingToList(true);
    try {
      const res = await fetch(`/api/admin/lists/${addToListId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-contacts", contactIds: [contact.id] }),
      });
      if (!res.ok) throw new Error("Failed");
      const newList = allLists.find((l) => l.id === addToListId);
      if (newList) setContact((c) => ({ ...c, lists: [...c.lists, { id: newList.id, name: newList.name }] }));
      setAddToListId("");
    } catch { /* ignore */ } finally { setAddingToList(false); }
  }

  async function addNote() {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      await patch("add-note", { body: newNote.trim() });
      setContact((c) => ({
        ...c,
        notes: [{ id: Math.random().toString(), body: newNote.trim(), createdAt: new Date().toISOString() }, ...c.notes],
      }));
      setNewNote("");
    } finally { setSaving(false); }
  }

  async function addTag() {
    if (!newTag.trim()) return;
    try {
      await patch("add-tag", { tag: newTag.trim().toLowerCase() });
      setContact((c) => ({ ...c, tags: [...new Set([...c.tags, newTag.trim().toLowerCase()])] }));
      setNewTag("");
    } catch { /* ignore duplicate */ }
  }

  async function removeTag(tag: string) {
    await patch("remove-tag", { tag });
    setContact((c) => ({ ...c, tags: c.tags.filter((t) => t !== tag) }));
  }

  async function setConsent(topic: Topic, optedIn: boolean) {
    await patch("set-consent", { topic, optedIn });
    setContact((c) => {
      const others = c.consents.filter((x) => x.topic !== topic);
      return { ...c, consents: [...others, { topic, optedIn }] };
    });
  }

  async function deleteContact() {
    if (!confirm("Delete this contact? This cannot be undone.")) return;
    await fetch(`/api/admin/contacts/${contact.id}`, { method: "DELETE" });
    router.push("/admin/contacts");
  }

  const consentMap = Object.fromEntries(contact.consents.map((c) => [c.topic, c.optedIn]));
  const availableLists = allLists.filter((l) => !contact.lists.some((cl) => cl.id === l.id));

  return (
    <>
      <Head><title>{contact.firstName ?? contact.email} — Contacts Admin</title></Head>
      <div className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
        <a href="/admin/contacts" className="hover:underline">Contacts</a>
        <span>/</span>
        <span>{contact.firstName && contact.lastName ? `${contact.firstName} ${contact.lastName}` : contact.email}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: core info */}
        <div className="lg:col-span-2 space-y-6">

          {/* Profile card */}
          <div className="rounded-2xl border border-navy/8 bg-white p-6">
            {editing ? (
              <>
                {editError && (
                  <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{editError}</div>
                )}
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Email *</label>
                    <input type="email" value={editForm.email}
                      onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">First name</label>
                    <input type="text" value={editForm.firstName}
                      onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Last name</label>
                    <input type="text" value={editForm.lastName}
                      onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Phone</label>
                    <input type="text" value={editForm.phone}
                      onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Phone 2</label>
                    <input type="text" value={editForm.phone2}
                      onChange={(e) => setEditForm((f) => ({ ...f, phone2: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Email 2</label>
                    <input type="email" value={editForm.email2}
                      onChange={(e) => setEditForm((f) => ({ ...f, email2: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Company</label>
                    <input type="text" value={editForm.company}
                      onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))}
                      className={inputCls} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving}
                    className="rounded-xl bg-navy px-4 py-1.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60">
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => { setEditing(false); setEditError(null); }}
                    className="rounded-xl border border-navy/15 px-4 py-1.5 text-sm font-semibold text-ink-soft hover:bg-cream-panel">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-extrabold text-navy">
                    {contact.firstName || contact.lastName
                      ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim()
                      : contact.email}
                  </h1>
                  <p className="text-sm text-ink-soft">{contact.email}</p>
                  {contact.email2 && <p className="text-sm text-ink-soft">{contact.email2}</p>}
                  {contact.company && <p className="text-sm text-ink-soft">{contact.company}</p>}
                  {contact.phone && <p className="text-sm text-ink-soft">{contact.phone}</p>}
                  {contact.phone2 && <p className="text-sm text-ink-soft">{contact.phone2}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(true)}
                    className="rounded-lg border border-navy/15 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-panel">
                    Edit
                  </button>
                  <button onClick={deleteContact}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                    Delete
                  </button>
                </div>
              </div>
            )}
            {!editing && (
              <div className="flex flex-wrap gap-3 text-xs text-ink-soft">
                <span>Source: {contact.source ?? "—"}</span>
                <span>Added: {new Date(contact.createdAt).toLocaleDateString()}</span>
                {contact.lastActivity && (
                  <span>
                    Last activity: {contact.lastActivity}
                    {contact.lastActivityAt ? ` · ${new Date(contact.lastActivityAt).toLocaleDateString()}` : ""}
                  </span>
                )}
                {contact.userId && <span className="text-green-700">Linked to account</span>}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="rounded-2xl border border-navy/8 bg-white p-6">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">Tags</h2>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {contact.tags.length === 0 && <span className="text-sm text-ink-soft">No tags yet.</span>}
              {contact.tags.map((t) => (
                <span key={t} className="flex items-center gap-1 rounded-full bg-navy/8 px-2.5 py-0.5 text-xs font-medium text-navy">
                  {t}
                  <button onClick={() => removeTag(t)} className="ml-0.5 text-navy/50 hover:text-red-600">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Add tag…"
                className="flex-1 rounded-xl border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
              <button onClick={addTag}
                className="rounded-xl bg-navy/8 px-4 py-1.5 text-sm font-semibold text-navy hover:bg-navy/15">
                Add
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-2xl border border-navy/8 bg-white p-6">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">Notes</h2>
            <div className="mb-3 space-y-3">
              {contact.notes.length === 0 && <p className="text-sm text-ink-soft">No notes yet.</p>}
              {contact.notes.map((n) => (
                <div key={n.id} className="rounded-xl bg-cream-panel p-3">
                  <p className="text-sm text-ink">{n.body}</p>
                  <p className="mt-1 text-xs text-ink-soft">{new Date(n.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
            <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write a note…" rows={2}
              className="mb-2 w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
            <button onClick={addNote} disabled={saving || !newNote.trim()}
              className="rounded-xl bg-navy px-4 py-1.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60">
              Save note
            </button>
          </div>

          {/* Campaign history */}
          {contact.sends.length > 0 && (
            <div className="rounded-2xl border border-navy/8 bg-white p-6">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">Campaign history</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy/8 text-left text-xs font-bold uppercase tracking-widest text-ink-soft">
                    <th className="pb-2">Campaign</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {contact.sends.map((s) => (
                    <tr key={s.id} className="border-b border-navy/5">
                      <td className="py-2">{s.campaignName}</td>
                      <td className="py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          s.status === "OPENED" ? "bg-green-100 text-green-800" :
                          s.status === "BOUNCED" || s.status === "UNSUBSCRIBED" ? "bg-red-100 text-red-700" :
                          "bg-navy/8 text-navy"
                        }`}>{s.status.toLowerCase()}</span>
                      </td>
                      <td className="py-2 text-ink-soft">{s.sentAt ? new Date(s.sentAt).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">

          {/* Addresses */}
          <div className="rounded-2xl border border-navy/8 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">Addresses</h2>
              {!addingAddress && editingAddressId === null && (
                <button onClick={() => setAddingAddress(true)}
                  className="text-xs font-semibold text-navy hover:underline">
                  + Add
                </button>
              )}
            </div>

            {contact.addresses.length === 0 && !addingAddress && (
              <p className="mb-2 text-sm text-ink-soft">No addresses yet.</p>
            )}

            <div className="space-y-3">
              {contact.addresses.map((a) =>
                editingAddressId === a.id ? (
                  <AddressForm
                    key={a.id}
                    initial={{
                      type: a.type ?? "",
                      street: a.street ?? "",
                      street2: a.street2 ?? "",
                      city: a.city ?? "",
                      state: a.state ?? "",
                      zip: a.zip ?? "",
                      country: a.country ?? "",
                      isPrimary: a.isPrimary,
                    }}
                    saving={addrSaving}
                    onSave={(data) => saveAddress(data, a.id)}
                    onCancel={() => setEditingAddressId(null)}
                  />
                ) : (
                  <div key={a.id} className="rounded-xl border border-navy/8 p-3 text-xs">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1">
                        {a.type && (
                          <span className="rounded-full bg-navy/8 px-2 py-0.5 font-semibold uppercase tracking-widest text-navy">
                            {a.type}
                          </span>
                        )}
                        {a.isPrimary && (
                          <span className="rounded-full bg-amber/30 px-2 py-0.5 font-semibold text-navy-dark">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-3">
                        <button onClick={() => setEditingAddressId(a.id)}
                          className="text-ink-soft hover:text-navy">Edit</button>
                        <button onClick={() => deleteAddress(a.id)}
                          className="text-ink-soft hover:text-red-600">Remove</button>
                      </div>
                    </div>
                    <div className="space-y-0.5 text-ink-soft">
                      {a.street && <p>{a.street}</p>}
                      {a.street2 && <p>{a.street2}</p>}
                      {(a.city || a.state || a.zip) && (
                        <p>{[a.city, a.state, a.zip].filter(Boolean).join(", ")}</p>
                      )}
                      {a.country && <p>{a.country}</p>}
                    </div>
                  </div>
                )
              )}

              {addingAddress && (
                <AddressForm
                  initial={{ isPrimary: contact.addresses.length === 0 }}
                  saving={addrSaving}
                  onSave={(data) => saveAddress(data)}
                  onCancel={() => setAddingAddress(false)}
                />
              )}
            </div>
          </div>

          {/* Consent */}
          <div className="rounded-2xl border border-navy/8 bg-white p-5">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-ink-soft">Email consent</h2>
            <div className="space-y-3">
              {TOPICS.map((topic) => {
                const opted = consentMap[topic] ?? null;
                return (
                  <div key={topic} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink">
                      {topic.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setConsent(topic, true)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                          opted === true ? "bg-green-600 text-white" : "bg-navy/8 text-ink-soft hover:bg-green-100"
                        }`}
                      >In</button>
                      <button
                        onClick={() => setConsent(topic, false)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                          opted === false ? "bg-red-600 text-white" : "bg-navy/8 text-ink-soft hover:bg-red-100"
                        }`}
                      >Out</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Attribution */}
          {contact.attribution && (
            <div className="rounded-2xl border border-navy/8 bg-white p-5">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">Attribution</h2>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-navy/8 px-3 py-1 text-xs font-semibold text-navy capitalize">
                  {contact.attribution.source.toLowerCase().replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-2 text-xs text-ink-soft">
                {new Date(contact.attribution.attributedAt).toLocaleDateString()}
              </p>
            </div>
          )}

          {/* Custom fields */}
          {customFieldDefs.length > 0 && (
            <div className="rounded-2xl border border-navy/8 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">Custom fields</h2>
                {!cfEditing ? (
                  <button type="button" onClick={() => { setCfDraft({ ...cfValues }); setCfEditing(true); }}
                    className="text-xs font-semibold text-navy hover:underline">
                    Edit
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button type="button" disabled={cfSaving}
                      onClick={async () => {
                        setCfSaving(true);
                        try {
                          const values = customFieldDefs.map(d => ({ fieldId: d.id, value: cfDraft[d.id] ?? "" }));
                          const r = await fetch(`/api/admin/contacts/${contact.id}/custom-fields`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ values }),
                          });
                          if (r.ok) { setCfValues({ ...cfDraft }); setCfEditing(false); }
                        } finally { setCfSaving(false); }
                      }}
                      className="text-xs font-semibold text-navy hover:underline disabled:opacity-50">
                      {cfSaving ? "Saving…" : "Save"}
                    </button>
                    <button type="button" onClick={() => setCfEditing(false)}
                      className="text-xs text-ink-soft hover:underline">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {customFieldDefs.map(d => (
                  <div key={d.id}>
                    <p className="mb-0.5 text-xs font-semibold text-ink-soft">
                      {d.label}{d.required && <span className="ml-1 text-red-400">*</span>}
                    </p>
                    {cfEditing ? (
                      d.type === "DROPDOWN" ? (
                        <select value={cfDraft[d.id] ?? ""} onChange={e => setCfDraft(x => ({ ...x, [d.id]: e.target.value }))}
                          className="w-full rounded-lg border border-navy/15 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30">
                          <option value="">— Select —</option>
                          {d.options?.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : d.type === "CHECKBOX" ? (
                        <label className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={cfDraft[d.id] === "true"}
                            onChange={e => setCfDraft(x => ({ ...x, [d.id]: e.target.checked ? "true" : "" }))}
                            className="accent-navy" />
                          Yes
                        </label>
                      ) : d.type === "TEXTAREA" ? (
                        <textarea value={cfDraft[d.id] ?? ""} onChange={e => setCfDraft(x => ({ ...x, [d.id]: e.target.value }))} rows={2}
                          className="w-full rounded-lg border border-navy/15 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                      ) : (
                        <input type={d.type === "NUMBER" ? "number" : d.type === "DATE" ? "date" : d.type === "URL" ? "url" : "text"}
                          value={cfDraft[d.id] ?? ""}
                          onChange={e => setCfDraft(x => ({ ...x, [d.id]: e.target.value }))}
                          className="w-full rounded-lg border border-navy/15 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
                      )
                    ) : (
                      <p className="text-sm text-ink">
                        {cfValues[d.id]
                          ? (d.type === "CHECKBOX" ? (cfValues[d.id] === "true" ? "Yes" : "No") : cfValues[d.id])
                          : <span className="italic text-ink-soft">—</span>
                        }
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lists */}
          <div className="rounded-2xl border border-navy/8 bg-white p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">Lists</h2>
            {contact.lists.length === 0 ? (
              <p className="mb-3 text-sm text-ink-soft">Not on any lists.</p>
            ) : (
              <div className="mb-3 space-y-1.5">
                {contact.lists.map((l) => (
                  <div key={l.id} className="text-sm">
                    <a href={`/admin/lists/${l.id}`} className="font-medium text-navy hover:underline">{l.name}</a>
                  </div>
                ))}
              </div>
            )}
            {availableLists.length > 0 && (
              <div className="mt-3 border-t border-navy/8 pt-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-soft">Add to list</p>
                <div className="flex gap-2">
                  <select value={addToListId} onChange={(e) => setAddToListId(e.target.value)}
                    className="flex-1 rounded-xl border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30">
                    <option value="">— Select —</option>
                    {availableLists.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  <button onClick={addToList} disabled={!addToListId || addingToList}
                    className="rounded-xl bg-navy/8 px-3 py-1.5 text-sm font-semibold text-navy hover:bg-navy/15 disabled:opacity-60">
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

AdminContactDetailPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default AdminContactDetailPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const { id } = ctx.params as { id: string };

  type CfDb = {
    customFieldDefinition: { findMany: (a: unknown) => Promise<{ id: string; slug: string; label: string; type: string; options: unknown; required: boolean }[]> };
    customFieldValue: { findMany: (a: unknown) => Promise<{ fieldId: string; value: string }[]> };
  };
  const cfDb = db as never as CfDb;

  const [contact, allLists, cfDefs, cfVals] = await Promise.all([
    db.contact.findUnique({
      where: { id },
      include: {
        addresses: { orderBy: [{ isPrimary: "desc" }, { id: "asc" }] },
        consents: true,
        tags: { orderBy: { tag: "asc" } },
        notes: { orderBy: { createdAt: "desc" } },
        listMemberships: { include: { list: { select: { id: true, name: true } } } },
        campaignSends: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { campaign: { select: { name: true } } },
        },
        attribution: true,
      },
    }),
    db.contactList.findMany({
      where: { ownerType: "FN_ADMIN" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    cfDb.customFieldDefinition.findMany({
      where: { active: true } as never,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] as never,
    }),
    cfDb.customFieldValue.findMany({
      where: { contactId: id } as never,
      select: { fieldId: true, value: true } as never,
    }),
  ]);

  if (!contact) return { notFound: true };

  return {
    props: {
      contact: {
        id: contact.id,
        email: contact.email,
        email2: contact.email2,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone,
        phone2: contact.phone2,
        company: contact.company,
        source: contact.source,
        lastActivity: contact.lastActivity,
        lastActivityAt: contact.lastActivityAt?.toISOString() ?? null,
        createdAt: contact.createdAt.toISOString(),
        userId: contact.userId,
        attribution: contact.attribution ? {
          source: contact.attribution.source,
          attributedAt: contact.attribution.attributedAt.toISOString(),
        } : null,
        addresses: contact.addresses.map((a) => ({
          id: a.id,
          type: a.type,
          street: a.street,
          street2: a.street2,
          city: a.city,
          state: a.state,
          zip: a.zip,
          country: a.country,
          isPrimary: a.isPrimary,
        })),
        consents: contact.consents.map((c) => ({ topic: c.topic, optedIn: c.optedIn })),
        tags: contact.tags.map((t) => t.tag),
        notes: contact.notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString() })),
        lists: contact.listMemberships.map((m) => ({ id: m.list.id, name: m.list.name })),
        sends: contact.campaignSends.map((s) => ({
          id: s.id,
          campaignName: s.campaign.name,
          status: s.status,
          sentAt: s.sentAt?.toISOString() ?? null,
        })),
      },
      allLists,
      customFieldDefs: cfDefs.map(d => ({
        id: d.id,
        slug: d.slug,
        label: d.label,
        type: d.type,
        options: Array.isArray(d.options) ? d.options as string[] : null,
        required: d.required,
      })),
      customFieldValues: cfVals.map(v => ({ fieldId: v.fieldId, value: v.value })),
    },
  };
};
