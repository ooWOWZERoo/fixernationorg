import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface AudienceRuleSummary { type: string; label: string }
interface MetricData {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalUnsubscribed: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubRate: number;
  computedAt: string;
}
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
    hasAudienceRules: boolean;
    audienceRuleSummary: AudienceRuleSummary[];
    sendCount: number;
    scheduledAt: string | null;
    sentAt: string | null;
    createdAt: string;
  };
  metric: MetricData | null;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-navy/8 text-navy",
  SCHEDULED: "bg-amber/20 text-amber-dark",
  SENDING: "bg-blue-100 text-blue-700",
  SENT: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  CANCELLED: "bg-red-100 text-red-700",
};

const AdminCampaignDetailPage: NextPageWithLayout<Props> = ({ campaign: initial, metric: initialMetric }) => {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initial);
  const [metric, setMetric] = useState(initialMetric);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refreshMetrics() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "compute_metrics" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMetric({
        totalSent: data.totalSent,
        totalDelivered: data.totalDelivered,
        totalOpened: data.totalOpened,
        totalClicked: data.totalClicked,
        totalBounced: data.totalBounced,
        totalUnsubscribed: data.totalUnsubscribed,
        openRate: data.openRate,
        clickRate: data.clickRate,
        bounceRate: data.bounceRate,
        unsubRate: data.unsubRate,
        computedAt: data.computedAt,
      });
    } catch { /* silent */ } finally { setRefreshing(false); }
  }

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

  const pct = (n: number) => `${Math.round(n * 100)}%`;

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
                <span className="block text-xs font-bold uppercase tracking-widest text-ink-soft">Audience</span>
                {campaign.hasAudienceRules ? (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {campaign.audienceRuleSummary.map((r, i) => (
                      <span key={i} className="rounded bg-navy/8 px-1.5 py-0.5 text-xs font-semibold text-navy">
                        {r.type}: {r.label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span>{campaign.listName ?? "—"}</span>
                )}
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
                <button onClick={triggerSend} disabled={sending || (!campaign.listId && !campaign.hasAudienceRules)}
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
            {!campaign.listId && !campaign.hasAudienceRules && campaign.status === "DRAFT" && (
              <p className="mt-2 text-xs text-amber-dark">No audience defined — edit the campaign to set one before sending.</p>
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
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">Delivery</h2>
              {campaign.status === "SENT" && (
                <button onClick={refreshMetrics} disabled={refreshing}
                  className="text-xs font-semibold text-navy hover:underline disabled:opacity-60">
                  {refreshing ? "Refreshing…" : "Refresh"}
                </button>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-ink-soft">Queued</span>
                <span className="font-bold text-navy">{campaign.sendCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-soft">Sent</span>
                <span className="font-bold text-navy">{metric?.totalSent ?? "—"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-ink-soft">Delivered</span>
                <span className="font-bold text-navy">{metric?.totalDelivered ?? "—"}</span>
              </div>
              {metric && metric.totalBounced > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-ink-soft">Bounced</span>
                  <span className="font-bold text-red-600">{metric.totalBounced}</span>
                </div>
              )}
              {metric && metric.totalUnsubscribed > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-ink-soft">Cancelled (pre-send)</span>
                  <span className="font-bold text-navy">{metric.totalUnsubscribed}</span>
                </div>
              )}
            </div>
          </div>

          {(metric || campaign.status === "SENT") && (
            <div className="rounded-2xl border border-navy/8 bg-white p-5">
              <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-ink-soft">Engagement</h2>
              {!metric ? (
                <p className="text-sm text-ink-soft">No metrics yet — click Refresh above.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-soft">Opened</span>
                    <span className="font-bold text-navy">{metric.totalOpened}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink-soft">Clicked</span>
                    <span className="font-bold text-navy">{metric.totalClicked}</span>
                  </div>
                  <div className="mt-3 border-t border-navy/8 pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-soft">Open rate</span>
                      <span className="font-bold text-green-700">{pct(metric.openRate)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink-soft">Click rate</span>
                      <span className="font-bold text-blue-700">{pct(metric.clickRate)}</span>
                    </div>
                    {metric.totalBounced > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-ink-soft">Bounce rate</span>
                        <span className="font-bold text-red-600">{pct(metric.bounceRate)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-ink-soft/60">
                    Computed {new Date(metric.computedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}
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
      metric: true,
    },
  });
  if (!campaign) return { notFound: true };

  // Build a human-readable summary of audienceRules for display
  type RuleShape = { type: string; listId?: string; role?: string; tag?: string; topic?: string; label?: string };
  type AudDef = { include: RuleShape[]; exclude: RuleShape[] } | null;
  const aud = campaign.audienceRules as AudDef;
  const audienceRuleSummary: AudienceRuleSummary[] = aud
    ? [
        ...aud.include.map((r) => ({
          type: r.type,
          label: r.label ?? r.role ?? r.tag ?? r.topic ?? r.listId ?? "?",
        })),
        ...aud.exclude.map((r) => ({
          type: `exclude:${r.type}`,
          label: r.label ?? r.role ?? r.tag ?? r.topic ?? r.listId ?? "?",
        })),
      ]
    : [];

  const m = campaign.metric;

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
        hasAudienceRules: !!aud && aud.include.length > 0,
        audienceRuleSummary,
        sendCount: campaign._count.sends,
        scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
        sentAt: campaign.sentAt?.toISOString() ?? null,
        createdAt: campaign.createdAt.toISOString(),
      },
      metric: m ? {
        totalSent: m.totalSent,
        totalDelivered: m.totalDelivered,
        totalOpened: m.totalOpened,
        totalClicked: m.totalClicked,
        totalBounced: m.totalBounced,
        totalUnsubscribed: m.totalUnsubscribed,
        openRate: m.openRate,
        clickRate: m.clickRate,
        bounceRate: m.bounceRate,
        unsubRate: m.unsubRate,
        computedAt: m.computedAt.toISOString(),
      } : null,
    },
  };
};
