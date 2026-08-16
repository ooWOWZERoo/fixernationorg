import { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

const SUPER_ADMIN_ROLES = ["SUPER_ADMIN"];
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

interface LogEntry {
  id: string;
  actorEmail: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: unknown;
  ip: string | null;
  createdAt: string;
}

interface Props {
  entries: LogEntry[];
  total: number;
  category: string;
  range: string;
}

const CATEGORIES: Record<string, string[]> = {
  all: [],
  applications: ["application.approved", "application.rejected"],
  users: ["user.role_changed"],
  security: ["mfa.enabled", "mfa.disabled"],
  content: ["blog.created", "blog.deleted", "resource.created", "resource.deleted", "morning_boost.created", "morning_boost.deleted"],
  groups: ["group.created", "group.deleted", "group_request.approved", "group_request.rejected"],
};

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  "application.approved":      { label: "Application approved",   color: "bg-green-100 text-green-800" },
  "application.rejected":      { label: "Application rejected",   color: "bg-red-100 text-red-800" },
  "user.role_changed":         { label: "Role changed",           color: "bg-navy/10 text-navy" },
  "mfa.enabled":               { label: "MFA enabled",            color: "bg-green-100 text-green-800" },
  "mfa.disabled":              { label: "MFA disabled",           color: "bg-amber-100 text-amber-800" },
  "blog.created":              { label: "Blog post created",      color: "bg-slate-100 text-slate-700" },
  "blog.deleted":              { label: "Blog post deleted",      color: "bg-red-100 text-red-800" },
  "resource.created":          { label: "Resource created",       color: "bg-slate-100 text-slate-700" },
  "resource.deleted":          { label: "Resource deleted",       color: "bg-red-100 text-red-800" },
  "morning_boost.created":     { label: "Morning Boost created",  color: "bg-slate-100 text-slate-700" },
  "morning_boost.deleted":     { label: "Morning Boost deleted",  color: "bg-red-100 text-red-800" },
  "group.created":             { label: "Group created",          color: "bg-slate-100 text-slate-700" },
  "group.deleted":             { label: "Group deleted",          color: "bg-red-100 text-red-800" },
  "group_request.approved":    { label: "Join request approved",  color: "bg-green-100 text-green-800" },
  "group_request.rejected":    { label: "Join request rejected",  color: "bg-red-100 text-red-800" },
};

function actionDisplay(action: string) {
  return ACTION_LABELS[action] ?? { label: action, color: "bg-slate-100 text-slate-700" };
}

function metaSummary(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "";
  const m = metadata as Record<string, unknown>;
  const parts: string[] = [];
  if (m.from && m.to) parts.push(`${m.from} → ${m.to}`);
  if (m.type) parts.push(String(m.type));
  if (m.applicantEmail) parts.push(String(m.applicantEmail));
  if (m.targetEmail) parts.push(String(m.targetEmail));
  if (m.reviewNotes && typeof m.reviewNotes === "string" && m.reviewNotes.length > 0) {
    parts.push(`"${m.reviewNotes.slice(0, 60)}${m.reviewNotes.length > 60 ? "…" : ""}"`);
  }
  return parts.join(" · ");
}

const AdminAuditPage: NextPageWithLayout<Props> = ({ entries, total, category, range }) => {
  const router = useRouter();

  function applyFilter(key: string, value: string) {
    router.push({ pathname: "/admin/audit", query: { ...router.query, [key]: value } });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Audit log</h1>
        <p className="mt-1 text-sm text-slate-500">Admin actions and security events, logged.</p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <label className="mr-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</label>
          <select
            value={category}
            onChange={(e) => applyFilter("category", e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-navy"
          >
            <option value="all">All</option>
            <option value="applications">Applications</option>
            <option value="users">Users</option>
            <option value="security">Security</option>
            <option value="content">Content</option>
            <option value="groups">Groups</option>
          </select>
        </div>
        <div>
          <label className="mr-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Range</label>
          <select
            value={range}
            onChange={(e) => applyFilter("range", e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-navy"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>
        <span className="ml-auto text-xs text-slate-400">{total} {total === 1 ? "entry" : "entries"}</span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {entries.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            No entries match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">When</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => {
                const { label, color } = actionDisplay(entry.action);
                const summary = metaSummary(entry.metadata);
                const ts = new Date(entry.createdAt);
                return (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      <span title={ts.toISOString()}>
                        {ts.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {" "}
                        {ts.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 max-w-[180px] truncate">
                      {entry.actorEmail ?? <span className="text-slate-400 italic">system</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${color}`}>
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell max-w-xs truncate">
                      {summary || (
                        <span className="text-slate-300">
                          {entry.resource}{entry.resourceId ? ` · ${entry.resourceId.slice(0, 8)}` : ""}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
};

AdminAuditPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return { redirect: { destination: "/signin", permanent: false } };
  }

  const category = (context.query.category as string) || "all";
  const range = (context.query.range as string) || "30";

  const actionFilter = CATEGORIES[category] ?? [];

  const since =
    range === "all"
      ? undefined
      : new Date(Date.now() - parseInt(range) * 24 * 60 * 60 * 1000);

  const where = {
    ...(actionFilter.length > 0 ? { action: { in: actionFilter } } : {}),
    ...(since ? { createdAt: { gte: since } } : {}),
  };

  const [entries, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        actorEmail: true,
        action: true,
        resource: true,
        resourceId: true,
        metadata: true,
        ip: true,
        createdAt: true,
      },
    }),
    db.auditLog.count({ where }),
  ]);

  return {
    props: {
      entries: JSON.parse(JSON.stringify(entries)),
      total,
      category,
      range,
    },
  };
};

export default AdminAuditPage;
