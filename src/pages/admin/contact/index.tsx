import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import type { ContactMessage } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

const STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  READ: "Read",
  ARCHIVED: "Archived",
};

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-amber/20 text-amber-dark",
  READ: "bg-blue-100 text-blue-700",
  ARCHIVED: "bg-slate-100 text-slate-500",
};

interface Props {
  messages: ContactMessage[];
}

const AdminContactPage: NextPageWithLayout<Props> = ({ messages: initial }) => {
  const [messages, setMessages] = useState(initial);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "NEW" | "READ" | "ARCHIVED">("ALL");

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/contact/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setMessages((msgs) => msgs.map((m) => m.id === id ? { ...m, status: status as ContactMessage["status"] } : m));
  };

  const deleteMessage = async (id: string) => {
    if (!confirm("Delete this message? This cannot be undone.")) return;
    await fetch(`/api/admin/contact/${id}`, { method: "DELETE" });
    setMessages((msgs) => msgs.filter((m) => m.id !== id));
  };

  const markReadOnExpand = (id: string, currentStatus: string) => {
    setExpanded((prev) => {
      const next = prev === id ? null : id;
      if (next && currentStatus === "NEW") updateStatus(id, "READ");
      return next;
    });
  };

  const filtered = filter === "ALL" ? messages : messages.filter((m) => m.status === filter);
  const newCount = messages.filter((m) => m.status === "NEW").length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Contact Messages
            {newCount > 0 && (
              <span className="ml-2 rounded-full bg-amber/20 px-2 py-0.5 text-sm font-semibold text-amber-dark">
                {newCount} new
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{messages.length} total messages</p>
        </div>
        <div className="flex gap-2">
          {(["ALL", "NEW", "READ", "ARCHIVED"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === f
                  ? "bg-navy text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              ].join(" ")}
            >
              {f === "ALL" ? "All" : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-400">
          No messages{filter !== "ALL" ? ` with status "${STATUS_LABEL[filter]}"` : ""}.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((msg) => (
            <div
              key={msg.id}
              className={[
                "rounded-xl border bg-white transition-shadow",
                msg.status === "NEW" ? "border-amber/40" : "border-slate-200",
                expanded === msg.id ? "shadow-md" : "",
              ].join(" ")}
            >
              {/* Row */}
              <button
                onClick={() => markReadOnExpand(msg.id, msg.status)}
                className="flex w-full items-start gap-4 px-5 py-4 text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[msg.status]}`}>
                      {STATUS_LABEL[msg.status]}
                    </span>
                    <span className="font-semibold text-slate-900">{msg.name}</span>
                    <span className="text-xs text-slate-400">{msg.email}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-sm text-slate-700">{msg.subject}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(msg.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  {expanded !== msg.id && (
                    <p className="mt-1 truncate text-xs text-slate-400">{msg.message}</p>
                  )}
                </div>
                <span className="shrink-0 text-slate-400 text-xs mt-1">
                  {expanded === msg.id ? "▲" : "▼"}
                </span>
              </button>

              {/* Expanded body */}
              {expanded === msg.id && (
                <div className="border-t border-slate-100 px-5 pb-5 pt-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{msg.message}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <a
                      href={`mailto:${msg.email}?subject=Re: ${encodeURIComponent(msg.subject)}`}
                      className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white no-underline hover:bg-navy-dark"
                    >
                      Reply by email
                    </a>
                    {msg.status !== "ARCHIVED" && (
                      <button
                        onClick={() => updateStatus(msg.id, "ARCHIVED")}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Archive
                      </button>
                    )}
                    {msg.status === "ARCHIVED" && (
                      <button
                        onClick={() => updateStatus(msg.id, "READ")}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Unarchive
                      </button>
                    )}
                    <button
                      onClick={() => deleteMessage(msg.id)}
                      className="ml-auto text-xs font-medium text-red-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

AdminContactPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }

  const messages = await db.contactMessage.findMany({ orderBy: { createdAt: "desc" } });
  return { props: { messages: JSON.parse(JSON.stringify(messages)) } };
};

export default AdminContactPage;
