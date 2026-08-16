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
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface Stats {
  totalCampaigns: number;
  sentCampaigns: number;
  totalSent: number;
  avgOpenRate: number | null;
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

const AdminCampaignsPage: NextPageWithLayout<Props> = ({ campaigns, stats }) => {
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
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total campaigns", value: stats.totalCampaigns },
            { label: "Sent", value: stats.sentCampaigns },
            { label: "Emails sent", value: stats.totalSent.toLocaleString() },
            { label: "Avg open rate", value: stats.avgOpenRate != null ? `${Math.round(stats.avgOpenRate * 100)}%` : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-2xl border border-navy/8 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">{label}</p>
              <p className="mt-1 text-2xl font-extrabold text-navy">{value}</p>
            </div>
          ))}
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
          <p className="text-sm text-ink-soft">No campaigns yet.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-navy/8 bg-white">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/8 text-left text-xs font-bold uppercase tracking-widest text-ink-soft">
                <th className="px-5 py-3">Campaign</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">List</th>
                <th className="px-5 py-3">Sends</th>
                <th className="px-5 py-3">Open rate</th>
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
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[c.status] ?? "bg-navy/8 text-navy"}`}>
                      {c.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-ink-soft">{c.listName ?? "—"}</td>
                  <td className="px-5 py-3 text-center text-ink-soft">{c.sendCount}</td>
                  <td className="px-5 py-3 text-center">
                    {c.openRate != null
                      ? <span className="font-semibold text-green-700">{Math.round(c.openRate * 100)}%</span>
                      : <span className="text-ink-soft/50">—</span>}
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
      )}
    </>
  );
};

AdminCampaignsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default AdminCampaignsPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.role || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const [campaigns, metricsAgg] = await Promise.all([
    db.campaign.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        list: { select: { name: true } },
        _count: { select: { sends: true } },
        metric: { select: { openRate: true } },
      },
    }),
    db.campaignMetric.aggregate({
      _avg: { openRate: true },
      _sum: { totalSent: true },
    }),
  ]);

  const totalCampaigns = campaigns.length;
  const sentCampaigns = campaigns.filter((c) => c.status === "SENT").length;

  return {
    props: {
      campaigns: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        subject: c.subject,
        listName: c.list?.name ?? null,
        sendCount: c._count.sends,
        openRate: c.metric?.openRate ?? null,
        scheduledAt: c.scheduledAt?.toISOString() ?? null,
        sentAt: c.sentAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
      stats: {
        totalCampaigns,
        sentCampaigns,
        totalSent: metricsAgg._sum.totalSent ?? 0,
        avgOpenRate: metricsAgg._avg.openRate ?? null,
      },
    },
  };
};
