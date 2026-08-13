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

type MemberCard = {
  id: string;
  name: string | null;
  username: string | null;
  headline: string | null;
  avatarUrl: string | null;
  joinedAt: string;
};

interface Props {
  members: MemberCard[];
  currentUserId: string | null;
}

const NetworkMembersPage: NextPageWithLayout<Props> = ({ members, currentUserId }) => {
  const [query, setQuery] = useState("");
  const [messageLoading, setMessageLoading] = useState<string | null>(null);

  const filtered = query.trim()
    ? members.filter((m) => {
        const q = query.toLowerCase();
        return (
          m.name?.toLowerCase().includes(q) ||
          m.username?.toLowerCase().includes(q) ||
          m.headline?.toLowerCase().includes(q)
        );
      })
    : members;

  async function startMessage(recipientId: string) {
    setMessageLoading(recipientId);
    const res = await fetch("/api/network/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId }),
    });
    if (res.ok) {
      const data = await res.json();
      window.location.href = `/network/messages/${data.conversationId}`;
    } else {
      setMessageLoading(null);
    }
  }

  return (
    <>
      <Head>
        <title>Members — FN Network</title>
        <meta name="description" content="Connect with members of the Fixer Nation community." />
      </Head>

      <section className="border-b border-navy/10 px-6 pb-0 pt-14 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <span className="eyebrow">FN Network</span>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-navy">Members</h1>
          <p className="mt-2 text-base text-ink-soft">
            The people who make up Fixer Nation.
          </p>
          <NetworkTabBar />
        </div>
      </section>

      <section className="px-6 py-10 lg:px-8">
        <div className="mx-auto max-w-6xl">
          {/* Search */}
          <div className="mb-8 max-w-sm">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members…"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            />
          </div>

          {filtered.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-sm text-ink-soft">
                {query ? "No members match that search." : "No members have set up a profile yet."}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((m) => (
              <div
                key={m.id}
                className="flex flex-col rounded-2xl bg-white p-5 shadow-[0_8px_24px_-16px_rgba(20,40,56,0.2)]"
              >
                <div className="flex items-start gap-3">
                  <Link
                    href={m.username ? `/profile/${m.username}` : "#"}
                    className="shrink-0 no-underline"
                  >
                    {m.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.avatarUrl}
                        alt={m.name ?? "Member"}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy text-base font-bold text-amber">
                        {(m.name ?? m.username ?? "?")[0].toUpperCase()}
                      </div>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={m.username ? `/profile/${m.username}` : "#"}
                      className="block truncate text-sm font-extrabold text-navy no-underline hover:underline"
                    >
                      {m.name ?? m.username ?? "Member"}
                    </Link>
                    {m.username && (
                      <p className="text-xs text-ink-soft">@{m.username}</p>
                    )}
                  </div>
                </div>

                {m.headline && (
                  <p className="mt-3 text-xs leading-relaxed text-ink line-clamp-2">
                    {m.headline}
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  {m.username && (
                    <Link
                      href={`/profile/${m.username}`}
                      className="flex-1 rounded-lg border border-navy/20 py-1.5 text-center text-xs font-bold text-navy no-underline hover:bg-navy hover:text-white transition-colors"
                    >
                      View profile
                    </Link>
                  )}
                  {currentUserId && m.id !== currentUserId && (
                    <button
                      onClick={() => startMessage(m.id)}
                      disabled={messageLoading === m.id}
                      className="flex-1 rounded-lg bg-navy py-1.5 text-xs font-bold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors"
                    >
                      {messageLoading === m.id ? "…" : "Message"}
                    </button>
                  )}
                  {m.id === currentUserId && (
                    <Link
                      href="/account/profile"
                      className="flex-1 rounded-lg border border-slate-300 py-1.5 text-center text-xs font-bold text-ink-soft no-underline hover:bg-cream-panel transition-colors"
                    >
                      Edit profile
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

NetworkMembersPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  const profiles = await db.socialProfile.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: { id: true, name: true, username: true, createdAt: true },
      },
    },
  });

  const members: MemberCard[] = profiles.map((p) => ({
    id: p.user.id,
    name: p.user.name,
    username: p.user.username,
    headline: p.headline,
    avatarUrl: p.avatarUrl,
    joinedAt: p.user.createdAt.toISOString(),
  }));

  return {
    props: {
      members,
      currentUserId: session?.user.id ?? null,
    },
  };
};

export default NetworkMembersPage;
