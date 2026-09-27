import { useState } from "react";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

interface PlanOption {
  id: string;
  label: string;
  grantedRole: string;
}

interface Props {
  plans: PlanOption[];
}

interface GrantResult {
  userId: string;
  email: string;
  planName: string;
  grantedRole: string;
  currentPeriodEnd: string | null;
  emailSent: boolean;
  setPasswordUrl?: string;
}

const INTERVAL_LABEL: Record<string, string> = {
  FREE_TRIAL: "free trial",
  MONTHLY: "monthly",
  ANNUAL: "annual",
  ONE_TIME: "one-time",
};

const ROLE_LABEL: Record<string, string> = {
  CONSUMER: "Consumer",
  MEMBER: "Member",
  PROVIDER: "Service Provider",
  AMBASSADOR: "Brand Ambassador",
  AFFILIATE: "Affiliate",
};

const inputClass =
  "w-full rounded-xl border border-navy/15 bg-cream px-3 py-2 text-sm text-navy focus:border-amber focus:outline-none";
const labelClass = "block text-xs font-bold uppercase tracking-wide text-ink-soft mb-1";

const EMPTY_FORM = { name: "", email: "", priceId: "", currentPeriodEnd: "", note: "" };

const GrantMembershipPage: NextPageWithLayout<Props> = ({ plans }) => {
  const [form, setForm] = useState({ ...EMPTY_FORM, priceId: plans[0]?.id ?? "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GrantResult | null>(null);

  const selectedPlan = plans.find((p) => p.id === form.priceId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users/grant-membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          priceId: form.priceId,
          // <input type="date"> gives a bare YYYY-MM-DD; send end-of-day UTC
          // so access doesn't cut out on the morning of the date the admin
          // picked.
          currentPeriodEnd: form.currentPeriodEnd
            ? new Date(`${form.currentPeriodEnd}T23:59:59.000Z`).toISOString()
            : null,
          note: form.note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't create the membership.");
        return;
      }
      setResult(data as GrantResult);
      setForm({ ...EMPTY_FORM, priceId: plans[0]?.id ?? "" });
    } catch {
      setError("Something went wrong. Nothing was saved.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/admin/users" className="text-sm font-semibold text-ink-soft hover:text-navy">
          ← Back to users
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold text-navy">Grant a membership</h1>
        <p className="mt-1 text-sm text-ink-soft">
          For someone who already paid on the old site but has no account here. This builds the
          account and the membership record together, then emails them a link to set their password.
        </p>
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-amber/40 bg-amber/10 p-6">
          <p className="text-sm font-semibold text-navy">No active membership plans to grant.</p>
          <p className="mt-1 text-sm text-ink-soft">
            Add or reactivate a membership price under{" "}
            <Link href="/admin/products" className="font-semibold text-navy hover:underline">
              Products
            </Link>{" "}
            first.
          </p>
        </div>
      ) : (
        <>
          {result && (
            <div className="mb-6 rounded-2xl border border-green-300 bg-green-50 p-6">
              <p className="font-bold text-green-800">
                {result.email} is set up with {result.planName}.
              </p>
              <p className="mt-1 text-sm text-green-900">
                Role granted: {ROLE_LABEL[result.grantedRole] ?? result.grantedRole}. Access{" "}
                {result.currentPeriodEnd
                  ? `ends ${new Date(result.currentPeriodEnd).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}`
                  : "doesn't expire"}
                .
              </p>
              {result.emailSent ? (
                <p className="mt-2 text-sm text-green-900">
                  Their set-password email is on its way. The link works for 30 days.
                </p>
              ) : (
                <div className="mt-3 rounded-xl border border-amber/50 bg-amber/10 p-3">
                  <p className="text-sm font-bold text-navy">The email didn&apos;t go out.</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    The account and membership are saved. Send them this link yourself — it works
                    for 30 days:
                  </p>
                  <p className="mt-2 break-all font-mono text-xs text-navy">{result.setPasswordUrl}</p>
                </div>
              )}
              <Link
                href={`/admin/users`}
                className="mt-3 inline-block text-sm font-semibold text-navy hover:underline"
              >
                View in users list →
              </Link>
            </div>
          )}

          <form onSubmit={handleSubmit} className="rounded-2xl border border-navy/8 bg-white p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="grant-name">
                  Full name
                </label>
                <input
                  id="grant-name"
                  type="text"
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="grant-email">
                  Email
                </label>
                <input
                  id="grant-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-ink-soft">
                  Has to be an email with no account yet. Double-check it — this is where the
                  set-password link goes.
                </p>
              </div>
              <div>
                <label className={labelClass} htmlFor="grant-plan">
                  Membership plan
                </label>
                <select
                  id="grant-plan"
                  required
                  value={form.priceId}
                  onChange={(e) => setForm((f) => ({ ...f, priceId: e.target.value }))}
                  className={inputClass}
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                {selectedPlan && (
                  <p className="mt-1 text-xs text-ink-soft">
                    Grants the {ROLE_LABEL[selectedPlan.grantedRole] ?? selectedPlan.grantedRole}{" "}
                    role.
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass} htmlFor="grant-expiry">
                  Access ends (optional)
                </label>
                <input
                  id="grant-expiry"
                  type="date"
                  value={form.currentPeriodEnd}
                  onChange={(e) => setForm((f) => ({ ...f, currentPeriodEnd: e.target.value }))}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-ink-soft">
                  Leave blank for access that doesn&apos;t expire. With a date set, the membership
                  is tracked as ending then, and it feeds the 30- and 7-day heads-up emails.
                  Nothing is ever charged either way — this never auto-renews and there&apos;s no
                  card on file.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="grant-note">
                  Note (optional)
                </label>
                <input
                  id="grant-note"
                  type="text"
                  maxLength={500}
                  placeholder="e.g. Wix annual, paid 3/14, order #1042"
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-ink-soft">Saved to the audit log, not shown to the member.</p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-amber px-5 py-2 text-sm font-bold text-navy-dark hover:bg-amber-dark disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create account and grant membership"}
              </button>
              {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            </div>
          </form>
        </>
      )}
    </div>
  );
};

GrantMembershipPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;
export default GrantMembershipPage;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  // Same filter the grant endpoint validates against, so the dropdown can
  // never offer something the server will reject.
  const prices = await db.price.findMany({
    where: { active: true, product: { type: "MEMBERSHIP" } },
    select: {
      id: true,
      amount: true,
      interval: true,
      membershipRole: true,
      product: { select: { name: true, sortOrder: true } },
    },
    orderBy: [{ product: { sortOrder: "asc" } }, { amount: "asc" }],
  });

  const plans: PlanOption[] = prices.map((p) => {
    const money = p.amount === 0 ? "free" : `$${(p.amount / 100).toFixed(2)}`;
    const interval = INTERVAL_LABEL[p.interval] ?? p.interval.toLowerCase();
    return {
      id: p.id,
      label: `${p.product.name} — ${money} ${interval}`,
      grantedRole: p.membershipRole ?? "MEMBER",
    };
  });

  return { props: { plans } };
};
