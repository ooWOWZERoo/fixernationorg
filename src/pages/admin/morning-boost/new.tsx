import { useState, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

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
      const res = await fetch("/api/admin/morning-boost/upload", { method: "POST", body: fd });
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

      {/* File picker */}
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

      {/* URL fallback */}
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="or paste an image URL…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
      />

      {/* Preview */}
      {value && (
        <div className="mt-2 flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Preview" className="h-20 w-28 rounded-lg object-cover border border-slate-200" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-slate-400 hover:text-red-600"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

const toSlug = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

interface FormState {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  imageUrl: string;
  authorName: string;
  publishedAt: string;
}

const AdminMorningBoostNew: NextPageWithLayout = () => {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    title: "",
    slug: "",
    excerpt: "",
    body: "",
    imageUrl: "",
    authorName: "Anthony J. Placito",
    publishedAt: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTitleChange = (title: string) => {
    setForm((f) => ({ ...f, title, slug: toSlug(title) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      excerpt: form.excerpt.trim() || undefined,
      body: form.body.trim(),
      imageUrl: form.imageUrl.trim() || undefined,
      authorName: form.authorName.trim() || "Anthony J. Placito",
      publishedAt: form.publishedAt || null,
    };

    try {
      const res = await fetch("/api/admin/morning-boost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setSaving(false);
        return;
      }
      await router.push(`/admin/morning-boost/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/admin/morning-boost" className="text-sm text-slate-500 no-underline hover:text-navy">
          ← Morning Boost
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">New Entry</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="title">Title</label>
          <input
            id="title"
            type="text"
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
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
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
          <p className="mt-1 text-xs text-slate-400">Lowercase letters, numbers, and hyphens only.</p>
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
            placeholder="Write your entry. Line breaks are kept as-is."
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
          <p className="mt-1 text-xs text-slate-400">Line breaks carry through to the live page.</p>
        </div>

        <ImageField
          value={form.imageUrl}
          onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="authorName">Author Name</label>
          <input
            id="authorName"
            type="text"
            value={form.authorName}
            onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
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

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <Link
            href="/admin/morning-boost"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors"
          >
            {saving ? "Creating…" : "Create Entry"}
          </button>
        </div>
      </form>
    </div>
  );
};

AdminMorningBoostNew.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }
  return { props: {} };
};

export default AdminMorningBoostNew;
