import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import type { Product, Price } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

const TYPE_LABEL: Record<string, string> = {
  MEMBERSHIP: "Membership Plan",
  BOOK: "Book",
  DIGITAL: "Digital Download",
  PHYSICAL: "Physical Product",
};

const INTERVAL_LABEL: Record<string, string> = {
  FREE_TRIAL: "Free Trial",
  MONTHLY: "Monthly",
  ANNUAL: "Annual",
  ONE_TIME: "One-Time",
};

const ROLE_OPTIONS = [
  { value: "", label: "None (non-membership)" },
  { value: "CONSUMER", label: "Consumer" },
  { value: "PROVIDER", label: "Service Provider" },
  { value: "AMBASSADOR", label: "Brand Ambassador" },
];

type ProductWithPrices = Product & { prices: Price[] };

interface Props {
  product: ProductWithPrices;
}

const AdminProductEdit: NextPageWithLayout<Props> = ({ product }) => {
  const router = useRouter();

  const [form, setForm] = useState({
    name: product.name,
    slug: product.slug,
    description: product.description ?? "",
    features: product.features.join("\n"),
    imageUrl: product.imageUrl ?? "",
    active: product.active,
    sortOrder: String(product.sortOrder),
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [deleting, setDeleting] = useState(false);

  const [priceForm, setPriceForm] = useState({
    interval: "MONTHLY",
    amountDollars: "",
    membershipRole: "",
    trialDays: "",
    active: true,
  });
  const [addingPrice, setAddingPrice] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || null,
      features: form.features.split("\n").map((s) => s.trim()).filter(Boolean),
      imageUrl: form.imageUrl.trim() || null,
      active: form.active,
      sortOrder: parseInt(form.sortOrder, 10) || 0,
    };

    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Something went wrong.");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setSaveError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
    await router.push("/admin/products");
  };

  const handleAddPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingPrice(true);
    setPriceError(null);

    const amountCents = Math.round(parseFloat(priceForm.amountDollars) * 100);
    if (isNaN(amountCents)) {
      setPriceError("Amount must be a valid number.");
      setAddingPrice(false);
      return;
    }

    const payload = {
      interval: priceForm.interval,
      amount: amountCents,
      membershipRole: priceForm.membershipRole || null,
      trialDays: priceForm.interval === "FREE_TRIAL" && priceForm.trialDays
        ? parseInt(priceForm.trialDays, 10)
        : null,
      active: priceForm.active,
    };

    try {
      const res = await fetch(`/api/admin/products/${product.id}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setPriceError(data.error ?? "Something went wrong.");
        setAddingPrice(false);
        return;
      }
      router.reload();
    } catch {
      setPriceError("Network error.");
      setAddingPrice(false);
    }
  };

  const handleStripeSync = async () => {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/admin/products/${product.id}/stripe-sync`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncResult({ ok: false, text: data.error ?? "Sync failed." });
      } else {
        const priceCount = (data.syncedPrices ?? []).length;
        setSyncResult({ ok: true, text: `Synced. Stripe product: ${data.stripeProductId}. ${priceCount} price${priceCount !== 1 ? "s" : ""} synced.` });
      }
    } catch {
      setSyncResult({ ok: false, text: "Network error. Please try again." });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleRemovePrice = async (priceId: string) => {
    if (!confirm("Remove this price?")) return;
    await fetch(`/api/admin/products/${product.id}/prices?priceId=${priceId}`, {
      method: "DELETE",
    });
    router.reload();
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/admin/products" className="text-sm text-slate-500 no-underline hover:text-navy">
          ← Products
        </Link>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{product.name}</h1>
            <span className="mt-1 inline-flex rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-medium text-navy">
              {TYPE_LABEL[product.type] ?? product.type}
            </span>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {/* Product form */}
      <form onSubmit={handleSave} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
        {saveError && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{saveError}</div>
        )}
        {saved && (
          <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">Saved.</div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Slug</label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            required
            pattern="[a-z0-9-]+"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Description <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
        </div>

        {product.type === "MEMBERSHIP" && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Features <span className="font-normal text-slate-400">(one per line)</span>
            </label>
            <textarea
              value={form.features}
              onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))}
              rows={5}
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Image URL <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            type="url"
            value={form.imageUrl}
            onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          />
        </div>

        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <input
              id="active"
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-navy focus:ring-navy"
            />
            <label htmlFor="active" className="text-sm font-medium text-slate-700">Active</label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Sort Order</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              min="0"
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>

      {/* Stripe sync */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Stripe</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Creates or updates the Stripe product and syncs any prices that haven't been pushed yet.
            </p>
          </div>
          <button
            type="button"
            onClick={handleStripeSync}
            disabled={syncLoading}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-navy hover:text-navy disabled:opacity-50 transition-colors"
          >
            {syncLoading ? "Syncing…" : "Sync to Stripe"}
          </button>
        </div>
        {syncResult && (
          <p className={`mt-3 text-xs font-medium ${syncResult.ok ? "text-green-700" : "text-red-600"}`}>
            {syncResult.text}
          </p>
        )}
      </div>

      {/* Prices section */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Prices</h2>

        {product.prices.length > 0 ? (
          <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Interval</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Role</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Active</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {product.prices.map((price) => (
                  <tr key={price.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-sm text-slate-700">
                      {INTERVAL_LABEL[price.interval] ?? price.interval}
                      {price.trialDays ? ` (${price.trialDays}d)` : ""}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-700">
                      {price.amount === 0 ? "Free" : `$${(price.amount / 100).toFixed(2)}`}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-700">{price.membershipRole ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${price.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
                        {price.active ? "✓" : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => handleRemovePrice(price.id)}
                        className="text-sm font-medium text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mb-4 text-sm text-slate-400">No prices configured yet.</p>
        )}

        {/* Add price form */}
        <form onSubmit={handleAddPrice} className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Add Price</h3>

          {priceError && (
            <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{priceError}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Interval</label>
              <select
                value={priceForm.interval}
                onChange={(e) => setPriceForm((f) => ({ ...f, interval: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              >
                <option value="FREE_TRIAL">Free Trial</option>
                <option value="MONTHLY">Monthly</option>
                <option value="ANNUAL">Annual</option>
                <option value="ONE_TIME">One-Time</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Amount (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={priceForm.amountDollars}
                onChange={(e) => setPriceForm((f) => ({ ...f, amountDollars: e.target.value }))}
                placeholder="0.00"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Membership Role</label>
              <select
                value={priceForm.membershipRole}
                onChange={(e) => setPriceForm((f) => ({ ...f, membershipRole: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            {priceForm.interval === "FREE_TRIAL" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Trial Days</label>
                <input
                  type="number"
                  min="1"
                  value={priceForm.trialDays}
                  onChange={(e) => setPriceForm((f) => ({ ...f, trialDays: e.target.value }))}
                  placeholder="7"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={priceForm.active}
                onChange={(e) => setPriceForm((f) => ({ ...f, active: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-navy focus:ring-navy"
              />
              Active
            </label>
            <button
              type="submit"
              disabled={addingPrice}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors"
            >
              {addingPrice ? "Adding…" : "+ Add Price"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

AdminProductEdit.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.adminRole)) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }

  const { id } = context.params as { id: string };
  const product = await db.product.findUnique({
    where: { id },
    include: { prices: { orderBy: { createdAt: "asc" } } },
  });

  if (!product) return { notFound: true };

  return { props: { product: JSON.parse(JSON.stringify(product)) } };
};

export default AdminProductEdit;
