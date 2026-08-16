import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface TemplateRow {
  id: string;
  name: string;
  subject: string;
  status: string;
  category: string | null;
  tags: string | null;
  campaignCount: number;
  updatedAt: string;
}

interface Props { templates: TemplateRow[] }

const STATUS_STYLES: Record<string, string> = {
  DRAFT:    "bg-navy/8 text-navy",
  APPROVED: "bg-green-100 text-green-800",
  RETIRED:  "bg-slate-100 text-slate-500",
};

const EmailTemplatesPage: NextPageWithLayout<Props> = ({ templates: initial }) => {
  const [templates, setTemplates] = useState(initial);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [cloning, setCloning] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const visible = templates.filter(t => {
    if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
    if (q) {
      const lq = q.toLowerCase();
      return t.name.toLowerCase().includes(lq) || t.subject.toLowerCase().includes(lq) || (t.tags ?? "").toLowerCase().includes(lq);
    }
    return true;
  });

  async function handleClone(id: string) {
    setCloning(id);
    try {
      const r = await fetch(`/api/admin/email-templates/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clone" }),
      });
      if (r.ok) {
        const cloned = await r.json();
        setTemplates(prev => [
          {
            id: cloned.id,
            name: cloned.name,
            subject: cloned.subject,
            status: cloned.status ?? "DRAFT",
            category: cloned.category ?? null,
            tags: cloned.tags ?? null,
            campaignCount: 0,
            updatedAt: cloned.updatedAt,
          },
          ...prev,
        ]);
      }
    } finally {
      setCloning(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const r = await fetch(`/api/admin/email-templates/${id}`, { method: "DELETE" });
      if (r.ok) setTemplates(prev => prev.filter(t => t.id !== id));
      else alert("Delete failed.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <Head><title>Email templates — Admin</title></Head>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-navy">Email templates</h1>
        <Link href="/admin/email-templates/new"
          className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark no-underline hover:bg-amber-dark">
          + New template
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5">
          {["ALL", "DRAFT", "APPROVED", "RETIRED"].map(s => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors ${
                statusFilter === s ? "bg-navy text-white" : "border border-navy/15 text-ink-soft hover:bg-cream-panel"
              }`}>
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search templates…"
          className="ml-auto w-60 rounded-lg border border-navy/15 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
          <p className="text-sm text-ink-soft">
            {templates.length === 0 ? "No templates yet. Create one to get started." : "No templates match your filters."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map(t => (
            <div key={t.id} className="flex flex-col rounded-2xl border border-navy/8 bg-white p-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[t.status] ?? STATUS_STYLES.DRAFT}`}>
                    {t.status.charAt(0) + t.status.slice(1).toLowerCase()}
                  </span>
                  {t.category && (
                    <span className="ml-1.5 inline-block rounded-full bg-cream-panel px-2 py-0.5 text-xs text-ink-soft">
                      {t.category}
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-ink-soft">
                  {t.campaignCount > 0 ? `${t.campaignCount} campaign${t.campaignCount !== 1 ? "s" : ""}` : "Unused"}
                </span>
              </div>

              <h2 className="mb-1 text-base font-bold text-navy line-clamp-2">{t.name}</h2>
              <p className="mb-4 text-sm text-ink-soft line-clamp-1">{t.subject}</p>

              {t.tags && (
                <div className="mb-4 flex flex-wrap gap-1">
                  {t.tags.split(",").map(tag => tag.trim()).filter(Boolean).map(tag => (
                    <span key={tag} className="rounded bg-navy/5 px-1.5 py-0.5 text-xs text-ink-soft">{tag}</span>
                  ))}
                </div>
              )}

              <div className="mt-auto flex items-center gap-2 border-t border-navy/8 pt-3">
                <Link href={`/admin/email-templates/${t.id}`}
                  className="flex-1 rounded-lg bg-navy px-3 py-1.5 text-center text-xs font-bold text-white no-underline hover:bg-navy-dark">
                  Edit
                </Link>
                <button type="button" onClick={() => handleClone(t.id)} disabled={cloning === t.id}
                  className="rounded-lg border border-navy/15 px-3 py-1.5 text-xs font-medium text-navy hover:bg-cream-panel disabled:opacity-50">
                  {cloning === t.id ? "…" : "Clone"}
                </button>
                <button type="button" onClick={() => handleDelete(t.id, t.name)} disabled={deleting === t.id || t.campaignCount > 0}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-30"
                  title={t.campaignCount > 0 ? "In use by campaigns" : undefined}>
                  {deleting === t.id ? "…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

EmailTemplatesPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: "/signin", permanent: false } };
  }

  const templates = await db.emailTemplate.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { campaigns: true } } },
  });

  return {
    props: {
      templates: templates.map(t => ({
        id: t.id,
        name: t.name,
        subject: t.subject,
        status: (t as unknown as { status: string }).status ?? "DRAFT",
        category: (t as unknown as { category: string | null }).category ?? null,
        tags: (t as unknown as { tags: string | null }).tags ?? null,
        campaignCount: t._count.campaigns,
        updatedAt: t.updatedAt.toISOString(),
      })),
    },
  };
};

export default EmailTemplatesPage;
