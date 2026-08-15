import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";
import { buildApplicationWhere, PAGE_SIZE, TAB_STATUS_MAP, type ExtraFilters } from "@/lib/application-filter";

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
  total: number;
  page: number;
  pageSize: number;
  queueCount: number;
  tab: string;
  type: string;
  q: string;
  submittedFrom: string;
  submittedTo: string;
  referralCode: string;
  campaignSource: string;
  territory: string;
  affiliateStatus: string;
}

// Client-side status sets used only for isReviewable check and post-action updates
const QUEUE_STATUSES = new Set(["PENDING", "SUBMITTED", "RESUBMITTED"]);
const ACTIVE_STATUSES = new Set(["UNDER_REVIEW", "ADDITIONAL_INFO_REQUIRED", "CONDITIONALLY_ACCEPTED"]);

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-500",
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
  DRAFT: "Draft",
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

const TABS: { key: FilterTab; label: string }[] = [
  { key: "QUEUE", label: "Needs review" },
  { key: "ACTIVE", label: "In progress" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "CLOSED", label: "Closed" },
  { key: "ALL", label: "All" },
];

const AdminApplicationsPage: NextPageWithLayout<Props> = ({
  applications: initial,
  total: initialTotal,
  page,
  pageSize,
  queueCount: initialQueueCount,
  tab,
  type,
  q,
  submittedFrom,
  submittedTo,
  referralCode,
  campaignSource,
  territory,
  affiliateStatus,
}) => {
  const router = useRouter();

  const [localApps, setLocalApps] = useState(initial);
  const [localTotal, setLocalTotal] = useState(initialTotal);
  const [localQueueCount, setLocalQueueCount] = useState(initialQueueCount);
  const [searchInput, setSearchInput] = useState(q);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);

  // Advanced filter local inputs (debounced text fields)
  const [territoryInput, setTerritoryInput] = useState(territory);
  const [referralInput, setReferralInput] = useState(referralCode);
  const [campaignInput, setCampaignInput] = useState(campaignSource);
  const advancedActive = [submittedFrom, submittedTo, referralCode, campaignSource, territory, affiliateStatus !== "ALL" ? affiliateStatus : ""].filter(Boolean).length;
  const [showAdvanced, setShowAdvanced] = useState(() => advancedActive > 0);

  // Sync local state when the server returns new data (e.g. after filter navigation)
  useEffect(() => {
    setLocalApps(initial);
    setLocalTotal(initialTotal);
    setLocalQueueCount(initialQueueCount);
    setExpanded(null);
  }, [initial, initialTotal, initialQueueCount]);

  useEffect(() => { setSearchInput(q); }, [q]);
  useEffect(() => { setTerritoryInput(territory); }, [territory]);
  useEffect(() => { setReferralInput(referralCode); }, [referralCode]);
  useEffect(() => { setCampaignInput(campaignSource); }, [campaignSource]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildQuery = (updates: Record<string, string | number | undefined> = {}) => {
    const base: Record<string, string | number> = { tab, type, page: 1 };
    if (q) base.q = q;
    if (submittedFrom) base.submittedFrom = submittedFrom;
    if (submittedTo) base.submittedTo = submittedTo;
    if (referralCode) base.referralCode = referralCode;
    if (campaignSource) base.campaignSource = campaignSource;
    if (territory) base.territory = territory;
    if (affiliateStatus && affiliateStatus !== "ALL") base.affiliateStatus = affiliateStatus;
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === "" || v === "ALL") delete base[k];
      else base[k] = v;
    }
    return base;
  };

  const pushFilter = (updates: Record<string, string | number | undefined>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    router.push({ pathname: router.pathname, query: buildQuery(updates) });
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushFilter({ q: value, page: 1 });
    }, 400);
  };

  const handleAdvancedText = (field: string, value: string, setter: (v: string) => void) => {
    setter(value);
    if (advDebounceRef.current) clearTimeout(advDebounceRef.current);
    advDebounceRef.current = setTimeout(() => {
      pushFilter({ [field]: value || undefined, page: 1 });
    }, 400);
  };

  const clearAdvanced = () => pushFilter({
    submittedFrom: undefined, submittedTo: undefined,
    referralCode: undefined, campaignSource: undefined,
    territory: undefined, affiliateStatus: undefined,
  });

  const totalPages = Math.ceil(localTotal / pageSize);
  const startItem = localTotal === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, localTotal);

  const exportParams = new URLSearchParams({ tab, type, q });
  if (submittedFrom) exportParams.set("submittedFrom", submittedFrom);
  if (submittedTo) exportParams.set("submittedTo", submittedTo);
  if (referralCode) exportParams.set("referralCode", referralCode);
  if (campaignSource) exportParams.set("campaignSource", campaignSource);
  if (territory) exportParams.set("territory", territory);
  if (affiliateStatus && affiliateStatus !== "ALL") exportParams.set("affiliateStatus", affiliateStatus);
  const exportUrl = `/api/admin/applications/export?${exportParams.toString()}`;

  const act = async (id: string, newStatus: string) => {
    setActing(id);
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, reviewNotes: reviewNotes[id] ?? "" }),
      });
      if (!res.ok) return;

      const updated = await res.json();
      const oldApp = localApps.find((a) => a.id === id);
      const wasInQueue = oldApp ? QUEUE_STATUSES.has(oldApp.status) : false;
      const tabStatuses = TAB_STATUS_MAP[tab];
      const stillInTab = !tabStatuses || tabStatuses.includes(updated.status);

      if (stillInTab) {
        setLocalApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
      } else {
        setLocalApps((prev) => prev.filter((a) => a.id !== id));
        setLocalTotal((t) => Math.max(0, t - 1));
      }
      if (wasInQueue && !QUEUE_STATUSES.has(updated.status)) {
        setLocalQueueCount((c) => Math.max(0, c - 1));
      }
      setExpanded(null);
    } finally {
      setActing(null);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Applications
            {localQueueCount > 0 && (
              <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber text-xs font-bold text-navy-dark">
                {localQueueCount}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-slate-500">Provider and ambassador applications.</p>
        </div>
        <a
          href={exportUrl}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800 transition-colors"
        >
          Export CSV
        </a>
      </div>

      {/* Search + advanced filter toggle */}
      <div className="mb-2 flex gap-2">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by name, email, phone, business, or category…"
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        />
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className={[
            "shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
            showAdvanced || advancedActive > 0
              ? "border-navy bg-navy text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
          ].join(" ")}
        >
          Filters{advancedActive > 0 ? ` (${advancedActive})` : ""}
        </button>
      </div>

      {/* Advanced filter panel */}
      {showAdvanced && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Submitted from</label>
              <input
                type="date"
                value={submittedFrom}
                onChange={(e) => pushFilter({ submittedFrom: e.target.value || undefined })}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-navy focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Submitted to</label>
              <input
                type="date"
                value={submittedTo}
                onChange={(e) => pushFilter({ submittedTo: e.target.value || undefined })}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-navy focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Territory</label>
              <input
                type="text"
                value={territoryInput}
                onChange={(e) => handleAdvancedText("territory", e.target.value, setTerritoryInput)}
                placeholder="e.g. Columbus"
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-navy focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Affiliate status</label>
              <select
                value={affiliateStatus}
                onChange={(e) => pushFilter({ affiliateStatus: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-navy focus:outline-none"
              >
                <option value="ALL">All</option>
                <option value="PENDING">Pending</option>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On hold</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="REVOKED">Revoked</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Referral code</label>
              <input
                type="text"
                value={referralInput}
                onChange={(e) => handleAdvancedText("referralCode", e.target.value, setReferralInput)}
                placeholder="e.g. JOHN2024"
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-navy focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Campaign source</label>
              <input
                type="text"
                value={campaignInput}
                onChange={(e) => handleAdvancedText("campaignSource", e.target.value, setCampaignInput)}
                placeholder="e.g. facebook"
                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-navy focus:outline-none"
              />
            </div>
          </div>
          {advancedActive > 0 && (
            <button
              onClick={clearAdvanced}
              className="mt-3 text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Tabs + type filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => pushFilter({ tab: t.key, page: 1 })}
            className={[
              "rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors",
              tab === t.key
                ? "bg-navy text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:text-navy",
            ].join(" ")}
          >
            {t.label}
            {t.key === "QUEUE" && localQueueCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber text-[10px] font-bold text-navy-dark">
                {localQueueCount}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          {(["ALL", "PROVIDER", "AMBASSADOR"] as const).map((t) => (
            <button
              key={t}
              onClick={() => pushFilter({ type: t, page: 1 })}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                type === t
                  ? t === "PROVIDER"
                    ? "bg-navy/10 text-navy"
                    : t === "AMBASSADOR"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-slate-200 text-slate-700"
                  : "bg-white border border-slate-200 text-slate-500 hover:text-slate-700",
              ].join(" ")}
            >
              {t === "ALL" ? "All types" : t === "PROVIDER" ? "Providers" : "Ambassadors"}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {localTotal > 0 && (
        <p className="mb-3 text-xs text-slate-400">
          Showing {startItem}–{endItem} of {localTotal} result{localTotal !== 1 ? "s" : ""}
        </p>
      )}

      {/* List */}
      {localApps.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm font-medium text-slate-500">No applications here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {localApps.map((app) => {
            const isOpen = expanded === app.id;
            const date = new Date(app.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
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
                      <span
                        className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                          app.type === "PROVIDER"
                            ? "bg-navy/10 text-navy"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {app.type}
                      </span>
                      {app.emailVerifiedAt && (
                        <span title="Email verified" className="shrink-0 text-green-500">
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 truncate">
                      {app.email}
                      {app.businessName ? ` · ${app.businessName}` : ""}
                      {app.providerDetail?.serviceCategory
                        ? ` · ${app.providerDetail.serviceCategory}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        STATUS_BADGE[app.status] ?? "bg-slate-100 text-slate-500"
                      }`}
                    >
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
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Email
                        </p>
                        <p className="mt-0.5 text-slate-700 break-all">{app.email}</p>
                      </div>
                      {app.phone && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Phone
                          </p>
                          <p className="mt-0.5 text-slate-700">{app.phone}</p>
                        </div>
                      )}
                      {app.submittedAt && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Submitted
                          </p>
                          <p className="mt-0.5 text-slate-700">
                            {new Date(app.submittedAt).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Email verified
                        </p>
                        <p className="mt-0.5 text-slate-700">
                          {app.emailVerifiedAt
                            ? new Date(app.emailVerifiedAt).toLocaleDateString()
                            : "No"}
                        </p>
                      </div>
                    </div>

                    {/* Link to full detail page */}
                    <div className="flex justify-end">
                      <Link
                        href={`/admin/applications/${app.id}`}
                        className="text-xs font-semibold text-navy hover:underline underline-offset-2"
                      >
                        View full application →
                      </Link>
                    </div>

                    {/* Provider detail */}
                    {app.providerDetail && (
                      <div className="space-y-3">
                        {app.providerDetail.serviceCategory && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Category
                            </p>
                            <p className="mt-0.5 text-sm text-slate-700">
                              {app.providerDetail.serviceCategory}
                            </p>
                          </div>
                        )}
                        {app.providerDetail.serviceAreas.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Service areas
                            </p>
                            <p className="mt-0.5 text-sm text-slate-700">
                              {app.providerDetail.serviceAreas.join(", ")}
                            </p>
                          </div>
                        )}
                        {app.providerDetail.whyJoining && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Why joining
                            </p>
                            <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">
                              {app.providerDetail.whyJoining}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ambassador detail */}
                    {app.ambassadorDetail && (
                      <div className="space-y-3">
                        {(app.ambassadorDetail.city || app.ambassadorDetail.state) && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Location
                            </p>
                            <p className="mt-0.5 text-sm text-slate-700">
                              {[app.ambassadorDetail.city, app.ambassadorDetail.state]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          </div>
                        )}
                        {app.ambassadorDetail.platformsUsed.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Platforms
                            </p>
                            <p className="mt-0.5 text-sm text-slate-700">
                              {app.ambassadorDetail.platformsUsed.join(", ")}
                            </p>
                          </div>
                        )}
                        {app.ambassadorDetail.whyJoining && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                              Why ambassador
                            </p>
                            <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">
                              {app.ambassadorDetail.whyJoining}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Legacy message field */}
                    {!app.providerDetail && !app.ambassadorDetail && app.message && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Message
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">
                          {app.message}
                        </p>
                      </div>
                    )}

                    {/* Previous review info */}
                    {app.reviewedBy && (
                      <div className="rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
                        Last action by {app.reviewedBy} on{" "}
                        {app.reviewedAt ? new Date(app.reviewedAt).toLocaleDateString() : "—"}
                        {app.reviewNotes && <p className="mt-1 italic">{app.reviewNotes}</p>}
                        {app.infoRequestNotes && (
                          <p className="mt-1">
                            <strong>Info requested:</strong> {app.infoRequestNotes}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Review actions */}
                    {isReviewable && (
                      <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-slate-500">
                            Review notes{" "}
                            <span className="font-normal">(internal only)</span>
                          </label>
                          <textarea
                            value={reviewNotes[app.id] ?? ""}
                            onChange={(e) =>
                              setReviewNotes((p) => ({ ...p, [app.id]: e.target.value }))
                            }
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
                          Accepting will upgrade their account to <strong>{app.type}</strong>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => pushFilter({ page: page - 1 })}
            disabled={page <= 1}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Previous
          </button>
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => pushFilter({ page: page + 1 })}
            disabled={page >= totalPages}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

AdminApplicationsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

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

  const tab = (context.query.tab as string) ?? "QUEUE";
  const type = (context.query.type as string) ?? "ALL";
  const q = ((context.query.q as string) ?? "").trim();
  const rawPage = parseInt((context.query.page as string) ?? "1", 10);
  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  const extra: ExtraFilters = {
    submittedFrom: (context.query.submittedFrom as string) || undefined,
    submittedTo: (context.query.submittedTo as string) || undefined,
    referralCode: (context.query.referralCode as string) || undefined,
    campaignSource: (context.query.campaignSource as string) || undefined,
    territory: (context.query.territory as string) || undefined,
    affiliateStatus: (context.query.affiliateStatus as string) || undefined,
  };

  const where = buildApplicationWhere(tab, type, q, extra);
  const queueWhere = buildApplicationWhere("QUEUE", "ALL", "");

  const [total, queueCount, applications] = await Promise.all([
    db.userApplication.count({ where }),
    db.userApplication.count({ where: queueWhere }),
    db.userApplication.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
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
    }),
  ]);

  return {
    props: {
      applications: JSON.parse(JSON.stringify(applications)),
      total,
      page,
      pageSize: PAGE_SIZE,
      queueCount,
      tab,
      type,
      q,
      submittedFrom: extra.submittedFrom ?? "",
      submittedTo: extra.submittedTo ?? "",
      referralCode: extra.referralCode ?? "",
      campaignSource: extra.campaignSource ?? "",
      territory: extra.territory ?? "",
      affiliateStatus: extra.affiliateStatus ?? "ALL",
    },
  };
};

export default AdminApplicationsPage;
