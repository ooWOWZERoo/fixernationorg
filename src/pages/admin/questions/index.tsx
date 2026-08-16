import { Fragment, useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

type QuestionRow = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  body: string;
  status: string;
  reply: string | null;
  respondedAt: string | null;
  createdAt: string;
};

interface Props {
  questions: QuestionRow[];
}

const STATUS_OPTIONS = ["NEW", "IN_REVIEW", "RESPONDED", "CLOSED"] as const;

const STATUS_BADGE: Record<string, string> = {
  NEW: "bg-amber/20 text-amber-dark",
  IN_REVIEW: "bg-blue-100 text-blue-700",
  RESPONDED: "bg-green-100 text-green-700",
  CLOSED: "bg-slate-100 text-slate-500",
};

const STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  IN_REVIEW: "In Review",
  RESPONDED: "Responded",
  CLOSED: "Closed",
};

const AdminQuestionsPage: NextPageWithLayout<Props> = ({ questions: initial }) => {
  const [questions, setQuestions] = useState(initial);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);

  async function updateStatus(id: string, status: string) {
    setSaving(id);
    try {
      const res = await fetch(`/api/admin/questions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated = await res.json();
        setQuestions((prev) =>
          prev.map((q) =>
            q.id === id ? { ...q, status: updated.status, respondedAt: updated.respondedAt } : q
          )
        );
      }
    } finally {
      setSaving(null);
    }
  }

  async function sendReply(q: QuestionRow) {
    const reply = replyText[q.id]?.trim();
    if (!reply) return;
    setSendingReply(q.id);
    try {
      const res = await fetch(`/api/admin/questions/${q.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply }),
      });
      if (res.ok) {
        const updated = await res.json();
        setQuestions((prev) =>
          prev.map((row) =>
            row.id === q.id
              ? { ...row, status: updated.status, reply: updated.reply, respondedAt: updated.respondedAt }
              : row
          )
        );
        setReplySuccess(q.id);
        setTimeout(() => setReplySuccess(null), 3000);
      }
    } finally {
      setSendingReply(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Ask The Fixer</h1>
        <p className="mt-1 text-sm text-slate-500">
          {questions.length} submission{questions.length !== 1 ? "s" : ""}.
        </p>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-slate-500">No submissions yet.</p>
          <p className="mt-1 text-sm text-slate-400">Member questions submitted via Ask The Fixer will appear here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Submitted</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {questions.map((q) => (
                <Fragment key={q.id}>
                  <tr className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{q.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{q.email}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {q.subject ? (
                        q.subject.length > 50 ? q.subject.slice(0, 50) + "…" : q.subject
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[q.status] ?? "bg-slate-100 text-slate-500"}`}>
                        {STATUS_LABEL[q.status] ?? q.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(q.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                          className="text-xs font-medium text-navy hover:text-navy-dark"
                        >
                          {expanded === q.id ? "Hide" : "View"}
                        </button>
                        <select
                          value={q.status}
                          disabled={saving === q.id}
                          onChange={(e) => updateStatus(q.id, e.target.value)}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:border-navy focus:outline-none disabled:opacity-50"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>

                  {expanded === q.id && (
                    <tr className="bg-slate-50">
                      <td colSpan={6} className="px-6 py-5">
                        {/* Original question */}
                        <div className="mb-5">
                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Question</p>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{q.body}</p>
                        </div>

                        {/* Previous reply (if any) */}
                        {q.reply && (
                          <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4">
                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-green-600">Reply sent</p>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{q.reply}</p>
                            {q.respondedAt && (
                              <p className="mt-2 text-xs text-slate-400">
                                Sent {new Date(q.respondedAt).toLocaleString()}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Reply form */}
                        <div>
                          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            {q.reply ? "Send a follow-up" : "Reply"} — email will go to {q.email}
                          </p>
                          <textarea
                            rows={5}
                            value={replyText[q.id] ?? ""}
                            onChange={(e) => setReplyText((prev) => ({ ...prev, [q.id]: e.target.value }))}
                            placeholder="Type your reply here..."
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                          />
                          <div className="mt-2 flex items-center gap-3">
                            <button
                              onClick={() => sendReply(q)}
                              disabled={sendingReply === q.id || !replyText[q.id]?.trim()}
                              className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-dark disabled:opacity-40"
                            >
                              {sendingReply === q.id ? "Sending…" : "Send Reply"}
                            </button>
                            {replySuccess === q.id && (
                              <span className="text-sm font-medium text-green-600">Reply sent.</span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
};

AdminQuestionsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  const questions = await db.fixerQuestion.findMany({
    orderBy: { createdAt: "desc" },
  });

  return { props: { questions: JSON.parse(JSON.stringify(questions)) } };
};

export default AdminQuestionsPage;
