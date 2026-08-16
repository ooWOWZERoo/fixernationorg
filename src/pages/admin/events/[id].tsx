import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface Attendee {
  userId: string;
  name: string | null;
  email: string;
  status: string;
}

interface EventData {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  location: string | null;
  isVirtual: boolean;
  startsAt: string;
  endsAt: string | null;
  priceCents: number;
  capacity: number | null;
  publishedAt: string | null;
}

interface Props {
  event: EventData;
  attendees: Attendee[];
}

function toDatetimeLocal(iso: string) {
  return iso.slice(0, 16);
}

const EditEventPage: NextPageWithLayout<Props> = ({ event, attendees }) => {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
    title: event.title,
    slug: event.slug,
    description: event.description ?? "",
    coverUrl: event.coverUrl ?? "",
    location: event.location ?? "",
    isVirtual: event.isVirtual,
    startsAt: toDatetimeLocal(event.startsAt),
    endsAt: event.endsAt ? toDatetimeLocal(event.endsAt) : "",
    priceCents: String(event.priceCents / 100),
    capacity: event.capacity ? String(event.capacity) : "",
    publishedAt: event.publishedAt,
  });

  function set(field: string, value: string | boolean | null) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSaved(false);
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        description: form.description.trim() || null,
        coverUrl: form.coverUrl.trim() || null,
        location: form.location.trim() || null,
        isVirtual: form.isVirtual,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        priceCents: Math.round(parseFloat(form.priceCents || "0") * 100),
        capacity: form.capacity ? parseInt(form.capacity) : null,
      };
      const res = await fetch(`/api/admin/events/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Save failed."); return; }
      setSaved(true);
    } catch { setError("Something went wrong."); }
    finally { setSaving(false); }
  }

  async function togglePublish() {
    const newVal = !form.publishedAt ? new Date().toISOString() : null;
    const res = await fetch(`/api/admin/events/${event.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publishedAt: newVal }),
    });
    if (res.ok) set("publishedAt", newVal);
  }

  async function handleDelete() {
    if (!confirm("Delete this event? This cannot be undone.")) return;
    setDeleting(true);
    const res = await fetch(`/api/admin/events/${event.id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/events");
    else setDeleting(false);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/events" className="text-sm font-semibold text-ink-soft no-underline hover:text-navy">
            ← Events
          </Link>
          <h1 className="text-2xl font-extrabold text-navy">{event.title}</h1>
          {form.publishedAt ? (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">Published</span>
          ) : (
            <span className="rounded-full bg-navy/8 px-2.5 py-0.5 text-xs font-bold text-ink-soft">Draft</span>
          )}
        </div>
        <button
          onClick={togglePublish}
          className="rounded-xl border border-navy/20 px-4 py-2 text-sm font-semibold text-navy hover:bg-cream-panel"
        >
          {form.publishedAt ? "Unpublish" : "Publish"}
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-navy/8 bg-white p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Title</label>
              <input type="text" required value={form.title} onChange={(e) => set("title", e.target.value)}
                className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-sm text-navy focus:border-amber focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Slug</label>
              <input type="text" required value={form.slug}
                onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 font-mono text-sm text-navy focus:border-amber focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Description</label>
              <textarea rows={5} value={form.description} onChange={(e) => set("description", e.target.value)}
                className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-sm text-navy focus:border-amber focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Cover image URL</label>
              <input type="url" value={form.coverUrl} onChange={(e) => set("coverUrl", e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-sm text-navy focus:border-amber focus:outline-none" />
            </div>
          </div>

          <div className="rounded-2xl border border-navy/8 bg-white p-6 space-y-4">
            <div className="flex items-center gap-3">
              <input type="checkbox" id="isVirtual" checked={form.isVirtual}
                onChange={(e) => set("isVirtual", e.target.checked)} className="h-4 w-4 rounded" />
              <label htmlFor="isVirtual" className="text-sm font-semibold text-navy">Online event</label>
            </div>
            {!form.isVirtual && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Location</label>
                <input type="text" value={form.location} onChange={(e) => set("location", e.target.value)}
                  className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-sm text-navy focus:border-amber focus:outline-none" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Starts</label>
                <input type="datetime-local" required value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)}
                  className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-sm text-navy focus:border-amber focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Ends</label>
                <input type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)}
                  className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-sm text-navy focus:border-amber focus:outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Price ($)</label>
                <input type="number" min="0" step="0.01" value={form.priceCents} onChange={(e) => set("priceCents", e.target.value)}
                  className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-sm text-navy focus:border-amber focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Capacity</label>
                <input type="number" min="1" value={form.capacity} onChange={(e) => set("capacity", e.target.value)}
                  placeholder="Unlimited"
                  className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-sm text-navy focus:border-amber focus:outline-none" />
              </div>
            </div>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3"><p className="text-sm font-semibold text-red-700">{error}</p></div>}
          {saved && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3"><p className="text-sm font-semibold text-green-700">Saved.</p></div>}

          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="rounded-xl bg-amber px-6 py-2.5 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50">
                {saving ? "Saving..." : "Save changes"}
              </button>
              <Link href="/admin/events" className="rounded-xl border border-navy/15 px-6 py-2.5 text-sm font-semibold text-navy no-underline hover:bg-cream-panel">
                Cancel
              </Link>
            </div>
            <button type="button" onClick={handleDelete} disabled={deleting}
              className="text-sm font-semibold text-red-500 hover:text-red-700 disabled:opacity-50">
              {deleting ? "Deleting..." : "Delete event"}
            </button>
          </div>
        </form>

        {/* Attendees */}
        <div>
          <h2 className="mb-3 text-sm font-extrabold uppercase tracking-widest text-ink-soft">
            Attendees ({attendees.filter((a) => a.status === "REGISTERED").length})
          </h2>
          {attendees.length === 0 ? (
            <div className="rounded-2xl border border-navy/8 bg-white p-6 text-center">
              <p className="text-sm text-ink-soft">No RSVPs yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attendees.map((a) => (
                <div key={a.userId} className="flex items-center justify-between rounded-xl border border-navy/8 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-navy">{a.name ?? a.email}</p>
                    {a.name && <p className="text-xs text-ink-soft">{a.email}</p>}
                  </div>
                  <span className={`text-xs font-bold ${a.status === "REGISTERED" ? "text-green-600" : a.status === "WAITLISTED" ? "text-amber-dark" : "text-ink-soft"}`}>
                    {a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

EditEventPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default EditEventPage;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const { id } = context.params as { id: string };
  const event = await db.event.findUnique({
    where: { id },
    include: {
      rsvps: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!event) return { notFound: true };

  return {
    props: {
      event: {
        id: event.id, title: event.title, slug: event.slug,
        description: event.description, coverUrl: event.coverUrl,
        location: event.location, isVirtual: event.isVirtual,
        startsAt: event.startsAt.toISOString(), endsAt: event.endsAt?.toISOString() ?? null,
        priceCents: event.priceCents, capacity: event.capacity,
        publishedAt: event.publishedAt?.toISOString() ?? null,
      },
      attendees: event.rsvps.map((r) => ({
        userId: r.user.id, name: r.user.name, email: r.user.email ?? "", status: r.status,
      })),
    },
  };
};
