import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  subject: string;
  listName: string | null;
  sendCount: number;
  openRate: number | null;
  bounceRate: number | null;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  needsAttention: boolean;
  attentionReason: string | null;
  isRecurring: boolean;
  parentCampaignId: string | null;
  recurrenceTime: string | null;
  recurrenceSource: string | null;
  recurrenceActive: boolean;
  occurrenceCount: number;
}

interface Stats {
  totalCampaigns: number;
  sentCampaigns: number;
  totalSent: number;
  avgOpenRate: number | null;
  avgBounceRate: number | null;
}

interface Props { campaigns: CampaignRow[]; stats: Stats }

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-navy/8 text-navy",
  SCHEDULED: "bg-amber/20 text-amber-dark",
  SENDING: "bg-blue-100 text-blue-700",
  SENT: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  CANCELLED: "bg-red-100 text-red-700",
};

type HealthGroup = "recurring_template" | "attention" | "sending" | "scheduled" | "sent" | "draft" | "paused_cancelled";

function classify(c: CampaignRow): HealthGroup {
  if (c.isRecurring && !c.parentCampaignId) return "recurring_template";
  if (c.needsAttention) return "attention";
  if (c.status === "SENDING") return "sending";
  if (c.status === "SCHEDULED") return "scheduled";
  if (c.status === "SENT") return "sent";
  if (c.status === "DRAFT") return "draft";
  return "paused_cancelled";
}

function StatusCell({ c }: { c: CampaignRow }) {
  if (c.needsAttention) {
    return (
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
        <span className="text-xs font-bold text-red-600">{c.attentionReason}</span>
      </div>
    );
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[c.status] ?? "bg-navy/8 text-navy"}`}>
      {c.status.toLowerCase()}
    </span>
  );
}

function CampaignTable({ campaigns }: { campaigns: CampaignRow[] }) {
  return (
    <div className="rounded-2xl border border-navy/8 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-navy/8 text-left text-xs font-bold uppercase tracking-widest text-ink-soft">
              <th className="px-5 py-3">Campaign</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">List</th>
              <th className="px-5 py-3">Sends</th>
              <th className="px-5 py-3">Open · Bounce</th>
              <th className="px-5 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-navy/5 hover:bg-cream-panel/40">
                <td className="px-5 py-3">
                  <Link href={`/admin/campaigns/${c.id}`} className="font-semibold text-navy hover:underline">
                    {c.name}
                  </Link>
                  <div className="text-xs text-ink-soft">{c.subject}</div>
                  {c.parentCampaignId && (
                    <Link href={`/admin/campaigns/${c.parentCampaignId}`} className="text-xs text-ink-soft/70 hover:underline">
                      🔁 recurring occurrence
                    </Link>
                  )}
                </td>
                <td className="px-5 py-3">
                  <StatusCell c={c} />
                </td>
                <td className="px-5 py-3 text-ink-soft">{c.listName ?? "—"}</td>
                <td className="px-5 py-3 text-center text-ink-soft">{c.sendCount}</td>
                <td className="px-5 py-3 text-center">
                  {c.openRate != null ? (
                    <span>
                      <span className="font-semibold text-green-700">{Math.round(c.openRate * 100)}%</span>
                      <span className="mx-1 text-ink-soft/40">·</span>
                      <span className={c.bounceRate && c.bounceRate > 0.05 ? "font-semibold text-red-600" : "text-ink-soft"}>
                        {Math.round((c.bounceRate ?? 0) * 100)}%
                      </span>
                    </span>
                  ) : (
                    <span className="text-ink-soft/50">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-ink-soft">
                  {c.sentAt
                    ? new Date(c.sentAt).toLocaleDateString()
                    : c.scheduledAt
                    ? `Scheduled ${new Date(c.scheduledAt).toLocaleDateString()}`
                    : new Date(c.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const GROUP_ORDER: { key: HealthGroup; label: string }[] = [
  { key: "attention", label: "Needs attention" },
  { key: "sending", label: "Sending now" },
  { key: "scheduled", label: "Scheduled" },
  { key: "sent", label: "Sent" },
  { key: "draft", label: "Draft" },
];

const AdminCampaignsPage: NextPageWithLayout<Props> = ({ campaigns, stats }) => {
  const [showPausedCancelled, setShowPausedCancelled] = useState(false);
  const [templates, setTemplates] = useState<CampaignRow[]>(() => campaigns.filter((c) => c.isRecurring && !c.parentCampaignId));
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const grouped: Record<HealthGroup, CampaignRow[]> = {
    recurring_template: [], attention: [], sending: [], scheduled: [], sent: [], draft: [], paused_cancelled: [],
  };
  for (const c of campaigns) grouped[classify(c)].push(c);

  async function togglePause(t: CampaignRow) {
    setTogglingId(t.id);
    const res = await fetch(`/api/admin/campaigns/${t.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recurrenceActive: !t.recurrenceActive }),
    });
    if (res.ok) {
      setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, recurrenceActive: !x.recurrenceActive } : x)));
    }
    setTogglingId(null);
  }

  return (
    <>
      <Head><title>Campaigns — Admin</title></Head>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-navy">Campaigns</h1>
        <Link href="/admin/campaigns/new"
          className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark no-underline hover:bg-amber-dark">
          + New campaign
        </Link>
      </div>

      {stats.totalCampaigns > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Campaigns (90d)", value: stats.totalCampaigns },
            { label: "Sent", value: stats.sentCampaigns },
            { label: "Emails sent", value: stats.totalSent.toLocaleString() },
            { label: "Avg open rate", value: stats.avgOpenRate != null ? `${Math.round(stats.avgOpenRate * 100)}%` : "—" },
            { label: "Avg bounce rate", value: stats.avgBounceRate != null ? `${Math.round(stats.avgBounceRate * 100)}%` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-navy/8 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">{label}</p>
              <p className="mt-1 text-2xl font-extrabold text-navy">{value}</p>
            </div>
          ))}
          <div className={`rounded-2xl border p-4 ${grouped.attention.length > 0 ? "border-red-200 bg-red-50" : "border-navy/8 bg-white"}`}>
            <p className={`text-xs font-bold uppercase tracking-widest ${grouped.attention.length > 0 ? "text-red-500" : "text-ink-soft"}`}>
              Needs attention
            </p>
            <p className={`mt-1 text-2xl font-extrabold ${grouped.attention.length > 0 ? "text-red-700" : "text-navy"}`}>
              {grouped.attention.length}
            </p>
          </div>
        </div>
      )}

      {templates.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
            Recurring campaigns <span className="font-normal text-ink-soft/60">({templates.length})</span>
          </h2>
          <div className="rounded-2xl border border-navy/8 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy/8 text-left text-xs font-bold uppercase tracking-widest text-ink-soft">
                    <th className="px-5 py-3">Campaign</th>
                    <th className="px-5 py-3">Time (UTC)</th>
                    <th className="px-5 py-3">Source</th>
                    <th className="px-5 py-3">Occurrences</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id} className="border-b border-navy/5 hover:bg-cream-panel/40">
                      <td className="px-5 py-3">
                        <Link href={`/admin/campaigns/${t.id}`} className="font-semibold text-navy hover:underline">
                          {t.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-ink-soft">Daily at {t.recurrenceTime}</td>
                      <td className="px-5 py-3 text-ink-soft">{t.recurrenceSource === "MORNING_BOOST" ? "Today's Morning Boost" : "Static content"}</td>
                      <td className="px-5 py-3 text-ink-soft">{t.occurrenceCount}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => togglePause(t)}
                          disabled={togglingId === t.id}
                          className={[
                            "rounded-full px-3 py-1 text-xs font-bold transition-colors disabled:opacity-40",
                            t.recurrenceActive
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                          ].join(" ")}
                        >
                          {togglingId === t.id ? "…" : t.recurrenceActive ? "Active" : "Paused"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
          <p className="text-sm text-ink-soft">No campaigns yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {GROUP_ORDER.map(({ key, label }) =>
            grouped[key].length === 0 ? null : (
              <div key={key}>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-soft">
                  {label} <span className="font-normal text-ink-soft/60">({grouped[key].length})</span>
                </h2>
                <CampaignTable campaigns={grouped[key]} />
              </div>
            )
          )}

          {grouped.paused_cancelled.length > 0 && (
            <div>
              <button
                onClick={() => setShowPausedCancelled((v) => !v)}
                className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-soft hover:text-navy"
              >
                <span className={`transition-transform ${showPausedCancelled ? "rotate-90" : ""}`}>&rsaquo;</span>
                Paused &amp; cancelled <span className="font-normal text-ink-soft/60">({grouped.paused_cancelled.length})</span>
              </button>
              {showPausedCancelled && <CampaignTable campaigns={grouped.paused_cancelled} />}
            </div>
          )}
        </div>
      )}
    </>
  );
};

AdminCampaignsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default AdminCampaignsPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: "/", permanent: false } };
  }

  // A daily recurring template adds 365+ occurrence rows a year — bound the
  // main query to recent activity rather than loading every campaign ever
  // created. Templates themselves are always included regardless of age
  // (there will only ever be a handful); older occurrences are reachable
  // from their template's own detail page, not this list.
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [campaigns, metricsAgg] = await Promise.all([
    db.campaign.findMany({
      where: {
        OR: [
          { createdAt: { gte: ninetyDaysAgo } },
          { isRecurring: true, parentCampaignId: null },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        list: { select: { name: true } },
        _count: { select: { sends: true, occurrences: true } },
        metric: { select: { openRate: true, bounceRate: true } },
      },
    }),
    db.campaignMetric.aggregate({
      _avg: { openRate: true, bounceRate: true },
      _sum: { totalSent: true },
    }),
  ]);

  const totalCampaigns = campaigns.length;
  const sentCampaigns = campaigns.filter((c) => c.status === "SENT").length;

  const now = new Date();
  // Mirrors the exact "stuck" definition the campaign-scheduler/
  // campaign-recovery cron jobs use to auto-reset a SENDING campaign back
  // to DRAFT — that cron only runs once a day, so a campaign can sit
  // visibly stuck for hours before it's caught; surface it immediately
  // instead of waiting on the cron.
  const stuckThreshold = new Date(now.getTime() - 30 * 60 * 1000);

  return {
    props: {
      campaigns: campaigns.map((c) => {
        let needsAttention = false;
        let attentionReason: string | null = null;
        if (c.status === "SENDING" && c.updatedAt < stuckThreshold) {
          needsAttention = true;
          attentionReason = "Stuck sending — over 30 min";
        } else if (c.status === "SCHEDULED" && c.scheduledAt && c.scheduledAt <= now) {
          needsAttention = true;
          attentionReason = "Overdue — scheduled send hasn't started";
        }

        return {
          id: c.id,
          name: c.name,
          status: c.status,
          subject: c.subject,
          listName: c.list?.name ?? null,
          sendCount: c._count.sends,
          openRate: c.metric?.openRate ?? null,
          bounceRate: c.metric?.bounceRate ?? null,
          scheduledAt: c.scheduledAt?.toISOString() ?? null,
          sentAt: c.sentAt?.toISOString() ?? null,
          createdAt: c.createdAt.toISOString(),
          needsAttention,
          attentionReason,
          isRecurring: c.isRecurring,
          parentCampaignId: c.parentCampaignId,
          recurrenceTime: c.recurrenceTime,
          recurrenceSource: c.recurrenceSource,
          recurrenceActive: c.recurrenceActive,
          occurrenceCount: c._count.occurrences,
        };
      }),
      stats: {
        totalCampaigns,
        sentCampaigns,
        totalSent: metricsAgg._sum.totalSent ?? 0,
        avgOpenRate: metricsAgg._avg.openRate ?? null,
        avgBounceRate: metricsAgg._avg.bounceRate ?? null,
      },
    },
  };
};
