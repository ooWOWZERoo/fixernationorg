import Head from "next/head";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

type EventCard = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  location: string | null;
  isVirtual: boolean;
  startsAt: string;
  endsAt: string | null;
  priceCents: number;
  capacity: number | null;
  rsvpCount: number;
};

interface Props {
  upcoming: EventCard[];
  past: EventCard[];
}

function formatEventDate(startsAt: string, endsAt: string | null): string {
  const start = new Date(startsAt);
  const opts: Intl.DateTimeFormatOptions = { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" };
  if (!endsAt) return start.toLocaleString("en-US", opts);
  const end = new Date(endsAt);
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) {
    return `${start.toLocaleString("en-US", { month: "long", day: "numeric", year: "numeric" })}, ${start.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })} – ${end.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" })}`;
  }
  return `${start.toLocaleString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function EventCardComponent({ event }: { event: EventCard }) {
  const isFree = event.priceCents === 0;
  const atCapacity = event.capacity !== null && event.rsvpCount >= event.capacity;

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex flex-col rounded-2xl border border-navy/8 bg-white overflow-hidden shadow-sm no-underline transition hover:-translate-y-0.5 hover:shadow-md"
    >
      {event.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.coverUrl} alt={event.title} className="h-44 w-full object-cover" />
      ) : (
        <div className="h-44 w-full bg-navy/6 flex items-center justify-center">
          <span className="text-4xl font-extrabold text-navy/20">{event.title[0]}</span>
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold text-amber-dark mb-1">
          {formatEventDate(event.startsAt, event.endsAt)}
        </p>
        <h2 className="font-bold text-navy group-hover:text-amber-dark leading-snug">{event.title}</h2>
        {event.description && (
          <p className="mt-1.5 text-sm text-ink-soft line-clamp-2">{event.description}</p>
        )}
        <div className="mt-auto pt-4 flex items-center justify-between">
          <span className="text-xs text-ink-soft">
            {event.isVirtual ? "Online" : event.location ?? "TBD"}
          </span>
          <div className="flex items-center gap-2">
            {atCapacity && (
              <span className="text-xs font-semibold text-red-500">Full</span>
            )}
            <span className="rounded-full bg-amber/15 px-2.5 py-0.5 text-xs font-bold text-amber-dark">
              {isFree ? "Free" : `$${(event.priceCents / 100).toFixed(0)}`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

const EventsPage: NextPageWithLayout<Props> = ({ upcoming, past }) => {
  return (
    <>
      <Head>
        <title>Events — Fixer Nation</title>
        <meta name="description" content="Upcoming Fixer Nation workshops, meetups, and community events." />
      </Head>
      <main className="mx-auto max-w-5xl px-6 py-12 lg:px-8">
        <div className="mb-10">
          <p className="mb-2 text-sm font-bold uppercase tracking-widest text-amber-dark">Events</p>
          <h1 className="mb-3 text-3xl font-extrabold text-navy">What&apos;s coming up</h1>
          <p className="max-w-xl text-muted">
            Workshops, meetups, and community events. Some are free, some have a cost. RSVP to save your spot.
          </p>
        </div>

        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-navy/8 bg-white p-16 text-center">
            <p className="text-sm text-ink-soft">No upcoming events right now. Check back soon.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => <EventCardComponent key={e.id} event={e} />)}
          </div>
        )}

        {past.length > 0 && (
          <div className="mt-16">
            <h2 className="mb-5 text-sm font-extrabold uppercase tracking-widest text-ink-soft">Past events</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 opacity-60">
              {past.map((e) => <EventCardComponent key={e.id} event={e} />)}
            </div>
          </div>
        )}
      </main>
    </>
  );
};

EventsPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default EventsPage;

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  const now = new Date();

  const [upcomingRaw, pastRaw] = await Promise.all([
    db.event.findMany({
      where: { publishedAt: { not: null, lte: now }, startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      include: { _count: { select: { rsvps: { where: { status: "REGISTERED" } } } } },
    }),
    db.event.findMany({
      where: { publishedAt: { not: null, lte: now }, startsAt: { lt: now } },
      orderBy: { startsAt: "desc" },
      take: 6,
      include: { _count: { select: { rsvps: { where: { status: "REGISTERED" } } } } },
    }),
  ]);

  const toCard = (e: typeof upcomingRaw[0]): EventCard => ({
    id: e.id, slug: e.slug, title: e.title,
    description: e.description, coverUrl: e.coverUrl,
    location: e.location, isVirtual: e.isVirtual,
    startsAt: e.startsAt.toISOString(), endsAt: e.endsAt?.toISOString() ?? null,
    priceCents: e.priceCents, capacity: e.capacity,
    rsvpCount: e._count.rsvps,
  });

  return { props: { upcoming: upcomingRaw.map(toCard), past: pastRaw.map(toCard) } };
};
