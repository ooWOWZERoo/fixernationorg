import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useRef, useEffect } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { BlockComposer } from "@/components/email/BlockComposer";
import type { NextPageWithLayout } from "@/types/next";
import type { EmailBlock } from "@/lib/email-blocks";

interface TemplateData {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  status: string;
  category: string | null;
  tags: string | null;
  blocks: EmailBlock[] | null;
  campaignCount: number;
  updatedAt: string;
}

interface Props { template: TemplateData }

const STATUS_STYLES: Record<string, string> = {
  DRAFT:    "bg-navy/8 text-navy",
  APPROVED: "bg-green-100 text-green-800",
  RETIRED:  "bg-slate-100 text-slate-500",
};

const EditEmailTemplatePage: NextPageWithLayout<Props> = ({ template: initial }) => {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const mediaCbRef = useRef<((url: string) => void) | null>(null);

  const [name, setName] = useState(initial.name);
  const [subject, setSubject] = useState(initial.subject);
  const [category, setCategory] = useState(initial.category ?? "");
  const [tags, setTags] = useState(initial.tags ?? "");
  const [status, setStatus] = useState(initial.status);
  const [textBody, setTextBody] = useState(initial.textBody ?? "");

  const blocksRef = useRef<EmailBlock[]>(initial.blocks ?? []);
  const htmlRef = useRef(initial.htmlBody);

  function onComposerChange(html: string, blocks: EmailBlock[]) {
    htmlRef.current = html;
    blocksRef.current = blocks;
    setSaved(false);
  }

  function handlePickImage(cb: (url: string) => void) {
    mediaCbRef.current = cb;
    setMediaPickerOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const r = await fetch(`/api/admin/email-templates/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          subject: subject.trim(),
          blocks: blocksRef.current.length > 0 ? blocksRef.current : null,
          htmlBody: blocksRef.current.length === 0 ? htmlRef.current : undefined,
          textBody: textBody.trim() || null,
          category: category.trim() || null,
          tags: tags.trim() || null,
          status,
        }),
      });
      if (r.ok) setSaved(true);
      else {
        const data = await r.json();
        setError(data?.error?.formErrors?.[0] ?? "Save failed.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/email-templates/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (r.ok) setStatus(newStatus);
    } finally {
      setSaving(false);
    }
  }

  async function handleClone() {
    setCloning(true);
    try {
      const r = await fetch(`/api/admin/email-templates/${initial.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clone" }),
      });
      if (r.ok) {
        const cloned = await r.json();
        // A full navigation, not router.push: this page's local state
        // (name/subject/status/etc.) is seeded once from `initial` via
        // useState — a client-side transition to the same route pattern
        // reuses the mounted component and never re-seeds it, so the
        // clone's URL would silently keep showing the original's fields.
        window.location.href = `/admin/email-templates/${cloned.id}`;
      }
    } finally {
      setCloning(false);
    }
  }

  async function handleTestSend() {
    const to = prompt("Send test to (email address):");
    if (!to?.trim()) return;
    setSendingTest(true);
    try {
      const r = await fetch(`/api/admin/email-templates/${initial.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_send", to: to.trim() }),
      });
      if (r.ok) alert(`Test email sent to ${to.trim()}`);
      else alert("Send failed.");
    } finally {
      setSendingTest(false);
    }
  }

  return (
    <>
      <Head><title>{name} — Email templates — Admin</title></Head>

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/admin/email-templates" className="text-sm text-ink-soft hover:text-navy">← Templates</Link>
        <span className="text-ink-soft/40">/</span>
        <span className="text-sm font-medium text-navy truncate max-w-xs">{initial.name}</span>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT}`}>
          {status.charAt(0) + status.slice(1).toLowerCase()}
        </span>
      </div>

      {/* Action bar */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleSave} disabled={saving}
          className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50">
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={() => setShowPreview(true)}
          className="rounded-xl border border-navy/15 px-4 py-2 text-sm font-medium text-navy hover:bg-cream-panel">
          Preview
        </button>
        <button type="button" onClick={handleTestSend} disabled={sendingTest}
          className="rounded-xl border border-navy/15 px-4 py-2 text-sm font-medium text-navy hover:bg-cream-panel disabled:opacity-50">
          {sendingTest ? "Sending…" : "Send test"}
        </button>
        <button type="button" onClick={handleClone} disabled={cloning}
          className="rounded-xl border border-navy/15 px-4 py-2 text-sm font-medium text-ink-soft hover:bg-cream-panel disabled:opacity-50">
          {cloning ? "Cloning…" : "Clone"}
        </button>

        {status === "DRAFT" && (
          <button type="button" onClick={() => handleStatusChange("APPROVED")} disabled={saving}
            className="ml-auto rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
            Approve
          </button>
        )}
        {status === "APPROVED" && (
          <button type="button" onClick={() => handleStatusChange("RETIRED")} disabled={saving}
            className="ml-auto rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50">
            Retire
          </button>
        )}
        {status === "RETIRED" && (
          <button type="button" onClick={() => handleStatusChange("DRAFT")} disabled={saving}
            className="ml-auto rounded-xl border border-navy/15 px-4 py-2 text-sm font-medium text-navy hover:bg-cream-panel disabled:opacity-50">
            Restore to draft
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {saved && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">Changes saved.</div>
      )}

      <div className="space-y-5">
        {/* Details */}
        <div className="rounded-2xl border border-navy/8 bg-white p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-soft">Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-navy mb-1">Template name</label>
              <input type="text" value={name} onChange={e => { setName(e.target.value); setSaved(false); }}
                className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1">Default subject line</label>
              <input type="text" value={subject} onChange={e => { setSubject(e.target.value); setSaved(false); }}
                className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1">Category</label>
              <input type="text" value={category} onChange={e => { setCategory(e.target.value); setSaved(false); }}
                placeholder="e.g. Newsletter"
                className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-navy mb-1">Tags</label>
              <input type="text" value={tags} onChange={e => { setTags(e.target.value); setSaved(false); }}
                placeholder="Comma-separated"
                className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-navy mb-2">Plain text fallback</label>
            <textarea value={textBody} onChange={e => { setTextBody(e.target.value); setSaved(false); }} rows={4}
              placeholder="Optional — plain text for email clients that don't render HTML"
              className="w-full rounded-lg border border-navy/15 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy/30" />
          </div>
        </div>

        {/* Composer */}
        <div className="rounded-2xl border border-navy/8 bg-white p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-ink-soft">Email content</h2>
          <BlockComposer
            initialBlocks={initial.blocks ?? []}
            onChange={onComposerChange}
            onPickImage={handlePickImage}
          />
        </div>

        {/* Danger zone */}
        {initial.campaignCount === 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-red-400">Danger zone</h2>
            <button type="button"
              onClick={async () => {
                if (!confirm(`Delete "${initial.name}"? This cannot be undone.`)) return;
                const r = await fetch(`/api/admin/email-templates/${initial.id}`, { method: "DELETE" });
                if (r.ok) router.push("/admin/email-templates");
                else alert("Delete failed.");
              }}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100">
              Delete this template
            </button>
          </div>
        )}
      </div>

      {/* Preview modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowPreview(false)}>
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-navy/8 bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-navy/8 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-navy">Email preview</h3>
                <p className="text-xs text-ink-soft mt-0.5">Subject: {subject}</p>
              </div>
              <button type="button" onClick={() => setShowPreview(false)}
                className="rounded-lg border border-navy/15 px-3 py-1 text-xs text-ink-soft hover:bg-cream-panel">
                Close
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-4">
              <iframe
                srcDoc={htmlRef.current}
                title="Email preview"
                className="mx-auto w-full max-w-xl rounded-lg border border-navy/8 bg-white"
                style={{ minHeight: 500 }}
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}

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

interface MediaAssetRow { id: string; url: string; name: string }

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
            <p className="py-8 text-center text-sm text-ink-soft">No images found.</p>
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
          <Link href="/admin/media" target="_blank" className="text-xs text-navy underline hover:no-underline">
            Manage media library
          </Link>
        </div>
      </div>
    </div>
  );
}

EditEmailTemplatePage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: "/signin", permanent: false } };
  }

  const { id } = ctx.params as { id: string };
  const template = await db.emailTemplate.findUnique({
    where: { id },
    include: { _count: { select: { campaigns: true } } },
  });
  if (!template) return { notFound: true };

  const t = template as unknown as {
    id: string; name: string; subject: string; htmlBody: string; textBody: string | null;
    status: string; category: string | null; tags: string | null; blocks: unknown;
    _count: { campaigns: number }; updatedAt: Date;
  };

  return {
    props: {
      template: {
        id: t.id,
        name: t.name,
        subject: t.subject,
        htmlBody: t.htmlBody,
        textBody: t.textBody ?? null,
        status: t.status ?? "DRAFT",
        category: t.category ?? null,
        tags: t.tags ?? null,
        blocks: Array.isArray(t.blocks) ? t.blocks : null,
        campaignCount: t._count.campaigns,
        updatedAt: t.updatedAt.toISOString(),
      } satisfies TemplateData,
    },
  };
};

export default EditEmailTemplatePage;
