import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import type { MorningBoost } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { ImageField } from "@/components/admin/ImageField";
import { VideoField } from "@/components/admin/VideoField";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import type { NextPageWithLayout } from "@/types/next";

const toDatetimeLocal = (date: string | null): string => {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface Props {
  entry: MorningBoost;
}

const AdminMorningBoostEdit: NextPageWithLayout<Props> = ({ entry }) => {
  const router = useRouter();

  const [form, setForm] = useState({
    title: entry.title,
    slug: entry.slug,
    excerpt: entry.excerpt ?? "",
    body: entry.body,
    imageUrl: entry.imageUrl ?? "",
    videoUrl: entry.videoUrl ?? "",
    authorName: entry.authorName,
    publishedAt: toDatetimeLocal(entry.publishedAt as unknown as string | null),
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Toast independent of scroll position — the old "Saved." banner rendered
  // at the top of the form while Save is at the bottom, so an admin who
  // scrolled down to save never saw it.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Next.js reuses this same page component instance when navigating from
  // one entry's edit page to another (e.g. Duplicate's redirect) — it does
  // NOT remount, so `form` must be explicitly resynced whenever the entry
  // underneath us actually changes, or the inputs keep showing stale data
  // from the previous entry even though `entry` itself has updated.
  useEffect(() => {
    setForm({
      title: entry.title,
      slug: entry.slug,
      excerpt: entry.excerpt ?? "",
      body: entry.body,
      imageUrl: entry.imageUrl ?? "",
      videoUrl: entry.videoUrl ?? "",
      authorName: entry.authorName,
      publishedAt: toDatetimeLocal(entry.publishedAt as unknown as string | null),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  useEffect(() => {
    if (router.query.created === "1") {
      setToast("Entry created.");
      // Strip the query param so a page refresh doesn't re-show the toast.
      router.replace(`/admin/morning-boost/${entry.id}`, undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    // Browser-local -> UTC conversion for the timezone-naive datetime-local
    // value. The discrete-args Date constructor interprets its inputs as
    // the browser's local time (matching what the admin actually typed),
    // and toISOString() turns that into an unambiguous UTC instant, so the
    // server's `new Date(publishedAt)` always parses the intended moment.
    const publishedAtIso = (() => {
      if (!form.publishedAt) return null;
      const [datePart, timePart] = form.publishedAt.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hour, minute] = timePart.split(":").map(Number);
      return new Date(year, month - 1, day, hour, minute).toISOString();
    })();

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      excerpt: form.excerpt.trim() || null,
      body: form.body.trim(),
      imageUrl: form.imageUrl.trim() || null,
      videoUrl: form.videoUrl.trim() || null,
      authorName: form.authorName.trim() || "Anthony J. Placito",
      publishedAt: publishedAtIso,
    };

    try {
      const res = await fetch(`/api/admin/morning-boost/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Something went wrong.");
      } else {
        setToast("Saved.");
      }
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${entry.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch(`/api/admin/morning-boost/${entry.id}`, { method: "DELETE" });
    await router.push("/admin/morning-boost");
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const res = await fetch("/api/admin/morning-boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${form.title.trim()} (Copy)`,
          slug: `${form.slug.trim()}-copy-${Date.now().toString(36)}`,
          excerpt: form.excerpt.trim() || undefined,
          body: form.body.trim(),
          imageUrl: form.imageUrl.trim() || undefined,
          videoUrl: form.videoUrl.trim() || undefined,
          authorName: form.authorName.trim() || "Anthony J. Placito",
          publishedAt: null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Something went wrong duplicating this entry.");
        setDuplicating(false);
        return;
      }
      await router.push(`/admin/morning-boost/${data.id}?created=1`);
    } catch {
      setSaveError("Network error. Please try again.");
      setDuplicating(false);
    }
  };

  const handleCopyExcerptToBody = () => {
    const escaped = form.excerpt
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    setForm((f) => ({ ...f, body: `<p>${escaped}</p>` }));
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/admin/morning-boost" className="text-sm text-slate-500 no-underline hover:text-navy">
          ← Morning Boost
        </Link>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{entry.title}</h1>
            {entry.publishedAt ? (
              <span className="mt-1 inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                Published
              </span>
            ) : (
              <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                Draft
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleDuplicate}
              disabled={duplicating}
              className="text-sm font-medium text-slate-600 hover:text-navy disabled:opacity-50"
            >
              {duplicating ? "Duplicating…" : "Duplicate"}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
        {saveError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="title">Title</label>
          <input
            id="title"
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="slug">Slug</label>
          <input
            id="slug"
            type="text"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            required
            pattern="[a-z0-9-]+"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
          <p className="mt-1 text-xs text-slate-400">Lowercase letters, numbers, and hyphens only.</p>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700" htmlFor="excerpt">
              Excerpt <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <button
              type="button"
              onClick={handleCopyExcerptToBody}
              disabled={!form.excerpt.trim()}
              className="text-xs font-medium text-navy hover:underline disabled:pointer-events-none disabled:text-slate-300"
            >
              Copy excerpt into body
            </button>
          </div>
          <textarea
            id="excerpt"
            value={form.excerpt}
            onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
            rows={2}
            placeholder="One or two lines shown on the Morning Boost index."
            className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Body</label>
          <RichTextEditor
            value={form.body}
            onChange={(html) => setForm((f) => ({ ...f, body: html }))}
          />
        </div>

        <ImageField
          value={form.imageUrl}
          onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
        />

        <VideoField
          value={form.videoUrl}
          onChange={(url) => setForm((f) => ({ ...f, videoUrl: url }))}
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="authorName">Author Name</label>
          <input
            id="authorName"
            type="text"
            value={form.authorName}
            onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="publishedAt">
            Publish Date <span className="font-normal text-slate-400">(leave blank to save as draft)</span>
          </label>
          <input
            id="publishedAt"
            type="datetime-local"
            value={form.publishedAt}
            onChange={(e) => setForm((f) => ({ ...f, publishedAt: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
          {toast}
          <button onClick={() => setToast(null)} className="text-white/60 hover:text-white">✕</button>
        </div>
      )}
    </div>
  );
};

AdminMorningBoostEdit.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }

  const { id } = context.params as { id: string };
  const entry = await db.morningBoost.findUnique({ where: { id } });
  if (!entry) return { notFound: true };

  return { props: { entry: JSON.parse(JSON.stringify(entry)) } };
};

export default AdminMorningBoostEdit;
