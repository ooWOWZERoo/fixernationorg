import Head from "next/head";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { isMember } from "@/lib/access";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

type MessageData = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string | null; image: string | null };
};

interface Props {
  conversationId: string;
  otherUser: { id: string; name: string | null; image: string | null };
  initialMessages: MessageData[];
  currentUserId: string;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  )
    return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  )
    return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

const NetworkThreadPage: NextPageWithLayout<Props> = ({
  conversationId,
  otherUser,
  initialMessages,
  currentUserId,
}) => {
  const [messages, setMessages] = useState<MessageData[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCreatedAt = useRef<string | null>(
    initialMessages.length > 0
      ? initialMessages[initialMessages.length - 1].createdAt
      : null
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    fetch(`/api/network/messages/${conversationId}`, { method: "PUT" });
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom("instant");
  }, [scrollToBottom]);

  useEffect(() => {
    const poll = async () => {
      const since = lastCreatedAt.current;
      if (!since) return;
      const res = await fetch(
        `/api/network/messages/${conversationId}?since=${encodeURIComponent(since)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.messages.length > 0) {
        setMessages((prev) => [...prev, ...data.messages]);
        lastCreatedAt.current = data.messages[data.messages.length - 1].createdAt;
        fetch(`/api/network/messages/${conversationId}`, { method: "PUT" });
        setTimeout(() => scrollToBottom(), 50);
      }
    };
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [conversationId, scrollToBottom]);

  async function sendMessage() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setBody("");
    try {
      const res = await fetch(`/api/network/messages/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        lastCreatedAt.current = data.message.createdAt;
        setTimeout(() => scrollToBottom(), 50);
      }
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const grouped: { date: string; msgs: MessageData[] }[] = [];
  for (const m of messages) {
    const label = formatDate(m.createdAt);
    if (grouped.length === 0 || grouped[grouped.length - 1].date !== label) {
      grouped.push({ date: label, msgs: [m] });
    } else {
      grouped[grouped.length - 1].msgs.push(m);
    }
  }

  return (
    <>
      <Head>
        <title>{otherUser.name ?? "Messages"} — FN Network</title>
      </Head>

      <div className="flex h-[calc(100dvh-4rem)] flex-col">
        {/* Thread header */}
        <div className="flex items-center gap-3 border-b border-navy/10 bg-white px-5 py-3">
          <Link
            href="/network/messages"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-cream-panel no-underline transition-colors"
          >
            ←
          </Link>
          {otherUser.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={otherUser.image}
              alt={otherUser.name ?? "User"}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-bold text-amber">
              {(otherUser.name ?? "?")[0].toUpperCase()}
            </div>
          )}
          <span className="text-sm font-bold text-navy">{otherUser.name ?? "Unknown"}</span>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <p className="mt-12 text-center text-sm text-ink-soft">No messages yet. Say hello!</p>
          )}

          {grouped.map(({ date, msgs }) => (
            <div key={date}>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-navy/10" />
                <span className="text-xs font-semibold text-ink-soft">{date}</span>
                <div className="h-px flex-1 bg-navy/10" />
              </div>
              {msgs.map((m) => {
                const isMe = m.sender.id === currentUserId;
                return (
                  <div
                    key={m.id}
                    className={`mb-2 flex ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        isMe
                          ? "rounded-br-sm bg-navy text-white"
                          : "rounded-bl-sm bg-white text-ink shadow-[0_2px_8px_-4px_rgba(20,40,56,0.15)]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p
                        className={`mt-1 text-right text-[10px] ${
                          isMe ? "text-white/60" : "text-ink-soft"
                        }`}
                      >
                        {formatTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Compose bar */}
        <div className="border-t border-navy/10 bg-white px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              className="flex-1 resize-none rounded-xl border border-slate-300 px-4 py-2.5 text-sm leading-relaxed focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              style={{ maxHeight: "120px", overflowY: "auto" }}
            />
            <button
              onClick={sendMessage}
              disabled={!body.trim() || sending}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-navy text-white transition-colors hover:bg-navy-dark disabled:opacity-40"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
          <p className="mt-1.5 text-center text-xs text-ink-soft/60">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
};

NetworkThreadPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !isMember(session.user.role)) {
    return {
      redirect: {
        destination: `/join?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  const me = session.user.id;
  const conversationId = context.params?.id as string;

  const participation = await db.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: me } },
  });
  if (!participation) return { notFound: true };

  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    include: {
      participants: {
        include: { user: { select: { id: true, name: true, image: true } } },
      },
      messages: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        take: 60,
        include: { sender: { select: { id: true, name: true, image: true } } },
      },
    },
  });
  if (!conversation) return { notFound: true };

  const otherParticipant = conversation.participants.find((p) => p.userId !== me);
  if (!otherParticipant) return { notFound: true };

  await db.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: me } },
    data: { lastReadAt: new Date() },
  });

  return {
    props: {
      conversationId,
      otherUser: otherParticipant.user,
      currentUserId: me,
      initialMessages: conversation.messages.map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        sender: m.sender,
      })),
    },
  };
};

export default NetworkThreadPage;
