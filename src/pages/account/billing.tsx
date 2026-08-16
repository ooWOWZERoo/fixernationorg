import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface MembershipInfo {
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  planName: string;
  interval: string;
  amount: number;
}

interface Props {
  membership: MembershipInfo | null;
  hasStripeCustomer: boolean;
  checkoutSuccess: boolean;
}

type MembershipDb = {
  userMembership: {
    findUnique: (a: unknown) => Promise<{
      status: string;
      currentPeriodEnd: Date | null;
      cancelAtPeriodEnd: boolean;
      trialEnd: Date | null;
      price: { interval: string; amount: number; product: { name: string } };
    } | null>;
  };
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  TRIALING: "Free trial",
  PAST_DUE: "Payment past due",
  CANCELED: "Canceled",
  INCOMPLETE: "Incomplete",
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  TRIALING: "bg-sky-100 text-sky-800",
  PAST_DUE: "bg-amber-100 text-amber-800",
  CANCELED: "bg-red-100 text-red-800",
  INCOMPLETE: "bg-slate-100 text-slate-600",
};

function formatInterval(interval: string) {
  if (interval === "MONTHLY") return "month";
  if (interval === "ANNUAL") return "year";
  return interval.toLowerCase();
}

const BillingPage: NextPageWithLayout<Props> = ({ membership, hasStripeCustomer, checkoutSuccess }) => {
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  async function openPortal() {
    setPortalLoading(true);
    setPortalError(null);
    try {
      const res = await fetch("/api/checkout/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to open billing portal");
      window.location.href = data.url;
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : "Something went wrong");
      setPortalLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Billing — Fixer Nation</title>
      </Head>

      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-xl">
          <div className="mb-2 flex items-center gap-3 flex-wrap">
            <Link href="/account" className="text-sm font-semibold text-ink-soft no-underline hover:text-navy">
              ← Account settings
            </Link>
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-navy">Billing</h1>

          {checkoutSuccess && (
            <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-4 text-sm text-emerald-800">
              Your membership is active. Welcome to Fixer Nation!
            </div>
          )}

          {membership ? (
            <div className="mt-8 rounded-2xl border border-navy/10 bg-white p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">Current plan</p>
                  <p className="mt-1 text-lg font-extrabold text-navy">{membership.planName}</p>
                  <p className="text-sm text-ink-soft">
                    ${(membership.amount / 100).toFixed(2)} / {formatInterval(membership.interval)}
                  </p>
                </div>
                <span className={`mt-1 inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${STATUS_COLOR[membership.status] ?? "bg-slate-100 text-slate-600"}`}>
                  {STATUS_LABEL[membership.status] ?? membership.status}
                </span>
              </div>

              {membership.trialEnd && membership.status === "TRIALING" && (
                <p className="text-sm text-ink-soft">
                  Trial ends {new Date(membership.trialEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
                  Your card won't be charged until then.
                </p>
              )}

              {membership.cancelAtPeriodEnd && membership.currentPeriodEnd && (
                <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Your membership will end on {new Date(membership.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. You can reactivate any time before then.
                </p>
              )}

              {!membership.cancelAtPeriodEnd && membership.currentPeriodEnd && membership.status !== "TRIALING" && (
                <p className="text-sm text-ink-soft">
                  Renews {new Date(membership.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.
                </p>
              )}

              {portalError && (
                <p className="text-sm text-red-600">{portalError}</p>
              )}

              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="w-full rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-60"
              >
                {portalLoading ? "Opening…" : "Manage subscription"}
              </button>
              <p className="text-xs text-ink-soft text-center">
                Update payment method, download invoices, or cancel — all handled securely by Stripe.
              </p>
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-navy/10 bg-white p-6 text-center space-y-4">
              <p className="text-sm text-ink-soft">You don't have an active membership.</p>
              <Link
                href="/join"
                className="inline-flex items-center justify-center rounded-xl bg-navy px-6 py-2.5 text-sm font-bold text-white no-underline hover:bg-navy-dark"
              >
                See membership options
              </Link>
            </div>
          )}

          {hasStripeCustomer && !membership && (
            <div className="mt-4 text-center">
              <button
                onClick={openPortal}
                disabled={portalLoading}
                className="text-sm text-ink-soft underline hover:text-navy disabled:opacity-60"
              >
                {portalLoading ? "Opening…" : "View past invoices"}
              </button>
            </div>
          )}
        </div>
      </section>
    </>
  );
};

BillingPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default BillingPage;

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.id) {
    return { redirect: { destination: "/signin?callbackUrl=/account/billing", permanent: false } };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });

  const membershipDb = db as never as MembershipDb;
  const raw = await membershipDb.userMembership.findUnique({
    where: { userId: session.user.id } as unknown as Record<string, unknown>,
    include: { price: { include: { product: { select: { name: true } } } } } as unknown as Record<string, unknown>,
  } as unknown as Record<string, unknown>);

  const membership: MembershipInfo | null = raw
    ? {
        status: raw.status,
        currentPeriodEnd: raw.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: raw.cancelAtPeriodEnd,
        trialEnd: raw.trialEnd?.toISOString() ?? null,
        planName: raw.price.product.name,
        interval: raw.price.interval,
        amount: raw.price.amount,
      }
    : null;

  return {
    props: {
      membership,
      hasStripeCustomer: !!user?.stripeCustomerId,
      checkoutSuccess: ctx.query.checkout === "success",
    },
  };
};
