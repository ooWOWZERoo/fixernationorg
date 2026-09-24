import Link from "next/link";
import { useState } from "react";

export interface PromoCodeData {
  id: string;
  code: string;
  status: string;
  discountType: string;
  discountValue: number;
  usedCount: number;
  maxUses: number | null;
}

export interface TerritoryAssignmentData {
  id: string;
  status: string;
  territory: {
    name: string;
    type: string;
    scope: string;
    county: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    region: string | null;
    isExclusive: boolean;
  };
}

export interface CommissionRuleData {
  id: string;
  name: string;
  rate: number;
  appliesTo: string | null;
  active: boolean;
}

interface Props {
  promoCodes: PromoCodeData[];
  territoryAssignments: TerritoryAssignmentData[];
  commissionRules: CommissionRuleData[];
  siteUrl: string;
  // Providers have no commissions ledger view (see COMMISSION_ROLES in
  // src/pages/api/account/commissions.ts) — omit the link there.
  showCommissionsLink?: boolean;
}

function discountLabel(code: PromoCodeData): string {
  return code.discountType === "FLAT" ? `$${code.discountValue} off` : `${code.discountValue}% off`;
}

function territoryLocation(t: TerritoryAssignmentData["territory"]): string {
  return t.region || t.city || t.county || t.state || "Unspecified area";
}

function formatRate(rate: number): string {
  const pct = rate * 100;
  return (Number.isInteger(pct) ? pct.toFixed(0) : pct.toFixed(2)) + "%";
}

export function AffiliateSnapshotSections({
  promoCodes,
  territoryAssignments,
  commissionRules,
  siteUrl,
  showCommissionsLink = true,
}: Props) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  async function copyLink(code: string) {
    const url = `${siteUrl}/join?promo=${code}`;
    await navigator.clipboard.writeText(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 2000);
  }

  const activeRules = commissionRules.filter((r) => r.active);

  return (
    <>
      {/* Promo codes */}
      <div className="mt-5 rounded-2xl border border-navy/8 bg-white p-6">
        <h2 className="mb-1 text-base font-extrabold text-navy">
          Your promo code{promoCodes.length === 1 ? "" : "s"}
        </h2>
        <p className="mb-4 text-sm text-ink-soft">
          Share this when you tell people about Fixer Nation. Anyone who signs up with it gets the discount, and it's tracked back to you.
        </p>
        {promoCodes.length === 0 && <p className="text-sm text-ink-soft">No promo codes assigned yet.</p>}
        <div className="space-y-4">
          {promoCodes.map((pc) => {
            const shareUrl = `${siteUrl}/join?promo=${pc.code}`;
            return (
              <div key={pc.id} className="rounded-xl border border-navy/10 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-navy">{pc.code}</span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{pc.status}</span>
                </div>
                <p className="mt-1 text-sm text-ink">
                  {discountLabel(pc)}
                  {pc.maxUses ? ` · ${pc.usedCount}/${pc.maxUses} used` : ` · ${pc.usedCount} used`}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="flex-1 truncate rounded-lg bg-cream-panel px-3 py-2 text-sm font-mono text-navy">
                    {shareUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyLink(pc.code)}
                    className="shrink-0 rounded-lg border border-navy/15 px-4 py-2 text-sm font-semibold text-navy hover:bg-cream-panel transition-colors"
                  >
                    {copiedCode === pc.code ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Territory assignment */}
      <div className="mt-5 rounded-2xl border border-navy/8 bg-white p-6">
        <h2 className="mb-1 text-base font-extrabold text-navy">Your assigned territory</h2>
        <p className="mb-4 text-sm text-ink-soft">
          The territory assigned to you by Fixer Nation, separate from any area you describe yourself above.
        </p>
        {territoryAssignments.length === 0 && <p className="text-sm text-ink-soft">No territory assigned.</p>}
        <div className="space-y-3">
          {territoryAssignments.map((ta) => (
            <div key={ta.id} className="rounded-xl border border-navy/10 p-4">
              <p className="text-sm font-semibold text-navy">{ta.territory.name}</p>
              <p className="text-sm text-ink-soft">
                {territoryLocation(ta.territory)} · {ta.territory.isExclusive ? "Exclusive" : "Shared"}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Commission rate */}
      <div className="mt-5 rounded-2xl border border-navy/8 bg-white p-6">
        <h2 className="mb-1 text-base font-extrabold text-navy">Your commission rate</h2>
        {activeRules.length === 0 && <p className="mt-3 text-sm text-ink-soft">No active commission rules yet.</p>}
        {activeRules.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {activeRules.map((r) => (
              <li key={r.id} className="text-sm text-ink">
                You earn {formatRate(r.rate)} on {r.appliesTo ?? "all products"}.
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCommissionsLink && (
        <p className="mt-6 text-sm text-ink-soft">
          Want to see what you've earned?{" "}
          <Link href="/account/commissions" className="font-semibold text-navy">
            View your commissions ledger
          </Link>
          .
        </p>
      )}
    </>
  );
}
