import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatUtcTimeOfDayLocal } from "@/lib/timeOfDay";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface EntryRow {
  id: string;
  slug: string;
  title: string;
  publishedAt: string | null;
  createdAt: string;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED";
}

interface SendTemplate {
  id: string;
  recurrenceTime: string | null;
  recurrenceActive: boolean;
}

interface Props {
  entries: EntryRow[];
  sendTemplate: SendTemplate | null;
}

const AdminMorningBoostPage: NextPageWithLayout<Props> = ({ entries, sendTemplate }) => {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Morning Boost</h1>
          <p className="mt-1 text-sm text-slate-500">Manage Morning Boost entries. The Publish Date only controls which day's entry is used — it does not control the send time.</p>
        </div>
        <Link
          href="/admin/morning-boost/new"
          className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-navy-dark transition-colors"
        >
          + New Entry
        </Link>
      </div>

      <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        {sendTemplate ? (
          <>
            Sends daily at <strong>{formatUtcTimeOfDayLocal(sendTemplate.recurrenceTime)}</strong> your local time, via the recurring campaign
            {" "}(<span className={sendTemplate.recurrenceActive ? "font-medium text-green-700" : "font-medium text-slate-500"}>
              {sendTemplate.recurrenceActive ? "active" : "paused"}
            </span>).{" "}
            <Link href={`/admin/campaigns/${sendTemplate.id}`} className="font-medium text-navy hover:underline">
              Manage send time &amp; audience →
            </Link>
          </>
        ) : (
          <>
            No recurring campaign is currently set up to send these entries — published content will never go out until one exists.{" "}
            <Link href="/admin/campaigns/new" className="font-medium text-navy hover:underline">Create one →</Link>
          </>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-slate-500">No entries yet.</p>
          <p className="mt-1 text-sm text-slate-400">Create your first Morning Boost entry to get started.</p>
          <Link
            href="/admin/morning-boost/new"
            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-navy-dark"
          >
            + New Entry
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Published</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{entry.title}</p>
                      <p className="text-xs text-slate-400">{entry.slug}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {entry.status === "PUBLISHED" ? (
                      <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        Published
                      </span>
                    ) : entry.status === "SCHEDULED" ? (
                      <span className="inline-flex rounded-full bg-amber/20 px-2.5 py-0.5 text-xs font-medium text-amber-dark">
                        Scheduled
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                        Draft
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {entry.publishedAt
                      ? new Date(entry.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/morning-boost/${entry.id}`}
                      className="text-sm font-medium text-navy no-underline hover:text-navy-dark"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
};

AdminMorningBoostPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }

  const [entries, sendTemplate] = await Promise.all([
    db.morningBoost.findMany({
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: { id: true, slug: true, title: true, publishedAt: true, createdAt: true },
    }),
    db.campaign.findFirst({
      where: { isRecurring: true, recurrenceSource: "MORNING_BOOST" },
      select: { id: true, recurrenceTime: true, recurrenceActive: true },
    }),
  ]);

  // Same day-window convention as the public site (see 945cb71): a
  // publishedAt dated today-or-earlier is live now; a future day is only
  // scheduled, not actually published yet.
  const now = new Date();
  const tomorrowStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const entriesWithStatus = entries.map((entry) => ({
    ...entry,
    status: !entry.publishedAt
      ? ("DRAFT" as const)
      : entry.publishedAt < tomorrowStartUtc
      ? ("PUBLISHED" as const)
      : ("SCHEDULED" as const),
  }));

  return { props: { entries: JSON.parse(JSON.stringify(entriesWithStatus)), sendTemplate } };
};

export default AdminMorningBoostPage;
