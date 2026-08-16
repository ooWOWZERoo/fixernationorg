import Head from "next/head";
import { useState, useRef, useCallback } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface AssetRow {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  alt: string | null;
  tags: string | null;
  folder: string;
  createdAt: string;
}

interface Props { assets: AssetRow[] }

function fmtBytes(b: number | null): string {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

const MediaLibraryPage: NextPageWithLayout<Props> = ({ assets: initial }) => {
  const [assets, setAssets] = useState<AssetRow[]>(initial);
  const [q, setQ] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<AssetRow | null>(null);
  const [editingAlt, setEditingAlt] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = q
    ? assets.filter(a =>
        a.name.toLowerCase().includes(q.toLowerCase()) ||
        (a.tags ?? "").toLowerCase().includes(q.toLowerCase()) ||
        (a.alt ?? "").toLowerCase().includes(q.toLowerCase())
      )
    : assets;

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/admin/media/upload", { method: "POST", body: fd });
      const data = await r.json();
      if (r.ok) {
        setAssets(prev => [data, ...prev]);
      } else {
        setUploadError(data?.error ?? "Upload failed.");
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this image? It may be used in email templates.")) return;
    setDeleting(id);
    try {
      const r = await fetch(`/api/admin/media/${id}`, { method: "DELETE" });
      if (r.ok) {
        setAssets(prev => prev.filter(a => a.id !== id));
        if (selected?.id === id) setSelected(null);
      } else {
        alert("Delete failed.");
      }
    } finally {
      setDeleting(null);
    }
  }

  async function saveAlt(id: string, alt: string) {
    await fetch(`/api/admin/media/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt }),
    });
    setAssets(prev => prev.map(a => a.id === id ? { ...a, alt } : a));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, alt } : prev);
    setEditingAlt(null);
  }

  return (
    <>
      <Head><title>Media library — Admin</title></Head>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-navy">Media library</h1>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50">
          {uploading ? "Uploading…" : "+ Upload image"}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden" onChange={handleFileChange} />
      </div>

      {uploadError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{uploadError}</div>
      )}

      <div className="mb-5">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, alt text, or tags…"
          className="w-full max-w-sm rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
      </div>

      <div className="flex gap-6">
        {/* Grid */}
        <div className="flex-1">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
              <p className="text-sm text-ink-soft">
                {assets.length === 0
                  ? "No images uploaded yet. Click \"+ Upload image\" to get started."
                  : "No images match your search."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.map(a => (
                <button key={a.id} type="button" onClick={() => setSelected(a)}
                  className={`group relative overflow-hidden rounded-xl border-2 transition-colors ${
                    selected?.id === a.id ? "border-navy" : "border-transparent hover:border-navy/30"
                  }`}>
                  <div className="aspect-square bg-slate-100 overflow-hidden">
                    <img src={a.url} alt={a.alt ?? a.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="px-2 py-1.5 text-left">
                    <p className="truncate text-xs font-medium text-navy">{a.name}</p>
                    <p className="text-xs text-ink-soft">{fmtBytes(a.bytes)}</p>
                  </div>
                  <div className="absolute inset-0 flex items-start justify-end p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button"
                      onClick={e => { e.stopPropagation(); handleDelete(a.id); }}
                      disabled={deleting === a.id}
                      className="rounded-full bg-red-500 p-1 text-white shadow hover:bg-red-600 disabled:opacity-50"
                      title="Delete">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                        <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 shrink-0">
            <div className="sticky top-4 rounded-2xl border border-navy/8 bg-white p-4">
              <div className="mb-3 aspect-video overflow-hidden rounded-lg bg-slate-100">
                <img src={selected.url} alt={selected.alt ?? selected.name} className="h-full w-full object-contain" />
              </div>
              <h3 className="mb-3 text-sm font-bold text-navy break-all">{selected.name}</h3>

              <dl className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Size</dt>
                  <dd className="font-medium text-navy">{fmtBytes(selected.bytes)}</dd>
                </div>
                {selected.width && selected.height && (
                  <div className="flex justify-between">
                    <dt className="text-ink-soft">Dimensions</dt>
                    <dd className="font-medium text-navy">{selected.width} × {selected.height}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Type</dt>
                  <dd className="font-medium text-navy">{selected.mimeType.split("/")[1]?.toUpperCase() ?? selected.mimeType}</dd>
                </div>
              </dl>

              {/* Alt text editor */}
              <div className="mt-4">
                <p className="mb-1 text-xs font-semibold text-ink-soft">Alt text</p>
                {editingAlt === selected.id ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      defaultValue={selected.alt ?? ""}
                      id="alt-textarea"
                      rows={2}
                      className="w-full rounded-lg border border-navy/15 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-navy/30"
                    />
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => {
                          const el = document.getElementById("alt-textarea") as HTMLTextAreaElement;
                          saveAlt(selected.id, el.value);
                        }}
                        className="flex-1 rounded-lg bg-navy px-2 py-1 text-xs font-bold text-white hover:bg-navy-dark">
                        Save
                      </button>
                      <button type="button" onClick={() => setEditingAlt(null)}
                        className="flex-1 rounded-lg border border-navy/15 px-2 py-1 text-xs text-ink-soft hover:bg-cream-panel">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setEditingAlt(selected.id)}
                    className="w-full rounded-lg border border-navy/8 bg-slate-50 px-2 py-1.5 text-left text-xs text-ink-soft hover:bg-cream-panel">
                    {selected.alt || <em>Click to add alt text</em>}
                  </button>
                )}
              </div>

              {/* Copy URL */}
              <button type="button"
                onClick={() => navigator.clipboard.writeText(selected.url)}
                className="mt-4 w-full rounded-xl border border-navy/15 py-2 text-xs font-medium text-navy hover:bg-cream-panel">
                Copy URL
              </button>

              <button type="button" onClick={() => handleDelete(selected.id)} disabled={deleting === selected.id}
                className="mt-2 w-full rounded-xl border border-red-200 py-2 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50">
                {deleting === selected.id ? "Deleting…" : "Delete image"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

MediaLibraryPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: "/signin", permanent: false } };
  }

  const assets = await (db as unknown as {
    mediaAsset: {
      findMany: (args: unknown) => Promise<{
        id: string; name: string; url: string; mimeType: string;
        width: number | null; height: number | null; bytes: number | null;
        alt: string | null; tags: string | null; folder: string; createdAt: Date;
      }[]>;
    };
  }).mediaAsset.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return {
    props: {
      assets: assets.map(a => ({
        id: a.id,
        name: a.name,
        url: a.url,
        mimeType: a.mimeType,
        width: a.width,
        height: a.height,
        bytes: a.bytes,
        alt: a.alt,
        tags: a.tags,
        folder: a.folder,
        createdAt: a.createdAt.toISOString(),
      })),
    },
  };
};

export default MediaLibraryPage;
