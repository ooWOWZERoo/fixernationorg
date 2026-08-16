import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface EventRow {
  id: string;
  title: string;
  slug: string;
  startsAt: string;
  isVirtual: boolean;
  location: string | null;
  priceCents: number;
  capacity: number | null;
  publishedAt: string | null;
  rsvpCount: number;
}

interface Props {
  events: EventRow[];
}

const AdminEventsPage: NextPageWithLayout<Props> = ({ events }) => {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-navy">Events</h1>
        <Link
          href="/admin/events/new"
          className="rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark no-underline hover:bg-amber-dark"
        >
          + New event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
          <p className="text-sm text-ink-soft">No events yet.</p>
          <Link href="/admin/events/new" className="mt-3 inline-block text-sm font-semibold text-navy underline">
            Create one
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-navy/8 bg-white">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/8">
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Event</th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Date</th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Price</th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">RSVPs</th>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id} className="border-b border-navy/5 last:border-0 hover:bg-cream-panel/50">
                  <td className="px-5 py-3">
                    <p className="font-bold text-navy">{ev.title}</p>
                    <p className="text-xs text-ink-soft">{ev.slug}</p>
                  </td>
                  <td className="px-5 py-3 text-ink">
                    {new Date(ev.startsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3 text-ink">
                    {ev.priceCents === 0 ? "Free" : `$${(ev.priceCents / 100).toFixed(0)}`}
                  </td>
                  <td className="px-5 py-3 text-ink">
                    {ev.rsvpCount}{ev.capacity ? ` / ${ev.capacity}` : ""}
                  </td>
                  <td className="px-5 py-3">
                    {ev.publishedAt ? (
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">Published</span>
                    ) : (
                      <span className="rounded-full bg-navy/8 px-2.5 py-0.5 text-xs font-bold text-ink-soft">Draft</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/admin/events/${ev.id}`} className="text-xs font-semibold text-navy underline no-underline hover:text-amber-dark">
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

AdminEventsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default AdminEventsPage;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const events = await db.event.findMany({
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { rsvps: { where: { status: "REGISTERED" } } } } },
  });

  return {
    props: {
      events: events.map((ev) => ({
        id: ev.id, title: ev.title, slug: ev.slug,
        startsAt: ev.startsAt.toISOString(),
        isVirtual: ev.isVirtual, location: ev.location,
        priceCents: ev.priceCents, capacity: ev.capacity,
        publishedAt: ev.publishedAt?.toISOString() ?? null,
        rsvpCount: ev._count.rsvps,
      })),
    },
  };
};
