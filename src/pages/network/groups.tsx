import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { NetworkTabBar } from "@/components/network/NetworkTabBar";
import type { NextPageWithLayout } from "@/types/next";

type GroupCard = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  visibility: string;
  memberCount: number;
  memberStatus: "member" | "requested" | "none";
};

interface Props {
  groups: GroupCard[];
  isSignedIn: boolean;
}

const NetworkGroupsPage: NextPageWithLayout<Props> = ({ groups, isSignedIn }) => {
  const [statuses, setStatuses] = useState<Record<string, GroupCard["memberStatus"]>>(
    Object.fromEntries(groups.map((g) => [g.id, g.memberStatus]))
  );
  const [busy, setBusy] = useState<string | null>(null);

  async function requestJoin(slug: string, groupId: string) {
    setBusy(groupId);
    const res = await fetch(`/api/network/groups/${slug}/request`, { method: "POST" });
    if (res.ok) setStatuses((prev) => ({ ...prev, [groupId]: "requested" }));
    setBusy(null);
  }

  return (
    <>
      <Head>
        <title>Groups — FN Network</title>
        <meta name="description" content="Browse Fixer Nation community groups." />
      </Head>

      <section className="border-b border-navy/10 px-6 pb-0 pt-14 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <span className="eyebrow">FN Network</span>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-navy">Community Groups</h1>
          <p className="mt-2 text-base text-ink-soft">
            Find your people. Request to join a group and start connecting.
          </p>
          <NetworkTabBar />
        </div>
      </section>

      <section className="px-6 py-12 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => {
              const status = statuses[g.id];
              return (
                <div
                  key={g.id}
                  className="overflow-hidden rounded-2xl bg-white shadow-[0_16px_34px_-22px_rgba(20,40,56,0.25)]"
                >
                  <div className="aspect-video overflow-hidden bg-cream-panel">
                    {g.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.coverUrl} alt={g.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="text-4xl opacity-20">👥</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-base font-extrabold text-navy">{g.name}</h3>
                    <p className="mt-0.5 text-xs font-semibold text-ink-soft">
                      {g.visibility === "PRIVATE" ? "Private" : "Public"} · {g.memberCount} member{g.memberCount !== 1 ? "s" : ""}
                    </p>
                    {g.description && (
                      <p className="mt-2 text-xs leading-relaxed text-ink-soft line-clamp-2">
                        {g.description}
                      </p>
                    )}

                    {status === "member" ? (
                      <Link
                        href={`/network/groups/${g.slug}`}
                        className="mt-4 block w-full rounded-[8px] bg-navy py-2 text-center text-xs font-bold text-white no-underline hover:bg-navy-dark transition-colors"
                      >
                        View Group
                      </Link>
                    ) : status === "requested" ? (
                      <div className="mt-4 w-full rounded-[8px] border-2 border-slate-300 py-2 text-center text-xs font-bold text-slate-400">
                        Request Sent
                      </div>
                    ) : isSignedIn ? (
                      <button
                        onClick={() => requestJoin(g.slug, g.id)}
                        disabled={busy === g.id}
                        className="mt-4 w-full rounded-[8px] border-2 border-navy py-2 text-xs font-bold text-navy transition-all hover:bg-navy hover:text-white disabled:opacity-50"
                      >
                        {busy === g.id ? "Sending…" : "Request to Join"}
                      </button>
                    ) : (
                      <Link
                        href="/signin"
                        className="mt-4 block w-full rounded-[8px] border-2 border-navy py-2 text-center text-xs font-bold text-navy no-underline hover:bg-navy hover:text-white transition-all"
                      >
                        Sign in to Join
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {groups.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-sm text-ink-soft">No groups yet — check back soon.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

NetworkGroupsPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  const groups = await db.socialGroup.findMany({
    where: { visibility: "PUBLIC" },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { members: true } } },
  });

  let membershipMap: Record<string, "member" | "requested"> = {};
  if (session) {
    const [memberships, requests] = await Promise.all([
      db.groupMember.findMany({
        where: { userId: session.user.id, groupId: { in: groups.map((g) => g.id) } },
        select: { groupId: true },
      }),
      db.groupRequest.findMany({
        where: { userId: session.user.id, status: "PENDING", groupId: { in: groups.map((g) => g.id) } },
        select: { groupId: true },
      }),
    ]);
    for (const m of memberships) membershipMap[m.groupId] = "member";
    for (const r of requests) membershipMap[r.groupId] = membershipMap[r.groupId] ?? "requested";
  }

  return {
    props: {
      isSignedIn: !!session,
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        description: g.description,
        coverUrl: g.coverUrl,
        visibility: g.visibility,
        memberCount: g._count.members,
        memberStatus: membershipMap[g.id] ?? "none",
      })),
    },
  };
};

export default NetworkGroupsPage;
