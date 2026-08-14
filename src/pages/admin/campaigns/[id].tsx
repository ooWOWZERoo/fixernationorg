import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface StatRow { status: string; count: number }
interface Props {
  campaign: {
    id: string;
    name: string;
    status: string;
    subject: string;
    fromName: string;
    fromEmail: string;
    htmlBody: string;
    textBody: string | null;
    listId: string | null;
    listName: string | null;
    sendCount: number;
    scheduledAt: string | null;
    sentAt: string | null;
    createdAt: string;
  };
  stats: StatRow[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-navy/8 text-navy",
  SCHEDULED: "bg-amber/20 text-amber-dark",
  SENDING: "bg-blue-100 text-blue-700",
  SENT: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  CANCELLED: "bg-red-100 text-red-700",
};

const AdminCampaignDetailPage: NextPageWithLayout<Props> = ({ campaign: initial, stats }) => {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initial);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function triggerSend() {
    if (!confirm(`Send "${campaign.name}" to all contacts on the list now?`)) return;
    setSending(true);
    setError(null);
    setSendResult(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSendResult(data.message);
      setCampaign((c) => ({ ...c, status: "SENT", sentAt: new Date().toISOString() }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally { setSending(false); }
  }

  async function deleteCampaign() {
    if (!confirm("Delete this campaign?")) return;
    await fetch(`/api/admin/campaigns/${campaign.id}`, { method: "DELETE" });
    router.push("/admin/campaigns");
  }

  const statMap = Object.fromEntries(stats.map((s) => [s.status, s.count]));
  const totalSent = statMap.SENT ?? 0;
  const opened = statMap.OPENED ?? 0;

  return (
    <>
      <Head><title>{campaign.name} — Campaigns Admin</title></Head>
      <div className="mb-4 flex items-center gap-2 text-sm text-ink-soft">
        <a href="/admin/campaigns" className="hover:underline">Campaigns</a>
        <span>/</span>
        <span>{campaign.name}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-navy/8 bg-white p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h1 className="text-xl font-extrabold text-navy">{campaign.name}</h1>
                <p className="mt-0.5 text-sm text-ink-soft">{campaign.subject}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[campaign.status] ?? "bg-navy/8 text-navy"}`}>
                {campaign.status.toLowerCase()}
              </span>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-xs font-bold uppercase tracking-widest text-ink-soft">From</span>
                <span>{campaign.fromName} &lt;{campaign.fromEmail}&gt;</span>
              </div>
              <div>
                <span className="block text-xs font-bold uppercase tracking-widest text-ink-soft">List</span>
                <span>{campaign.listName ?? "—"}</span>
              </div>
              {campaign.scheduledAt && (
                <div>
                  <span className="block text-xs font-bold uppercase tracking-widest text-ink-soft">Scheduled</span>
                  <span>{new Date(campaign.scheduledAt).toLocaleString()}</span>
                </div>
              )}
              {campaign.sentAt && (
                <div>
                  <span className="block text-xs font-bold uppercase tracking-widest text-ink-soft">Sent</span>
                  <span>{new Date(campaign.sentAt).toLocaleString()}</span>
                </div>
              )}
            </div>

            {error && <div className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {sendResult && <div className="mb-3 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">{sendResult}</div>}

            <div className="flex gap-3">
              {(campaign.status === "DRAFT" || campaign.status === "SCHEDULED") && (
                <button onClick={triggerSend} disabled={sending || !campaign.listId}
                  className="rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60">
                  {sending ? "Sending…" : "Send now"}
                </button>
              )}
              {campaign.status === "DRAFT" && (
                <a href={`/admin/campaigns/${campaign.id}/edit`}
                  className="rounded-xl border border-navy/15 px-5 py-2.5 text-sm font-bold text-ink-soft hover:bg-cream-panel no-underline">
                  Edit
                </a>
              )}
              {campaign.status !== "SENDING" && (
                <button onClick={deleteCampaign}
                  className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
                  Delete
                </button>
              )}
            </div>
            {!campaign.listId && campaign.status === "DRAFT" && (
              <p className="mt-2 text-xs text-amber-dark">No list assigned — edit the campaign to add one before sending.</p>
            )}
          </div>

          {/* HTML preview */}
          <div className="rounded-2xl border border-navy/8 bg-white p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">Email preview</h2>
            <div className="overflow-auto rounded-xl border border-navy/8 bg-cream-panel p-4 text-xs font-mono max-h-64 text-ink-soft whitespace-pre-wrap">
              {campaign.htmlBody.slice(0, 2000)}{campaign.htmlBody.length > 2000 ? "\n…" : ""}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-navy/8 bg-white p-5">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-ink-soft">Send stats</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-ink-soft">Total sends</span>
                <span className="font-bold text-navy">{campaign.sendCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-soft">Delivered</span>
                <span className="font-bold text-navy">{totalSent}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-soft">Opened</span>
                <span className="font-bold text-navy">{opened}</span>
              </div>
              {campaign.sendCount > 0 && opened > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-ink-soft">Open rate</span>
                  <span className="font-bold text-green-700">{Math.round((opened / Math.max(totalSent, 1)) * 100)}%</span>
                </div>
              )}
              {Object.entries(statMap).filter(([s]) => !["SENT", "OPENED", "QUEUED"].includes(s)).map(([status, count]) => (
                <div key={status} className="flex justify-between text-sm">
                  <span className="text-ink-soft capitalize">{status.toLowerCase()}</span>
                  <span className="font-bold text-navy">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

AdminCampaignDetailPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default AdminCampaignDetailPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const { id } = ctx.params as { id: string };

  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      list: { select: { name: true } },
      _count: { select: { sends: true } },
    },
  });
  if (!campaign) return { notFound: true };

  const statsRaw = await db.campaignSend.groupBy({
    by: ["status"],
    where: { campaignId: id },
    _count: { status: true },
  });

  return {
    props: {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        subject: campaign.subject,
        fromName: campaign.fromName,
        fromEmail: campaign.fromEmail,
        htmlBody: campaign.htmlBody,
        textBody: campaign.textBody,
        listId: campaign.listId,
        listName: campaign.list?.name ?? null,
        sendCount: campaign._count.sends,
        scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
        sentAt: campaign.sentAt?.toISOString() ?? null,
        createdAt: campaign.createdAt.toISOString(),
      },
      stats: statsRaw.map((s) => ({ status: s.status, count: s._count.status })),
    },
  };
};
