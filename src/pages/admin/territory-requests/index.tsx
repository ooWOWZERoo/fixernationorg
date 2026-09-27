import { useState } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import {
  findCountyTerritory,
  withTerritoryRequests,
  TERRITORY_REQUEST_TYPE_LABEL,
  type TerritoryRequestRow,
  type TerritoryRequestStatus,
  type TerritoryRequestType,
} from "@/lib/territory-requests";
import type { NextPageWithLayout } from "@/types/next";

type CurrentAssignment = {
  id: string;
  territoryName: string;
  state: string | null;
  county: string | null;
  isExclusive: boolean;
  isTheOneBeingChanged: boolean;
};

type RequestCard = {
  id: string;
  requestType: TerritoryRequestType;
  requestedState: string;
  requestedCounty: string;
  status: TerritoryRequestStatus;
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  requesterName: string | null;
  requesterEmail: string;
  requesterRole: string;
  currentAssignments: CurrentAssignment[];
  // Null when no Territory exists for the requested county yet — approval
  // will create one, so there's nothing to flag.
  matchedTerritoryStatus: string | null;
  matchedTerritoryExclusive: boolean;
};

interface Props {
  requests: RequestCard[];
  pendingCount: number;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber/20 text-amber-dark",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
};

const STATUS_FILTERS = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;

const FILTER_LABEL: Record<string, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  ALL: "All",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const TerritoryRequestsPage: NextPageWithLayout<Props> = ({ requests, pendingCount }) => {
  const router = useRouter();
  const queryStatus = router.query.status as string | undefined;
  const activeFilter = STATUS_FILTERS.includes(queryStatus as (typeof STATUS_FILTERS)[number])
    ? queryStatus
    : "PENDING";

  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function review(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setError(null);
    setDone(null);
    try {
      const res = await fetch(`/api/admin/territory-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNotes: notes[id]?.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setDone(
        action === "approve"
          ? "Approved. The territory is assigned and the requester has been emailed."
          : "Rejected. The requester has been emailed and their existing territory is untouched."
      );
      setNotes((n) => ({ ...n, [id]: "" }));
      await router.replace(router.asPath, undefined, { scroll: false });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Territory requests</h1>
        <p className="mt-1 text-sm text-slate-500">
          {pendingCount === 0
            ? "Nothing waiting on you right now."
            : `${pendingCount} request${pendingCount === 1 ? "" : "s"} waiting on a decision.`}
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => router.push(s === "PENDING" ? "/admin/territory-requests" : `/admin/territory-requests?status=${s}`)}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              activeFilter === s
                ? "bg-navy text-white"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {FILTER_LABEL[s]}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {done && <div className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">{done}</div>}

      {requests.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <p className="text-sm font-semibold text-slate-500">No territory requests here.</p>
          <p className="mt-1 text-xs text-slate-400">
            Ambassadors, providers and affiliates submit these from their account page.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => {
            const reserved = r.matchedTerritoryStatus === "RESERVED";
            const locked = r.matchedTerritoryStatus === "LOCKED";
            return (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-slate-900">
                      {r.requesterName ?? r.requesterEmail}
                    </p>
                    <p className="text-xs text-slate-400">
                      {r.requesterEmail} &middot; {r.requesterRole} &middot; asked {formatDate(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      {TERRITORY_REQUEST_TYPE_LABEL[r.requestType]}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        STATUS_BADGE[r.status] ?? "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Asking for</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {r.requestedCounty}, {r.requestedState}
                    </p>
                    {r.matchedTerritoryStatus === null ? (
                      <p className="mt-1 text-xs text-slate-400">
                        No territory exists for this county yet, so approving creates one.
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-slate-400">
                        Matches an existing territory ({r.matchedTerritoryStatus.toLowerCase()}
                        {r.matchedTerritoryExclusive ? ", exclusive" : ""}).
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Holds today
                    </p>
                    {r.currentAssignments.length === 0 ? (
                      <p className="mt-1 text-sm text-slate-400">Nothing assigned yet.</p>
                    ) : (
                      <ul className="mt-1 space-y-1">
                        {r.currentAssignments.map((a) => (
                          <li key={a.id} className="text-sm text-slate-700">
                            {a.territoryName}
                            {a.isExclusive && (
                              <span className="ml-1.5 text-xs font-semibold text-orange-600">Exclusive</span>
                            )}
                            {a.isTheOneBeingChanged && (
                              <span className="ml-1.5 text-xs font-semibold text-navy">
                                (being replaced by this request)
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {reserved && (
                  <div className="mt-5 rounded-lg border border-amber-dark/30 bg-amber/10 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-dark">Reserved — requires override</p>
                    <p className="mt-0.5 text-xs text-amber-dark/80">
                      Someone set this territory aside on purpose. Approving assigns it anyway, so check why
                      it was reserved before you do.
                    </p>
                  </div>
                )}

                {locked && (
                  <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm font-semibold text-red-700">Locked — approval will fail</p>
                    <p className="mt-0.5 text-xs text-red-600">
                      Locked territories can't take an assignment. Unlock it on the Territories page first, or
                      reject this request.
                    </p>
                  </div>
                )}

                {r.status === "PENDING" ? (
                  <div className="mt-5 border-t border-slate-100 pt-5">
                    <label
                      htmlFor={`notes-${r.id}`}
                      className="block text-xs font-semibold text-slate-600 mb-1"
                    >
                      Note to the requester (included in the decision email)
                    </label>
                    <textarea
                      id={`notes-${r.id}`}
                      rows={2}
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                      placeholder="Optional for an approval, worth writing for a rejection."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                    />
                    <div className="mt-3 flex gap-3">
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => review(r.id, "approve")}
                        className="rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-40"
                      >
                        {busyId === r.id ? "Working…" : "Approve"}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => review(r.id, "reject")}
                        className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400">
                    {r.status === "APPROVED" ? "Approved" : "Rejected"} by {r.reviewedBy ?? "—"} on{" "}
                    {formatDate(r.reviewedAt)}
                    {r.adminNotes && <span className="block mt-1 text-slate-500">“{r.adminNotes}”</span>}
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

TerritoryRequestsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

type RequestWithUser = TerritoryRequestRow & {
  user: { id: string; name: string | null; email: string; role: string };
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${encodeURIComponent(ctx.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  // Whitelisted, not passed straight through: an unrecognised ?status= would
  // otherwise reach Prisma as an invalid enum value and 500 the page.
  const requested = ctx.query.status as string | undefined;
  const statusFilter = STATUS_FILTERS.includes(requested as (typeof STATUS_FILTERS)[number])
    ? (requested as string)
    : "PENDING";
  const db_ = withTerritoryRequests(db);

  const [rows, pendingCount] = await Promise.all([
    db_.territoryRequest.findMany({
      where: statusFilter === "ALL" ? {} : { status: statusFilter },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }) as Promise<RequestWithUser[]>,
    db_.territoryRequest.count({ where: { status: "PENDING" } }),
  ]);

  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const assignments =
    userIds.length === 0
      ? []
      : await db.territoryAssignment.findMany({
          where: { userId: { in: userIds }, status: "ACTIVE" },
          include: { territory: { select: { name: true, state: true, county: true, isExclusive: true } } },
          orderBy: { createdAt: "desc" },
        });

  // One lookup per distinct requested county rather than per row, so a
  // backlog of requests for the same county doesn't multiply the queries.
  const matched = new Map<string, { status: string; isExclusive: boolean } | null>();
  for (const key of new Set(rows.map((r) => `${r.requestedState}|${r.requestedCounty}`))) {
    const [state, county] = key.split("|");
    const territory = await findCountyTerritory(db, state, county);
    matched.set(key, territory ? { status: territory.status, isExclusive: territory.isExclusive } : null);
  }

  const requests: RequestCard[] = rows.map((r) => {
    const match = matched.get(`${r.requestedState}|${r.requestedCounty}`) ?? null;
    return {
      id: r.id,
      requestType: r.requestType,
      requestedState: r.requestedState,
      requestedCounty: r.requestedCounty,
      status: r.status,
      adminNotes: r.adminNotes,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      requesterName: r.user.name,
      requesterEmail: r.user.email,
      requesterRole: r.user.role,
      currentAssignments: assignments
        .filter((a) => a.userId === r.userId)
        .map((a) => ({
          id: a.id,
          territoryName: a.territory.name,
          state: a.territory.state,
          county: a.territory.county,
          isExclusive: a.territory.isExclusive,
          isTheOneBeingChanged: a.id === r.existingAssignmentId,
        })),
      matchedTerritoryStatus: match?.status ?? null,
      matchedTerritoryExclusive: match?.isExclusive ?? false,
    };
  });

  return { props: { requests, pendingCount } };
};

export default TerritoryRequestsPage;
