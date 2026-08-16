import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMember } from "@/lib/access";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { NetworkTabBar } from "@/components/network/NetworkTabBar";
import type { NextPageWithLayout } from "@/types/next";

type OtherUser = { id: string; name: string | null; image: string | null };

type ConversationRow = {
  id: string;
  other: OtherUser[];
  lastMessage: { body: string; senderId: string; createdAt: string } | null;
  unreadCount: number;
  updatedAt: string;
};

interface Props {
  conversations: ConversationRow[];
  currentUserId: string;
  allUsers: { id: string; name: string | null; email: string }[];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function Avatar({ user }: { user: OtherUser }) {
  if (user.image)
    return <img src={user.image} alt={user.name ?? "User"} className="h-10 w-10 rounded-full object-cover" />;
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-sm font-bold text-amber">
      {(user.name ?? "?")[0].toUpperCase()}
    </div>
  );
}

const NetworkMessagesPage: NextPageWithLayout<Props> = ({
  conversations,
  currentUserId,
  allUsers,
}) => {
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [starting, setStarting] = useState(false);

  const filtered = allUsers.filter(
    (u) =>
      u.id !== currentUserId &&
      (u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()))
  );

  async function startConversation(recipientId: string) {
    setStarting(true);
    try {
      const res = await fetch("/api/network/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId }),
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = `/network/messages/${data.conversationId}`;
      }
    } finally {
      setStarting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Messages — FN Network</title>
        <meta name="description" content="Your direct messages on Fixer Nation." />
      </Head>

      {/* Page header */}
      <section className="border-b border-navy/10 px-6 pb-0 pt-14 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <span className="eyebrow">FN Network</span>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-navy">Messages</h1>
          <p className="mt-2 text-base text-ink-soft">Private conversations with other members.</p>
          <NetworkTabBar />
        </div>
      </section>

      <section className="px-6 py-10 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-ink-soft">
              {conversations.length === 0
                ? "No conversations yet."
                : `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""}`}
            </p>
            <button
              onClick={() => setShowNew(true)}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark transition-colors"
            >
              New Message
            </button>
          </div>

          {conversations.length === 0 ? (
            <div className="rounded-2xl border border-navy/10 bg-white p-12 text-center">
              <p className="text-sm font-semibold text-navy">No messages yet</p>
              <p className="mt-1 text-sm text-ink-soft">
                Start a private conversation with another Fixer Nation member.
              </p>
              <button
                onClick={() => setShowNew(true)}
                className="mt-4 inline-block rounded-lg bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-dark transition-colors"
              >
                New Message
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-navy/10 bg-white divide-y divide-navy/6">
              {conversations.map((c) => {
                const other = c.other[0];
                if (!other) return null;
                return (
                  <Link
                    key={c.id}
                    href={`/network/messages/${c.id}`}
                    className="flex items-center gap-3 px-5 py-4 no-underline hover:bg-cream-panel transition-colors"
                  >
                    <Avatar user={other} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-sm font-bold ${
                            c.unreadCount > 0 ? "text-navy" : "text-ink"
                          }`}
                        >
                          {other.name ?? other.id}
                        </span>
                        {c.lastMessage && (
                          <span className="flex-shrink-0 text-xs text-ink-soft">
                            {timeAgo(c.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className="truncate text-xs text-ink-soft">
                          {c.lastMessage
                            ? `${c.lastMessage.senderId === currentUserId ? "You: " : ""}${c.lastMessage.body}`
                            : "No messages yet"}
                        </p>
                        {c.unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber px-1.5 text-xs font-bold text-navy-dark">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* New message modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 px-4">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-navy/10 px-5 py-4">
              <h2 className="text-base font-bold text-navy">New Message</h2>
              <button
                onClick={() => setShowNew(false)}
                className="text-ink-soft hover:text-navy text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
              <div className="mt-2 max-h-60 overflow-y-auto">
                {search.length > 0 && filtered.length === 0 && (
                  <p className="px-2 py-3 text-sm text-ink-soft">No members found.</p>
                )}
                {filtered.slice(0, 8).map((u) => (
                  <button
                    key={u.id}
                    onClick={() => startConversation(u.id)}
                    disabled={starting}
                    className="w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-cream-panel disabled:opacity-50 transition-colors"
                  >
                    <span className="block font-semibold text-navy">{u.name ?? "—"}</span>
                    <span className="block text-xs text-ink-soft">{u.email}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

NetworkMessagesPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !isMember(session.user.role, session.user.adminRole)) {
    return {
      redirect: {
        destination: `/join?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  const me = session.user.id;

  const participations = await db.conversationParticipant.findMany({
    where: { userId: me },
    include: {
      conversation: {
        include: {
          participants: {
            include: { user: { select: { id: true, name: true, image: true } } },
          },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, body: true, senderId: true, createdAt: true },
          },
        },
      },
    },
    orderBy: { conversation: { updatedAt: "desc" } },
  });

  const conversations: ConversationRow[] = await Promise.all(
    participations.map(async (p) => {
      const other = p.conversation.participants
        .filter((cp) => cp.userId !== me)
        .map((cp) => cp.user);
      const lastMsg = p.conversation.messages[0] ?? null;
      const unreadCount = await db.directMessage.count({
        where: {
          conversationId: p.conversationId,
          senderId: { not: me },
          deletedAt: null,
          ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}),
        },
      });
      return {
        id: p.conversationId,
        other,
        lastMessage: lastMsg
          ? {
              body: lastMsg.body,
              senderId: lastMsg.senderId,
              createdAt: lastMsg.createdAt.toISOString(),
            }
          : null,
        unreadCount,
        updatedAt: p.conversation.updatedAt.toISOString(),
      };
    })
  );

  const allUsers = await db.user.findMany({
    where: { id: { not: me } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return {
    props: { conversations, currentUserId: me, allUsers },
  };
};

export default NetworkMessagesPage;
