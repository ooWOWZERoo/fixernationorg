import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { NetworkTabBar } from "@/components/network/NetworkTabBar";
import { PostCard, type PostData } from "@/components/network/PostCard";
import type { NextPageWithLayout } from "@/types/next";

type GroupSidebarItem = {
  id: string;
  name: string;
  slug: string;
  coverUrl: string | null;
  memberCount: number;
};

interface Props {
  initialPosts: PostData[];
  nextCursor: string | null;
  myGroups: GroupSidebarItem[];
  discoverGroups: GroupSidebarItem[];
  currentUser: { id: string; name: string | null } | null;
}

const NetworkPage: NextPageWithLayout<Props> = ({
  initialPosts,
  nextCursor: initCursor,
  myGroups,
  discoverGroups,
  currentUser,
}) => {
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const url = cursor ? `/api/network/feed?cursor=${encodeURIComponent(cursor)}` : "/api/network/feed";
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setPosts((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
    }
    setLoadingMore(false);
  }

  function handleDeleted(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <>
      <Head>
        <title>Community — Fixer Nation</title>
        <meta name="description" content="Connect with groups and members across Fixer Nation." />
      </Head>

      {/* Page header */}
      <section className="border-b border-navy/10 px-6 pb-0 pt-14 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <span className="eyebrow">Community</span>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-navy">Community Feed</h1>
          <p className="mt-2 text-base text-ink-soft">
            What's happening across Fixer Nation.
          </p>
          <NetworkTabBar />
        </div>
      </section>

      <section className="px-6 py-10 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex gap-8">
            {/* Left sidebar — my groups */}
            <aside className="hidden w-56 flex-shrink-0 lg:block">
              {currentUser && myGroups.length > 0 && (
                <div className="mb-6">
                  <h2 className="mb-3 text-xs font-extrabold uppercase tracking-widest text-ink-soft">Your Groups</h2>
                  <ul className="space-y-1">
                    {myGroups.map((g) => (
                      <li key={g.id}>
                        <Link
                          href={`/network/groups/${g.slug}`}
                          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-ink no-underline hover:bg-cream-panel transition-colors"
                        >
                          <div className="h-7 w-7 flex-shrink-0 overflow-hidden rounded-lg bg-navy/10">
                            {g.coverUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={g.coverUrl} alt={g.name} className="h-full w-full object-cover" />
                            )}
                          </div>
                          <span className="truncate">{g.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/network/groups"
                    className="mt-3 block text-xs font-semibold text-ink-soft no-underline hover:text-navy"
                  >
                    Browse all groups →
                  </Link>
                </div>
              )}

              {!currentUser && (
                <div className="rounded-xl border border-navy/10 bg-white p-4">
                  <p className="text-sm font-bold text-navy">Join the community</p>
                  <p className="mt-1 text-xs text-ink-soft">Sign in to post, comment, and join groups.</p>
                  <Link
                    href="/signin"
                    className="mt-3 block rounded-lg bg-navy px-4 py-2 text-center text-xs font-semibold text-white no-underline hover:bg-navy-dark transition-colors"
                  >
                    Sign In
                  </Link>
                </div>
              )}
            </aside>

            {/* Center — feed */}
            <div className="min-w-0 flex-1 space-y-4">
              {!currentUser && (
                <div className="rounded-xl border border-navy/10 bg-white px-5 py-4 text-sm text-ink-soft">
                  <Link href="/signin" className="font-semibold text-navy no-underline hover:underline">
                    Sign in
                  </Link>{" "}
                  to post, comment, and react to content across the network.
                </div>
              )}

              {posts.length === 0 && (
                <div className="py-20 text-center">
                  <p className="text-base font-semibold text-navy">Nothing here yet.</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {currentUser
                      ? "Join a group and be the first to post."
                      : "Sign in to see your group feeds."}
                  </p>
                  <Link
                    href="/network/groups"
                    className="mt-4 inline-block rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white no-underline hover:bg-navy-dark transition-colors"
                  >
                    Browse Groups
                  </Link>
                </div>
              )}

              {posts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  showGroup
                  currentUserId={currentUser?.id}
                  onDeleted={handleDeleted}
                />
              ))}

              {cursor && (
                <div className="pt-2 text-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </div>

            {/* Right sidebar — discover */}
            <aside className="hidden w-56 flex-shrink-0 xl:block">
              <h2 className="mb-3 text-xs font-extrabold uppercase tracking-widest text-ink-soft">Discover Groups</h2>
              <div className="space-y-3">
                {discoverGroups.slice(0, 4).map((g) => (
                  <Link
                    key={g.id}
                    href={`/network/groups/${g.slug}`}
                    className="flex items-center gap-2.5 rounded-xl bg-white p-3 no-underline shadow-[0_8px_20px_-14px_rgba(20,40,56,0.2)] hover:shadow-md transition-shadow"
                  >
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-navy/10">
                      {g.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={g.coverUrl} alt={g.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-lg">👥</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-navy">{g.name}</p>
                      <p className="text-xs text-ink-soft">{g.memberCount} member{g.memberCount !== 1 ? "s" : ""}</p>
                    </div>
                  </Link>
                ))}
                <Link
                  href="/network/groups"
                  className="block text-center text-xs font-semibold text-ink-soft no-underline hover:text-navy mt-2"
                >
                  See all groups →
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {!currentUser && (
        <section className="bg-navy px-6 py-20 text-center lg:px-8">
          <div className="mx-auto max-w-xl">
            <span className="eyebrow" style={{ background: "rgba(255,255,255,0.12)", color: "#F2D9AE" }}>
              Membership
            </span>
            <h2 className="mt-4 text-3xl font-extrabold text-white">
              Full network access comes with your membership
            </h2>
            <Link
              href="/join"
              className="mt-7 inline-flex items-center justify-center rounded-[10px] bg-amber px-8 py-3.5 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
            >
              Join Fixer Nation
            </Link>
          </div>
        </section>
      )}
    </>
  );
};

NetworkPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  // Fetch public posts + posts in user's private groups
  let groupIds: string[] | undefined;
  let myGroupIds = new Set<string>();

  if (session) {
    const memberships = await db.groupMember.findMany({
      where: { userId: session.user.id },
      select: { groupId: true },
    });
    myGroupIds = new Set(memberships.map((m) => m.groupId));
    const publicGroups = await db.socialGroup.findMany({
      where: { visibility: "PUBLIC" },
      select: { id: true },
    });
    groupIds = [...new Set([...publicGroups.map((g) => g.id), ...Array.from(myGroupIds)])];
  }

  const posts = await db.post.findMany({
    where: {
      deletedAt: null,
      ...(groupIds
        ? { groupId: { in: groupIds } }
        : { group: { visibility: "PUBLIC" } }),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      author: { select: { id: true, name: true, image: true } },
      group: { select: { id: true, name: true, slug: true } },
      _count: { select: { comments: true, reactions: true } },
    },
  });

  const likedSet = session
    ? new Set(
        (await db.reaction.findMany({
          where: { userId: session.user.id, postId: { in: posts.map((p) => p.id) } },
          select: { postId: true },
        })).map((r) => r.postId as string)
      )
    : new Set<string>();

  const initialPosts: PostData[] = posts.map((p) => ({
    id: p.id,
    body: p.body,
    attachments: (p.attachments as any) ?? null,
    pinned: p.pinned,
    createdAt: p.createdAt.toISOString(),
    likedByMe: likedSet.has(p.id),
    author: p.author,
    group: p.group ?? undefined,
    _count: p._count,
  }));

  const nextCursor = posts.length === 20 ? posts[posts.length - 1].createdAt.toISOString() : null;

  // My groups sidebar
  const allGroups = await db.socialGroup.findMany({
    where: { visibility: "PUBLIC" },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { members: true } } },
  });

  const myGroups: GroupSidebarItem[] = session
    ? allGroups
        .filter((g) => myGroupIds.has(g.id))
        .map((g) => ({ id: g.id, name: g.name, slug: g.slug, coverUrl: g.coverUrl, memberCount: g._count.members }))
    : [];

  const discoverGroups: GroupSidebarItem[] = allGroups
    .filter((g) => !myGroupIds.has(g.id))
    .map((g) => ({ id: g.id, name: g.name, slug: g.slug, coverUrl: g.coverUrl, memberCount: g._count.members }));

  return {
    props: {
      initialPosts,
      nextCursor,
      myGroups,
      discoverGroups,
      currentUser: session ? { id: session.user.id, name: session.user.name ?? null } : null,
    },
  };
};

export default NetworkPage;
