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
  status: string;
  name: string | null;
  email: string;
  phone: string | null;
  businessName: string | null;
  message: string | null;
  reviewNotes: string | null;
  infoRequestNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  submittedAt: string | null;
  emailVerifiedAt: string | null;
  userId: string | null;
  createdAt: string;
  providerDetail: {
    serviceCategory: string | null;
    serviceAreas: string[];
    businessType: string | null;
    whyJoining: string | null;
  } | null;
  ambassadorDetail: {
    city: string | null;
    state: string | null;
    platformsUsed: string[];
    communityDescription: string | null;
    whyJoining: string | null;
  } | null;
}

interface Props {
  applications: AppRow[];
}

const QUEUE_STATUSES = new Set(["PENDING", "SUBMITTED", "RESUBMITTED"]);
const ACTIVE_STATUSES = new Set(["UNDER_REVIEW", "ADDITIONAL_INFO_REQUIRED", "CONDITIONALLY_ACCEPTED"]);
const FINAL_STATUSES = new Set(["ACCEPTED_ONBOARDING_REQUIRED", "APPROVED", "ONBOARDING_IN_PROGRESS", "TERRITORY_PENDING", "PAYMENT_PENDING", "PAYMENT_FAILED", "ACTIVE"]);
const CLOSED_STATUSES = new Set(["DECLINED", "REJECTED", "WITHDRAWN", "EXPIRED"]);

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber/20 text-amber-dark",
  SUBMITTED: "bg-amber/20 text-amber-dark",
  RESUBMITTED: "bg-orange-100 text-orange-700",
  UNDER_REVIEW: "bg-blue-100 text-blue-700",
  ADDITIONAL_INFO_REQUIRED: "bg-purple-100 text-purple-700",
  CONDITIONALLY_ACCEPTED: "bg-teal-100 text-teal-700",
  ACCEPTED_ONBOARDING_REQUIRED: "bg-green-100 text-green-700",
  APPROVED: "bg-green-100 text-green-700",
  ONBOARDING_IN_PROGRESS: "bg-teal-100 text-teal-700",
  TERRITORY_PENDING: "bg-sky-100 text-sky-700",
  PAYMENT_PENDING: "bg-sky-100 text-sky-700",
  PAYMENT_FAILED: "bg-red-100 text-red-600",
  ACTIVE: "bg-green-100 text-green-800",
  DECLINED: "bg-slate-100 text-slate-500",
  REJECTED: "bg-slate-100 text-slate-500",
  WITHDRAWN: "bg-slate-100 text-slate-500",
  EXPIRED: "bg-slate-100 text-slate-400",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  SUBMITTED: "Submitted",
  RESUBMITTED: "Resubmitted",
  UNDER_REVIEW: "Under review",
  ADDITIONAL_INFO_REQUIRED: "Info requested",
  CONDITIONALLY_ACCEPTED: "Conditional",
  ACCEPTED_ONBOARDING_REQUIRED: "Accepted",
  APPROVED: "Approved",
  ONBOARDING_IN_PROGRESS: "Onboarding",
  TERRITORY_PENDING: "Territory pending",
  PAYMENT_PENDING: "Payment pending",
  PAYMENT_FAILED: "Payment failed",
  ACTIVE: "Active",
  DECLINED: "Declined",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  EXPIRED: "Expired",
};

const REVIEW_ACTIONS: { label: string; status: string; style: string }[] = [
  { label: "Mark under review", status: "UNDER_REVIEW", style: "text-blue-600 border-blue-200 hover:bg-blue-50" },
  { label: "Request more info", status: "ADDITIONAL_INFO_REQUIRED", style: "text-purple-600 border-purple-200 hover:bg-purple-50" },
  { label: "Conditionally accept", status: "CONDITIONALLY_ACCEPTED", style: "text-teal-600 border-teal-200 hover:bg-teal-50" },
  { label: "Accept", status: "ACCEPTED_ONBOARDING_REQUIRED", style: "text-green-700 border-green-200 hover:bg-green-50" },
  { label: "Decline", status: "DECLINED", style: "text-red-600 border-red-200 hover:bg-red-50" },
];

type FilterTab = "QUEUE" | "ACTIVE" | "ACCEPTED" | "CLOSED" | "ALL";

const AdminApplicationsPage: NextPageWithLayout<Props> = ({ applications: initial }) => {
  const [applications, setApplications] = useState<AppRow[]>(initial);
  const [filter, setFilter] = useState<FilterTab>("QUEUE");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "PROVIDER" | "AMBASSADOR">("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);

  const queueCount = applications.filter((a) => QUEUE_STATUSES.has(a.status)).length;

  const visible = applications.filter((a) => {
    const matchesType = typeFilter === "ALL" || a.type === typeFilter;
    const matchesStatus =
      filter === "ALL" ? true
      : filter === "QUEUE" ? QUEUE_STATUSES.has(a.status)
      : filter === "ACTIVE" ? ACTIVE_STATUSES.has(a.status)
      : filter === "ACCEPTED" ? FINAL_STATUSES.has(a.status)
      : CLOSED_STATUSES.has(a.status);
    return matchesType && matchesStatus;
  });

  const act = async (id: string, status: string, notes?: string) => {
    setActing(id);
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNotes: notes ?? reviewNotes[id] ?? "" }),
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

  const TABS: { key: FilterTab; label: string; count?: number }[] = [
    { key: "QUEUE", label: "Needs review", count: queueCount },
    { key: "ACTIVE", label: "In progress" },
    { key: "ACCEPTED", label: "Accepted" },
    { key: "CLOSED", label: "Closed" },
    { key: "ALL", label: "All" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Applications
          {queueCount > 0 && (
            <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber text-xs font-bold text-navy-dark">
              {queueCount}
            </span>
          )}
        </h1>
        <p className="mt-1 text-sm text-slate-500">Provider and ambassador applications.</p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={[
              "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
              filter === tab.key
                ? "bg-navy text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:text-navy",
            ].join(" ")}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber text-[10px] font-bold text-navy-dark">
                {tab.count}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {(["ALL", "PROVIDER", "AMBASSADOR"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                typeFilter === t
                  ? t === "PROVIDER" ? "bg-navy/10 text-navy" : t === "AMBASSADOR" ? "bg-purple-100 text-purple-700" : "bg-slate-200 text-slate-700"
                  : "bg-white border border-slate-200 text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              {t === "ALL" ? "All types" : t === "PROVIDER" ? "Providers" : "Ambassadors"}
            </button>
          ))}
        </div>
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
            const displayName = app.name ?? app.email;
            const isReviewable = QUEUE_STATUSES.has(app.status) || ACTIVE_STATUSES.has(app.status);

            return (
              <div key={app.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : app.id)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900 truncate">{displayName}</p>
                      <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${app.type === "PROVIDER" ? "bg-navy/10 text-navy" : "bg-purple-100 text-purple-700"}`}>
                        {app.type}
                      </span>
                      {app.emailVerifiedAt && (
                        <span title="Email verified" className="shrink-0 text-green-500">
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 truncate">
                      {app.email}
                      {app.businessName ? ` · ${app.businessName}` : ""}
                      {app.providerDetail?.serviceCategory ? ` · ${app.providerDetail.serviceCategory}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[app.status] ?? "bg-slate-100 text-slate-500"}`}>
                      {STATUS_LABEL[app.status] ?? app.status}
                    </span>
                    <span className="text-xs text-slate-400">{date}</span>
                    <span className="text-slate-400">{isOpen ? "▲" : "▼"}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-slate-100 px-5 py-5 space-y-5">
                    {/* Basic info */}
                    <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                      <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</p><p className="mt-0.5 text-slate-700 break-all">{app.email}</p></div>
                      {app.phone && <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phone</p><p className="mt-0.5 text-slate-700">{app.phone}</p></div>}
                      {app.submittedAt && <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Submitted</p><p className="mt-0.5 text-slate-700">{new Date(app.submittedAt).toLocaleDateString()}</p></div>}
                      <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email verified</p><p className="mt-0.5 text-slate-700">{app.emailVerifiedAt ? new Date(app.emailVerifiedAt).toLocaleDateString() : "No"}</p></div>
                    </div>

                    {/* Provider detail */}
                    {app.providerDetail && (
                      <div className="space-y-3">
                        {app.providerDetail.serviceCategory && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Category</p>
                            <p className="mt-0.5 text-sm text-slate-700">{app.providerDetail.serviceCategory}</p>
                          </div>
                        )}
                        {app.providerDetail.serviceAreas.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Service areas</p>
                            <p className="mt-0.5 text-sm text-slate-700">{app.providerDetail.serviceAreas.join(", ")}</p>
                          </div>
                        )}
                        {app.providerDetail.whyJoining && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Why joining</p>
                            <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{app.providerDetail.whyJoining}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ambassador detail */}
                    {app.ambassadorDetail && (
                      <div className="space-y-3">
                        {(app.ambassadorDetail.city || app.ambassadorDetail.state) && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Location</p>
                            <p className="mt-0.5 text-sm text-slate-700">{[app.ambassadorDetail.city, app.ambassadorDetail.state].filter(Boolean).join(", ")}</p>
                          </div>
                        )}
                        {app.ambassadorDetail.platformsUsed.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Platforms</p>
                            <p className="mt-0.5 text-sm text-slate-700">{app.ambassadorDetail.platformsUsed.join(", ")}</p>
                          </div>
                        )}
                        {app.ambassadorDetail.whyJoining && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Why ambassador</p>
                            <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{app.ambassadorDetail.whyJoining}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Legacy message field */}
                    {!app.providerDetail && !app.ambassadorDetail && app.message && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Message</p>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{app.message}</p>
                      </div>
                    )}

                    {/* Previous review info */}
                    {app.reviewedBy && (
                      <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
                        Last action by {app.reviewedBy} on{" "}
                        {app.reviewedAt ? new Date(app.reviewedAt).toLocaleDateString() : "—"}
                        {app.reviewNotes && <p className="mt-1 italic">{app.reviewNotes}</p>}
                        {app.infoRequestNotes && (
                          <p className="mt-1"><strong>Info requested:</strong> {app.infoRequestNotes}</p>
                        )}
                      </div>
                    )}

                    {/* Review actions */}
                    {isReviewable && (
                      <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-500">
                            Review notes <span className="font-normal">(internal only)</span>
                          </label>
                          <textarea
                            value={reviewNotes[app.id] ?? ""}
                            onChange={(e) => setReviewNotes((p) => ({ ...p, [app.id]: e.target.value }))}
                            rows={2}
                            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {REVIEW_ACTIONS.map((action) => (
                            <button
                              key={action.status}
                              onClick={() => act(app.id, action.status)}
                              disabled={acting === app.id || app.status === action.status}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${action.style}`}
                            >
                              {acting === app.id ? "…" : action.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-slate-400">
                          Accepting will upgrade their account to{" "}
                          <strong>{app.type}</strong>
                          {app.userId ? "." : " once they create an account."}
                        </p>
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
    include: {
      providerDetail: {
        select: {
          serviceCategory: true,
          serviceAreas: true,
          businessType: true,
          whyJoining: true,
        },
      },
      ambassadorDetail: {
        select: {
          city: true,
          state: true,
          platformsUsed: true,
          communityDescription: true,
          whyJoining: true,
        },
      },
    },
  });

  return { props: { applications: JSON.parse(JSON.stringify(applications)) } };
};

export default AdminApplicationsPage;
