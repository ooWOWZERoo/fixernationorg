import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

const TOPICS = ["MORNING_BOOST", "CAMPAIGNS", "NEWSLETTERS", "PRODUCT_UPDATES"] as const;
type Topic = typeof TOPICS[number];

const ADDRESS_TYPES = ["HOME", "WORK", "BILLING", "SHIPPING", "OTHER"] as const;

interface ConsentRow  { topic: Topic; optedIn: boolean }
interface NoteRow     { id: string; body: string; createdAt: string }
interface ListRow     { id: string; name: string }
interface SendRow     { id: string; campaignName: string; status: string; sentAt: string | null }
interface ListOption  { id: string; name: string }
interface ActivityRow { id: string; type: string; summary: string; occurredAt: string }
interface AttributionRow { source: string; attributedAt: string; campaignId: string | null }

const ATTR_COLORS: Record<string, string> = {
  ORGANIC: "bg-green-100 text-green-800",
  REFERRAL: "bg-blue-100 text-blue-800",
  IMPORT: "bg-navy/8 text-navy",
  MANUAL: "bg-navy/8 text-navy",
  INVITE: "bg-purple-100 text-purple-800",
  SUBSCRIBE_FORM: "bg-amber/20 text-amber-dark",
  CAMPAIGN: "bg-teal-100 text-teal-800",
};
interface CustomFieldDef { id: string; slug: string; label: string; type: string; options: string[] | null; required: boolean }
interface CustomFieldVal { fieldId: string; value: string }
interface ActiveSuppression { id: string; type: string; reason: string | null; suppressedAt: string }
interface IdentityRow { id: string; type: string; value: string; label: string | null; isPrimary: boolean; createdAt: string }
interface ContactSearchResult { id: string; email: string; firstName: string | null; lastName: string | null }

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
  type: string; street: string; street2: string;
  city: string; state: string; zip: string; country: string; isPrimary: boolean;
}

const blankAddr: AddrFormState = {
  type: "", street: "", street2: "", city: "", state: "", zip: "", country: "", isPrimary: false,
};

const inputCls = "w-full rounded-xl border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30";

function AddressForm({ initial, saving, onSave, onCancel }: {
  initial?: Partial<AddrFormState>; saving: boolean;
  onSave: (d: AddrFormState) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState<AddrFormState>({ ...blankAddr, ...initial });
  const f = (k: keyof AddrFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));
  return (
    <div className="space-y-2 rounded-xl border border-navy/15 bg-cream-panel/40 p-3">
      <select value={form.type} onChange={f("type")} className={inputCls}>
        <option value="">— Address type —</option>
        {ADDRESS_TYPES.map((t) => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
      </select>
      <input type="text" placeholder="Street" value={form.street} onChange={f("street")} className={inputCls} />
      <input type="text" placeholder="Street line 2 (optional)" value={form.street2} onChange={f("street2")} className={inputCls} />
      <div className="grid grid-cols-2 gap-2">
        <input type="text" placeholder="City" value={form.city} onChange={f("city")} className={inputCls} />
        <input type="text" placeholder="State / Region" value={form.state} onChange={f("state")} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" placeholder="Zip" value={form.zip} onChange={f("zip")} className={inputCls} />
        <input type="text" placeholder="Country" value={form.country} onChange={f("country")} className={inputCls} />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
        <input type="checkbox" checked={form.isPrimary}
          onChange={(e) => setForm((p) => ({ ...p, isPrimary: e.target.checked }))} className="accent-navy" />
        Set as primary address
      </label>
      <div className="flex gap-2 pt-1">
        <button onClick={() => onSave(form)} disabled={saving}
          className="rounded-xl bg-navy px-4 py-1.5 text-xs font-bold text-white hover:bg-navy-dark disabled:opacity-60">
          {saving ? "Saving…" : "Save address"}
        </button>
        <button onClick={onCancel}
          className="rounded-xl border border-navy/15 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-panel">
          Cancel
        </button>
      </div>
    </div>
  );
}

const ACTIVITY_ICONS: Record<string, string> = {
  NOTE_ADDED: "📝",
  TAG_ADDED: "🏷",
  TAG_REMOVED: "🏷",
  LIST_JOINED: "📋",
  LIST_REMOVED: "📋",
  CONSENT_UPDATED: "✅",
  CAMPAIGN_SENT: "📧",
  CAMPAIGN_OPENED: "👁",
  CAMPAIGN_CLICKED: "🔗",
  CAMPAIGN_BOUNCED: "⚠️",
  CAMPAIGN_UNSUBSCRIBED: "🚫",
  CONTACT_UPDATED: "✏️",
  CONTACT_CREATED: "🎉",
};

type Tab = "activity" | "notes" | "lists" | "consent" | "campaigns" | "addresses" | "custom-fields" | "identities";

interface Props {
  contact: {
    id: string; email: string; email2: string | null;
    firstName: string | null; lastName: string | null;
    phone: string | null; phone2: string | null; company: string | null;
    source: string | null; lastActivity: string | null; lastActivityAt: string | null;
    createdAt: string; userId: string | null;
    attribution: AttributionRow | null;
    consents: ConsentRow[]; tags: string[]; notes: NoteRow[];
    lists: ListRow[]; sends: SendRow[]; addresses: AddressRow[];
  };
  allLists: ListOption[];
  customFieldDefs: CustomFieldDef[];
  customFieldValues: CustomFieldVal[];
  activeSuppression: ActiveSuppression | null;
  identities: IdentityRow[];
}

const AdminContactDetailPage: NextPageWithLayout<Props> = ({
  contact: initial, allLists, customFieldDefs, customFieldValues: initialCfv, activeSuppression: initialSuppression,
  identities: initialIdentities,
}) => {
  const router = useRouter();
  const [contact, setContact] = useState(initial);
  const [activeTab, setActiveTab] = useState<Tab>("activity");

  // Suppression
  const [suppression, setSuppression] = useState<ActiveSuppression | null>(initialSuppression);
  const [liftingSupp, setLiftingSupp] = useState(false);

  // Activity
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    if (activeTab === "activity" && !activityLoaded) {
      setActivityLoading(true);
      fetch(`/api/admin/contacts/${contact.id}/activity`)
        .then((r) => r.json())
        .then((data) => { setActivity(Array.isArray(data) ? data : []); setActivityLoaded(true); })
        .catch(() => {})
        .finally(() => setActivityLoading(false));
    }
  }, [activeTab, activityLoaded, contact.id]);

  // Custom fields
  const [cfValues, setCfValues] = useState<Record<string, string>>(
    Object.fromEntries(initialCfv.map((v) => [v.fieldId, v.value]))
  );
  const [cfEditing, setCfEditing] = useState(false);
  const [cfDraft, setCfDraft] = useState<Record<string, string>>({});
  const [cfSaving, setCfSaving] = useState(false);

  // Contact edits
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    email: initial.email,
    firstName: initial.firstName ?? "",
    lastName: initial.lastName ?? "",
    phone: initial.phone ?? "",
    phone2: initial.phone2 ?? "",
    email2: initial.email2 ?? "",
    company: initial.company ?? "",
  });

  // Notes
  const [newNote, setNewNote] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // Tags
  const [newTag, setNewTag] = useState("");

  // Lists
  const [addToListId, setAddToListId] = useState("");
  const [addingToList, setAddingToList] = useState(false);

  // Addresses
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [addrSaving, setAddrSaving] = useState(false);

  // Identities
  const [identities, setIdentities] = useState<IdentityRow[]>(initialIdentities);
  const [addingIdentity, setAddingIdentity] = useState(false);
  const [idForm, setIdForm] = useState({ type: "EMAIL", value: "", label: "", isPrimary: false });
  const [idSaving, setIdSaving] = useState(false);

  // Attribution
  const [editingAttribution, setEditingAttribution] = useState(false);
  const [attrSource, setAttrSource] = useState<string>(initial.attribution?.source ?? "ORGANIC");
  const [attrSaving, setAttrSaving] = useState(false);

  // Merge
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeResults, setMergeResults] = useState<ContactSearchResult[]>([]);
  const [mergeSearching, setMergeSearching] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<ContactSearchResult | null>(null);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (!mergeOpen || mergeSearch.length < 2) { setMergeResults([]); return; }
    const timer = setTimeout(async () => {
      setMergeSearching(true);
      try {
        const r = await fetch(`/api/admin/contacts?q=${encodeURIComponent(mergeSearch)}&limit=8`);
        const data = await r.json();
        const all: ContactSearchResult[] = Array.isArray(data?.contacts) ? data.contacts : [];
        setMergeResults(all.filter((c) => c.id !== contact.id));
      } catch { /* ignore */ } finally { setMergeSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [mergeSearch, mergeOpen, contact.id]);

  async function addIdentity() {
    if (!idForm.value.trim()) return;
    setIdSaving(true);
    try {
      const r = await fetch(`/api/admin/contacts/${contact.id}/identities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: idForm.type, value: idForm.value.trim(), label: idForm.label.trim() || undefined, isPrimary: idForm.isPrimary }),
      });
      if (!r.ok) return;
      const saved: IdentityRow = await r.json();
      setIdentities((prev) => [...prev, saved].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0)));
      setIdForm({ type: "EMAIL", value: "", label: "", isPrimary: false });
      setAddingIdentity(false);
    } finally { setIdSaving(false); }
  }

  async function deleteIdentity(identityId: string) {
    if (!confirm("Remove this identity?")) return;
    await fetch(`/api/admin/contacts/${contact.id}/identities/${identityId}`, { method: "DELETE" });
    setIdentities((prev) => prev.filter((i) => i.id !== identityId));
  }

  async function doMerge() {
    if (!mergeTarget) return;
    const targetName = [mergeTarget.firstName, mergeTarget.lastName].filter(Boolean).join(" ") || mergeTarget.email;
    if (!confirm(`Merge "${targetName} <${mergeTarget.email}>" into this contact? The other record will be permanently deleted.`)) return;
    setMerging(true);
    try {
      const r = await fetch(`/api/admin/contacts/${contact.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: mergeTarget.id }),
      });
      if (r.ok) {
        setMergeOpen(false);
        router.replace(router.asPath);
      }
    } finally { setMerging(false); }
  }

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
    setEditSaving(true);
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
      setActivityLoaded(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setEditSaving(false);
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
        if (data.isPrimary) addresses = addresses.map((a) => ({ ...a, isPrimary: a.id === saved.id }));
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

  async function saveAttribution() {
    setAttrSaving(true);
    try {
      const res = await fetch(`/api/admin/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-attribution", source: attrSource }),
      });
      if (!res.ok) return;
      const saved = await res.json();
      setContact((c) => ({
        ...c,
        attribution: {
          source: saved.source,
          attributedAt: saved.attributedAt,
          campaignId: saved.campaignId ?? null,
        },
      }));
      setEditingAttribution(false);
      setActivityLoaded(false);
    } finally { setAttrSaving(false); }
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
      setActivityLoaded(false);
    } catch { /* ignore */ } finally { setAddingToList(false); }
  }

  async function addNote() {
    if (!newNote.trim()) return;
    setNoteSaving(true);
    try {
      await patch("add-note", { body: newNote.trim() });
      setContact((c) => ({
        ...c,
        notes: [{ id: Math.random().toString(), body: newNote.trim(), createdAt: new Date().toISOString() }, ...c.notes],
      }));
      setNewNote("");
      setActivityLoaded(false);
    } finally { setNoteSaving(false); }
  }

  async function addTag() {
    if (!newTag.trim()) return;
    try {
      await patch("add-tag", { tag: newTag.trim().toLowerCase() });
      setContact((c) => ({ ...c, tags: [...new Set([...c.tags, newTag.trim().toLowerCase()])] }));
      setNewTag("");
      setActivityLoaded(false);
    } catch { /* ignore duplicate */ }
  }

  async function removeTag(tag: string) {
    await patch("remove-tag", { tag });
    setContact((c) => ({ ...c, tags: c.tags.filter((t) => t !== tag) }));
    setActivityLoaded(false);
  }

  async function setConsent(topic: Topic, optedIn: boolean) {
    await patch("set-consent", { topic, optedIn });
    setContact((c) => {
      const others = c.consents.filter((x) => x.topic !== topic);
      return { ...c, consents: [...others, { topic, optedIn }] };
    });
    setActivityLoaded(false);
  }

  async function deleteContact() {
    if (!confirm("Delete this contact? This cannot be undone.")) return;
    await fetch(`/api/admin/contacts/${contact.id}`, { method: "DELETE" });
    router.push("/admin/contacts");
  }

  const consentMap = Object.fromEntries(contact.consents.map((c) => [c.topic, c.optedIn]));
  const availableLists = allLists.filter((l) => !contact.lists.some((cl) => cl.id === l.id));
  const displayName = contact.firstName || contact.lastName
    ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim()
    : contact.email;

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: "activity", label: "Activity" },
    { key: "notes", label: "Notes", count: contact.notes.length || undefined },
    { key: "lists", label: "Lists", count: contact.lists.length || undefined },
    { key: "consent", label: "Consent" },
    { key: "campaigns", label: "Campaigns", count: contact.sends.length || undefined },
    { key: "addresses", label: "Addresses", count: contact.addresses.length || undefined },
    { key: "identities", label: "Identities", count: identities.length || undefined },
    ...(customFieldDefs.length > 0 ? [{ key: "custom-fields" as Tab, label: "Custom fields" }] : []),
  ];

  return (
    <>
      <Head><title>{displayName} — Contacts Admin</title></Head>

      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
        <Link href="/admin/contacts" className="hover:underline">Contacts</Link>
        <span>/</span>
        <span>{displayName}</span>
      </div>

      {/* Profile header */}
      <div className="mb-6 rounded-2xl border border-navy/8 bg-white p-6">
        {editing ? (
          <>
            {editError && (
              <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{editError}</div>
            )}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Email *</label>
                <input type="email" value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">First name</label>
                <input type="text" value={editForm.firstName}
                  onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Last name</label>
                <input type="text" value={editForm.lastName}
                  onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Phone</label>
                <input type="text" value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Phone 2</label>
                <input type="text" value={editForm.phone2}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone2: e.target.value }))} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Email 2</label>
                <input type="email" value={editForm.email2}
                  onChange={(e) => setEditForm((f) => ({ ...f, email2: e.target.value }))} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Company</label>
                <input type="text" value={editForm.company}
                  onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={editSaving}
                className="rounded-xl bg-navy px-4 py-1.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60">
                {editSaving ? "Saving…" : "Save"}
              </button>
              <button onClick={() => { setEditing(false); setEditError(null); }}
                className="rounded-xl border border-navy/15 px-4 py-1.5 text-sm font-semibold text-ink-soft hover:bg-cream-panel">
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold text-navy">{displayName}</h1>
              <p className="text-sm text-ink-soft">{contact.email}</p>
              {contact.email2 && <p className="text-sm text-ink-soft">{contact.email2}</p>}
              {contact.company && <p className="text-sm text-ink-soft">{contact.company}</p>}
              {(contact.phone || contact.phone2) && (
                <p className="text-sm text-ink-soft">
                  {[contact.phone, contact.phone2].filter(Boolean).join(" · ")}
                </p>
              )}

              {/* Tags row */}
              {contact.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {contact.tags.map((t) => (
                    <span key={t}
                      className="flex items-center gap-1 rounded-full bg-navy/8 px-2.5 py-0.5 text-xs font-medium text-navy">
                      {t}
                      <button onClick={() => removeTag(t)} className="ml-0.5 text-navy/50 hover:text-red-600">×</button>
                    </span>
                  ))}
                </div>
              )}

              {/* Meta row */}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-soft">
                <span>Source: {contact.source ?? "—"}</span>
                <span>Added: {new Date(contact.createdAt).toLocaleDateString()}</span>
                {contact.lastActivity && (
                  <span>
                    Last: {contact.lastActivity}
                    {contact.lastActivityAt ? ` · ${new Date(contact.lastActivityAt).toLocaleDateString()}` : ""}
                  </span>
                )}
                {contact.userId && <span className="font-semibold text-green-700">Has account</span>}
              </div>

              {/* Attribution */}
              <div className="mt-2 flex items-center gap-2">
                {!editingAttribution ? (
                  <>
                    {contact.attribution ? (
                      <>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ATTR_COLORS[contact.attribution.source] ?? "bg-navy/8 text-navy"}`}>
                          {contact.attribution.source.toLowerCase().replace(/_/g, " ")}
                        </span>
                        <span className="text-xs text-ink-soft">
                          {new Date(contact.attribution.attributedAt).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => { setAttrSource(contact.attribution!.source); setEditingAttribution(true); }}
                          className="text-xs text-ink-soft hover:text-navy">
                          Edit
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setAttrSource("ORGANIC"); setEditingAttribution(true); }}
                        className="text-xs text-ink-soft hover:text-navy">
                        + Set attribution
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <select
                      value={attrSource}
                      onChange={(e) => setAttrSource(e.target.value)}
                      className="rounded-lg border border-navy/15 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-navy/30">
                      {["ORGANIC", "REFERRAL", "IMPORT", "MANUAL", "INVITE", "SUBSCRIBE_FORM", "CAMPAIGN"].map((s) => (
                        <option key={s} value={s}>{s.toLowerCase().replace(/_/g, " ")}</option>
                      ))}
                    </select>
                    <button
                      onClick={saveAttribution}
                      disabled={attrSaving}
                      className="rounded-lg bg-navy px-3 py-1 text-xs font-bold text-white hover:bg-navy-dark disabled:opacity-60">
                      {attrSaving ? "…" : "Save"}
                    </button>
                    <button
                      onClick={() => setEditingAttribution(false)}
                      className="rounded-lg border border-navy/15 px-2 py-1 text-xs text-ink-soft hover:bg-cream-panel">
                      Cancel
                    </button>
                  </>
                )}
              </div>

              {/* Add tag */}
              <div className="mt-3 flex gap-2">
                <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                  placeholder="Add tag…"
                  className="rounded-xl border border-navy/15 px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-navy/30" />
                <button onClick={addTag}
                  className="rounded-xl bg-navy/8 px-3 py-1 text-xs font-semibold text-navy hover:bg-navy/15">
                  Add tag
                </button>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button onClick={() => setEditing(true)}
                className="rounded-lg border border-navy/15 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-panel">
                Edit
              </button>
              <button onClick={() => { setMergeOpen(true); setMergeSearch(""); setMergeTarget(null); setMergeResults([]); }}
                className="rounded-lg border border-navy/15 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-panel">
                Merge
              </button>
              <button onClick={deleteContact}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="mb-6 border-b border-navy/8">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={[
                "flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                activeTab === tab.key
                  ? "border-navy text-navy"
                  : "border-transparent text-ink-soft hover:border-navy/30 hover:text-navy",
              ].join(" ")}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                  activeTab === tab.key ? "bg-navy/10 text-navy" : "bg-navy/6 text-ink-soft"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab panels */}
      <div className="rounded-2xl border border-navy/8 bg-white p-6">

        {/* ── Activity ── */}
        {activeTab === "activity" && (
          <div>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-ink-soft">Activity timeline</h2>
            {activityLoading ? (
              <p className="py-8 text-center text-sm text-ink-soft">Loading…</p>
            ) : activity.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-soft">
                No activity recorded yet. Actions like adding notes, tags, and updating consent will appear here.
              </p>
            ) : (
              <ol className="relative border-l border-navy/10 pl-6 space-y-4">
                {activity.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-cream-panel text-xs ring-2 ring-white">
                      {ACTIVITY_ICONS[a.type] ?? "•"}
                    </span>
                    <div className="ml-2">
                      <p className="text-sm text-ink">{a.summary}</p>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {new Date(a.occurredAt).toLocaleDateString(undefined, {
                          year: "numeric", month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        {/* ── Notes ── */}
        {activeTab === "notes" && (
          <div>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-ink-soft">Notes</h2>
            <div className="mb-4 space-y-3">
              {contact.notes.length === 0 && <p className="text-sm text-ink-soft">No notes yet.</p>}
              {contact.notes.map((n) => (
                <div key={n.id} className="rounded-xl bg-cream-panel p-3">
                  <p className="text-sm text-ink">{n.body}</p>
                  <p className="mt-1 text-xs text-ink-soft">{new Date(n.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
            <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write a note…" rows={3}
              className="mb-2 w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
            <button onClick={addNote} disabled={noteSaving || !newNote.trim()}
              className="rounded-xl bg-navy px-4 py-1.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60">
              {noteSaving ? "Saving…" : "Save note"}
            </button>
          </div>
        )}

        {/* ── Lists ── */}
        {activeTab === "lists" && (
          <div>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-ink-soft">List memberships</h2>
            {contact.lists.length === 0 ? (
              <p className="mb-4 text-sm text-ink-soft">Not on any lists.</p>
            ) : (
              <div className="mb-4 space-y-2">
                {contact.lists.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-xl border border-navy/8 px-4 py-2.5">
                    <Link href={`/admin/lists/${l.id}`} className="text-sm font-medium text-navy hover:underline">
                      {l.name}
                    </Link>
                  </div>
                ))}
              </div>
            )}
            {availableLists.length > 0 && (
              <div className="border-t border-navy/8 pt-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-ink-soft">Add to list</p>
                <div className="flex gap-2">
                  <select value={addToListId} onChange={(e) => setAddToListId(e.target.value)}
                    className="flex-1 rounded-xl border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30">
                    <option value="">— Select a list —</option>
                    {availableLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <button onClick={addToList} disabled={!addToListId || addingToList}
                    className="rounded-xl bg-navy/8 px-4 py-1.5 text-sm font-semibold text-navy hover:bg-navy/15 disabled:opacity-60">
                    {addingToList ? "Adding…" : "Add"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Consent ── */}
        {activeTab === "consent" && (
          <div className="space-y-6">

            {/* Implied consent banner */}
            <div className={`rounded-xl border px-4 py-3 ${
              contact.userId
                ? "border-green-200 bg-green-50"
                : "border-navy/8 bg-cream-panel/40"
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-lg">{contact.userId ? "✅" : "ℹ️"}</span>
                <div>
                  <p className="text-sm font-semibold text-navy">
                    {contact.userId ? "Implied consent — has account" : "No platform account"}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {contact.userId
                      ? "This contact signed up for a Fixer Nation account, which implies consent to receive transactional communications."
                      : "This contact does not have a linked platform account. Explicit opt-in is required before sending campaigns."}
                  </p>
                </div>
              </div>
            </div>

            {/* Active suppression warning */}
            {suppression && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-lg">🚫</span>
                    <div>
                      <p className="text-sm font-semibold text-red-800">Suppressed — will not receive campaigns</p>
                      <p className="mt-0.5 text-xs text-red-700">
                        Type: {suppression.type.toLowerCase()} · Suppressed {new Date(suppression.suppressedAt).toLocaleDateString()}
                        {suppression.reason ? ` · ${suppression.reason}` : ""}
                      </p>
                    </div>
                  </div>
                  {suppression.type === "ADMIN" && (
                    <button
                      disabled={liftingSupp}
                      onClick={async () => {
                        if (!confirm("Lift this suppression? The address will be eligible for campaigns again.")) return;
                        setLiftingSupp(true);
                        try {
                          const r = await fetch(`/api/admin/suppression/${suppression.id}`, { method: "DELETE" });
                          if (r.ok) setSuppression(null);
                        } finally { setLiftingSupp(false); }
                      }}
                      className="shrink-0 rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">
                      {liftingSupp ? "…" : "Lift"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Consent topic toggles */}
            <div>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">Topic preferences</h2>
              <div className="space-y-3">
                {TOPICS.map((topic) => {
                  const opted = consentMap[topic] ?? null;
                  return (
                    <div key={topic} className="flex items-center justify-between rounded-xl border border-navy/8 px-4 py-3">
                      <span className="text-sm font-medium text-ink">
                        {topic.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <div className="flex gap-1.5">
                        <button onClick={() => setConsent(topic, true)}
                          className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                            opted === true ? "bg-green-600 text-white" : "bg-navy/8 text-ink-soft hover:bg-green-100"
                          }`}>
                          In
                        </button>
                        <button onClick={() => setConsent(topic, false)}
                          className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                            opted === false ? "bg-red-600 text-white" : "bg-navy/8 text-ink-soft hover:bg-red-100"
                          }`}>
                          Out
                        </button>
                        {opted === null && (
                          <span className="rounded-lg bg-navy/4 px-3 py-1 text-xs text-ink-soft/60">No record</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Campaigns ── */}
        {activeTab === "campaigns" && (
          <div>
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-ink-soft">Campaign history</h2>
            {contact.sends.length === 0 ? (
              <p className="text-sm text-ink-soft">No campaigns sent to this contact yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy/8 text-left text-xs font-bold uppercase tracking-widest text-ink-soft">
                    <th className="pb-2 pr-4">Campaign</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {contact.sends.map((s) => (
                    <tr key={s.id} className="border-b border-navy/5">
                      <td className="py-2 pr-4">{s.campaignName}</td>
                      <td className="py-2 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          s.status === "OPENED" || s.status === "CLICKED"  ? "bg-green-100 text-green-800" :
                          s.status === "BOUNCED" || s.status === "UNSUBSCRIBED" ? "bg-red-100 text-red-700" :
                          "bg-navy/8 text-navy"
                        }`}>
                          {s.status.toLowerCase()}
                        </span>
                      </td>
                      <td className="py-2 text-ink-soft">
                        {s.sentAt ? new Date(s.sentAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Addresses ── */}
        {activeTab === "addresses" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">Addresses</h2>
              {!addingAddress && editingAddressId === null && (
                <button onClick={() => setAddingAddress(true)}
                  className="text-xs font-semibold text-navy hover:underline">
                  + Add address
                </button>
              )}
            </div>

            {contact.addresses.length === 0 && !addingAddress && (
              <p className="mb-4 text-sm text-ink-soft">No addresses on file.</p>
            )}

            <div className="space-y-3">
              {contact.addresses.map((a) =>
                editingAddressId === a.id ? (
                  <AddressForm key={a.id}
                    initial={{ type: a.type ?? "", street: a.street ?? "", street2: a.street2 ?? "",
                      city: a.city ?? "", state: a.state ?? "", zip: a.zip ?? "",
                      country: a.country ?? "", isPrimary: a.isPrimary }}
                    saving={addrSaving}
                    onSave={(data) => saveAddress(data, a.id)}
                    onCancel={() => setEditingAddressId(null)}
                  />
                ) : (
                  <div key={a.id} className="rounded-xl border border-navy/8 p-4 text-sm">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {a.type && (
                          <span className="rounded-full bg-navy/8 px-2 py-0.5 text-xs font-semibold uppercase tracking-widest text-navy">
                            {a.type}
                          </span>
                        )}
                        {a.isPrimary && (
                          <span className="rounded-full bg-amber/30 px-2 py-0.5 text-xs font-semibold text-navy-dark">
                            Primary
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3 text-xs">
                        <button onClick={() => setEditingAddressId(a.id)} className="text-ink-soft hover:text-navy">Edit</button>
                        <button onClick={() => deleteAddress(a.id)} className="text-ink-soft hover:text-red-600">Remove</button>
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
        )}

        {/* ── Identities ── */}
        {activeTab === "identities" && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">Identity records</h2>
              {!addingIdentity && (
                <button onClick={() => setAddingIdentity(true)}
                  className="text-xs font-semibold text-navy hover:underline">
                  + Add identity
                </button>
              )}
            </div>

            {identities.length === 0 && !addingIdentity && (
              <p className="mb-4 text-sm text-ink-soft">No additional identities on file. Add alternate emails, phone numbers, or external IDs.</p>
            )}

            <div className="space-y-2 mb-4">
              {identities.map((i) => (
                <div key={i.id} className="flex items-center justify-between rounded-xl border border-navy/8 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest text-ink-soft w-20 shrink-0">
                        {i.type.replace("_", " ").toLowerCase()}
                      </span>
                      <span className="text-sm font-medium text-ink truncate">{i.value}</span>
                      {i.isPrimary && (
                        <span className="rounded-full bg-amber/30 px-2 py-0.5 text-xs font-semibold text-navy-dark">Primary</span>
                      )}
                    </div>
                    {i.label && <p className="mt-0.5 text-xs text-ink-soft ml-[5.5rem]">{i.label}</p>}
                  </div>
                  <button onClick={() => deleteIdentity(i.id)}
                    className="ml-3 shrink-0 text-xs text-ink-soft hover:text-red-600">
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {addingIdentity && (
              <div className="rounded-xl border border-navy/15 bg-cream-panel/40 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Type</label>
                    <select value={idForm.type} onChange={(e) => setIdForm((f) => ({ ...f, type: e.target.value }))}
                      className={inputCls}>
                      <option value="EMAIL">Email</option>
                      <option value="PHONE">Phone</option>
                      <option value="EXTERNAL_ID">External ID</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Value</label>
                    <input type="text" value={idForm.value} onChange={(e) => setIdForm((f) => ({ ...f, value: e.target.value }))}
                      placeholder="e.g. jane@other.com" className={inputCls} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Label (optional)</label>
                    <input type="text" value={idForm.label} onChange={(e) => setIdForm((f) => ({ ...f, label: e.target.value }))}
                      placeholder="e.g. Work email" className={inputCls} />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-soft">
                      <input type="checkbox" checked={idForm.isPrimary}
                        onChange={(e) => setIdForm((f) => ({ ...f, isPrimary: e.target.checked }))}
                        className="accent-navy" />
                      Mark as primary
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={addIdentity} disabled={idSaving || !idForm.value.trim()}
                    className="rounded-xl bg-navy px-4 py-1.5 text-xs font-bold text-white hover:bg-navy-dark disabled:opacity-60">
                    {idSaving ? "Saving…" : "Save"}
                  </button>
                  <button onClick={() => { setAddingIdentity(false); setIdForm({ type: "EMAIL", value: "", label: "", isPrimary: false }); }}
                    className="rounded-xl border border-navy/15 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-panel">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Custom fields ── */}
        {activeTab === "custom-fields" && customFieldDefs.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">Custom fields</h2>
              {!cfEditing ? (
                <button onClick={() => { setCfDraft({ ...cfValues }); setCfEditing(true); }}
                  className="text-xs font-semibold text-navy hover:underline">
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button disabled={cfSaving}
                    onClick={async () => {
                      setCfSaving(true);
                      try {
                        const values = customFieldDefs.map((d) => ({ fieldId: d.id, value: cfDraft[d.id] ?? "" }));
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
                  <button onClick={() => setCfEditing(false)} className="text-xs text-ink-soft hover:underline">
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-4">
              {customFieldDefs.map((d) => (
                <div key={d.id}>
                  <p className="mb-1 text-xs font-semibold text-ink-soft">
                    {d.label}{d.required && <span className="ml-1 text-red-400">*</span>}
                  </p>
                  {cfEditing ? (
                    d.type === "DROPDOWN" ? (
                      <select value={cfDraft[d.id] ?? ""} onChange={(e) => setCfDraft((x) => ({ ...x, [d.id]: e.target.value }))}
                        className={inputCls}>
                        <option value="">— Select —</option>
                        {d.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : d.type === "CHECKBOX" ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={cfDraft[d.id] === "true"}
                          onChange={(e) => setCfDraft((x) => ({ ...x, [d.id]: e.target.checked ? "true" : "" }))}
                          className="accent-navy" />
                        Yes
                      </label>
                    ) : d.type === "TEXTAREA" ? (
                      <textarea value={cfDraft[d.id] ?? ""} onChange={(e) => setCfDraft((x) => ({ ...x, [d.id]: e.target.value }))} rows={2}
                        className={inputCls} />
                    ) : (
                      <input
                        type={d.type === "NUMBER" ? "number" : d.type === "DATE" ? "date" : d.type === "URL" ? "url" : "text"}
                        value={cfDraft[d.id] ?? ""}
                        onChange={(e) => setCfDraft((x) => ({ ...x, [d.id]: e.target.value }))}
                        className={inputCls} />
                    )
                  ) : (
                    <p className="text-sm text-ink">
                      {cfValues[d.id]
                        ? (d.type === "CHECKBOX" ? (cfValues[d.id] === "true" ? "Yes" : "No") : cfValues[d.id])
                        : <span className="italic text-ink-soft">—</span>}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Merge modal */}
      {mergeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-navy">Merge another contact into this one</h2>
              <button onClick={() => setMergeOpen(false)} className="text-ink-soft hover:text-navy text-lg leading-none">×</button>
            </div>
            <p className="mb-4 text-sm text-ink-soft">
              Search for the contact to absorb. Their data will be merged here and their record deleted. This cannot be undone.
            </p>

            <input type="search" value={mergeSearch} onChange={(e) => { setMergeSearch(e.target.value); setMergeTarget(null); }}
              placeholder="Search by name or email…"
              className="mb-3 w-full rounded-xl border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />

            {mergeSearching && <p className="py-2 text-center text-sm text-ink-soft">Searching…</p>}

            {!mergeSearching && mergeSearch.length >= 2 && mergeResults.length === 0 && (
              <p className="py-2 text-center text-sm text-ink-soft">No contacts found.</p>
            )}

            {mergeResults.length > 0 && !mergeTarget && (
              <div className="mb-4 max-h-48 overflow-y-auto rounded-xl border border-navy/8 divide-y divide-navy/5">
                {mergeResults.map((c) => {
                  const name = [c.firstName, c.lastName].filter(Boolean).join(" ");
                  return (
                    <button key={c.id} onClick={() => setMergeTarget(c)}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-cream-panel transition-colors">
                      <span className="font-medium text-navy">{name || c.email}</span>
                      {name && <span className="ml-2 text-ink-soft text-xs">{c.email}</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {mergeTarget && (
              <div className="mb-4 rounded-xl border border-amber/40 bg-amber/10 px-4 py-3">
                <p className="text-sm font-semibold text-navy-dark">
                  Absorb: {[mergeTarget.firstName, mergeTarget.lastName].filter(Boolean).join(" ") || mergeTarget.email}
                </p>
                <p className="text-xs text-ink-soft mt-0.5">{mergeTarget.email}</p>
                <p className="mt-2 text-xs text-ink-soft">
                  All their tags, lists, consents, campaign history, notes, and addresses will be moved here. Duplicate entries will be dropped. Their contact record will be deleted.
                </p>
                <button onClick={() => setMergeTarget(null)} className="mt-2 text-xs text-ink-soft hover:underline">
                  Choose a different contact
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={doMerge} disabled={!mergeTarget || merging}
                className="rounded-xl bg-navy px-5 py-2 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-50">
                {merging ? "Merging…" : "Confirm merge"}
              </button>
              <button onClick={() => setMergeOpen(false)}
                className="rounded-xl border border-navy/15 px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-cream-panel">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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
  type SupDb = {
    suppressionRecord: {
      findFirst: (a: unknown) => Promise<{ id: string; type: string; reason: string | null; suppressedAt: Date } | null>;
    };
  };
  type IdDb = {
    contactIdentity: {
      findMany: (a: unknown) => Promise<{ id: string; type: string; value: string; label: string | null; isPrimary: boolean; createdAt: Date }[]>;
    };
  };
  const cfDb = db as never as CfDb;
  const supDb = db as never as SupDb;
  const idDb = db as never as IdDb;

  const contactRaw = await db.contact.findUnique({ where: { id }, select: { email: true } });
  if (!contactRaw) return { notFound: true };

  const [contact, allLists, cfDefs, cfVals, suppression, identitiesRaw] = await Promise.all([
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
    supDb.suppressionRecord.findFirst({
      where: { email: contactRaw.email, liftedAt: null } as never,
      orderBy: { suppressedAt: "desc" } as never,
    }),
    idDb.contactIdentity.findMany({
      where: { contactId: id } as never,
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] as never,
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
        attribution: contact.attribution
          ? {
              source: contact.attribution.source,
              attributedAt: contact.attribution.attributedAt.toISOString(),
              campaignId: contact.attribution.campaignId ?? null,
            }
          : null,
        addresses: contact.addresses.map((a) => ({
          id: a.id, type: a.type, street: a.street, street2: a.street2,
          city: a.city, state: a.state, zip: a.zip, country: a.country, isPrimary: a.isPrimary,
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
      customFieldDefs: cfDefs.map((d) => ({
        id: d.id, slug: d.slug, label: d.label, type: d.type,
        options: Array.isArray(d.options) ? d.options as string[] : null,
        required: d.required,
      })),
      customFieldValues: cfVals.map((v) => ({ fieldId: v.fieldId, value: v.value })),
      activeSuppression: suppression
        ? { id: suppression.id, type: suppression.type, reason: suppression.reason, suppressedAt: suppression.suppressedAt.toISOString() }
        : null,
      identities: identitiesRaw.map((i) => ({
        id: i.id,
        type: i.type,
        value: i.value,
        label: i.label,
        isPrimary: i.isPrimary,
        createdAt: i.createdAt.toISOString(),
      })),
    },
  };
};
