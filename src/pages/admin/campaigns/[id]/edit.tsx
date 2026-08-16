import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { BlockComposer } from "@/components/email/BlockComposer";
import { AudienceBuilder } from "@/components/email/AudienceBuilder";
import type { AudienceDefinition } from "@/lib/audience";
import type { NextPageWithLayout } from "@/types/next";

interface ListOption { id: string; name: string }

interface Props {
  campaign: {
    id: string;
    name: string;
    subject: string;
    fromName: string;
    fromEmail: string;
    htmlBody: string | null;
    textBody: string | null;
    listId: string | null;
    audienceRules: AudienceDefinition | null;
    scheduledAt: string | null;
  };
  lists: ListOption[];
}

const AdminEditCampaignPage: NextPageWithLayout<Props> = ({ campaign, lists }) => {
  const router = useRouter();
  const [form, setForm] = useState({
    name: campaign.name,
    subject: campaign.subject,
    fromName: campaign.fromName,
    fromEmail: campaign.fromEmail,
    htmlBody: campaign.htmlBody ?? "",
    textBody: campaign.textBody ?? "",
    scheduledAt: campaign.scheduledAt
      ? new Date(campaign.scheduledAt).toISOString().slice(0, 16)
      : "",
  });
  const [audienceRules, setAudienceRules] = useState<AudienceDefinition>(
    campaign.audienceRules ??
    (campaign.listId
      ? { logic: "OR", include: [{ type: "list", listId: campaign.listId, label: lists.find(l => l.id === campaign.listId)?.name }], exclude: [] }
      : { logic: "OR", include: [], exclude: [] })
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useComposer, setUseComposer] = useState(false);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = {
        ...form,
        textBody: form.textBody || null,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        audienceRules: audienceRules.include.length > 0 ? audienceRules : null,
        listId: null,
      };
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? data.error ?? "Failed to update campaign");
      }
      router.push(`/admin/campaigns/${campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <>
      <Head><title>Edit {campaign.name} — Admin</title></Head>
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
          <a href="/admin/campaigns" className="hover:underline">Campaigns</a>
          <span>/</span>
          <a href={`/admin/campaigns/${campaign.id}`} className="hover:underline">{campaign.name}</a>
          <span>/</span>
          <span>Edit</span>
        </div>

        <h1 className="mb-6 text-2xl font-extrabold text-navy">Edit campaign</h1>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-navy/8 bg-white p-6">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-ink-soft">Campaign name *</label>
            <input required type="text" value={form.name} onChange={set("name")}
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
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-ink-soft">Audience</label>
            <AudienceBuilder
              value={audienceRules}
              onChange={setAudienceRules}
              lists={lists}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-ink-soft">HTML body *</label>
              <div className="flex rounded-lg border border-navy/15 overflow-hidden text-xs font-medium">
                <button type="button" onClick={() => setUseComposer(false)}
                  className={`px-3 py-1 ${!useComposer ? "bg-navy text-white" : "text-ink-soft hover:bg-cream-panel"}`}>
                  HTML
                </button>
                <button type="button" onClick={() => setUseComposer(true)}
                  className={`px-3 py-1 ${useComposer ? "bg-navy text-white" : "text-ink-soft hover:bg-cream-panel"}`}>
                  Visual
                </button>
              </div>
            </div>
            {useComposer ? (
              <BlockComposer onChange={v => setForm(f => ({ ...f, htmlBody: v }))} />
            ) : (
              <textarea required value={form.htmlBody} onChange={set("htmlBody")} rows={10}
                className="w-full rounded-xl border border-navy/15 px-4 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-navy/30" />
            )}
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
            <p className="mt-1 text-xs text-ink-soft">Clear this to keep as draft.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60">
              {saving ? "Saving…" : "Save changes"}
            </button>
            <a href={`/admin/campaigns/${campaign.id}`}
              className="rounded-xl border border-navy/15 px-5 py-2.5 text-sm font-bold text-ink-soft hover:bg-cream-panel no-underline">
              Cancel
            </a>
          </div>
        </form>
      </div>
    </>
  );
};

AdminEditCampaignPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default AdminEditCampaignPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const { id } = ctx.params as { id: string };

  const campaign = await db.campaign.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      subject: true,
      fromName: true,
      fromEmail: true,
      htmlBody: true,
      textBody: true,
      listId: true,
      audienceRules: true,
      scheduledAt: true,
      status: true,
    },
  });

  if (!campaign) return { notFound: true };

  if (campaign.status === "SENT" || campaign.status === "SENDING") {
    return { redirect: { destination: `/admin/campaigns/${id}`, permanent: false } };
  }

  const lists = await db.contactList.findMany({
    where: { ownerType: "FN_ADMIN" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return {
    props: {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
        htmlBody: campaign.htmlBody,
        textBody: campaign.textBody,
        listId: campaign.listId,
        audienceRules: (campaign.audienceRules as AudienceDefinition | null) ?? null,
        scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
      },
      lists,
    },
  };
};
