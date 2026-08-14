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

interface ConsentRow { topic: Topic; optedIn: boolean }
interface NoteRow { id: string; body: string; createdAt: string }
interface ListRow { id: string; name: string }
interface SendRow { id: string; campaignName: string; status: string; sentAt: string | null }

interface Props {
  contact: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    company: string | null;
    source: string | null;
    createdAt: string;
    userId: string | null;
    consents: ConsentRow[];
    tags: string[];
    notes: NoteRow[];
    lists: ListRow[];
    sends: SendRow[];
  };
}

const AdminContactDetailPage: NextPageWithLayout<Props> = ({ contact: initial }) => {
  const router = useRouter();
  const [contact, setContact] = useState(initial);
  const [newNote, setNewNote] = useState("");
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);

  async function patch(action: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    if (!res.ok) throw new Error("Failed");
    return res;
  }

  async function addNote() {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      await patch("add-note", { body: newNote.trim() });
      setContact((c) => ({ ...c, notes: [{ id: Math.random().toString(), body: newNote.trim(), createdAt: new Date().toISOString() }, ...c.notes] }));
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
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h1 className="text-xl font-extrabold text-navy">
                  {contact.firstName || contact.lastName ? `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() : contact.email}
                </h1>
                <p className="text-sm text-ink-soft">{contact.email}</p>
                {contact.company && <p className="text-sm text-ink-soft">{contact.company}</p>}
                {contact.phone && <p className="text-sm text-ink-soft">{contact.phone}</p>}
              </div>
              <button onClick={deleteContact}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50">
                Delete
              </button>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-ink-soft">
              <span>Source: {contact.source ?? "—"}</span>
              <span>Added: {new Date(contact.createdAt).toLocaleDateString()}</span>
              {contact.userId && <span className="text-green-700">Linked to account</span>}
            </div>
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
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
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
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Write a note…"
              rows={2}
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

        {/* Right: consent + lists */}
        <div className="space-y-6">
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
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${opted === true ? "bg-green-600 text-white" : "bg-navy/8 text-ink-soft hover:bg-green-100"}`}
                      >In</button>
                      <button
                        onClick={() => setConsent(topic, false)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${opted === false ? "bg-red-600 text-white" : "bg-navy/8 text-ink-soft hover:bg-red-100"}`}
                      >Out</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lists */}
          <div className="rounded-2xl border border-navy/8 bg-white p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">Lists</h2>
            {contact.lists.length === 0 ? (
              <p className="text-sm text-ink-soft">Not on any lists.</p>
            ) : (
              <div className="space-y-1.5">
                {contact.lists.map((l) => (
                  <div key={l.id} className="text-sm">
                    <a href={`/admin/lists/${l.id}`} className="font-medium text-navy hover:underline">{l.name}</a>
                  </div>
                ))}
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
  const contact = await db.contact.findUnique({
    where: { id },
    include: {
      consents: true,
      tags: { orderBy: { tag: "asc" } },
      notes: { orderBy: { createdAt: "desc" } },
      listMemberships: { include: { list: { select: { id: true, name: true } } } },
      campaignSends: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { campaign: { select: { name: true } } },
      },
    },
  });

  if (!contact) return { notFound: true };

  return {
    props: {
      contact: {
        id: contact.id,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone,
        company: contact.company,
        source: contact.source,
        createdAt: contact.createdAt.toISOString(),
        userId: contact.userId,
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
    },
  };
};
