import { useState } from "react";
import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminLayout } from "@/components/layout/AdminLayout";
import type { NextPageWithLayout } from "@/types/next";

// ── types ─────────────────────────────────────────────────────────────────────

type ProviderDetail = {
  firstName: string;
  lastName: string;
  phone: string;
  businessName: string | null;
  businessType: string | null;
  yearsInBusiness: string | null;
  website: string | null;
  licenseNumber: string | null;
  insuranceCarrier: string | null;
  insuranceExpiry: string | null;
  serviceCategory: string | null;
  serviceDescription: string | null;
  serviceAreas: string[];
  pricingModel: string | null;
  priceRange: string | null;
  whyJoining: string | null;
  targetAudience: string | null;
  differentiation: string | null;
  linkedinUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  otherSocialUrl: string | null;
  agreedToAccuracy: boolean;
  agreedToPolicy: boolean;
  agreedToContact: boolean;
  signatureName: string | null;
  agreedAt: string | null;
};

type AmbassadorDetail = {
  firstName: string;
  lastName: string;
  phone: string;
  city: string | null;
  state: string | null;
  occupation: string | null;
  employer: string | null;
  howHeardAboutFN: string | null;
  memberSince: string | null;
  audienceSize: string | null;
  platformsUsed: string[];
  communityDescription: string | null;
  geographicFocus: string | null;
  whyJoining: string | null;
  missionAlignment: string | null;
  referralNetwork: string | null;
  linkedinUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tiktokUrl: string | null;
  youtubeUrl: string | null;
  podcastUrl: string | null;
  blogUrl: string | null;
  agreedToAccuracy: boolean;
  agreedToPolicy: boolean;
  agreedToContact: boolean;
  signatureName: string | null;
  agreedAt: string | null;
};

type Application = {
  id: string;
  type: "PROVIDER" | "AMBASSADOR";
  status: string;
  name: string | null;
  email: string;
  phone: string | null;
  businessName: string | null;
  message: string | null;
  userId: string | null;
  referralCode: string | null;
  campaignSource: string | null;
  submittedAt: string | null;
  emailVerifiedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  infoRequestNotes: string | null;
  createdAt: string;
  providerDetail: ProviderDetail | null;
  ambassadorDetail: AmbassadorDetail | null;
  territoryAssignments: TerritoryAssignmentRow[];
};

type OnboardingRecord = {
  id: string;
  pricingType: string;
  quotedAmount: string | null;
  finalAmount: string | null;
  discountPercent: string | null;
  paymentStatus: string;
  paidAt: string | null;
  stripePaymentLinkUrl: string | null;
  waiverReason: string | null;
  notes: string | null;
};

type AffiliateSnippet = {
  id: string;
  status: string;
  affiliateType: string;
  taxOnboardingDone: boolean;
  payoutOnboardingDone: boolean;
  activatedAt: string | null;
  createdAt: string;
};

type TerritoryOption = {
  id: string;
  name: string;
  scope: string;
  county: string | null;
  city: string | null;
  state: string | null;
  status: string;
  isExclusive: boolean;
  _count: { assignments: number };
};

type TerritoryAssignmentRow = {
  id: string;
  status: string;
  startDate: string;
  endDate: string | null;
  autoRenew: boolean;
  notes: string | null;
  assignedBy: string;
  revokedAt: string | null;
  revokedBy: string | null;
  territory: { id: string; name: string; scope: string; county: string | null; state: string | null };
};

interface Props {
  application: Application;
  availableTerritories: TerritoryOption[];
  affiliateAssignment: AffiliateSnippet | null;
  onboardingRecord: OnboardingRecord | null;
}

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber/20 text-amber-dark",
  SUBMITTED: "bg-amber/20 text-amber-dark",
  RESUBMITTED: "bg-orange-100 text-orange-700",
  UNDER_REVIEW: "bg-blue-100 text-blue-700",
  ADDITIONAL_INFO_REQUIRED: "bg-purple-100 text-purple-700",
  CONDITIONALLY_ACCEPTED: "bg-teal-100 text-teal-700",
  ACCEPTED_ONBOARDING_REQUIRED: "bg-green-100 text-green-700",
  APPROVED: "bg-green-100 text-green-700",
  ONBOARDING_IN_PROGRESS: "bg-teal-100 text-teal-700",
  ACTIVE: "bg-green-100 text-green-800",
  DECLINED: "bg-slate-100 text-slate-500",
  REJECTED: "bg-slate-100 text-slate-500",
  WITHDRAWN: "bg-slate-100 text-slate-400",
  EXPIRED: "bg-slate-100 text-slate-400",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  SUBMITTED: "Submitted",
  RESUBMITTED: "Resubmitted",
  UNDER_REVIEW: "Under review",
  ADDITIONAL_INFO_REQUIRED: "Info requested",
  CONDITIONALLY_ACCEPTED: "Conditional",
  ACCEPTED_ONBOARDING_REQUIRED: "Accepted",
  APPROVED: "Approved",
  ONBOARDING_IN_PROGRESS: "Onboarding",
  ACTIVE: "Active",
  DECLINED: "Declined",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  EXPIRED: "Expired",
};

const REVIEWABLE_FROM = new Set([
  "PENDING", "SUBMITTED", "UNDER_REVIEW",
  "ADDITIONAL_INFO_REQUIRED", "RESUBMITTED", "CONDITIONALLY_ACCEPTED",
]);

// Provider checklist items
const PROVIDER_CHECKLIST = [
  "Business name and type on file",
  "Service category matches the description",
  "Service areas are specific enough",
  "Licensing or credentials noted (if applicable)",
  "\"Why joining\" response reads as genuine",
  "Social or web presence reviewed",
  "Agreements signed with full name",
];

// Ambassador checklist items
const AMBASSADOR_CHECKLIST = [
  "Platform presence reviewed",
  "Community description is specific, not vague",
  "\"Why ambassador\" response reads as genuine",
  "Mission alignment makes sense",
  "Geographic focus is clear",
  "Agreements signed with full name",
];

// ── small helpers ─────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value?: string | null | boolean }) {
  if (value === undefined || value === null || value === "" || value === false) return null;
  const display = typeof value === "boolean" ? (value ? "Yes" : "No") : value;
  return (
    <div className="flex gap-3 py-1.5 border-b border-slate-100 last:border-0">
      <dt className="w-44 shrink-0 text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm text-slate-800 break-words">{display}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50"
      >
        <span className="text-sm font-bold text-slate-800">{title}</span>
        <span className="text-slate-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-5 pb-4 pt-2">
          <dl className="divide-y divide-slate-100">{children}</dl>
        </div>
      )}
    </div>
  );
}

function ExternalLink({ href, label }: { href?: string | null; label: string }) {
  if (!href) return null;
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-navy underline underline-offset-2 hover:opacity-70 text-sm"
    >
      {label}
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

const AFFILIATE_STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-amber/20 text-amber-dark",
  ACTIVE: "bg-green-100 text-green-700",
  ON_HOLD: "bg-blue-100 text-blue-700",
  SUSPENDED: "bg-orange-100 text-orange-700",
  REVOKED: "bg-slate-100 text-slate-500",
  CLOSED: "bg-slate-100 text-slate-400",
};

const ONBOARDING_STATUSES = new Set([
  "ACCEPTED_ONBOARDING_REQUIRED",
  "ONBOARDING_IN_PROGRESS",
  "PAYMENT_PENDING",
]);

const PRICING_LABELS: Record<string, string> = {
  CURRENT: "Current price",
  QUOTED: "Quoted price",
  PROMOTIONAL: "Promotional",
  PARTIAL_DISCOUNT: "Partial discount",
  FULL_WAIVER: "Full waiver",
  TRIAL: "Trial",
  COMPLIMENTARY: "Complimentary",
};

const ApplicationDetailPage: NextPageWithLayout<Props> = ({
  application: initial,
  availableTerritories,
  affiliateAssignment: initialAffiliate,
  onboardingRecord: initialOnboarding,
}) => {
  const [application, setApplication] = useState(initial);
  const [reviewNotes, setReviewNotes] = useState(initial.reviewNotes ?? "");
  const [infoRequestNotes, setInfoRequestNotes] = useState(initial.infoRequestNotes ?? "");
  const [acting, setActing] = useState(false);
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [checklist, setChecklist] = useState<Record<number, boolean>>({});

  // Territory assignment state
  const [selectedTerritoryId, setSelectedTerritoryId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  // Affiliate state
  const [affiliate, setAffiliate] = useState<AffiliateSnippet | null>(initialAffiliate);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionResult, setProvisionResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Onboarding record state
  const [onboarding, setOnboarding] = useState<OnboardingRecord | null>(initialOnboarding);
  const [onboardingForm, setOnboardingForm] = useState({
    pricingType: initialOnboarding?.pricingType ?? "CURRENT",
    quotedAmount: initialOnboarding?.quotedAmount ?? "",
    finalAmount: initialOnboarding?.finalAmount ?? "",
    discountPercent: initialOnboarding?.discountPercent ?? "",
    paymentStatus: initialOnboarding?.paymentStatus ?? "PENDING",
    paidAt: initialOnboarding?.paidAt ? new Date(initialOnboarding.paidAt).toISOString().slice(0, 10) : "",
    stripePaymentLinkUrl: initialOnboarding?.stripePaymentLinkUrl ?? "",
    waiverReason: initialOnboarding?.waiverReason ?? "",
    notes: initialOnboarding?.notes ?? "",
  });
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [onboardingResult, setOnboardingResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [activating, setActivating] = useState(false);

  const isReviewable = REVIEWABLE_FROM.has(application.status);
  const isOnboarding = ONBOARDING_STATUSES.has(application.status);
  const isActive = application.status === "ACTIVE";
  const paymentReady =
    onboarding?.paymentStatus === "COMPLETED" || onboarding?.paymentStatus === "WAIVED";
  const pd = application.providerDetail;
  const ad = application.ambassadorDetail;
  const checklistItems = application.type === "PROVIDER" ? PROVIDER_CHECKLIST : AMBASSADOR_CHECKLIST;
  const checkedCount = Object.values(checklist).filter(Boolean).length;

  const assignTerritory = async () => {
    if (!selectedTerritoryId) return;
    setAssigning(true);
    setAssignResult(null);
    try {
      const res = await fetch(`/api/admin/territories/${selectedTerritoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign",
          applicationId: application.id,
          notes: assignNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setApplication((prev) => ({
          ...prev,
          territoryAssignments: [data, ...prev.territoryAssignments],
        }));
        setSelectedTerritoryId("");
        setAssignNotes("");
        setAssignResult({ ok: true, message: "Territory assigned." });
        setTimeout(() => setAssignResult(null), 3000);
      } else {
        setAssignResult({ ok: false, message: data.error ?? "Assignment failed." });
      }
    } catch {
      setAssignResult({ ok: false, message: "Network error." });
    } finally {
      setAssigning(false);
    }
  };

  const revokeTerritory = async (assignmentId: string, territoryId: string) => {
    setRevoking(assignmentId);
    try {
      const res = await fetch(`/api/admin/territories/${territoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", assignmentId }),
      });
      const data = await res.json();
      if (res.ok) {
        setApplication((prev) => ({
          ...prev,
          territoryAssignments: prev.territoryAssignments.map((a) =>
            a.id === assignmentId ? { ...a, status: "REVOKED", revokedAt: data.revokedAt } : a
          ),
        }));
      }
    } finally {
      setRevoking(null);
    }
  };

  const provisionAffiliate = async () => {
    if (!application.userId) return;
    setProvisioning(true);
    setProvisionResult(null);
    try {
      const res = await fetch("/api/admin/affiliates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: application.userId,
          applicationId: application.id,
          affiliateType: application.type,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAffiliate(data);
        setProvisionResult({ ok: true, message: "Affiliate provisioned." });
        setTimeout(() => setProvisionResult(null), 3000);
      } else {
        setProvisionResult({ ok: false, message: data.error ?? "Failed to provision." });
      }
    } catch {
      setProvisionResult({ ok: false, message: "Network error." });
    } finally {
      setProvisioning(false);
    }
  };

  const saveOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOnboarding(true);
    setOnboardingResult(null);
    try {
      const body: Record<string, unknown> = {
        pricingType: onboardingForm.pricingType,
        paymentStatus: onboardingForm.paymentStatus,
      };
      if (onboardingForm.quotedAmount) body.quotedAmount = parseFloat(onboardingForm.quotedAmount as string);
      if (onboardingForm.finalAmount) body.finalAmount = parseFloat(onboardingForm.finalAmount as string);
      if (onboardingForm.discountPercent) body.discountPercent = parseFloat(onboardingForm.discountPercent as string);
      if (onboardingForm.paidAt) body.paidAt = onboardingForm.paidAt;
      if (onboardingForm.stripePaymentLinkUrl) body.stripePaymentLinkUrl = onboardingForm.stripePaymentLinkUrl.trim() || null;
      if (onboardingForm.waiverReason) body.waiverReason = onboardingForm.waiverReason.trim() || null;
      if (onboardingForm.notes) body.notes = onboardingForm.notes.trim() || null;

      const res = await fetch(`/api/admin/onboarding/${application.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        setOnboarding(data);
        setOnboardingResult({ ok: true, message: "Pricing saved." });
        setTimeout(() => setOnboardingResult(null), 3000);
      } else {
        setOnboardingResult({ ok: false, message: data.error ?? "Save failed." });
      }
    } catch {
      setOnboardingResult({ ok: false, message: "Network error." });
    } finally {
      setSavingOnboarding(false);
    }
  };

  const activate = async () => {
    setActivating(true);
    try {
      const res = await fetch(`/api/admin/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE", reviewNotes: reviewNotes.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setApplication((prev) => ({ ...prev, ...data }));
        setActionResult({ ok: true, message: "Applicant activated. Welcome email sent." });
        setTimeout(() => setActionResult(null), 5000);
      } else {
        setActionResult({ ok: false, message: data.error ?? "Activation failed." });
      }
    } catch {
      setActionResult({ ok: false, message: "Network error." });
    } finally {
      setActivating(false);
    }
  };

  const act = async (status: string) => {
    setActing(true);
    setActionResult(null);
    try {
      const res = await fetch(`/api/admin/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reviewNotes: reviewNotes.trim() || undefined,
          infoRequestNotes: infoRequestNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setApplication((prev) => ({ ...prev, ...data }));
        setActionResult({ ok: true, message: `Status updated to ${STATUS_LABEL[status] ?? status}.` });
        setTimeout(() => setActionResult(null), 4000);
      } else {
        setActionResult({ ok: false, message: data.error ?? "Something went wrong." });
      }
    } catch {
      setActionResult({ ok: false, message: "Network error. Please try again." });
    } finally {
      setActing(false);
    }
  };

  const displayName = application.name ?? application.email;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/admin/applications" className="hover:text-navy transition-colors">
          Applications
        </Link>
        <span>/</span>
        <span className="font-medium text-slate-800 truncate max-w-[24rem]">{displayName}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{displayName}</h1>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${application.type === "PROVIDER" ? "bg-navy/10 text-navy" : "bg-purple-100 text-purple-700"}`}>
              {application.type}
            </span>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[application.status] ?? "bg-slate-100 text-slate-500"}`}>
              {STATUS_LABEL[application.status] ?? application.status}
            </span>
            {application.emailVerifiedAt && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                Email verified
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-slate-400">
            <span>Submitted {application.submittedAt ? new Date(application.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</span>
            {application.reviewedBy && (
              <span>Last reviewed by {application.reviewedBy} on {new Date(application.reviewedAt!).toLocaleDateString()}</span>
            )}
            {application.referralCode && <span>Referral code: {application.referralCode}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* ── Left: application data ─────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-2">

          {/* Contact */}
          <Section title="Contact info">
            <Row label="Full name" value={application.name} />
            <Row label="Email" value={application.email} />
            <Row label="Phone" value={application.phone} />
            <Row label="Email verified" value={application.emailVerifiedAt ? `Yes — ${new Date(application.emailVerifiedAt).toLocaleDateString()}` : "Not yet"} />
            {application.userId && <Row label="Has FN account" value="Yes" />}
            {application.campaignSource && <Row label="Campaign source" value={application.campaignSource} />}
          </Section>

          {/* Provider sections */}
          {pd && (
            <>
              <Section title="Business">
                <Row label="Business name" value={pd.businessName} />
                <Row label="Business type" value={pd.businessType} />
                <Row label="Years in business" value={pd.yearsInBusiness} />
                <Row label="Website" value={pd.website ? undefined : null} />
                {pd.website && (
                  <div className="flex gap-3 py-1.5 border-b border-slate-100">
                    <dt className="w-44 shrink-0 text-xs font-semibold text-slate-500">Website</dt>
                    <dd className="text-sm"><ExternalLink href={pd.website} label={pd.website} /></dd>
                  </div>
                )}
                <Row label="License number" value={pd.licenseNumber} />
                <Row label="Insurance carrier" value={pd.insuranceCarrier} />
                <Row label="Insurance expiry" value={pd.insuranceExpiry} />
              </Section>

              <Section title="Services">
                <Row label="Category" value={pd.serviceCategory} />
                <Row label="Service areas" value={pd.serviceAreas.join(", ")} />
                <Row label="Pricing model" value={pd.pricingModel} />
                <Row label="Price range" value={pd.priceRange} />
                {pd.serviceDescription && (
                  <div className="py-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">Description</p>
                    <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{pd.serviceDescription}</p>
                  </div>
                )}
              </Section>

              <Section title="Their story">
                {pd.whyJoining && (
                  <div className="py-2 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">Why joining</p>
                    <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{pd.whyJoining}</p>
                  </div>
                )}
                {pd.targetAudience && (
                  <div className="py-2 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">Who they serve</p>
                    <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{pd.targetAudience}</p>
                  </div>
                )}
                {pd.differentiation && (
                  <div className="py-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">What makes them different</p>
                    <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{pd.differentiation}</p>
                  </div>
                )}
              </Section>

              <Section title="Online presence">
                {pd.linkedinUrl && <div className="py-1.5 border-b border-slate-100"><ExternalLink href={pd.linkedinUrl} label="LinkedIn" /></div>}
                {pd.facebookUrl && <div className="py-1.5 border-b border-slate-100"><ExternalLink href={pd.facebookUrl} label="Facebook" /></div>}
                {pd.instagramUrl && <div className="py-1.5 border-b border-slate-100"><ExternalLink href={pd.instagramUrl} label="Instagram" /></div>}
                {pd.otherSocialUrl && <div className="py-1.5"><ExternalLink href={pd.otherSocialUrl} label="Other link" /></div>}
                {!pd.linkedinUrl && !pd.facebookUrl && !pd.instagramUrl && !pd.otherSocialUrl && (
                  <p className="py-2 text-sm text-slate-400">No links provided.</p>
                )}
              </Section>

              <Section title="Agreements">
                <Row label="Accuracy confirmed" value={pd.agreedToAccuracy} />
                <Row label="Policy agreed" value={pd.agreedToPolicy} />
                <Row label="Contact agreed" value={pd.agreedToContact} />
                <Row label="Signature" value={pd.signatureName} />
                <Row label="Signed at" value={pd.agreedAt ? new Date(pd.agreedAt).toLocaleString() : null} />
              </Section>
            </>
          )}

          {/* Ambassador sections */}
          {ad && (
            <>
              <Section title="Background">
                <Row label="City / State" value={[ad.city, ad.state].filter(Boolean).join(", ") || null} />
                <Row label="Occupation" value={ad.occupation} />
                <Row label="Employer" value={ad.employer} />
                <Row label="How they found FN" value={ad.howHeardAboutFN} />
                <Row label="Member since" value={ad.memberSince} />
              </Section>

              <Section title="Their community">
                <Row label="Platforms" value={ad.platformsUsed.join(", ")} />
                <Row label="Audience size" value={ad.audienceSize} />
                <Row label="Geographic focus" value={ad.geographicFocus} />
                {ad.communityDescription && (
                  <div className="py-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">Community description</p>
                    <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{ad.communityDescription}</p>
                  </div>
                )}
              </Section>

              <Section title="Why ambassador">
                {ad.whyJoining && (
                  <div className="py-2 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">Why joining</p>
                    <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{ad.whyJoining}</p>
                  </div>
                )}
                {ad.missionAlignment && (
                  <div className="py-2 border-b border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">Mission alignment</p>
                    <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{ad.missionAlignment}</p>
                  </div>
                )}
                {ad.referralNetwork && (
                  <div className="py-2">
                    <p className="text-xs font-semibold text-slate-500 mb-1.5">Referral network</p>
                    <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{ad.referralNetwork}</p>
                  </div>
                )}
              </Section>

              <Section title="Online presence">
                {ad.linkedinUrl && <div className="py-1.5 border-b border-slate-100"><ExternalLink href={ad.linkedinUrl} label="LinkedIn" /></div>}
                {ad.facebookUrl && <div className="py-1.5 border-b border-slate-100"><ExternalLink href={ad.facebookUrl} label="Facebook" /></div>}
                {ad.instagramUrl && <div className="py-1.5 border-b border-slate-100"><ExternalLink href={ad.instagramUrl} label="Instagram" /></div>}
                {ad.tiktokUrl && <div className="py-1.5 border-b border-slate-100"><ExternalLink href={ad.tiktokUrl} label="TikTok" /></div>}
                {ad.youtubeUrl && <div className="py-1.5 border-b border-slate-100"><ExternalLink href={ad.youtubeUrl} label="YouTube" /></div>}
                {ad.podcastUrl && <div className="py-1.5 border-b border-slate-100"><ExternalLink href={ad.podcastUrl} label="Podcast" /></div>}
                {ad.blogUrl && <div className="py-1.5"><ExternalLink href={ad.blogUrl} label="Blog / Website" /></div>}
                {!ad.linkedinUrl && !ad.facebookUrl && !ad.instagramUrl && !ad.tiktokUrl && !ad.youtubeUrl && !ad.podcastUrl && !ad.blogUrl && (
                  <p className="py-2 text-sm text-slate-400">No links provided.</p>
                )}
              </Section>

              <Section title="Agreements">
                <Row label="Accuracy confirmed" value={ad.agreedToAccuracy} />
                <Row label="Policy agreed" value={ad.agreedToPolicy} />
                <Row label="Contact agreed" value={ad.agreedToContact} />
                <Row label="Signature" value={ad.signatureName} />
                <Row label="Signed at" value={ad.agreedAt ? new Date(ad.agreedAt).toLocaleString() : null} />
              </Section>
            </>
          )}

          {/* Legacy applications with no detail model */}
          {!pd && !ad && application.message && (
            <Section title="Application message">
              <p className="py-2 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">{application.message}</p>
            </Section>
          )}
        </div>

        {/* ── Right: review panel ────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Checklist */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800">Review checklist</p>
              <span className="text-xs text-slate-400">{checkedCount}/{checklistItems.length}</span>
            </div>
            <div className="space-y-2">
              {checklistItems.map((item, i) => (
                <label key={i} className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={checklist[i] ?? false}
                    onChange={(e) => setChecklist((c) => ({ ...c, [i]: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-navy focus:ring-navy"
                  />
                  <span className={`text-sm leading-snug transition-colors ${checklist[i] ? "text-slate-400 line-through" : "text-slate-700"}`}>
                    {item}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Review notes */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="mb-3 text-sm font-bold text-slate-800">Review notes</p>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes — not sent to the applicant."
              disabled={!isReviewable}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          {/* Action panel */}
          {isReviewable ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <p className="text-sm font-bold text-slate-800">Decision</p>

              {actionResult && (
                <div className={`rounded-lg px-3 py-2.5 text-sm font-medium ${actionResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {actionResult.message}
                </div>
              )}

              {/* Under review */}
              <div>
                <button
                  onClick={() => act("UNDER_REVIEW")}
                  disabled={acting || application.status === "UNDER_REVIEW"}
                  className="w-full rounded-lg border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-40"
                >
                  Mark under review
                </button>
                <p className="mt-1 text-xs text-slate-400">Sends "your application is under review" email.</p>
              </div>

              {/* Info request */}
              <div className="space-y-2">
                <button
                  onClick={() => act("ADDITIONAL_INFO_REQUIRED")}
                  disabled={acting || !infoRequestNotes.trim()}
                  className="w-full rounded-lg border border-purple-200 px-4 py-2.5 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-50 disabled:opacity-40"
                >
                  Request more info
                </button>
                <textarea
                  value={infoRequestNotes}
                  onChange={(e) => setInfoRequestNotes(e.target.value)}
                  rows={3}
                  placeholder="What do you need? This message is emailed to the applicant."
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
                <p className="text-xs text-slate-400">Required — the message above goes in the email.</p>
              </div>

              {/* Conditional */}
              <div>
                <button
                  onClick={() => act("CONDITIONALLY_ACCEPTED")}
                  disabled={acting}
                  className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-40"
                >
                  Conditionally accept
                </button>
                <p className="mt-1 text-xs text-slate-400">Sends conditional acceptance email. Add review notes above to include next steps.</p>
              </div>

              {/* Accept */}
              <div>
                <button
                  onClick={() => act("ACCEPTED_ONBOARDING_REQUIRED")}
                  disabled={acting}
                  className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-40"
                >
                  Accept
                </button>
                <p className="mt-1 text-xs text-slate-400">
                  Upgrades their account to{" "}
                  <strong>{application.type}</strong>
                  {application.userId ? "." : " when they create an account."}
                </p>
              </div>

              {/* Decline */}
              <div>
                <button
                  onClick={() => act("DECLINED")}
                  disabled={acting}
                  className="w-full rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
                >
                  Decline
                </button>
                <p className="mt-1 text-xs text-slate-400">Sends decline email. This cannot be undone.</p>
              </div>
            </div>
          ) : isOnboarding ? (
            /* ── Onboarding & payment panel ────────────────────────────────── */
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">Onboarding &amp; payment</p>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[application.status] ?? "bg-slate-100 text-slate-500"}`}>
                  {STATUS_LABEL[application.status] ?? application.status}
                </span>
              </div>

              {/* Stage quick-set */}
              <div className="flex flex-wrap gap-2">
                {(["ONBOARDING_IN_PROGRESS", "PAYMENT_PENDING"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => act(s)}
                    disabled={acting || application.status === s}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-30 ${application.status === s ? "border-navy bg-navy/10 text-navy" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    {STATUS_LABEL[s] ?? s}
                  </button>
                ))}
              </div>

              {/* Pricing form */}
              <form onSubmit={saveOnboarding} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Pricing type</label>
                  <select
                    value={onboardingForm.pricingType}
                    onChange={(e) => setOnboardingForm((f) => ({ ...f, pricingType: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                  >
                    {Object.entries(PRICING_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>

                {!["FULL_WAIVER", "COMPLIMENTARY"].includes(onboardingForm.pricingType) && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        {onboardingForm.pricingType === "PARTIAL_DISCOUNT" ? "Original $" : "Amount $"}
                      </label>
                      <input
                        type="number" min="0" step="0.01"
                        value={onboardingForm.quotedAmount as string}
                        onChange={(e) => setOnboardingForm((f) => ({ ...f, quotedAmount: e.target.value }))}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                      />
                    </div>
                    {onboardingForm.pricingType === "PARTIAL_DISCOUNT" ? (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Discount %</label>
                          <input
                            type="number" min="0" max="100" step="0.1"
                            value={onboardingForm.discountPercent as string}
                            onChange={(e) => setOnboardingForm((f) => ({ ...f, discountPercent: e.target.value }))}
                            placeholder="e.g. 25"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Final amount $</label>
                          <input
                            type="number" min="0" step="0.01"
                            value={onboardingForm.finalAmount as string}
                            onChange={(e) => setOnboardingForm((f) => ({ ...f, finalAmount: e.target.value }))}
                            placeholder="0.00"
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                          />
                        </div>
                      </>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Final amount $</label>
                        <input
                          type="number" min="0" step="0.01"
                          value={onboardingForm.finalAmount as string}
                          onChange={(e) => setOnboardingForm((f) => ({ ...f, finalAmount: e.target.value }))}
                          placeholder="= amount if same"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Payment status</label>
                  <select
                    value={onboardingForm.paymentStatus}
                    onChange={(e) => setOnboardingForm((f) => ({ ...f, paymentStatus: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="WAIVED">Waived</option>
                    <option value="FAILED">Failed</option>
                  </select>
                </div>

                {onboardingForm.paymentStatus === "COMPLETED" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Payment date</label>
                    <input
                      type="date"
                      value={onboardingForm.paidAt}
                      onChange={(e) => setOnboardingForm((f) => ({ ...f, paidAt: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                    />
                  </div>
                )}

                {onboardingForm.paymentStatus === "WAIVED" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Waiver reason</label>
                    <textarea
                      value={onboardingForm.waiverReason}
                      onChange={(e) => setOnboardingForm((f) => ({ ...f, waiverReason: e.target.value }))}
                      rows={2}
                      className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                    />
                  </div>
                )}

                {onboardingResult && (
                  <div className={`rounded-lg px-3 py-2 text-sm font-medium ${onboardingResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {onboardingResult.message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingOnboarding}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  {savingOnboarding ? "Saving…" : "Save pricing"}
                </button>
              </form>

              <div className="border-t border-slate-100 pt-3 space-y-2">
                {actionResult && (
                  <div className={`rounded-lg px-3 py-2.5 text-sm font-medium ${actionResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {actionResult.message}
                  </div>
                )}

                {application.type === "AMBASSADOR" && !affiliate && (
                  <p className="text-xs text-amber-600 font-semibold">No affiliate record yet — provision one before activating.</p>
                )}

                {!paymentReady && (
                  <p className="text-xs text-slate-400">Payment must be completed or waived before activation.</p>
                )}

                <button
                  onClick={activate}
                  disabled={activating || !paymentReady}
                  className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-40"
                >
                  {activating ? "Activating…" : "Activate"}
                </button>
                <p className="text-xs text-slate-400 text-center">Marks as Active and sends welcome email.</p>
              </div>
            </div>
          ) : isActive ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center space-y-1">
              <p className="text-sm font-bold text-green-800">Active</p>
              <p className="text-xs text-green-600">
                {application.type === "PROVIDER" ? "Service provider" : "Ambassador"} account is live.
              </p>
              {application.reviewedBy && (
                <p className="text-xs text-green-600">
                  Activated by {application.reviewedBy} on{" "}
                  {application.reviewedAt ? new Date(application.reviewedAt).toLocaleDateString() : "—"}
                </p>
              )}
              {onboarding && (
                <p className="text-xs text-green-600 pt-1">
                  {PRICING_LABELS[onboarding.pricingType] ?? onboarding.pricingType} &middot; payment {onboarding.paymentStatus.toLowerCase()}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-5 text-center">
              <p className="text-sm font-semibold text-slate-500">
                {STATUS_LABEL[application.status] ?? application.status}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Reviewed by {application.reviewedBy ?? "admin"} on{" "}
                {application.reviewedAt ? new Date(application.reviewedAt).toLocaleDateString() : "—"}
              </p>
              {application.reviewNotes && (
                <p className="mt-2 text-xs italic text-slate-500">{application.reviewNotes}</p>
              )}
            </div>
          )}

          {/* Territory assignment — ambassador only */}
          {application.type === "AMBASSADOR" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">Territory</p>
                <Link href="/admin/territories" className="text-xs font-semibold text-navy hover:underline underline-offset-2">
                  Manage territories →
                </Link>
              </div>

              {/* Current assignments */}
              {application.territoryAssignments.length > 0 && (
                <div className="space-y-2">
                  {application.territoryAssignments.map((a) => (
                    <div
                      key={a.id}
                      className={`flex items-start justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                        a.status === "ACTIVE"
                          ? "border-teal-200 bg-teal-50"
                          : "border-slate-100 bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`font-semibold truncate ${a.status === "ACTIVE" ? "text-teal-800" : "text-slate-400"}`}>
                          {a.territory.name}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {a.territory.scope}{a.territory.county ? ` · ${a.territory.county}` : ""}{a.territory.state ? `, ${a.territory.state}` : ""}
                          {" · "}Assigned {new Date(a.startDate).toLocaleDateString()}
                        </p>
                        {a.status !== "ACTIVE" && (
                          <p className="text-xs text-slate-400 capitalize">{a.status.toLowerCase()}{a.revokedAt ? ` on ${new Date(a.revokedAt).toLocaleDateString()}` : ""}</p>
                        )}
                      </div>
                      {a.status === "ACTIVE" && (
                        <button
                          onClick={() => revokeTerritory(a.id, a.territory.id)}
                          disabled={revoking === a.id}
                          className="shrink-0 rounded px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                        >
                          {revoking === a.id ? "…" : "Revoke"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Assign form */}
              {assignResult && (
                <div className={`rounded-lg px-3 py-2 text-sm font-medium ${assignResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {assignResult.message}
                </div>
              )}

              <div className="space-y-2">
                <select
                  value={selectedTerritoryId}
                  onChange={(e) => setSelectedTerritoryId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                >
                  <option value="">— select a territory —</option>
                  {availableTerritories.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}{t.state ? ` (${t.state})` : ""}{t.isExclusive ? " [exclusive]" : ""}
                      {t._count.assignments > 0 ? ` · ${t._count.assignments} assigned` : ""}
                    </option>
                  ))}
                </select>
                <input
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Assignment notes (optional)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
                <button
                  onClick={assignTerritory}
                  disabled={assigning || !selectedTerritoryId}
                  className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-40"
                >
                  {assigning ? "Assigning…" : "Assign territory"}
                </button>
              </div>

              {availableTerritories.length === 0 && (
                <p className="text-xs text-slate-400">
                  No active territories yet.{" "}
                  <Link href="/admin/territories" className="text-navy underline underline-offset-2">
                    Create one
                  </Link>{" "}
                  first.
                </p>
              )}
            </div>
          )}

          {/* Affiliate panel — ambassador only */}
          {application.type === "AMBASSADOR" && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">Affiliate</p>
                {affiliate && (
                  <Link href={`/admin/affiliates/${affiliate.id}`} className="text-xs font-semibold text-navy hover:underline underline-offset-2">
                    Manage →
                  </Link>
                )}
              </div>

              {provisionResult && (
                <div className={`rounded-lg px-3 py-2 text-sm font-medium ${provisionResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {provisionResult.message}
                </div>
              )}

              {affiliate ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Status</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${AFFILIATE_STATUS_BADGE[affiliate.status] ?? "bg-slate-100 text-slate-500"}`}>
                      {affiliate.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Tax onboarding</span>
                    <span className={affiliate.taxOnboardingDone ? "text-green-600 font-semibold" : "text-slate-400"}>
                      {affiliate.taxOnboardingDone ? "Done" : "Pending"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Payout onboarding</span>
                    <span className={affiliate.payoutOnboardingDone ? "text-green-600 font-semibold" : "text-slate-400"}>
                      {affiliate.payoutOnboardingDone ? "Done" : "Pending"}
                    </span>
                  </div>
                  {affiliate.activatedAt && (
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Activated</span>
                      <span>{new Date(affiliate.activatedAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">
                    No affiliate record yet. This is created automatically when you accept the application.
                    {application.userId ? " You can also provision it manually below." : " Requires an account."}
                  </p>
                  {application.userId && (
                    <button
                      onClick={provisionAffiliate}
                      disabled={provisioning}
                      className="w-full rounded-lg border border-purple-200 px-4 py-2.5 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-50 disabled:opacity-40"
                    >
                      {provisioning ? "Provisioning…" : "Provision affiliate manually"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Application metadata */}
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-400 space-y-1">
            <div className="flex justify-between"><span>ID</span><span className="font-mono">{application.id.slice(0, 12)}…</span></div>
            <div className="flex justify-between"><span>Created</span><span>{new Date(application.createdAt).toLocaleDateString()}</span></div>
            {!application.emailVerifiedAt && (
              <p className="pt-1 text-amber-600 font-semibold">Email not yet verified</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

ApplicationDetailPage.getLayout = (page) => <AdminLayout>{page}</AdminLayout>;

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

  const [application, availableTerritories] = await Promise.all([
    db.userApplication.findUnique({
      where: { id },
      include: {
        providerDetail: true,
        ambassadorDetail: true,
        territoryAssignments: {
          include: {
            territory: {
              select: { id: true, name: true, scope: true, county: true, state: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    db.territory.findMany({
      where: { status: { in: ["ACTIVE", "RESERVED"] } },
      include: { _count: { select: { assignments: { where: { status: "ACTIVE" } } } } },
      orderBy: [{ state: "asc" }, { name: "asc" }],
    }),
  ]);

  if (!application) {
    return { notFound: true };
  }

  const [affiliateAssignment, onboardingRecord] = await Promise.all([
    db.affiliateAssignment.findUnique({
      where: { applicationId: id },
      select: {
        id: true,
        status: true,
        affiliateType: true,
        taxOnboardingDone: true,
        payoutOnboardingDone: true,
        activatedAt: true,
        createdAt: true,
      },
    }),
    db.onboardingRecord.findUnique({
      where: { applicationId: id },
    }),
  ]);

  return {
    props: {
      application: JSON.parse(JSON.stringify(application)),
      availableTerritories: JSON.parse(JSON.stringify(availableTerritories)),
      affiliateAssignment: JSON.parse(JSON.stringify(affiliateAssignment ?? null)),
      onboardingRecord: JSON.parse(JSON.stringify(onboardingRecord ?? null)),
    },
  };
};

export default ApplicationDetailPage;
