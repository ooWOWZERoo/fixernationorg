import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

type MembershipDb = {
  userMembership: {
    findMany: (a: Record<string, unknown>) => Promise<unknown[]>;
  };
};

type MembershipRow = {
  id: string;
  userId: string;
  priceId: string;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
  price: {
    id: string;
    amount: number;
    interval: string;
    product: { id: string; name: string };
  };
  ltv: number;
};

interface Props {
  memberships: MembershipRow[];
  counts: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  TRIALING: "bg-amber-100 text-amber-700",
  PAST_DUE: "bg-red-100 text-red-600",
  CANCELED: "bg-slate-100 text-slate-500",
  INCOMPLETE: "bg-orange-100 text-orange-600",
};

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "TRIALING", label: "Trialing" },
  { value: "PAST_DUE", label: "Past due" },
  { value: "CANCELED", label: "Canceled" },
  { value: "INCOMPLETE", label: "Incomplete" },
];

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const AdminMembershipsPage: NextPageWithLayout<Props> = ({ memberships, counts }) => {
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = statusFilter
    ? memberships.filter((m) => m.status === statusFilter)
    : memberships;

  const total = memberships.length;

  const mrr = memberships
    .filter((m) => m.status === "ACTIVE" || m.status === "TRIALING")
    .reduce((sum, m) => {
      const monthly = m.price.interval === "YEARLY" ? m.price.amount / 12 : m.price.amount;
      return sum + monthly;
    }, 0);

  const totalLtv = filtered.reduce((sum, m) => sum + m.ltv, 0);
  const avgLtv = filtered.length > 0 ? Math.round(totalLtv / filtered.length) : 0;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Memberships</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: total, color: "text-gray-900" },
          { label: "Active", value: counts.ACTIVE ?? 0, color: "text-green-700" },
          { label: "Trialing", value: counts.TRIALING ?? 0, color: "text-amber-700" },
          { label: "Past due", value: counts.PAST_DUE ?? 0, color: "text-red-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`text-2xl font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-4 flex-wrap mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Estimated MRR</p>
          <p className="text-2xl font-semibold text-gray-900">{fmt(Math.round(mrr))}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Total LTV {statusFilter ? `(${statusFilter.toLowerCase()})` : "(all)"}</p>
          <p className="text-2xl font-semibold text-gray-900">{fmt(totalLtv)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">Avg LTV per member</p>
          <p className="text-2xl font-semibold text-gray-900">{fmt(avgLtv)}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === tab.value
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {tab.value ? `${tab.label} (${counts[tab.value] ?? 0})` : `All (${total})`}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 p-6">No memberships found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {["Member", "Plan", "Status", "Price", "LTV", "Period end", "Trial end", "Subscription"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{m.user.name ?? "—"}</p>
                      <p className="text-xs text-gray-400">{m.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <p>{m.price.product.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{m.price.interval.toLowerCase()}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          STATUS_COLORS[m.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {m.status.replace("_", " ")}
                        {m.cancelAtPeriodEnd ? " · cancels" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmt(m.price.amount)}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmt(m.ltv)}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(m.currentPeriodEnd)}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(m.trialEnd)}</td>
                    <td className="px-4 py-3">
                      {m.stripeSubscriptionId ? (
                        <a
                          href={`https://dashboard.stripe.com/subscriptions/${m.stripeSubscriptionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-xs font-mono"
                        >
                          {m.stripeSubscriptionId}
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

AdminMembershipsPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: "/signin", permanent: false } };
  }

  const membershipDb = db as never as MembershipDb;
  const rawRows = await membershipDb.userMembership.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      price: { include: { product: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = rawRows as Array<{
    id: string;
    userId: string;
    priceId: string;
    stripeSubscriptionId: string | null;
    stripeCustomerId: string | null;
    status: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    trialEnd: Date | null;
    createdAt: Date;
    user: { id: string; name: string | null; email: string };
    price: { id: string; amount: number; interval: string; product: { id: string; name: string } };
  }>;

  const nowMs = Date.now();

  const memberships: MembershipRow[] = rows.map((r) => {
    const monthly = r.price.interval === "YEARLY" ? r.price.amount / 12 : r.price.amount;
    const msActive = nowMs - r.createdAt.getTime();
    const monthsActive = Math.max(1, Math.round(msActive / (30 * 24 * 60 * 60 * 1000)));
    const ltv = Math.round(monthly * monthsActive);

    return {
      id: r.id,
      userId: r.userId,
      priceId: r.priceId,
      stripeSubscriptionId: r.stripeSubscriptionId,
      stripeCustomerId: r.stripeCustomerId,
      status: r.status,
      currentPeriodEnd: r.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: r.cancelAtPeriodEnd,
      trialEnd: r.trialEnd?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      user: r.user,
      price: r.price,
      ltv,
    };
  });

  const counts: Record<string, number> = {};
  for (const m of memberships) {
    counts[m.status] = (counts[m.status] ?? 0) + 1;
  }

  return { props: { memberships, counts } };
};

export default AdminMembershipsPage;
