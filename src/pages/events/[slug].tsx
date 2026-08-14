import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

type RsvpStatus = "REGISTERED" | "WAITLISTED" | "CANCELLED" | null;

interface Props {
  event: {
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
  myRsvp: RsvpStatus;
  isSignedIn: boolean;
}

function formatLongDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}

const EventPage: NextPageWithLayout<Props> = ({ event, myRsvp: initialRsvp, isSignedIn }) => {
  const [myRsvp, setMyRsvp] = useState<RsvpStatus>(initialRsvp);
  const [rsvpCount, setRsvpCount] = useState(event.rsvpCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFree = event.priceCents === 0;
  const atCapacity = event.capacity !== null && rsvpCount >= event.capacity;
  const isRegistered = myRsvp === "REGISTERED";
  const isWaitlisted = myRsvp === "WAITLISTED";
  const isPast = new Date(event.startsAt) < new Date();

  async function handleRsvp() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${event.slug}/rsvp`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      const prev = myRsvp;
      setMyRsvp(data.status as RsvpStatus);
      if ((data.status === "REGISTERED") && prev !== "REGISTERED" && prev !== "WAITLISTED") {
        setRsvpCount((c) => c + 1);
      } else if (data.status === "CANCELLED" && (prev === "REGISTERED")) {
        setRsvpCount((c) => Math.max(0, c - 1));
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  let rsvpLabel = "";
  if (isRegistered) rsvpLabel = "Cancel registration";
  else if (isWaitlisted) rsvpLabel = "Leave waitlist";
  else if (atCapacity) rsvpLabel = "Join waitlist";
  else if (isFree) rsvpLabel = "Count me in";
  else rsvpLabel = `Register ($${(event.priceCents / 100).toFixed(0)})`;

  let statusMsg: { text: string; color: string } | null = null;
  if (isRegistered) statusMsg = { text: "You're registered. We'll send a reminder before the event.", color: "text-green-700" };
  else if (isWaitlisted) statusMsg = { text: "You're on the waitlist. We'll let you know if a spot opens up.", color: "text-amber-dark" };
  else if (myRsvp === "CANCELLED") statusMsg = { text: "Registration cancelled.", color: "text-ink-soft" };

  return (
    <>
      <Head>
        <title>{event.title} — Fixer Nation Events</title>
        {event.description && <meta name="description" content={event.description} />}
      </Head>

      <main className="mx-auto max-w-3xl px-6 py-10 lg:px-8">
        <Link href="/events" className="text-sm font-semibold text-ink-soft no-underline hover:text-navy">
          ← All events
        </Link>

        {event.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverUrl} alt={event.title} className="mt-6 w-full rounded-2xl object-cover max-h-72" />
        )}

        <h1 className="mt-6 text-3xl font-extrabold text-navy leading-tight">{event.title}</h1>

        <div className="mt-4 flex flex-wrap gap-3">
          <span className="rounded-full bg-amber/15 px-3 py-1 text-sm font-bold text-amber-dark">
            {isFree ? "Free" : `$${(event.priceCents / 100).toFixed(0)}`}
          </span>
          <span className="rounded-full bg-navy/8 px-3 py-1 text-sm font-semibold text-ink">
            {event.isVirtual ? "Online" : event.location ?? "TBD"}
          </span>
          {event.capacity !== null && (
            <span className="rounded-full bg-navy/8 px-3 py-1 text-sm font-semibold text-ink">
              {rsvpCount} / {event.capacity} spots filled
            </span>
          )}
        </div>

        <div className="mt-5 rounded-2xl border border-navy/8 bg-white p-5">
          <p className="text-sm font-semibold text-ink-soft mb-1">When</p>
          <p className="font-bold text-navy">{formatLongDate(event.startsAt)}</p>
          {event.endsAt && (
            <p className="text-sm text-ink-soft mt-0.5">Ends {formatLongDate(event.endsAt)}</p>
          )}
        </div>

        {event.description && (
          <div className="mt-5">
            <p className="whitespace-pre-wrap text-ink leading-relaxed">{event.description}</p>
          </div>
        )}

        {/* RSVP section */}
        {!isPast && (
          <div className="mt-8 rounded-2xl border border-navy/10 bg-white p-6">
            <p className="mb-3 font-bold text-navy">
              {atCapacity && !isRegistered && !isWaitlisted ? "This event is full." : "Reserve your spot"}
            </p>

            {statusMsg && (
              <p className={`mb-3 text-sm font-semibold ${statusMsg.color}`}>{statusMsg.text}</p>
            )}

            {error && (
              <p className="mb-3 text-sm font-semibold text-red-600">{error}</p>
            )}

            {isSignedIn ? (
              <button
                onClick={handleRsvp}
                disabled={loading}
                className={[
                  "rounded-xl px-5 py-2.5 text-sm font-extrabold transition-all",
                  isRegistered || isWaitlisted
                    ? "bg-navy/8 text-navy hover:bg-navy/15"
                    : "bg-amber text-navy-dark shadow-[0_8px_16px_-8px_rgba(242,169,60,0.55)] hover:-translate-y-0.5 hover:bg-amber-dark",
                  loading ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {loading ? "..." : rsvpLabel}
              </button>
            ) : (
              <div>
                <p className="mb-3 text-sm text-ink-soft">Sign in to RSVP.</p>
                <Link
                  href={`/signin?callbackUrl=/events/${event.slug}`}
                  className="rounded-xl bg-amber px-5 py-2.5 text-sm font-extrabold text-navy-dark no-underline shadow-[0_8px_16px_-8px_rgba(242,169,60,0.55)] hover:bg-amber-dark"
                >
                  Sign in
                </Link>
              </div>
            )}
          </div>
        )}

        {isPast && (
          <div className="mt-8 rounded-2xl border border-navy/8 bg-cream p-5 text-center">
            <p className="text-sm text-ink-soft">This event has passed.</p>
          </div>
        )}
      </main>
    </>
  );
};

EventPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default EventPage;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const { slug } = context.params as { slug: string };
  const session = await getServerSession(context.req, context.res, authOptions);
  const now = new Date();

  const event = await db.event.findUnique({
    where: { slug },
    include: { _count: { select: { rsvps: { where: { status: "REGISTERED" } } } } },
  });

  if (!event || !event.publishedAt || event.publishedAt > now) {
    return { notFound: true };
  }

  let myRsvp: RsvpStatus = null;
  if (session) {
    const rsvp = await db.eventRsvp.findUnique({
      where: { eventId_userId: { eventId: event.id, userId: session.user.id } },
      select: { status: true },
    });
    myRsvp = (rsvp?.status ?? null) as RsvpStatus;
  }

  return {
    props: {
      event: {
        id: event.id, slug: event.slug, title: event.title,
        description: event.description, coverUrl: event.coverUrl,
        location: event.location, isVirtual: event.isVirtual,
        startsAt: event.startsAt.toISOString(), endsAt: event.endsAt?.toISOString() ?? null,
        priceCents: event.priceCents, capacity: event.capacity,
        rsvpCount: event._count.rsvps,
      },
      myRsvp,
      isSignedIn: !!session,
    },
  };
};
