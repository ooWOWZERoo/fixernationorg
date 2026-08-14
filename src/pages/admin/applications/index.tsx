import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface AppRow {
  id: string;
  type: "PROVIDER" | "AMBASSADOR";
  status: "PENDING" | "APPROVED" | "REJECTED";
  name: string;
  email: string;
  businessName: string | null;
  message: string;
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  userId: string | null;
  createdAt: string;
}

interface Props {
  applications: AppRow[];
}

type Filter = "ALL" | "PENDING" | "PROVIDER" | "AMBASSADOR";

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber/20 text-amber-dark",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-600",
};

const AdminApplicationsPage: NextPageWithLayout<Props> = ({ applications: initial }) => {
  const [applications, setApplications] = useState<AppRow[]>(initial);
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);

  const pendingCount = applications.filter((a) => a.status === "PENDING").length;

  const visible = applications.filter((a) => {
    if (filter === "ALL") return true;
    if (filter === "PENDING") return a.status === "PENDING";
    if (filter === "PROVIDER") return a.type === "PROVIDER";
    if (filter === "AMBASSADOR") return a.type === "AMBASSADOR";
    return true;
  });

  const act = async (id: string, status: "APPROVED" | "REJECTED") => {
    setActing(id);
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNotes: reviewNotes[id] ?? "" }),
      });
      if (res.ok) {
        const updated = await res.json();
        setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
        setExpanded(null);
      }
    } finally {
      setActing(null);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Applications
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber text-xs font-bold text-navy-dark">
                {pendingCount}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Provider and ambassador applications.</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-5 flex gap-2">
        {(["PENDING", "ALL", "PROVIDER", "AMBASSADOR"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
              filter === f ? "bg-navy text-white" : "bg-white border border-slate-200 text-slate-600 hover:text-navy",
            ].join(" ")}
          >
            {f === "ALL" ? "All" : f === "PENDING" ? "Pending" : f === "PROVIDER" ? "Providers" : "Ambassadors"}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-slate-500">No applications here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((app) => {
            const isOpen = expanded === app.id;
            const date = new Date(app.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

            return (
              <div key={app.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {/* Row */}
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : app.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 truncate">{app.name}</p>
                      <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${app.type === "PROVIDER" ? "bg-navy/10 text-navy" : "bg-purple-100 text-purple-700"}`}>
                        {app.type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 truncate">{app.email}{app.businessName ? ` · ${app.businessName}` : ""}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[app.status]}`}>
                      {app.status}
                    </span>
                    <span className="text-xs text-slate-400">{date}</span>
                    <span className="text-slate-400">{isOpen ? "▲" : "▼"}</span>
                  </div>
                </button>

                {/* Expanded */}
                {isOpen && (
                  <div className="border-t border-slate-100 px-5 py-5 space-y-4">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Application message</p>
                      <p className="whitespace-pre-wrap text-sm text-slate-700">{app.message}</p>
                    </div>

                    {app.userId && (
                      <p className="text-xs text-slate-400">Has a Fixer Nation account (userId: {app.userId})</p>
                    )}

                    {app.status === "PENDING" && (
                      <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-500">
                            Review notes <span className="font-normal">(optional — sent to record only, not the applicant)</span>
                          </label>
                          <textarea
                            value={reviewNotes[app.id] ?? ""}
                            onChange={(e) => setReviewNotes((p) => ({ ...p, [app.id]: e.target.value }))}
                            rows={2}
                            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                          />
                        </div>
                        <div className="flex gap-3">
                          <button
                            onClick={() => act(app.id, "APPROVED")}
                            disabled={acting === app.id}
                            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            {acting === app.id ? "…" : "Approve"}
                          </button>
                          <button
                            onClick={() => act(app.id, "REJECTED")}
                            disabled={acting === app.id}
                            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                          >
                            {acting === app.id ? "…" : "Reject"}
                          </button>
                        </div>
                        <p className="text-xs text-slate-400">
                          Approving will update the account role to{" "}
                          <strong>{app.type}</strong>
                          {app.userId ? " immediately." : " when the user creates an account with this email."}
                        </p>
                      </div>
                    )}

                    {app.status !== "PENDING" && (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
                        Reviewed by {app.reviewedBy ?? "admin"} on{" "}
                        {app.reviewedAt ? new Date(app.reviewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}.
                        {app.reviewNotes && <p className="mt-1 italic">{app.reviewNotes}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

AdminApplicationsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }

  const applications = await db.userApplication.findMany({
    orderBy: { createdAt: "desc" },
  });

  return { props: { applications: JSON.parse(JSON.stringify(applications)) } };
};

export default AdminApplicationsPage;
