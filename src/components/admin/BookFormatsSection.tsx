import { useState } from "react";
import { useRouter } from "next/router";
import type { Price } from "@prisma/client";

export type BookFormatType = "PAPERBACK" | "HARDCOVER" | "DIGITAL";

export interface BookFormatRow {
  format: BookFormatType;
  amazonUrl: string | null;
  priceId: string | null;
  exists: boolean;
}

const FORMATS: { value: BookFormatType; label: string; note?: string }[] = [
  { value: "PAPERBACK", label: "Paperback" },
  { value: "HARDCOVER", label: "Hardcover" },
  { value: "DIGITAL", label: "Kindle", note: "Amazon only" },
];

interface Props {
  productId: string;
  prices: Price[];
  formats: BookFormatRow[];
}

export function BookFormatsSection({ productId, prices, formats }: Props) {
  const router = useRouter();

  const [urlDraft, setUrlDraft] = useState<Record<string, string>>(
    Object.fromEntries(formats.map((f) => [f.format, f.amazonUrl ?? ""]))
  );
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});
  const [existingDraft, setExistingDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byFormat = new Map(formats.map((f) => [f.format, f]));
  const attachedPriceIds = new Set(formats.map((f) => f.priceId).filter(Boolean) as string[]);
  const oneTimePrices = prices.filter((p) => p.interval === "ONE_TIME" && p.active);
  const unattached = oneTimePrices.filter((p) => !attachedPriceIds.has(p.id));

  const priceById = (id: string | null) => (id ? prices.find((p) => p.id === id) ?? null : null);

  async function putFormat(format: BookFormatType, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/products/${productId}/book-formats`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format, ...body }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Something went wrong.");
    }
  }

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      router.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(null);
    }
  }

  const saveUrl = (format: BookFormatType) =>
    run(`url-${format}`, () => putFormat(format, { amazonUrl: urlDraft[format]?.trim() || null }));

  // Two steps on purpose: the existing Add Price endpoint makes a bare Price,
  // then this attaches it to the format row. Nothing about prices.ts changes.
  const addAndAttach = (format: BookFormatType) =>
    run(`new-${format}`, async () => {
      const amountCents = Math.round(parseFloat(amountDraft[format] ?? "") * 100);
      if (isNaN(amountCents) || amountCents < 0) throw new Error("Enter an amount like 12.99.");

      const res = await fetch(`/api/admin/products/${productId}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interval: "ONE_TIME",
          amount: amountCents,
          membershipRole: null,
          trialDays: null,
          active: true,
        }),
      });
      const price = await res.json();
      if (!res.ok) throw new Error(price.error ?? "Could not add the price.");

      await putFormat(format, { priceId: price.id });
    });

  const attachExisting = (format: BookFormatType) =>
    run(`attach-${format}`, async () => {
      const priceId = existingDraft[format];
      if (!priceId) throw new Error("Pick a price first.");
      await putFormat(format, { priceId });
    });

  const detach = (format: BookFormatType) =>
    run(`detach-${format}`, () => putFormat(format, { priceId: null }));

  const removeFormat = (format: BookFormatType) => {
    if (!confirm("Remove this format? The price itself stays in the Prices list.")) return;
    return run(`remove-${format}`, async () => {
      const res = await fetch(`/api/admin/products/${productId}/book-formats?format=${format}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not remove the format.");
      }
    });
  };

  return (
    <div className="mt-8">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Formats</h2>
      <p className="mb-4 text-xs text-slate-400">
        Paperback and hardcover can have a price here, an Amazon link, or both. Kindle goes to Amazon
        only, since there is no ebook delivery on this site. A format with neither one set stays off
        the book page.
      </p>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {unattached.length > 0 && (
        <div className="mb-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {unattached.length === 1
            ? `The one-time price ${fmt(unattached[0].amount)} is not attached to a format yet, so the book page shows no buy button for it. Attach it below.`
            : `${unattached.length} one-time prices are not attached to a format yet, so the book page shows no buy button for them. Attach them below.`}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Format</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Amazon link</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Price on this site</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {FORMATS.map(({ value, label, note }) => {
              const row = byFormat.get(value);
              const price = priceById(row?.priceId ?? null);
              return (
                <tr key={value} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="text-sm font-medium text-slate-800">{label}</span>
                    {note && <span className="mt-0.5 block text-xs text-slate-400">{note}</span>}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        value={urlDraft[value] ?? ""}
                        onChange={(e) => setUrlDraft((d) => ({ ...d, [value]: e.target.value }))}
                        placeholder="https://www.amazon.com/dp/..."
                        className="w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                      />
                      <button
                        type="button"
                        onClick={() => saveUrl(value)}
                        disabled={busy !== null}
                        className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-navy hover:text-navy disabled:opacity-50 transition-colors"
                      >
                        {busy === `url-${value}` ? "Saving…" : "Save link"}
                      </button>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {value === "DIGITAL" ? (
                      <span className="text-sm text-slate-400">Amazon only</span>
                    ) : price ? (
                      <div>
                        <span className="text-sm font-medium text-slate-800">{fmt(price.amount)}</span>
                        <button
                          type="button"
                          onClick={() => detach(value)}
                          disabled={busy !== null}
                          className="ml-3 text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          {busy === `detach-${value}` ? "Detaching…" : "Detach"}
                        </button>
                        {!price.stripePriceId && (
                          <span className="mt-1 block text-xs text-amber-700">
                            Not in Stripe yet. Run Sync to Stripe above or the buy button stays hidden.
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={amountDraft[value] ?? ""}
                            onChange={(e) => setAmountDraft((d) => ({ ...d, [value]: e.target.value }))}
                            placeholder="12.99"
                            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                          />
                          <button
                            type="button"
                            onClick={() => addAndAttach(value)}
                            disabled={busy !== null}
                            className="shrink-0 rounded-lg bg-navy px-3 py-2 text-xs font-semibold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors"
                          >
                            {busy === `new-${value}` ? "Adding…" : "Add price"}
                          </button>
                        </div>
                        {unattached.length > 0 && (
                          <div className="flex items-center gap-2">
                            <select
                              value={existingDraft[value] ?? ""}
                              onChange={(e) => setExistingDraft((d) => ({ ...d, [value]: e.target.value }))}
                              className="w-40 rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                            >
                              <option value="">Use a price you already added</option>
                              {unattached.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {fmt(p.amount)}
                                  {p.stripePriceId ? "" : " (not in Stripe)"}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => attachExisting(value)}
                              disabled={busy !== null}
                              className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-navy hover:text-navy disabled:opacity-50 transition-colors"
                            >
                              {busy === `attach-${value}` ? "Attaching…" : "Attach"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {row?.exists ? (
                      <button
                        type="button"
                        onClick={() => removeFormat(value)}
                        disabled={busy !== null}
                        className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {busy === `remove-${value}` ? "Removing…" : "Remove"}
                      </button>
                    ) : (
                      <span className="text-sm text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmt(cents: number) {
  return cents === 0 ? "Free" : `$${(cents / 100).toFixed(2)}`;
}

export default BookFormatsSection;
