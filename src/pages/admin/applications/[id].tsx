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
  accountInviteToken: string | null;
  accountInviteExpiresAt: string | null;
  accountInviteSentAt: string | null;
  providerDetail: ProviderDetail | null;
  ambassadorDetail: AmbassadorDetail | null;
  territoryAssignments: TerritoryAssignmentRow[];
};

type AppEvent = {
  id: string;
  type: string;
  actor: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

type PriorApplication = {
  id: string;
  type: string;
  status: string;
  submittedAt: string | null;
  createdAt: string;
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
  stripeCheckoutSessionId: string | null;
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

type ChecklistItemRow = { key: string; status: string };

interface Props {
  application: Application;
  availableTerritories: TerritoryOption[];
  affiliateAssignment: AffiliateSnippet | null;
  onboardingRecord: OnboardingRecord | null;
  checklistItems: ChecklistItemRow[];
  priorApplications: PriorApplication[];
  events: AppEvent[];
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

type ChecklistDef = { key: string; label: string };

const PROVIDER_CHECKLIST: ChecklistDef[] = [
  { key: "identity", label: "Identity reviewed" },
  { key: "business", label: "Business reviewed" },
  { key: "category", label: "Provider category confirmed" },
  { key: "license-applicability", label: "License/certification applicability determined" },
  { key: "credential-status", label: "Credential status verified" },
  { key: "profile-content", label: "Profile content reviewed" },
  { key: "plan-tier", label: "Plan/tier selected" },
  { key: "pricing", label: "Pricing snapshot established" },
  { key: "payment-terms", label: "Payment terms determined" },
  { key: "affiliate-eligibility", label: "Affiliate eligibility determined" },
  { key: "publish-readiness", label: "Profile publish readiness confirmed" },
  { key: "activation", label: "Final activation criteria satisfied" },
];

const AMBASSADOR_CHECKLIST: ChecklistDef[] = [
  { key: "identity", label: "Identity reviewed" },
  { key: "background", label: "Background and experience reviewed" },
  { key: "territory-requested", label: "Requested territory reviewed" },
  { key: "existing-ambassadors", label: "Existing ambassadors in territory reviewed" },
  { key: "territory-rules", label: "Reserved/locked territory rules checked" },
  { key: "territory-assignment", label: "Territory assignment(s) established or deferred" },
  { key: "affiliate-assignment", label: "Affiliate assignment created" },
  { key: "referral-link", label: "Referral link/promo code provisioning prepared" },
  { key: "commission-rule", label: "Commission rule assigned" },
  { key: "tax-payout", label: "Tax/payout requirements determined" },
  { key: "plan-tier", label: "Plan/tier selected" },
  { key: "pricing-waiver", label: "Pricing/waiver established" },
  { key: "payment", label: "Payment completed or waived" },
  { key: "activation", label: "Final activation criteria satisfied" },
];

const STATUS_DOT: Record<string, string> = {
  PENDING: "bg-slate-300",
  PASSED: "bg-green-500",
  FAILED: "bg-red-500",
  NOT_APPLICABLE: "bg-slate-400",
  ADDITIONAL_DOCS_REQUIRED: "bg-amber-400",
};

const STATUS_LABEL_MAP: Record<string, string> = {
  PENDING: "Pending",
  PASSED: "Passed",
  FAILED: "Failed",
  NOT_APPLICABLE: "N/A",
  ADDITIONAL_DOCS_REQUIRED: "Docs needed",
};

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

const EVENT_DOT: Record<string, string> = {
  STATUS_CHANGED:        "border-blue-400 bg-blue-100",
  EMAIL_SENT:            "border-violet-400 bg-violet-100",
  INVITE_SENT:           "border-teal-400 bg-teal-100",
  INVITE_RESENT:         "border-teal-300 bg-teal-50",
  INVITE_REVOKED:        "border-red-300 bg-red-50",
  TERRITORY_ASSIGNED:    "border-amber-400 bg-amber-100",
  TERRITORY_REVOKED:     "border-orange-300 bg-orange-50",
  AFFILIATE_PROVISIONED: "border-green-400 bg-green-100",
  ACCOUNT_CREATED:       "border-green-500 bg-green-200",
  FIELDS_EDITED:         "border-slate-400 bg-slate-100",
};

function formatEventLabel(ev: AppEvent): string {
  const m = ev.meta ?? {};
  switch (ev.type) {
    case "STATUS_CHANGED":
      return `Status changed${m.from ? ` from ${STATUS_LABEL[m.from as string] ?? m.from}` : ""} to ${STATUS_LABEL[m.to as string] ?? m.to}`;
    case "EMAIL_SENT":
      return `Email sent${m.subject ? `: "${m.subject}"` : ""}${m.custom ? " (custom)" : ""}`;
    case "INVITE_SENT":
      return "Account invitation sent";
    case "INVITE_RESENT":
      return "Account invitation resent";
    case "INVITE_REVOKED":
      return "Account invitation revoked";
    case "TERRITORY_ASSIGNED":
      return `Territory assigned${m.territoryName ? `: ${m.territoryName}` : ""}`;
    case "TERRITORY_REVOKED":
      return `Territory revoked${m.territoryName ? `: ${m.territoryName}` : ""}`;
    case "AFFILIATE_PROVISIONED":
      return "Affiliate provisioned";
    case "ACCOUNT_CREATED":
      return "Account created via invite";
    case "FIELDS_EDITED": {
      const count = Array.isArray(m.changes) ? (m.changes as unknown[]).length : 0;
      return `${count} field${count !== 1 ? "s" : ""} edited${m.reason ? ` — ${m.reason}` : ""}`;
    }
    default:
      return ev.type.replace(/_/g, " ").toLowerCase();
  }
}

const PRICING_LABELS: Record<string, string> = {
  CURRENT: "Current price",
  QUOTED: "Quoted price",
  PROMOTIONAL: "Promotional",
  PARTIAL_DISCOUNT: "Partial discount",
  FULL_WAIVER: "Full waiver",
  TRIAL: "Trial",
  COMPLIMENTARY: "Complimentary",
};

interface SendPreviewPanelProps {
  preview: { status: string; subject: string; body: string; loading: boolean };
  onSubjectChange: (s: string) => void;
  onBodyChange: (b: string) => void;
  onSend: () => void;
  onCancel: () => void;
  sending: boolean;
}

function SendPreviewPanel({
  preview,
  onSubjectChange,
  onBodyChange,
  onSend,
  onCancel,
  sending,
}: SendPreviewPanelProps) {
  return (
    <div className="rounded-lg border border-navy/20 bg-navy/5 p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-wide text-navy">
        Review email before sending
      </p>
      {preview.loading ? (
        <p className="text-xs text-slate-400">Loading template…</p>
      ) : (
        <>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Subject</label>
            <input
              type="text"
              value={preview.subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Body</label>
            <textarea
              value={preview.body}
              onChange={(e) => onBodyChange(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy resize-y"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={onSend}
              disabled={sending}
              className="flex-1 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-dark disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send email & update status"}
            </button>
            <button
              onClick={onCancel}
              disabled={sending}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const ApplicationDetailPage: NextPageWithLayout<Props> = ({
  application: initial,
  availableTerritories,
  affiliateAssignment: initialAffiliate,
  onboardingRecord: initialOnboarding,
  checklistItems: initialChecklistItems,
  priorApplications,
  events: initialEvents,
}) => {
  const [application, setApplication] = useState(initial);
  const [reviewNotes, setReviewNotes] = useState(initial.reviewNotes ?? "");
  const [infoRequestNotes, setInfoRequestNotes] = useState(initial.infoRequestNotes ?? "");
  const [acting, setActing] = useState(false);
  const [actionResult, setActionResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [checklist, setChecklist] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialChecklistItems.map((i) => [i.key, i.status]))
  );

  function updateChecklistItem(key: string, status: string) {
    setChecklist((c) => ({ ...c, [key]: status }));
    fetch("/api/admin/checklist", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId: application.id, key, status }),
    }).catch(console.error);
  }

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
  const [generatingLink, setGeneratingLink] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string | null>(initialOnboarding?.stripePaymentLinkUrl ?? null);
  const [activating, setActivating] = useState(false);
  const [events, setEvents] = useState<AppEvent[]>(initialEvents);

  // Pre-send email preview state
  const [sendPreview, setSendPreview] = useState<{
    status: string;
    subject: string;
    body: string;
    loading: boolean;
  } | null>(null);

  // Field edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: initial.name ?? "",
    email: initial.email,
    phone: initial.phone ?? "",
    businessName: initial.businessName ?? "",
    referralCode: initial.referralCode ?? "",
    campaignSource: initial.campaignSource ?? "",
    serviceCategory: initial.providerDetail?.serviceCategory ?? "",
    serviceAreas: initial.providerDetail?.serviceAreas.join(", ") ?? "",
    businessType: initial.providerDetail?.businessType ?? "",
    licenseNumber: initial.providerDetail?.licenseNumber ?? "",
    website: initial.providerDetail?.website ?? "",
    city: initial.ambassadorDetail?.city ?? "",
    state: initial.ambassadorDetail?.state ?? "",
    platformsUsed: initial.ambassadorDetail?.platformsUsed.join(", ") ?? "",
  });
  const [editReason, setEditReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [editResult, setEditResult] = useState<{ ok: boolean; message: string } | null>(null);

  const openEditPanel = () => {
    setEditForm({
      name: application.name ?? "",
      email: application.email,
      phone: application.phone ?? "",
      businessName: application.businessName ?? "",
      referralCode: application.referralCode ?? "",
      campaignSource: application.campaignSource ?? "",
      serviceCategory: application.providerDetail?.serviceCategory ?? "",
      serviceAreas: application.providerDetail?.serviceAreas.join(", ") ?? "",
      businessType: application.providerDetail?.businessType ?? "",
      licenseNumber: application.providerDetail?.licenseNumber ?? "",
      website: application.providerDetail?.website ?? "",
      city: application.ambassadorDetail?.city ?? "",
      state: application.ambassadorDetail?.state ?? "",
      platformsUsed: application.ambassadorDetail?.platformsUsed.join(", ") ?? "",
    });
    setEditReason("");
    setEditResult(null);
    setEditOpen(true);
  };

  const saveFieldEdits = async () => {
    if (!editReason.trim()) {
      setEditResult({ ok: false, message: "A reason for the edit is required." });
      return;
    }
    setSaving(true);
    setEditResult(null);
    try {
      const payload = {
        reason: editReason.trim(),
        name: editForm.name.trim() || undefined,
        email: editForm.email.trim() || undefined,
        phone: editForm.phone.trim() || null,
        businessName: editForm.businessName.trim() || null,
        referralCode: editForm.referralCode.trim() || null,
        campaignSource: editForm.campaignSource.trim() || null,
        ...(application.providerDetail ? {
          serviceCategory: editForm.serviceCategory.trim() || null,
          serviceAreas: editForm.serviceAreas.split(",").map((s) => s.trim()).filter(Boolean),
          businessType: editForm.businessType.trim() || null,
          licenseNumber: editForm.licenseNumber.trim() || null,
          website: editForm.website.trim() || null,
        } : {}),
        ...(application.ambassadorDetail ? {
          city: editForm.city.trim() || null,
          state: editForm.state.trim() || null,
          platformsUsed: editForm.platformsUsed.split(",").map((s) => s.trim()).filter(Boolean),
        } : {}),
      };
      const res = await fetch(`/api/admin/applications/${application.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.message === "No changes detected.") {
          setEditResult({ ok: true, message: "No changes to save." });
        } else {
          setApplication((prev) => ({ ...prev, ...data }));
          setEditResult({ ok: true, message: "Fields updated." });
          setEditOpen(false);
          const newEvent: AppEvent = {
            id: `local-${Date.now()}`,
            type: "FIELDS_EDITED",
            actor: null,
            meta: {
              reason: editReason.trim(),
              changes: [],
            },
            createdAt: new Date().toISOString(),
          };
          setEvents((prev) => [newEvent, ...prev]);
        }
      } else {
        setEditResult({ ok: false, message: data.error ?? "Save failed." });
      }
    } catch {
      setEditResult({ ok: false, message: "Network error." });
    } finally {
      setSaving(false);
    }
  };

  // Account invite state
  const [inviteSentAt, setInviteSentAt] = useState<string | null>(initial.accountInviteSentAt);
  const [inviteExpiresAt, setInviteExpiresAt] = useState<string | null>(initial.accountInviteExpiresAt);
  const [inviteHasToken, setInviteHasToken] = useState<boolean>(!!initial.accountInviteToken);
  const [inviting, setInviting] = useState(false);
  const [revoking2, setRevoking2] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; message: string } | null>(null);

  const isReviewable = REVIEWABLE_FROM.has(application.status);
  const isOnboarding = ONBOARDING_STATUSES.has(application.status);
  const isActive = application.status === "ACTIVE";
  const paymentReady =
    onboarding?.paymentStatus === "COMPLETED" || onboarding?.paymentStatus === "WAIVED";
  const pd = application.providerDetail;
  const ad = application.ambassadorDetail;
  const checklistDefs = application.type === "PROVIDER" ? PROVIDER_CHECKLIST : AMBASSADOR_CHECKLIST;
  const checkedCount = Object.values(checklist).filter(
    (s) => s === "PASSED" || s === "NOT_APPLICABLE"
  ).length;

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

  const generatePaymentLink = async () => {
    setGeneratingLink(true);
    setOnboardingResult(null);
    try {
      const res = await fetch(`/api/admin/applications/payment/${application.id}`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) {
        setPaymentLink(data.url);
        setOnboarding((prev) => prev ? { ...prev, stripePaymentLinkUrl: data.url, stripeCheckoutSessionId: data.sessionId } : prev);
        setOnboardingResult({ ok: true, message: "Payment link generated." });
        // Also move app status if it changed
        if (application.status !== "PAYMENT_PENDING") {
          setApplication((prev) => ({ ...prev, status: "PAYMENT_PENDING" }));
        }
      } else {
        setOnboardingResult({ ok: false, message: data.error ?? "Failed to generate payment link." });
      }
    } catch {
      setOnboardingResult({ ok: false, message: "Network error." });
    } finally {
      setGeneratingLink(false);
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

  const act = async (status: string, customSubject?: string, customBody?: string) => {
    setActing(true);
    setActionResult(null);
    setSendPreview(null);
    try {
      const res = await fetch(`/api/admin/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reviewNotes: reviewNotes.trim() || undefined,
          infoRequestNotes: infoRequestNotes.trim() || undefined,
          customSubject: customSubject?.trim() || undefined,
          customBody: customBody?.trim() || undefined,
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

  const STATUS_TEMPLATE_KEY: Record<string, string> = {
    UNDER_REVIEW:                 "application.under_review",
    ADDITIONAL_INFO_REQUIRED:     "application.info_required",
    CONDITIONALLY_ACCEPTED:       "application.conditionally_accepted",
    ACCEPTED_ONBOARDING_REQUIRED: "application.accepted",
    DECLINED:                     "application.declined",
    REJECTED:                     "application.declined",
    ACTIVE:                       "activation.welcome",
    WITHDRAWN:                    "application.withdrawn",
  };

  const openPreview = async (status: string) => {
    const templateKey = STATUS_TEMPLATE_KEY[status];
    if (!templateKey) {
      act(status);
      return;
    }
    setSendPreview({ status, subject: "", body: "", loading: true });
    try {
      const res = await fetch(`/api/admin/message-templates/${templateKey}`);
      const data = await res.json();
      if (res.ok && data.subject) {
        const firstName = (application.name ?? "").split(" ")[0] || "there";
        const role = application.type === "PROVIDER" ? "service provider" : "brand ambassador";
        const substitute = (str: string) =>
          str
            .replace(/\{\{first_name\}\}/g, firstName)
            .replace(/\{\{role\}\}/g, role)
            .replace(/\{\{info_request_notes\}\}/g, infoRequestNotes.trim() || "(info request notes here)")
            .replace(/\{\{review_notes\}\}/g, reviewNotes.trim() || "")
            .replace(/\{\{deadline\}\}/g, "soon");
        setSendPreview({
          status,
          subject: substitute(data.subject),
          body: substitute(data.body),
          loading: false,
        });
      } else {
        // Template not found — send directly without preview
        setSendPreview(null);
        act(status);
      }
    } catch {
      setSendPreview(null);
      act(status);
    }
  };

  const sendInvite = async () => {
    setInviting(true);
    setInviteResult(null);
    try {
      const res = await fetch(`/api/admin/applications/invite/${application.id}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setInviteSentAt(data.accountInviteSentAt);
        setInviteExpiresAt(data.accountInviteExpiresAt);
        setInviteHasToken(true);
        setInviteResult({ ok: true, message: inviteHasToken ? "Invite resent." : "Invite sent." });
        setTimeout(() => setInviteResult(null), 4000);
      } else {
        setInviteResult({ ok: false, message: data.error ?? "Failed to send invite." });
      }
    } catch {
      setInviteResult({ ok: false, message: "Network error." });
    } finally {
      setInviting(false);
    }
  };

  const revokeInvite = async () => {
    setRevoking2(true);
    setInviteResult(null);
    try {
      const res = await fetch(`/api/admin/applications/invite/${application.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setInviteSentAt(null);
        setInviteExpiresAt(null);
        setInviteHasToken(false);
        setInviteResult({ ok: true, message: "Invite revoked." });
        setTimeout(() => setInviteResult(null), 3000);
      } else {
        setInviteResult({ ok: false, message: data.error ?? "Failed to revoke." });
      }
    } catch {
      setInviteResult({ ok: false, message: "Network error." });
    } finally {
      setRevoking2(false);
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

          {/* Edit fields panel */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => (editOpen ? setEditOpen(false) : openEditPanel())}
              className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50"
            >
              <span className="text-sm font-bold text-slate-800">Edit application fields</span>
              <span className="text-slate-400 text-xs">{editOpen ? "▲" : "▼"}</span>
            </button>
            {editOpen && (
              <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4">
                <p className="text-xs text-slate-500">
                  Changes are logged to the activity timeline. Email changes clear email verification.
                </p>

                {/* Contact fields */}
                <fieldset className="space-y-3">
                  <legend className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Contact</legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">Full name</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">
                        Email
                        {editForm.email !== application.email && (
                          <span className="ml-1.5 text-amber-600">(verification will be cleared)</span>
                        )}
                      </label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">Phone</label>
                      <input
                        type="text"
                        value={editForm.phone}
                        onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">Business name</label>
                      <input
                        type="text"
                        value={editForm.businessName}
                        onChange={(e) => setEditForm((f) => ({ ...f, businessName: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                      />
                    </div>
                  </div>
                </fieldset>

                {/* Attribution */}
                <fieldset className="space-y-3">
                  <legend className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Attribution</legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">Referral code</label>
                      <input
                        type="text"
                        value={editForm.referralCode}
                        onChange={(e) => setEditForm((f) => ({ ...f, referralCode: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-500">Campaign source</label>
                      <input
                        type="text"
                        value={editForm.campaignSource}
                        onChange={(e) => setEditForm((f) => ({ ...f, campaignSource: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                      />
                    </div>
                  </div>
                </fieldset>

                {/* Provider-specific fields */}
                {application.providerDetail && (
                  <fieldset className="space-y-3">
                    <legend className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Provider details</legend>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Service category</label>
                        <input
                          type="text"
                          value={editForm.serviceCategory}
                          onChange={(e) => setEditForm((f) => ({ ...f, serviceCategory: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Business type</label>
                        <input
                          type="text"
                          value={editForm.businessType}
                          onChange={(e) => setEditForm((f) => ({ ...f, businessType: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">License number</label>
                        <input
                          type="text"
                          value={editForm.licenseNumber}
                          onChange={(e) => setEditForm((f) => ({ ...f, licenseNumber: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Website</label>
                        <input
                          type="text"
                          value={editForm.website}
                          onChange={(e) => setEditForm((f) => ({ ...f, website: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Service areas <span className="font-normal text-slate-400">(comma-separated)</span></label>
                        <input
                          type="text"
                          value={editForm.serviceAreas}
                          onChange={(e) => setEditForm((f) => ({ ...f, serviceAreas: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                        />
                      </div>
                    </div>
                  </fieldset>
                )}

                {/* Ambassador-specific fields */}
                {application.ambassadorDetail && (
                  <fieldset className="space-y-3">
                    <legend className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Ambassador details</legend>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">City</label>
                        <input
                          type="text"
                          value={editForm.city}
                          onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">State</label>
                        <input
                          type="text"
                          value={editForm.state}
                          onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Platforms used <span className="font-normal text-slate-400">(comma-separated)</span></label>
                        <input
                          type="text"
                          value={editForm.platformsUsed}
                          onChange={(e) => setEditForm((f) => ({ ...f, platformsUsed: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                        />
                      </div>
                    </div>
                  </fieldset>
                )}

                {/* Reason (required) */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">
                    Reason for edit <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    rows={2}
                    placeholder="e.g. Applicant reported typo in email address"
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                  />
                </div>

                {editResult && (
                  <p className={`text-xs font-semibold ${editResult.ok ? "text-green-600" : "text-red-600"}`}>
                    {editResult.message}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={saveFieldEdits}
                    disabled={saving}
                    className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy-dark disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    onClick={() => setEditOpen(false)}
                    disabled={saving}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

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

          {/* Activity timeline */}
          <Section title={`Activity${events.length > 0 ? ` (${events.length})` : ""}`}>
            {events.length === 0 ? (
              <p className="py-2 text-sm text-slate-400">No recorded events yet.</p>
            ) : (
              <div className="space-y-0 py-1">
                {events.map((ev, i) => (
                  <div key={ev.id} className="flex gap-3">
                    {/* Timeline dot + line */}
                    <div className="flex flex-col items-center">
                      <div className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 ${EVENT_DOT[ev.type] ?? "border-slate-300 bg-white"}`} />
                      {i < events.length - 1 && <div className="w-px flex-1 bg-slate-100" />}
                    </div>
                    {/* Content */}
                    <div className="min-w-0 flex-1 pb-4">
                      <p className="text-sm font-semibold text-slate-800 leading-snug">{formatEventLabel(ev)}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {ev.actor ?? "system"} &middot;{" "}
                        {new Date(ev.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* ── Right: review panel ────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Checklist */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800">Onboarding checklist</p>
              <span className="text-xs text-slate-400">{checkedCount}/{checklistDefs.length} done</span>
            </div>
            <div className="space-y-1.5">
              {checklistDefs.map(({ key, label }) => {
                const status = checklist[key] ?? "PENDING";
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status] ?? "bg-slate-300"}`} />
                    <span className={`flex-1 text-xs leading-snug ${status === "PASSED" || status === "NOT_APPLICABLE" ? "text-slate-400" : "text-slate-700"}`}>
                      {label}
                    </span>
                    <select
                      value={status}
                      onChange={(e) => updateChecklistItem(key, e.target.value)}
                      className="shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-600 focus:border-navy focus:outline-none"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="PASSED">Passed</option>
                      <option value="FAILED">Failed</option>
                      <option value="NOT_APPLICABLE">N/A</option>
                      <option value="ADDITIONAL_DOCS_REQUIRED">Docs needed</option>
                    </select>
                  </div>
                );
              })}
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
                  onClick={() => openPreview("UNDER_REVIEW")}
                  disabled={acting || !!sendPreview || application.status === "UNDER_REVIEW"}
                  className="w-full rounded-lg border border-blue-200 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-40"
                >
                  Mark under review
                </button>
                <p className="mt-1 text-xs text-slate-400">Sends "your application is under review" email.</p>
              </div>

              {/* Info request */}
              <div className="space-y-2">
                <button
                  onClick={() => openPreview("ADDITIONAL_INFO_REQUIRED")}
                  disabled={acting || !!sendPreview || !infoRequestNotes.trim()}
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
                  onClick={() => openPreview("CONDITIONALLY_ACCEPTED")}
                  disabled={acting || !!sendPreview}
                  className="w-full rounded-lg border border-teal-200 px-4 py-2.5 text-sm font-semibold text-teal-700 transition-colors hover:bg-teal-50 disabled:opacity-40"
                >
                  Conditionally accept
                </button>
                <p className="mt-1 text-xs text-slate-400">Sends conditional acceptance email. Add review notes above to include next steps.</p>
              </div>

              {/* Accept */}
              <div>
                <button
                  onClick={() => openPreview("ACCEPTED_ONBOARDING_REQUIRED")}
                  disabled={acting || !!sendPreview}
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
                  onClick={() => openPreview("DECLINED")}
                  disabled={acting || !!sendPreview}
                  className="w-full rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
                >
                  Decline
                </button>
                <p className="mt-1 text-xs text-slate-400">Sends decline email. This cannot be undone.</p>
              </div>

              {/* Pre-send email preview panel */}
              {sendPreview && (
                <SendPreviewPanel
                  preview={sendPreview}
                  onSubjectChange={(s) => setSendPreview((p) => p ? { ...p, subject: s } : null)}
                  onBodyChange={(b) => setSendPreview((p) => p ? { ...p, body: b } : null)}
                  onSend={() => act(sendPreview.status, sendPreview.subject, sendPreview.body)}
                  onCancel={() => setSendPreview(null)}
                  sending={acting}
                />
              )}
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

              {/* Stripe payment link — only shown for paid pricing types */}
              {!["FULL_WAIVER", "COMPLIMENTARY"].includes(onboardingForm.pricingType) &&
                onboarding?.paymentStatus !== "COMPLETED" &&
                onboarding?.paymentStatus !== "WAIVED" && (
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-600">Stripe payment link</p>
                  {paymentLink ? (
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={paymentLink}
                        className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                      />
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(paymentLink)}
                        className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        Copy
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No payment link yet.</p>
                  )}
                  <button
                    type="button"
                    onClick={generatePaymentLink}
                    disabled={generatingLink || !onboarding}
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    {generatingLink
                      ? "Generating…"
                      : paymentLink
                      ? "Regenerate payment link"
                      : "Generate payment link"}
                  </button>
                  <p className="text-xs text-slate-400">Link expires after 24 hours. Save pricing before generating.</p>
                </div>
              )}

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
                  onClick={() => openPreview("ACTIVE")}
                  disabled={activating || acting || !!sendPreview || !paymentReady}
                  className="w-full rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-40"
                >
                  {activating ? "Activating…" : "Activate"}
                </button>
                <p className="text-xs text-slate-400 text-center">Marks as Active and sends welcome email.</p>

                {sendPreview && (
                  <SendPreviewPanel
                    preview={sendPreview}
                    onSubjectChange={(s) => setSendPreview((p) => p ? { ...p, subject: s } : null)}
                    onBodyChange={(b) => setSendPreview((p) => p ? { ...p, body: b } : null)}
                    onSend={() => act(sendPreview.status, sendPreview.subject, sendPreview.body)}
                    onCancel={() => setSendPreview(null)}
                    sending={acting}
                  />
                )}
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

          {/* Account invite panel — shown when accepted/onboarding but no account yet */}
          {!application.userId && isOnboarding && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <p className="text-sm font-bold text-slate-800">Account invite</p>

              {application.userId ? (
                <p className="text-xs text-green-600 font-semibold">Account linked.</p>
              ) : inviteHasToken ? (
                <div className="space-y-1">
                  <p className="text-xs text-slate-600">
                    Invite sent{" "}
                    {inviteSentAt
                      ? new Date(inviteSentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </p>
                  {inviteExpiresAt && (
                    <p className={`text-xs ${new Date(inviteExpiresAt) < new Date() ? "text-red-500 font-semibold" : "text-slate-400"}`}>
                      {new Date(inviteExpiresAt) < new Date()
                        ? "Expired — resend to issue a new link"
                        : `Expires ${new Date(inviteExpiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No invite sent yet. Send one so they can create their account.</p>
              )}

              {inviteResult && (
                <div className={`rounded-lg px-3 py-2 text-sm font-medium ${inviteResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {inviteResult.message}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  onClick={sendInvite}
                  disabled={inviting || revoking2}
                  className="w-full rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-dark disabled:opacity-40"
                >
                  {inviting ? "Sending…" : inviteHasToken ? "Resend invite" : "Send invite"}
                </button>
                {inviteHasToken && (
                  <button
                    onClick={revokeInvite}
                    disabled={inviting || revoking2}
                    className="w-full rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
                  >
                    {revoking2 ? "Revoking…" : "Revoke invite"}
                  </button>
                )}
              </div>
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

          {/* Prior application history */}
          {priorApplications.length > 0 && (
            <div className="rounded-xl border border-amber/30 bg-amber/5 p-4 space-y-2">
              <p className="text-xs font-bold text-amber-dark">Prior applications ({priorApplications.length})</p>
              {priorApplications.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide mr-1.5 ${p.type === "PROVIDER" ? "bg-navy/10 text-navy" : "bg-purple-100 text-purple-700"}`}>
                      {p.type}
                    </span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[p.status] ?? "bg-slate-100 text-slate-500"}`}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {p.submittedAt
                        ? new Date(p.submittedAt).toLocaleDateString()
                        : new Date(p.createdAt).toLocaleDateString()}
                    </span>
                    <Link
                      href={`/admin/applications/${p.id}`}
                      className="text-xs font-semibold text-navy hover:underline underline-offset-2"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              ))}
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
        events: {
          orderBy: { createdAt: "desc" },
          take: 100,
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

  const [affiliateAssignment, onboardingRecord, checklistItems, priorApplications] = await Promise.all([
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
    db.checklistItem.findMany({
      where: { applicationId: id },
      select: { key: true, status: true },
    }),
    db.userApplication.findMany({
      where: { email: application.email, id: { not: id } },
      select: { id: true, type: true, status: true, submittedAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const { events: rawEvents, ...applicationWithoutEvents } = application;

  return {
    props: {
      application: JSON.parse(JSON.stringify(applicationWithoutEvents)),
      availableTerritories: JSON.parse(JSON.stringify(availableTerritories)),
      affiliateAssignment: JSON.parse(JSON.stringify(affiliateAssignment ?? null)),
      onboardingRecord: JSON.parse(JSON.stringify(onboardingRecord ?? null)),
      checklistItems: JSON.parse(JSON.stringify(checklistItems)),
      priorApplications: JSON.parse(JSON.stringify(priorApplications)),
      events: JSON.parse(JSON.stringify(rawEvents ?? [])),
    },
  };
};

export default ApplicationDetailPage;
