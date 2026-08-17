import Head from "next/head";
import Link from "next/link";
import { AccountNav } from "@/components/account/AccountNav";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const REASON_LABEL: Record<string, string> = {
  post_created: "Posted in a group",
  comment_added: "Left a comment",
  event_rsvp: "RSVPed to an event",
  referral_converted: "Referred a new member",
  profile_completed: "Completed your profile",
  manual_award: "Admin award",
};

function labelReason(reason: string): string {
  return REASON_LABEL[reason] ?? reason.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface PointRow {
  id: string;
  points: number;
  reason: string;
  note: string | null;
  createdAt: string;
}

interface Props {
  total: number;
  history: PointRow[];
}

const PointsPage: NextPageWithLayout<Props> = ({ total, history }) => {
  return (
    <>
      <Head>
        <title>Community Points — Fixer Nation</title>
      </Head>

      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-xl">
          <AccountNav />

          <h1 className="text-3xl font-extrabold tracking-tight text-navy">Community points</h1>

          <div className="mt-6 rounded-2xl border border-navy/10 bg-white p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-dark">Your total</p>
            <div className="mt-1 flex items-end gap-2">
              <p className="text-4xl font-extrabold text-navy">{total}</p>
              <p className="mb-1 text-base text-ink-soft">pts</p>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-base font-extrabold text-navy">How to earn points</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              <li>Post in a community group — <span className="font-semibold text-navy">5 pts</span></li>
              <li>Leave a comment — <span className="font-semibold text-navy">2 pts</span></li>
              <li>RSVP to an event — <span className="font-semibold text-navy">3 pts</span></li>
              <li>Refer someone who joins — <span className="font-semibold text-navy">10 pts</span></li>
              <li>Complete your profile — <span className="font-semibold text-navy">5 pts</span></li>
            </ul>
          </div>

          <div className="mt-10">
            <h2 className="text-base font-extrabold text-navy">History</h2>
            {history.length === 0 ? (
              <p className="mt-4 text-sm text-ink-soft">
                No points yet. Post in a group, RSVP to an event, or refer a friend to get started.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-navy/8 rounded-2xl border border-navy/10 bg-white">
                {history.map((row) => (
                  <div key={row.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold text-navy">
                        {labelReason(row.reason)}
                        {row.reason === "manual_award" && row.note && (
                          <span className="ml-1 font-normal text-ink-soft">— {row.note}</span>
                        )}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {new Date(row.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-amber-dark">+{row.points} pts</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
};

PointsPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${encodeURIComponent("/account/points")}`,
        permanent: false,
      },
    };
  }

  const rows = await db.loyaltyPoint.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const total = rows.reduce((sum, r) => sum + r.points, 0);

  return {
    props: {
      total,
      history: rows.map((r) => ({
        id: r.id,
        points: r.points,
        reason: r.reason,
        note: r.resourceId ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    },
  };
};

export default PointsPage;
