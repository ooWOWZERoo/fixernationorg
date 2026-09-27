import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { StateCountySelect } from "@/components/territory/StateCountySelect";

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

export type TerritoryRequestKind = "INITIAL" | "ADD" | "CHANGE";

export interface TerritoryRequestData {
  id: string;
  requestType: TerritoryRequestKind;
  requestedState: string;
  requestedCounty: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  existingAssignmentId: string | null;
  adminNotes: string | null;
  createdAt: string;
}

interface Props {
  promoCodes: PromoCodeData[];
  territoryAssignments: TerritoryAssignmentData[];
  territoryRequests: TerritoryRequestData[];
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

const REQUEST_LABEL: Record<TerritoryRequestKind, string> = {
  INITIAL: "First territory",
  ADD: "Additional territory",
  CHANGE: "Territory change",
};

// Exact wording required by SP-74 — don't reword without checking the spec.
const SUBMITTED_TEXT =
  "Your territory request has been submitted for admin review and approval. We'll notify you when a decision is made.";

const MEMBER_LABEL_CLASS = "block text-xs font-semibold text-navy mb-1";
const MEMBER_SELECT_CLASS =
  "w-full rounded-lg border border-navy/15 px-3 py-2.5 text-sm text-ink focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy";

export function AffiliateSnapshotSections({
  promoCodes,
  territoryAssignments,
  territoryRequests,
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

  const router = useRouter();
  const activeAssignments = territoryAssignments.filter((t) => t.status === "ACTIVE");
  const pendingRequests = territoryRequests.filter((r) => r.status === "PENDING");

  // Which request form is open, if any. existingAssignmentId is set only for
  // a CHANGE, and is what tells the server which assignment to transfer.
  const [openForm, setOpenForm] = useState<{
    kind: TerritoryRequestKind;
    existingAssignmentId: string | null;
  } | null>(null);
  const [place, setPlace] = useState({ state: "", county: "" });
  const [submitting, setSubmitting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submittedKind, setSubmittedKind] = useState<TerritoryRequestKind | null>(null);

  function openRequest(kind: TerritoryRequestKind, existingAssignmentId: string | null = null) {
    setOpenForm({ kind, existingAssignmentId });
    setPlace({ state: "", county: "" });
    setRequestError(null);
    setSubmittedKind(null);
  }

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!openForm) return;
    setSubmitting(true);
    setRequestError(null);
    try {
      const res = await fetch("/api/account/territory-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestType: openForm.kind,
          requestedState: place.state,
          requestedCounty: place.county,
          existingAssignmentId: openForm.existingAssignmentId ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRequestError(data.error ?? "We couldn't submit that. Please try again.");
        return;
      }
      setSubmittedKind(openForm.kind);
      setOpenForm(null);
      setPlace({ state: "", county: "" });
      // Pull the new pending request into the list below without losing the
      // confirmation message (props update, local state survives).
      await router.replace(router.asPath, undefined, { scroll: false });
    } catch {
      setRequestError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

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

      {/* Territory assignment + requests */}
      <div className="mt-5 rounded-2xl border border-navy/8 bg-white p-6">
        <h2 className="mb-1 text-base font-extrabold text-navy">Your assigned territory</h2>
        <p className="mb-4 text-sm text-ink-soft">
          The territory assigned to you by Fixer Nation, separate from any area you describe yourself above.
        </p>

        {activeAssignments.length === 0 && (
          <p className="text-sm text-ink-soft">No territory assigned yet.</p>
        )}

        <div className="space-y-3">
          {activeAssignments.map((ta) => {
            const pendingChange = pendingRequests.find((r) => r.existingAssignmentId === ta.id);
            return (
              <div key={ta.id} className="rounded-xl border border-navy/10 p-4">
                <p className="text-sm font-semibold text-navy">{ta.territory.name}</p>
                <p className="text-sm text-ink-soft">
                  {territoryLocation(ta.territory)} · {ta.territory.isExclusive ? "Exclusive" : "Shared"}
                </p>
                {pendingChange ? (
                  <p className="mt-2 text-xs font-semibold text-amber-dark">
                    Change to {pendingChange.requestedCounty}, {pendingChange.requestedState} is with the
                    Fixer Nation team. This territory is yours until they decide.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => openRequest("CHANGE", ta.id)}
                    className="mt-3 rounded-lg border border-navy/15 px-4 py-2 text-sm font-semibold text-navy transition-colors hover:bg-cream-panel"
                  >
                    Request a change
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Pending requests that aren't a change to an existing assignment */}
        {pendingRequests.filter((r) => !r.existingAssignmentId).length > 0 && (
          <div className="mt-4 space-y-2">
            {pendingRequests
              .filter((r) => !r.existingAssignmentId)
              .map((r) => (
                <div key={r.id} className="rounded-xl border border-amber-dark/25 bg-amber/10 p-4">
                  <p className="text-sm font-semibold text-navy">
                    {r.requestedCounty}, {r.requestedState}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-dark">
                    {REQUEST_LABEL[r.requestType]} · waiting on the Fixer Nation team
                  </p>
                </div>
              ))}
          </div>
        )}

        {/* Ask for a new one */}
        {!openForm && (
          <button
            type="button"
            onClick={() => openRequest(activeAssignments.length === 0 ? "INITIAL" : "ADD")}
            className="mt-4 rounded-lg bg-navy px-5 py-2.5 text-sm font-bold text-white transition hover:bg-navy-dark"
          >
            {activeAssignments.length === 0 ? "Request a territory" : "Request another territory"}
          </button>
        )}

        {openForm && (
          <form onSubmit={submitRequest} className="mt-5 rounded-xl border border-navy/10 bg-cream-panel/40 p-5">
            <h3 className="text-sm font-extrabold text-navy">
              {openForm.kind === "CHANGE"
                ? "Where would you rather cover?"
                : openForm.kind === "ADD"
                ? "Which county do you want to add?"
                : "Which county do you want to cover?"}
            </h3>
            <p className="mt-1 mb-4 text-sm text-ink-soft">
              Pick a state, then a county. Someone on the Fixer Nation team has to approve this before it
              takes effect, and nothing changes on your account until they do.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StateCountySelect
                idPrefix={`territory-request-${openForm.existingAssignmentId ?? openForm.kind}`}
                state={place.state}
                county={place.county}
                onChange={setPlace}
                required
                disabled={submitting}
                labelClassName={MEMBER_LABEL_CLASS}
                selectClassName={MEMBER_SELECT_CLASS}
              />
            </div>

            {requestError && (
              <p className="mt-4 text-sm font-medium text-red-600">{requestError}</p>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={submitting || !place.state || !place.county}
                className="rounded-[10px] bg-navy px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-navy-dark disabled:opacity-50"
              >
                {submitting ? "Sending..." : "Submit for approval"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setOpenForm(null);
                  setRequestError(null);
                }}
                className="rounded-[10px] border border-navy/15 px-6 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-cream-panel disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {submittedKind && (
          <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-5">
            <p className="text-sm font-medium text-green-800">{SUBMITTED_TEXT}</p>
            {submittedKind === "CHANGE" && (
              <p className="mt-2 text-sm text-green-800">
                Your current territory stays in effect the whole time it's under review. If the change is
                approved, it moves over then, not before.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Commission rate */}
      <div className="mt-5 rounded-2xl border border-navy/8 bg-white p-6">
        <h2 className="mb-1 text-base font-extrabold text-navy">Your commission rate</h2>
        {activeRules.length === 0 && <p className="mt-3 text-sm text-ink-soft">No active commission rules yet.</p>}
        {activeRules.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {activeRules.map((r) => (
              <li key={r.id} className="text-sm text-ink">
                You earn {formatRate(r.rate)} on {r.appliesTo ?? "all products except Book"}.
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
