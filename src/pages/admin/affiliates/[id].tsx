import { useState } from "react";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

// ── types ─────────────────────────────────────────────────────────────────────

type PromoCodeRow = {
  id: string;
  code: string;
  status: string;
  discountType: string;
  discountValue: string;
  maxUses: number | null;
  usedCount: number;
  validFrom: string;
  validUntil: string | null;
  notes: string | null;
  createdAt: string;
};

type CommissionRuleRow = {
  id: string;
  name: string;
  type: string;
  rate: string;
  pendingDays: number;
  appliesTo: string | null;
  active: boolean;
  createdAt: string;
};

type LedgerRow = {
  id: string;
  status: string;
  sourceType: string;
  description: string | null;
  grossAmount: string;
  commissionAmount: string;
  commissionRate: string | null;
  currency: string;
  pendingUntil: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
};

type AffiliateDetail = {
  id: string;
  affiliateType: string;
  status: string;
  attributionWindowDays: number;
  payoutThreshold: string | null;
  payoutCycle: string;
  taxOnboardingDone: boolean;
  payoutOnboardingDone: boolean;
  stripeConnectId: string | null;
  activatedAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  revokedAt: string | null;
  notes: string | null;
  assignedBy: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string; role: string };
  application: { id: string; name: string | null; email: string; type: string; status: string } | null;
  promoCodes: PromoCodeRow[];
  commissionRules: CommissionRuleRow[];
  ledgerEntries: LedgerRow[];
};

interface Props {
  affiliate: AffiliateDetail;
}

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber/20 text-amber-dark",
  ACTIVE: "bg-green-100 text-green-700",
  ON_HOLD: "bg-blue-100 text-blue-700",
  SUSPENDED: "bg-orange-100 text-orange-700",
  REVOKED: "bg-slate-100 text-slate-500",
  CLOSED: "bg-slate-100 text-slate-400",
};

const LEDGER_BADGE: Record<string, string> = {
  PENDING: "bg-amber/20 text-amber-dark",
  APPROVED: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  REVERSED: "bg-red-100 text-red-600",
  ON_HOLD: "bg-slate-100 text-slate-500",
  CANCELLED: "bg-slate-100 text-slate-400",
};

const PROMO_BADGE: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  INACTIVE: "bg-slate-100 text-slate-500",
  EXPIRED: "bg-slate-100 text-slate-400",
};

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: string | null | undefined, currency = "USD") {
  if (!amount) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    parseFloat(amount)
  );
}

function pct(rate: string | null | undefined) {
  if (!rate) return "—";
  return `${(parseFloat(rate) * 100).toFixed(2)}%`;
}

// ── component ─────────────────────────────────────────────────────────────────

const AffiliateDetailPage: NextPageWithLayout<Props> = ({ affiliate: initial }) => {
  const [affiliate, setAffiliate] = useState(initial);
  const [activeTab, setActiveTab] = useState<"promo" | "rules" | "ledger" | "settings">("promo");

  // Status action state
  const [newStatus, setNewStatus] = useState("");
  const [statusReason, setStatusReason] = useState("");
  const [changingStatus, setChangingStatus] = useState(false);

  // Promo code form
  const [promoForm, setPromoForm] = useState({
    discountType: "PERCENTAGE",
    discountValue: "",
    maxUses: "",
    validUntil: "",
    notes: "",
    customCode: "",
  });
  const [addingPromo, setAddingPromo] = useState(false);
  const [promoResult, setPromoResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Commission rule form
  const [ruleForm, setRuleForm] = useState({
    name: "",
    type: "PERCENTAGE",
    rate: "",
    pendingDays: "30",
    appliesTo: "",
  });
  const [addingRule, setAddingRule] = useState(false);

  // Ledger entry form
  const [ledgerForm, setLedgerForm] = useState({
    sourceType: "MANUAL",
    description: "",
    grossAmount: "",
    commissionAmount: "",
    commissionRate: "",
    pendingDays: "0",
    notes: "",
  });
  const [addingLedger, setAddingLedger] = useState(false);
  const [ledgerResult, setLedgerResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Settings form
  const [settings, setSettings] = useState({
    attributionWindowDays: String(affiliate.attributionWindowDays),
    payoutThreshold: affiliate.payoutThreshold ?? "",
    payoutCycle: affiliate.payoutCycle,
    taxOnboardingDone: affiliate.taxOnboardingDone,
    payoutOnboardingDone: affiliate.payoutOnboardingDone,
    stripeConnectId: affiliate.stripeConnectId ?? "",
    notes: affiliate.notes ?? "",
  });
  const [savingSettings, setSavingSettings] = useState(false);

  const patch = async (body: object) => {
    const res = await fetch(`/api/admin/affiliates/${affiliate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, data: await res.json() };
  };

  const handleStatusChange = async () => {
    if (!newStatus) return;
    setChangingStatus(true);
    const { ok, data } = await patch({ action: "status", status: newStatus, reason: statusReason.trim() || undefined });
    if (ok) {
      setAffiliate((prev) => ({ ...prev, ...data }));
      setNewStatus("");
      setStatusReason("");
    }
    setChangingStatus(false);
  };

  const handleAddPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingPromo(true);
    setPromoResult(null);
    const { ok, data } = await patch({
      action: "promo",
      discountType: promoForm.discountType,
      discountValue: parseFloat(promoForm.discountValue),
      maxUses: promoForm.maxUses ? parseInt(promoForm.maxUses) : undefined,
      validUntil: promoForm.validUntil || undefined,
      notes: promoForm.notes.trim() || undefined,
      customCode: promoForm.customCode.trim() || undefined,
    });
    if (ok) {
      setAffiliate((prev) => ({ ...prev, promoCodes: [data, ...prev.promoCodes] }));
      setPromoForm({ discountType: "PERCENTAGE", discountValue: "", maxUses: "", validUntil: "", notes: "", customCode: "" });
      setPromoResult({ ok: true, message: `Code ${data.code} created.` });
      setTimeout(() => setPromoResult(null), 4000);
    } else {
      setPromoResult({ ok: false, message: data.error ?? "Failed to create code." });
    }
    setAddingPromo(false);
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingRule(true);
    const { ok, data } = await patch({
      action: "rule",
      name: ruleForm.name.trim(),
      type: ruleForm.type,
      rate: parseFloat(ruleForm.rate) / (ruleForm.type === "PERCENTAGE" ? 100 : 1),
      pendingDays: parseInt(ruleForm.pendingDays),
      appliesTo: ruleForm.appliesTo.trim() || undefined,
    });
    if (ok) {
      setAffiliate((prev) => ({ ...prev, commissionRules: [...prev.commissionRules, data] }));
      setRuleForm({ name: "", type: "PERCENTAGE", rate: "", pendingDays: "30", appliesTo: "" });
    }
    setAddingRule(false);
  };

  const handleDeactivateRule = async (ruleId: string) => {
    const { ok, data } = await patch({ action: "deactivate_rule", ruleId });
    if (ok) {
      setAffiliate((prev) => ({
        ...prev,
        commissionRules: prev.commissionRules.map((r) => (r.id === ruleId ? { ...r, active: false } : r)),
      }));
    }
    void data;
  };

  const handleAddLedger = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingLedger(true);
    setLedgerResult(null);
    const { ok, data } = await patch({
      action: "ledger",
      sourceType: ledgerForm.sourceType,
      description: ledgerForm.description.trim(),
      grossAmount: parseFloat(ledgerForm.grossAmount),
      commissionAmount: parseFloat(ledgerForm.commissionAmount),
      commissionRate: ledgerForm.commissionRate ? parseFloat(ledgerForm.commissionRate) / 100 : undefined,
      pendingDays: parseInt(ledgerForm.pendingDays),
      notes: ledgerForm.notes.trim() || undefined,
    });
    if (ok) {
      setAffiliate((prev) => ({ ...prev, ledgerEntries: [data, ...prev.ledgerEntries] }));
      setLedgerForm({ sourceType: "MANUAL", description: "", grossAmount: "", commissionAmount: "", commissionRate: "", pendingDays: "0", notes: "" });
      setLedgerResult({ ok: true, message: "Entry added." });
      setTimeout(() => setLedgerResult(null), 3000);
    } else {
      setLedgerResult({ ok: false, message: data.error ?? "Failed." });
    }
    setAddingLedger(false);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    const { ok, data } = await patch({
      action: "settings",
      attributionWindowDays: parseInt(settings.attributionWindowDays),
      payoutThreshold: settings.payoutThreshold ? parseFloat(settings.payoutThreshold) : undefined,
      payoutCycle: settings.payoutCycle,
      taxOnboardingDone: settings.taxOnboardingDone,
      payoutOnboardingDone: settings.payoutOnboardingDone,
      stripeConnectId: settings.stripeConnectId.trim() || undefined,
      notes: settings.notes.trim() || undefined,
    });
    if (ok) setAffiliate((prev) => ({ ...prev, ...data }));
    setSavingSettings(false);
  };

  const displayName = affiliate.user.name ?? affiliate.user.email;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/admin/affiliates" className="hover:text-navy transition-colors">Affiliates</Link>
        <span>/</span>
        <span className="font-medium text-slate-800 truncate max-w-sm">{displayName}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{displayName}</h1>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${affiliate.affiliateType === "AMBASSADOR" ? "bg-purple-100 text-purple-700" : "bg-navy/10 text-navy"}`}>
              {affiliate.affiliateType}
            </span>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[affiliate.status] ?? "bg-slate-100 text-slate-500"}`}>
              {affiliate.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{affiliate.user.email}</p>
        </div>
        {affiliate.application && (
          <Link
            href={`/admin/applications/${affiliate.application.id}`}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            View application →
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left: tabs ──────────────────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-2">
          {/* Tab bar */}
          <div className="flex border-b border-slate-200">
            {(["promo", "rules", "ledger", "settings"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2.5 text-sm font-semibold capitalize transition-colors ${activeTab === t ? "border-b-2 border-navy text-navy" : "text-slate-500 hover:text-slate-800"}`}
              >
                {t === "promo" ? "Promo codes" : t === "rules" ? "Commission rules" : t === "ledger" ? "Ledger" : "Settings"}
                {t === "promo" && affiliate.promoCodes.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">{affiliate.promoCodes.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* ── Promo codes tab ────────────────────────────────────────────── */}
          {activeTab === "promo" && (
            <div className="space-y-4">
              {/* Add promo form */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="mb-4 text-sm font-bold text-slate-800">Add promo code</h3>
                {promoResult && (
                  <div className={`mb-3 rounded-lg px-3 py-2 text-sm font-medium ${promoResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {promoResult.message}
                  </div>
                )}
                <form onSubmit={handleAddPromo} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Discount type</label>
                      <select value={promoForm.discountType} onChange={(e) => setPromoForm((f) => ({ ...f, discountType: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy">
                        <option value="PERCENTAGE">Percentage</option>
                        <option value="FLAT">Flat amount</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        {promoForm.discountType === "PERCENTAGE" ? "Discount %" : "Discount $"} *
                      </label>
                      <input required type="number" min="0.01" step="0.01" value={promoForm.discountValue} onChange={(e) => setPromoForm((f) => ({ ...f, discountValue: e.target.value }))} placeholder={promoForm.discountType === "PERCENTAGE" ? "10" : "25.00"} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Max uses</label>
                      <input type="number" min="1" value={promoForm.maxUses} onChange={(e) => setPromoForm((f) => ({ ...f, maxUses: e.target.value }))} placeholder="Unlimited" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Custom code</label>
                      <input value={promoForm.customCode} onChange={(e) => setPromoForm((f) => ({ ...f, customCode: e.target.value }))} placeholder="Auto-generated if blank" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy uppercase" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Expires</label>
                      <input type="date" value={promoForm.validUntil} onChange={(e) => setPromoForm((f) => ({ ...f, validUntil: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
                    </div>
                  </div>
                  <button type="submit" disabled={addingPromo || !promoForm.discountValue} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-40">
                    {addingPromo ? "Creating…" : "Create code"}
                  </button>
                </form>
              </div>

              {/* Promo code list */}
              {affiliate.promoCodes.length === 0 ? (
                <p className="text-sm text-slate-400 px-1">No promo codes yet.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Code</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Discount</th>
                        <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 sm:table-cell">Uses</th>
                        <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 md:table-cell">Expires</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {affiliate.promoCodes.map((p) => (
                        <tr key={p.id}>
                          <td className="px-4 py-3 font-mono font-semibold text-slate-900">{p.code}</td>
                          <td className="px-4 py-3 text-slate-700">
                            {p.discountType === "PERCENTAGE"
                              ? `${parseFloat(p.discountValue)}%`
                              : fmt(p.discountValue)}
                          </td>
                          <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                            {p.usedCount}{p.maxUses ? ` / ${p.maxUses}` : ""}
                          </td>
                          <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                            {p.validUntil ? new Date(p.validUntil).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${PROMO_BADGE[p.status] ?? "bg-slate-100 text-slate-500"}`}>
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Commission rules tab ────────────────────────────────────────── */}
          {activeTab === "rules" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="mb-4 text-sm font-bold text-slate-800">Add commission rule</h3>
                <form onSubmit={handleAddRule} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Rule name *</label>
                      <input required value={ruleForm.name} onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Standard referral 10%" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
                      <select value={ruleForm.type} onChange={(e) => setRuleForm((f) => ({ ...f, type: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy">
                        <option value="PERCENTAGE">Percentage</option>
                        <option value="FLAT">Flat $</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Rate {ruleForm.type === "PERCENTAGE" ? "(%)" : "($)"} *
                      </label>
                      <input required type="number" min="0.01" step="0.01" value={ruleForm.rate} onChange={(e) => setRuleForm((f) => ({ ...f, rate: e.target.value }))} placeholder={ruleForm.type === "PERCENTAGE" ? "10" : "25.00"} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Pending days</label>
                      <input type="number" min="0" value={ruleForm.pendingDays} onChange={(e) => setRuleForm((f) => ({ ...f, pendingDays: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Applies to</label>
                      <input value={ruleForm.appliesTo} onChange={(e) => setRuleForm((f) => ({ ...f, appliesTo: e.target.value }))} placeholder="All products (blank)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
                    </div>
                  </div>
                  <button type="submit" disabled={addingRule || !ruleForm.name || !ruleForm.rate} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-40">
                    {addingRule ? "Adding…" : "Add rule"}
                  </button>
                </form>
              </div>

              {affiliate.commissionRules.length === 0 ? (
                <p className="text-sm text-slate-400 px-1">No commission rules yet.</p>
              ) : (
                <div className="space-y-2">
                  {affiliate.commissionRules.map((r) => (
                    <div key={r.id} className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${r.active ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"}`}>
                      <div>
                        <p className={`font-semibold text-sm ${r.active ? "text-slate-900" : "text-slate-400 line-through"}`}>{r.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {r.type === "PERCENTAGE" ? pct(r.rate) : fmt(r.rate)} &middot; {r.pendingDays}d pending
                          {r.appliesTo ? ` · ${r.appliesTo}` : " · all products"}
                        </p>
                      </div>
                      {r.active && (
                        <button onClick={() => handleDeactivateRule(r.id)} className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-slate-400 hover:text-red-600 hover:bg-red-50">
                          Deactivate
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Ledger tab ─────────────────────────────────────────────────── */}
          {activeTab === "ledger" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="mb-4 text-sm font-bold text-slate-800">Add manual entry</h3>
                {ledgerResult && (
                  <div className={`mb-3 rounded-lg px-3 py-2 text-sm font-medium ${ledgerResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {ledgerResult.message}
                  </div>
                )}
                <form onSubmit={handleAddLedger} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
                      <select value={ledgerForm.sourceType} onChange={(e) => setLedgerForm((f) => ({ ...f, sourceType: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy">
                        <option value="MANUAL">Manual adjustment</option>
                        <option value="BONUS">Bonus</option>
                        <option value="REVERSAL">Reversal</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Description *</label>
                      <input required value={ledgerForm.description} onChange={(e) => setLedgerForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Q3 performance bonus" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Transaction $ *</label>
                      <input required type="number" step="0.01" value={ledgerForm.grossAmount} onChange={(e) => setLedgerForm((f) => ({ ...f, grossAmount: e.target.value }))} placeholder="0.00" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Commission $ *</label>
                      <input required type="number" step="0.01" value={ledgerForm.commissionAmount} onChange={(e) => setLedgerForm((f) => ({ ...f, commissionAmount: e.target.value }))} placeholder="0.00" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Pending days</label>
                      <input type="number" min="0" value={ledgerForm.pendingDays} onChange={(e) => setLedgerForm((f) => ({ ...f, pendingDays: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
                    </div>
                  </div>
                  <button type="submit" disabled={addingLedger || !ledgerForm.description || !ledgerForm.grossAmount || !ledgerForm.commissionAmount} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-40">
                    {addingLedger ? "Adding…" : "Add entry"}
                  </button>
                </form>
              </div>

              {affiliate.ledgerEntries.length === 0 ? (
                <p className="text-sm text-slate-400 px-1">No ledger entries yet. Entries are created automatically when referrals convert (SP-5) or manually above.</p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Description</th>
                        <th className="hidden px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500 sm:table-cell">Transaction</th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-500">Commission</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Status</th>
                        <th className="hidden px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 md:table-cell">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {affiliate.ledgerEntries.map((l) => (
                        <tr key={l.id}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{l.description ?? l.sourceType}</p>
                            <p className="text-xs text-slate-400">{l.sourceType}</p>
                          </td>
                          <td className="hidden px-4 py-3 text-right text-slate-600 sm:table-cell">{fmt(l.grossAmount)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">{fmt(l.commissionAmount)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${LEDGER_BADGE[l.status] ?? "bg-slate-100 text-slate-500"}`}>
                              {l.status}
                            </span>
                          </td>
                          <td className="hidden px-4 py-3 text-slate-500 text-xs md:table-cell">
                            {new Date(l.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Settings tab ───────────────────────────────────────────────── */}
          {activeTab === "settings" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-bold text-slate-800">Affiliate settings</h3>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Attribution window (days)</label>
                    <input type="number" min="1" value={settings.attributionWindowDays} onChange={(e) => setSettings((s) => ({ ...s, attributionWindowDays: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Payout cycle</label>
                    <select value={settings.payoutCycle} onChange={(e) => setSettings((s) => ({ ...s, payoutCycle: e.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy">
                      <option value="MONTHLY">Monthly</option>
                      <option value="BIWEEKLY">Biweekly</option>
                      <option value="WEEKLY">Weekly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Payout threshold ($)</label>
                    <input type="number" min="0" step="0.01" value={settings.payoutThreshold} onChange={(e) => setSettings((s) => ({ ...s, payoutThreshold: e.target.value }))} placeholder="e.g. 50.00" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Stripe Connect ID</label>
                    <input value={settings.stripeConnectId} onChange={(e) => setSettings((s) => ({ ...s, stripeConnectId: e.target.value }))} placeholder="acct_..." className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy font-mono" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={settings.taxOnboardingDone} onChange={(e) => setSettings((s) => ({ ...s, taxOnboardingDone: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-navy focus:ring-navy" />
                    <span className="text-sm text-slate-700">Tax onboarding complete (W-9/W-8)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={settings.payoutOnboardingDone} onChange={(e) => setSettings((s) => ({ ...s, payoutOnboardingDone: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-navy focus:ring-navy" />
                    <span className="text-sm text-slate-700">Payout onboarding complete</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Internal notes</label>
                  <textarea value={settings.notes} onChange={(e) => setSettings((s) => ({ ...s, notes: e.target.value }))} rows={3} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy" />
                </div>

                <button type="submit" disabled={savingSettings} className="rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-40">
                  {savingSettings ? "Saving…" : "Save settings"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ── Right: status + overview ─────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Status management */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <p className="text-sm font-bold text-slate-800">Status</p>
            <div className="flex flex-wrap gap-2">
              {(["PENDING", "ACTIVE", "ON_HOLD", "SUSPENDED", "REVOKED", "CLOSED"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setNewStatus(newStatus === s ? "" : s)}
                  disabled={affiliate.status === s}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-30 ${newStatus === s ? "border-navy bg-navy text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  {s.replace("_", " ")}
                </button>
              ))}
            </div>
            {newStatus && (
              <div className="space-y-2 pt-1">
                {(newStatus === "SUSPENDED" || newStatus === "REVOKED") && (
                  <input
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Reason (optional)"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                  />
                )}
                <button
                  onClick={handleStatusChange}
                  disabled={changingStatus}
                  className="w-full rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90 disabled:opacity-40"
                >
                  {changingStatus ? "Updating…" : `Set to ${newStatus.replace("_", " ")}`}
                </button>
              </div>
            )}
          </div>

          {/* Onboarding checklist */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
            <p className="text-sm font-bold text-slate-800">Onboarding status</p>
            <div className="space-y-2 text-sm">
              {[
                { label: "Application accepted", done: true },
                { label: "Affiliate provisioned", done: true },
                { label: "Commission rule set", done: affiliate.commissionRules.some((r) => r.active) },
                { label: "Promo code created", done: affiliate.promoCodes.length > 0 },
                { label: "Tax onboarding (W-9)", done: affiliate.taxOnboardingDone },
                { label: "Payout onboarding", done: affiliate.payoutOnboardingDone },
                { label: "Activated", done: affiliate.status === "ACTIVE" },
              ].map(({ label, done }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span className={`h-4 w-4 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-green-500" : "bg-slate-200"}`}>
                    {done && (
                      <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className={done ? "text-slate-700" : "text-slate-400"}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Metadata */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-400 space-y-1">
            <div className="flex justify-between"><span>Attribution window</span><span>{affiliate.attributionWindowDays}d</span></div>
            <div className="flex justify-between"><span>Payout cycle</span><span>{affiliate.payoutCycle}</span></div>
            {affiliate.payoutThreshold && <div className="flex justify-between"><span>Payout threshold</span><span>{fmt(affiliate.payoutThreshold)}</span></div>}
            <div className="flex justify-between"><span>Assigned by</span><span className="truncate max-w-[130px]">{affiliate.assignedBy}</span></div>
            <div className="flex justify-between"><span>Created</span><span>{new Date(affiliate.createdAt).toLocaleDateString()}</span></div>
            {affiliate.activatedAt && <div className="flex justify-between"><span>Activated</span><span>{new Date(affiliate.activatedAt).toLocaleDateString()}</span></div>}
          </div>
        </div>
      </div>
    </div>
  );
};

AffiliateDetailPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return {
      redirect: {
        destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  const { id } = context.params as { id: string };

  const affiliate = await db.affiliateAssignment.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      application: { select: { id: true, name: true, email: true, type: true, status: true } },
      promoCodes: { orderBy: { createdAt: "desc" } },
      commissionRules: { orderBy: { createdAt: "asc" } },
      ledgerEntries: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!affiliate) return { notFound: true };

  return {
    props: { affiliate: JSON.parse(JSON.stringify(affiliate)) },
  };
};

export default AffiliateDetailPage;
