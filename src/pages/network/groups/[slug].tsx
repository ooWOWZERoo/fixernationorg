import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMember } from "@/lib/access";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PostCard, type PostData } from "@/components/network/PostCard";
import { PostComposer } from "@/components/network/PostComposer";
import type { NextPageWithLayout } from "@/types/next";

type MemberStatus = "member" | "owner" | "moderator" | "requested" | "none";

interface Props {
  group: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    coverUrl: string | null;
    visibility: string;
    memberCount: number;
  };
  initialPosts: PostData[];
  nextCursor: string | null;
  memberStatus: MemberStatus;
  currentUser: { id: string; name: string | null } | null;
  isAdmin: boolean;
}

const GroupPage: NextPageWithLayout<Props> = ({
  group,
  initialPosts,
  nextCursor: initCursor,
  memberStatus: initStatus,
  currentUser,
  isAdmin,
}) => {
  const [posts, setPosts] = useState(initialPosts);
  const [cursor, setCursor] = useState(initCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [memberStatus, setMemberStatus] = useState(initStatus);
  const [requestBusy, setRequestBusy] = useState(false);

  const canPost = currentUser && (isAdmin || memberStatus === "member" || memberStatus === "owner" || memberStatus === "moderator");
  const canSee = group.visibility === "PUBLIC" || canPost || isAdmin;

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const res = await fetch(`/api/network/groups/${group.slug}/posts?cursor=${encodeURIComponent(cursor)}`);
    if (res.ok) {
      const data = await res.json();
      setPosts((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
    }
    setLoadingMore(false);
  }

  async function requestJoin() {
    setRequestBusy(true);
    const res = await fetch(`/api/network/groups/${group.slug}/request`, { method: "POST" });
    if (res.ok) setMemberStatus("requested");
    setRequestBusy(false);
  }

  function handleNewPost(post: PostData) {
    setPosts((prev) => [post, ...prev]);
  }

  function handleDeleted(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <>
      <Head>
        <title>{group.name} — FN Network</title>
      </Head>

      {/* Cover + header */}
      <div className="relative">
        {group.coverUrl ? (
          <div className="h-40 overflow-hidden bg-navy/20 lg:h-56">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={group.coverUrl} alt={group.name} className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="h-32 bg-gradient-to-br from-navy to-navy-dark lg:h-44" />
        )}
      </div>

      <div className="border-b border-navy/10 px-6 pb-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-navy">{group.name}</h1>
              <p className="mt-1 text-sm text-ink-soft">
                {group.visibility === "PRIVATE" ? "Private" : "Public"} group ·{" "}
                {group.memberCount} member{group.memberCount !== 1 ? "s" : ""}
              </p>
              {group.description && (
                <p className="mt-2 max-w-xl text-sm text-ink">{group.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isAdmin && (
                <Link
                  href={`/admin/groups/${group.id}`}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 no-underline hover:bg-slate-50 transition-colors"
                >
                  Manage
                </Link>
              )}
              {!currentUser ? (
                <Link
                  href="/signin"
                  className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white no-underline hover:bg-navy-dark transition-colors"
                >
                  Sign in to join
                </Link>
              ) : memberStatus === "none" ? (
                <button
                  onClick={requestJoin}
                  disabled={requestBusy}
                  className="rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors"
                >
                  {requestBusy ? "Sending…" : "Request to Join"}
                </button>
              ) : memberStatus === "requested" ? (
                <span className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-400">
                  Request Sent
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-4">
            <Link
              href="/network"
              className="border-b-[3px] border-transparent pb-2 text-sm font-bold text-ink-soft no-underline hover:text-navy"
            >
              Feed
            </Link>
            <Link
              href="/network/groups"
              className="border-b-[3px] border-transparent pb-2 text-sm font-bold text-ink-soft no-underline hover:text-navy"
            >
              Groups
            </Link>
            <span className="border-b-[3px] border-amber pb-2 text-sm font-bold text-navy">
              {group.name}
            </span>
            <Link
              href="/network/members"
              className="border-b-[3px] border-transparent pb-2 text-sm font-bold text-ink-soft no-underline hover:text-navy"
            >
              Members
            </Link>
            <Link
              href="/network/messages"
              className="border-b-[3px] border-transparent pb-2 text-sm font-bold text-ink-soft no-underline hover:text-navy"
            >
              Messages
            </Link>
          </div>
        </div>
      </div>

      <section className="px-6 py-10 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-4">
          {!canSee ? (
            <div className="rounded-2xl border border-navy/10 bg-white p-10 text-center">
              <p className="text-sm font-semibold text-navy">This is a private group.</p>
              <p className="mt-1 text-sm text-ink-soft">Request to join to see posts.</p>
            </div>
          ) : (
            <>
              {canPost && (
                <PostComposer
                  groupSlug={group.slug}
                  authorName={currentUser?.name ?? null}
                  onPosted={handleNewPost}
                />
              )}

              {!currentUser && (
                <div className="rounded-xl border border-navy/10 bg-white px-5 py-4 text-sm text-ink-soft">
                  <Link href="/signin" className="font-semibold text-navy no-underline hover:underline">
                    Sign in
                  </Link>{" "}
                  to post, comment, and react.
                </div>
              )}

              {posts.length === 0 && (
                <div className="py-12 text-center text-sm text-ink-soft">
                  No posts yet. Be the first to share something!
                </div>
              )}

              {posts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
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
            </>
          )}
        </div>
      </section>
    </>
  );
};

GroupPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const slug = context.params?.slug as string;
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !isMember(session.user.role, session.user.adminRole)) {
    return {
      redirect: {
        destination: `/join?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  const group = await db.socialGroup.findUnique({
    where: { slug },
    include: { _count: { select: { members: true } } },
  });
  if (!group) return { notFound: true };

  const isAdmin = !!session && ["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole);

  let memberStatus: "member" | "owner" | "moderator" | "requested" | "none" = "none";
  if (session) {
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: session.user.id } },
    });
    if (membership) {
      memberStatus = membership.role === "OWNER" ? "owner" : membership.role === "MODERATOR" ? "moderator" : "member";
    } else {
      const request = await db.groupRequest.findUnique({
        where: { groupId_userId: { groupId: group.id, userId: session.user.id } },
      });
      if (request?.status === "PENDING") memberStatus = "requested";
    }
  }

  const canSee = group.visibility === "PUBLIC" || isAdmin ||
    memberStatus === "member" || memberStatus === "owner" || memberStatus === "moderator";

  let initialPosts: PostData[] = [];
  let nextCursor: string | null = null;

  if (canSee) {
    const posts = await db.post.findMany({
      where: { groupId: group.id, deletedAt: null },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 20,
      include: {
        author: { select: { id: true, name: true, image: true } },
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

    initialPosts = posts.map((p) => ({
      id: p.id,
      body: p.body,
      attachments: (p.attachments as any) ?? null,
      pinned: p.pinned,
      createdAt: p.createdAt.toISOString(),
      likedByMe: likedSet.has(p.id),
      author: p.author,
      _count: p._count,
    }));

    if (posts.length === 20) nextCursor = posts[posts.length - 1].createdAt.toISOString();
  }

  return {
    props: {
      group: {
        id: group.id,
        name: group.name,
        slug: group.slug,
        description: group.description,
        coverUrl: group.coverUrl,
        visibility: group.visibility,
        memberCount: group._count.members,
      },
      initialPosts,
      nextCursor,
      memberStatus,
      isAdmin,
      currentUser: session ? { id: session.user.id, name: session.user.name ?? null } : null,
    },
  };
};

export default GroupPage;
