import Head from "next/head";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AccountNav } from "@/components/account/AccountNav";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface OrderProps {
  id: string;
  status: string;
  bookName: string;
  amountPaid: number | null;
  shippingName: string | null;
  shippingAddressLine1: string | null;
  shippingAddressLine2: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
  createdAt: string;
}

interface Props {
  order: OrderProps;
  checkoutSuccess: boolean;
}

// BookOrder is a new model the local Prisma client doesn't know about yet
// (regenerates on the next Vercel build) — cast at the call site per
// project convention.
type BookOrderDb = {
  bookOrder: {
    findUnique: (a: unknown) => Promise<{
      id: string;
      userId: string;
      status: string;
      amountPaid: number | null;
      shippingName: string | null;
      shippingAddressLine1: string | null;
      shippingAddressLine2: string | null;
      shippingCity: string | null;
      shippingState: string | null;
      shippingPostalCode: string | null;
      shippingCountry: string | null;
      createdAt: Date;
      product: { name: string };
    } | null>;
  };
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Payment pending",
  PAID: "Order confirmed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELED: "Canceled",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600",
  PAID: "bg-emerald-100 text-emerald-800",
  SHIPPED: "bg-sky-100 text-sky-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  CANCELED: "bg-red-100 text-red-800",
};

const BookOrderPage: NextPageWithLayout<Props> = ({ order, checkoutSuccess }) => {
  return (
    <>
      <Head>
        <title>Order — Fixer Nation</title>
      </Head>

      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <AccountNav />

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-navy">Order confirmation</h1>

          {checkoutSuccess && (
            <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-4 text-sm text-emerald-800">
              Thanks for your order! We&apos;ll email you once it ships.
            </div>
          )}

          <div className="mt-8 rounded-2xl border border-navy/10 bg-white p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">Book</p>
                <p className="mt-1 text-lg font-extrabold text-navy">{order.bookName}</p>
                {order.amountPaid !== null && (
                  <p className="text-sm text-ink-soft">${(order.amountPaid / 100).toFixed(2)}</p>
                )}
              </div>
              <span className={`mt-1 inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${STATUS_COLOR[order.status] ?? "bg-slate-100 text-slate-600"}`}>
                {STATUS_LABEL[order.status] ?? order.status}
              </span>
            </div>

            {(order.shippingAddressLine1 || order.shippingName) && (
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">Shipping to</p>
                <p className="mt-1 text-sm text-ink">
                  {order.shippingName}
                  <br />
                  {order.shippingAddressLine1}
                  {order.shippingAddressLine2 ? <>, {order.shippingAddressLine2}</> : null}
                  <br />
                  {[order.shippingCity, order.shippingState, order.shippingPostalCode].filter(Boolean).join(", ")}
                  {order.shippingCountry ? <><br />{order.shippingCountry}</> : null}
                </p>
              </div>
            )}

            <p className="text-sm text-ink-soft">
              Ordered {new Date(order.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
            </p>
          </div>

          <div className="mt-6 text-center">
            <Link href="/dashboard" className="text-sm font-bold text-navy underline hover:opacity-70">
              Go to your dashboard
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

BookOrderPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default BookOrderPage;

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const id = ctx.params?.id as string;
  if (!session?.user?.id) {
    return { redirect: { destination: `/signin?callbackUrl=/account/book-orders/${id}`, permanent: false } };
  }

  const bookOrderDb = db as never as BookOrderDb;
  const raw = await bookOrderDb.bookOrder.findUnique({
    where: { id },
    include: { product: { select: { name: true } } },
  });

  if (!raw || raw.userId !== session.user.id) {
    return { notFound: true };
  }

  return {
    props: {
      order: {
        id: raw.id,
        status: raw.status,
        bookName: raw.product.name,
        amountPaid: raw.amountPaid,
        shippingName: raw.shippingName,
        shippingAddressLine1: raw.shippingAddressLine1,
        shippingAddressLine2: raw.shippingAddressLine2,
        shippingCity: raw.shippingCity,
        shippingState: raw.shippingState,
        shippingPostalCode: raw.shippingPostalCode,
        shippingCountry: raw.shippingCountry,
        createdAt: raw.createdAt.toISOString(),
      },
      checkoutSuccess: ctx.query.checkout === "success",
    },
  };
};
