import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface OrderRow {
  id: string;
  bookName: string;
  buyerName: string | null;
  buyerEmail: string;
  status: string;
  amountPaid: number | null;
  shippingAddress: string | null;
  createdAt: string;
}

interface Props {
  orders: OrderRow[];
}

// BookOrder is a new model the local Prisma client doesn't know about yet
// (regenerates on the next Vercel build) — cast at the call site per
// project convention.
type BookOrderDb = {
  bookOrder: {
    findMany: (a: unknown) => Promise<Array<{
      id: string;
      status: string;
      amountPaid: number | null;
      shippingAddressLine1: string | null;
      shippingCity: string | null;
      shippingState: string | null;
      shippingPostalCode: string | null;
      createdAt: Date;
      product: { name: string };
      user: { name: string | null; email: string };
    }>>;
  };
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  PAID: "bg-emerald-100 text-emerald-800",
  SHIPPED: "bg-sky-100 text-sky-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  CANCELED: "bg-red-100 text-red-800",
};

const AdminBookOrdersPage: NextPageWithLayout<Props> = ({ orders: initialOrders }) => {
  const [orders, setOrders] = useState(initialOrders);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function markShipped(id: string) {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/book-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SHIPPED" }),
      });
      if (res.ok) {
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "SHIPPED" } : o)));
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Failed to update order.");
      }
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-navy">Book orders</h1>
        <p className="mt-1 text-sm text-ink-soft">{orders.length} orders</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-navy/8 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy/8">
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Book</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Buyer</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Shipping</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-ink-soft">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-navy/5 last:border-0 hover:bg-cream-panel/50">
                  <td className="px-4 py-3 font-semibold text-navy">{o.bookName}</td>
                  <td className="px-4 py-3 text-ink">
                    {o.buyerName ?? "—"}
                    <div className="text-xs text-ink-soft">{o.buyerEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${STATUS_COLOR[o.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {o.amountPaid !== null ? `$${(o.amountPaid / 100).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{o.shippingAddress ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {new Date(o.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {o.status === "PAID" && (
                      <button
                        onClick={() => markShipped(o.id)}
                        disabled={updatingId === o.id}
                        className="rounded-lg border border-navy/15 px-3 py-1.5 text-xs font-bold text-navy hover:bg-navy hover:text-white disabled:opacity-50"
                      >
                        {updatingId === o.id ? "Updating…" : "Mark shipped"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-soft">
                    No book orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

AdminBookOrdersPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default AdminBookOrdersPage;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const bookOrderDb = db as never as BookOrderDb;
  const orders = await bookOrderDb.bookOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { name: true } },
      user: { select: { name: true, email: true } },
    },
  });

  return {
    props: {
      orders: orders.map((o) => ({
        id: o.id,
        bookName: o.product.name,
        buyerName: o.user.name,
        buyerEmail: o.user.email,
        status: o.status,
        amountPaid: o.amountPaid,
        shippingAddress: o.shippingAddressLine1
          ? [o.shippingAddressLine1, o.shippingCity, o.shippingState, o.shippingPostalCode].filter(Boolean).join(", ")
          : null,
        createdAt: o.createdAt.toISOString(),
      })),
    },
  };
};
