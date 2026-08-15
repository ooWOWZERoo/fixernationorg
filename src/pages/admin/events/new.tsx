import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

function slugify(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const NewEventPage: NextPageWithLayout = () => {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    description: "",
    coverUrl: "",
    location: "",
    isVirtual: false,
    startsAt: "",
    endsAt: "",
    priceCents: "0",
    capacity: "",
    publishNow: false,
  });

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const title = e.target.value;
    setForm((f) => ({ ...f, title, slug: slugEdited ? f.slug : slugify(title) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
        publishedAt: form.publishNow ? new Date().toISOString() : null,
      };
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Save failed."); return; }
      router.push(`/admin/events/${data.id}`);
    } catch {
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/admin/events" className="text-sm font-semibold text-ink-soft no-underline hover:text-navy">
          ← Events
        </Link>
        <h1 className="text-2xl font-extrabold text-navy">New event</h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        <div className="rounded-2xl border border-navy/8 bg-white p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Title *</label>
            <input
              type="text" required value={form.title}
              onChange={handleTitleChange}
              className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-sm text-navy focus:border-amber focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Slug *</label>
            <input
              type="text" required value={form.slug}
              onChange={(e) => { setSlugEdited(true); set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }}
              className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 font-mono text-sm text-navy focus:border-amber focus:outline-none"
            />
            <p className="mt-1 text-xs text-ink-soft">URL: /events/{form.slug || "slug"}</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Description</label>
            <textarea
              rows={4} value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-sm text-navy focus:border-amber focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Cover image URL</label>
            <input
              type="url" value={form.coverUrl}
              onChange={(e) => set("coverUrl", e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-sm text-navy focus:border-amber focus:outline-none"
            />
          </div>
        </div>

        <div className="rounded-2xl border border-navy/8 bg-white p-6 space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox" id="isVirtual" checked={form.isVirtual}
              onChange={(e) => set("isVirtual", e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <label htmlFor="isVirtual" className="text-sm font-semibold text-navy">Online event</label>
          </div>

          {!form.isVirtual && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Location</label>
              <input
                type="text" value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="City, State or address"
                className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-sm text-navy focus:border-amber focus:outline-none"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Starts *</label>
              <input
                type="datetime-local" required value={form.startsAt}
                onChange={(e) => set("startsAt", e.target.value)}
                className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-sm text-navy focus:border-amber focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Ends</label>
              <input
                type="datetime-local" value={form.endsAt}
                onChange={(e) => set("endsAt", e.target.value)}
                className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-sm text-navy focus:border-amber focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Price ($)</label>
              <input
                type="number" min="0" step="0.01" value={form.priceCents}
                onChange={(e) => set("priceCents", e.target.value)}
                className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-sm text-navy focus:border-amber focus:outline-none"
              />
              <p className="mt-1 text-xs text-ink-soft">0 = free</p>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1">Capacity</label>
              <input
                type="number" min="1" value={form.capacity}
                onChange={(e) => set("capacity", e.target.value)}
                placeholder="Unlimited"
                className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-2.5 text-sm text-navy focus:border-amber focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-navy/8 bg-white p-6">
          <div className="flex items-center gap-3">
            <input
              type="checkbox" id="publishNow" checked={form.publishNow}
              onChange={(e) => set("publishNow", e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <label htmlFor="publishNow" className="text-sm font-semibold text-navy">Publish immediately</label>
          </div>
          <p className="mt-1 pl-7 text-xs text-ink-soft">If unchecked, saves as draft. You can publish from the edit page.</p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm font-semibold text-red-700">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit" disabled={saving}
            className="rounded-xl bg-amber px-6 py-2.5 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create event"}
          </button>
          <Link href="/admin/events" className="rounded-xl border border-navy/15 px-6 py-2.5 text-sm font-semibold text-navy no-underline hover:bg-cream-panel">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
};

NewEventPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default NewEventPage;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: "/", permanent: false } };
  }
  return { props: {} };
};
