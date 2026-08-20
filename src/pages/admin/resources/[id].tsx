import { useState, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import type { Resource } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

const RESOURCE_TYPES = ["Guide", "Worksheet", "Video", "Template", "Tool"];

function ImageField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/resources/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Upload failed.");
      } else {
        onChange(data.url);
      }
    } catch {
      setUploadError("Network error during upload.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        Cover Image <span className="font-normal text-slate-400">(optional)</span>
      </label>
      <div className="mb-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          {uploading ? "Uploading…" : "Choose file"}
        </button>
        <span className="text-xs text-slate-400">JPEG, PNG, GIF or WebP · max 5 MB</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFile}
        />
      </div>
      {uploadError && <p className="mb-2 text-xs text-red-600">{uploadError}</p>}
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="or paste an image URL…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
      />
      {value && (
        <div className="mt-2 flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Preview" className="h-20 w-28 rounded-lg object-cover border border-slate-200" />
          <button type="button" onClick={() => onChange("")} className="text-xs text-slate-400 hover:text-red-600">
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

const toDatetimeLocal = (date: string | null): string => {
  if (!date) return "";
  const d = new Date(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface Props {
  resource: Resource;
}

const AdminResourceEdit: NextPageWithLayout<Props> = ({ resource }) => {
  const router = useRouter();

  const [form, setForm] = useState({
    title: resource.title,
    slug: resource.slug,
    excerpt: resource.excerpt ?? "",
    body: resource.body,
    type: resource.type ?? "",
    imageUrl: resource.imageUrl ?? "",
    fileUrl: resource.fileUrl ?? "",
    authorName: resource.authorName,
    publishedAt: toDatetimeLocal(resource.publishedAt as unknown as string | null),
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      excerpt: form.excerpt.trim() || null,
      body: form.body.trim(),
      type: form.type.trim() || null,
      imageUrl: form.imageUrl.trim() || null,
      fileUrl: form.fileUrl.trim() || null,
      authorName: form.authorName.trim() || "Anthony J. Placito",
      publishedAt: form.publishedAt || null,
    };

    try {
      const res = await fetch(`/api/admin/resources/${resource.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Something went wrong.");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${resource.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch(`/api/admin/resources/${resource.id}`, { method: "DELETE" });
    await router.push("/admin/resources");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/admin/resources" className="text-sm text-slate-500 no-underline hover:text-navy">
          ← Resources
        </Link>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{resource.title}</h1>
            {resource.publishedAt ? (
              <span className="mt-1 inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                Published
              </span>
            ) : (
              <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                Draft
              </span>
            )}
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
        {saveError && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>}
        {saved && <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">Saved.</div>}

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
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="type">
            Type <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <select
            id="type"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          >
            <option value="">— no type —</option>
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="excerpt">
            Excerpt <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="excerpt"
            value={form.excerpt}
            onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
            rows={2}
            placeholder="One or two lines shown on the index."
            className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="body">Body</label>
          <textarea
            id="body"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={12}
            required
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
          <p className="mt-1 text-xs text-slate-400">Line breaks carry through to the live page.</p>
        </div>

        <ImageField value={form.imageUrl} onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))} />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="fileUrl">
            Download File URL <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="fileUrl"
            type="url"
            value={form.fileUrl}
            onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))}
            placeholder="https://…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
          <p className="mt-1 text-xs text-slate-400">Direct link to a PDF, worksheet, or downloadable file.</p>
        </div>

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
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Publish Date <span className="font-normal text-slate-400">(leave blank to save as draft)</span>
          </label>
          <input
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
    </div>
  );
};

AdminResourceEdit.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }

  const { id } = context.params as { id: string };
  const resource = await db.resource.findUnique({ where: { id } });
  if (!resource) return { notFound: true };

  return { props: { resource: JSON.parse(JSON.stringify(resource)) } };
};

export default AdminResourceEdit;
