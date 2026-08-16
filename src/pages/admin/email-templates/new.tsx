import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useRef, useEffect } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { BlockComposer } from "@/components/email/BlockComposer";
import type { NextPageWithLayout } from "@/types/next";
import type { EmailBlock } from "@/lib/email-blocks";

const NewEmailTemplatePage: NextPageWithLayout = () => {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "APPROVED">("DRAFT");
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const mediaCbRef = useRef<((url: string) => void) | null>(null);

  const blocksRef = useRef<EmailBlock[]>([]);
  const htmlRef = useRef("");

  function onComposerChange(html: string, blocks: EmailBlock[]) {
    htmlRef.current = html;
    blocksRef.current = blocks;
  }

  function handlePickImage(cb: (url: string) => void) {
    mediaCbRef.current = cb;
    setMediaPickerOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !subject.trim()) return;
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          subject: subject.trim(),
          blocks: blocksRef.current.length > 0 ? blocksRef.current : undefined,
          htmlBody: blocksRef.current.length === 0 ? htmlRef.current : undefined,
          category: category.trim() || undefined,
          tags: tags.trim() || undefined,
          status,
        }),
      });
      if (r.ok) {
        const data = await r.json();
        router.push(`/admin/email-templates/${data.id}`);
      } else {
        const data = await r.json();
        setError(data?.error?.formErrors?.[0] ?? "Save failed.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Head><title>New email template — Admin</title></Head>

      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/email-templates" className="text-sm text-ink-soft hover:text-navy">← Templates</Link>
        <span className="text-ink-soft/40">/</span>
        <h1 className="text-xl font-extrabold text-navy">New template</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Details card */}
        <div className="rounded-2xl border border-navy/8 bg-white p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft">Details</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-navy mb-1">Template name <span className="text-red-400">*</span></label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required
                placeholder="e.g. Monthly Newsletter"
                className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1">Default subject line <span className="text-red-400">*</span></label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} required
                placeholder="e.g. Your monthly update from Fixer Nation"
                className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
              <p className="mt-1 text-xs text-ink-soft">Campaigns can override this</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1">Category</label>
              <input type="text" value={category} onChange={e => setCategory(e.target.value)}
                placeholder="e.g. Newsletter, Announcement"
                className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1">Tags</label>
              <input type="text" value={tags} onChange={e => setTags(e.target.value)}
                placeholder="Comma-separated (e.g. weekly, members)"
                className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-navy mb-2">Status</label>
            <div className="flex gap-2">
              {(["DRAFT", "APPROVED"] as const).map(s => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                    status === s ? "bg-navy text-white" : "border border-navy/15 text-ink-soft hover:bg-cream-panel"
                  }`}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Composer */}
        <div className="rounded-2xl border border-navy/8 bg-white p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-ink-soft">Email content</h2>
          <BlockComposer onChange={onComposerChange} onPickImage={handlePickImage} />
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving || !name.trim() || !subject.trim()}
            className="rounded-xl bg-amber px-5 py-2.5 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50">
            {saving ? "Creating…" : "Create template"}
          </button>
          <Link href="/admin/email-templates"
            className="rounded-xl border border-navy/15 px-5 py-2.5 text-sm font-medium text-ink-soft no-underline hover:bg-cream-panel">
            Cancel
          </Link>
        </div>
      </form>

      {/* Media picker modal */}
      {mediaPickerOpen && (
        <MediaPickerModal
          onSelect={url => { mediaCbRef.current?.(url); mediaCbRef.current = null; setMediaPickerOpen(false); }}
          onClose={() => { mediaCbRef.current = null; setMediaPickerOpen(false); }}
        />
      )}
    </>
  );
};

// ── Inline media picker ───────────────────────────────────────────────────────

interface MediaAssetRow { id: string; url: string; name: string; width?: number | null; height?: number | null }

function MediaPickerModal({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [assets, setAssets] = useState<MediaAssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/admin/media")
      .then(r => r.json())
      .then(data => setAssets(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = q ? assets.filter(a => a.name.toLowerCase().includes(q.toLowerCase())) : assets;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-navy/8 bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-navy/8 px-5 py-4">
          <h3 className="text-base font-bold text-navy">Choose an image</h3>
          <button type="button" onClick={onClose} className="text-ink-soft hover:text-navy">✕</button>
        </div>
        <div className="p-5">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search images…"
            className="mb-4 w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
          {loading ? (
            <p className="py-8 text-center text-sm text-ink-soft">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-soft">No images found. Upload some in the <strong>Media library</strong>.</p>
          ) : (
            <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto">
              {filtered.map(a => (
                <button key={a.id} type="button" onClick={() => onSelect(a.url)}
                  className="group overflow-hidden rounded-lg border border-navy/8 hover:border-navy/30">
                  <img src={a.url} alt={a.name} className="h-24 w-full object-cover" />
                  <p className="truncate px-1.5 py-1 text-xs text-ink-soft group-hover:text-navy">{a.name}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-navy/8 px-5 py-3 text-right">
          <Link href="/admin/media" target="_blank"
            className="text-xs text-navy underline hover:no-underline">
            Manage media library
          </Link>
        </div>
      </div>
    </div>
  );
}

NewEmailTemplatePage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: "/signin", permanent: false } };
  }
  return { props: {} };
};

export default NewEmailTemplatePage;
