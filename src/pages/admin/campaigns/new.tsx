import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface ListOption { id: string; name: string }

interface Props { lists: ListOption[] }

const AdminNewCampaignPage: NextPageWithLayout<Props> = ({ lists }) => {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    subject: "",
    fromName: "Fixer Nation",
    fromEmail: "campaigns@fixernation.org",
    htmlBody: "",
    textBody: "",
    listId: "",
    scheduledAt: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...form,
        listId: form.listId || undefined,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
      };
      const res = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? data.error ?? "Failed to create campaign");
      }
      const campaign = await res.json();
      router.push(`/admin/campaigns/${campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <>
      <Head><title>New Campaign — Admin</title></Head>
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
          <a href="/admin/campaigns" className="hover:underline">Campaigns</a>
          <span>/</span>
          <span>New campaign</span>
        </div>

        <h1 className="mb-6 text-2xl font-extrabold text-navy">New campaign</h1>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-navy/8 bg-white p-6">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Campaign name *</label>
            <input required type="text" value={form.name} onChange={set("name")} placeholder="e.g. August newsletter"
              className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Subject line *</label>
            <input required type="text" value={form.subject} onChange={set("subject")}
              className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">From name</label>
              <input type="text" value={form.fromName} onChange={set("fromName")}
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">From email</label>
              <input type="email" value={form.fromEmail} onChange={set("fromEmail")}
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Send to list</label>
            <select value={form.listId} onChange={set("listId")}
              className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30">
              <option value="">— Select a list (optional) —</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">HTML body *</label>
            <textarea required value={form.htmlBody} onChange={set("htmlBody")} rows={10}
              placeholder="Paste your HTML email body here…"
              className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy/30" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Plain text (optional)</label>
            <textarea value={form.textBody} onChange={set("textBody")} rows={4}
              placeholder="Plain text fallback for email clients that don't render HTML…"
              className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Schedule (optional)</label>
            <input type="datetime-local" value={form.scheduledAt} onChange={set("scheduledAt")}
              className="rounded-xl border border-navy/15 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
            <p className="mt-1 text-xs text-ink-soft">Leave blank to save as draft. You can send manually from the campaign page.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60">
              {saving ? "Saving…" : form.scheduledAt ? "Save and schedule" : "Save as draft"}
            </button>
            <a href="/admin/campaigns"
              className="rounded-xl border border-navy/15 px-5 py-2.5 text-sm font-bold text-ink-soft hover:bg-cream-panel no-underline">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </>
  );
};

AdminNewCampaignPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default AdminNewCampaignPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const lists = await db.contactList.findMany({
    where: { ownerType: "FN_ADMIN" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return { props: { lists } };
};
