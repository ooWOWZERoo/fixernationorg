import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const DRAFT_KEY = "fn_provider_draft";
const TOTAL_STEPS = 6;

const STEP_TITLES = [
  "Contact info",
  "Your business",
  "What you offer",
  "Your story",
  "Online presence",
  "Review and sign",
];

const SERVICE_CATEGORIES = [
  "Financial Coaching",
  "Business Coaching",
  "Legal Services",
  "Tax Services",
  "Real Estate",
  "Insurance",
  "Mental Health / Counseling",
  "Career Coaching",
  "Health & Wellness",
  "Credit Repair",
  "Debt Management",
  "Mortgage / Lending",
  "Accounting",
  "Other",
];

const BUSINESS_TYPES = [
  "Sole Proprietor",
  "LLC",
  "Corporation",
  "Partnership",
  "Non-profit",
  "Other",
];

const YEARS_OPTIONS = [
  "Less than 1 year",
  "1–2 years",
  "3–5 years",
  "6–10 years",
  "More than 10 years",
];

const PRICING_MODELS = [
  "Hourly rate",
  "Project-based",
  "Monthly retainer",
  "Free consultation",
  "Variable / negotiable",
];

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  referralCode: string;
  businessName: string;
  businessType: string;
  yearsInBusiness: string;
  website: string;
  licenseNumber: string;
  insuranceCarrier: string;
  serviceCategory: string;
  serviceDescription: string;
  serviceAreas: string;
  pricingModel: string;
  priceRange: string;
  whyJoining: string;
  targetAudience: string;
  differentiation: string;
  linkedinUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  otherSocialUrl: string;
  agreedToAccuracy: boolean;
  agreedToPolicy: boolean;
  agreedToContact: boolean;
  signatureName: string;
};

const EMPTY: FormData = {
  firstName: "", lastName: "", email: "", phone: "", referralCode: "",
  businessName: "", businessType: "", yearsInBusiness: "", website: "",
  licenseNumber: "", insuranceCarrier: "",
  serviceCategory: "", serviceDescription: "", serviceAreas: "", pricingModel: "", priceRange: "",
  whyJoining: "", targetAudience: "", differentiation: "",
  linkedinUrl: "", facebookUrl: "", instagramUrl: "", otherSocialUrl: "",
  agreedToAccuracy: false, agreedToPolicy: false, agreedToContact: false, signatureName: "",
};

interface Props {
  prefillEmail: string;
  prefillName: string;
}

const BecomeAProviderPage: NextPageWithLayout<Props> = ({ prefillEmail, prefillName }) => {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(() => ({
    ...EMPTY,
    email: prefillEmail,
    firstName: prefillName.split(" ")[0] ?? "",
    lastName: prefillName.split(" ").slice(1).join(" ") ?? "",
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FormData>;
        setForm((f) => ({ ...f, ...parsed }));
      }
    } catch {}
  }, []);

  const set = (field: keyof FormData, value: string | boolean) => {
    setForm((f) => ({ ...f, [field]: value }));
    setStepError(null);
  };

  const saveDraft = (data: FormData) => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch {}
  };

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!form.firstName.trim()) { setStepError("First name is required."); return false; }
      if (!form.lastName.trim()) { setStepError("Last name is required."); return false; }
      if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) { setStepError("A valid email address is required."); return false; }
      if (!form.phone.trim() || form.phone.trim().length < 7) { setStepError("A valid phone number is required."); return false; }
    }
    if (step === 5) {
      if (!form.signatureName.trim()) { setStepError("Type your full name to sign."); return false; }
      if (!form.agreedToAccuracy) { setStepError("Please confirm the accuracy of your information."); return false; }
      if (!form.agreedToPolicy) { setStepError("Please agree to the community guidelines."); return false; }
      if (!form.agreedToContact) { setStepError("Please agree to being contacted about your application."); return false; }
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    saveDraft(form);
    setStepError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => {
    setStepError(null);
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/applications/provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          referralCode: form.referralCode || undefined,
          businessName: form.businessName || undefined,
          businessType: form.businessType || undefined,
          yearsInBusiness: form.yearsInBusiness || undefined,
          website: form.website || undefined,
          licenseNumber: form.licenseNumber || undefined,
          insuranceCarrier: form.insuranceCarrier || undefined,
          serviceCategory: form.serviceCategory || undefined,
          serviceDescription: form.serviceDescription || undefined,
          serviceAreas: form.serviceAreas
            ? form.serviceAreas.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
          pricingModel: form.pricingModel || undefined,
          priceRange: form.priceRange || undefined,
          whyJoining: form.whyJoining || undefined,
          targetAudience: form.targetAudience || undefined,
          differentiation: form.differentiation || undefined,
          linkedinUrl: form.linkedinUrl || undefined,
          facebookUrl: form.facebookUrl || undefined,
          instagramUrl: form.instagramUrl || undefined,
          otherSocialUrl: form.otherSocialUrl || undefined,
          agreedToAccuracy: form.agreedToAccuracy,
          agreedToPolicy: form.agreedToPolicy,
          agreedToContact: form.agreedToContact,
          signatureName: form.signatureName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "REAPPLICATION_BLOCKED") {
          setError(data.message ?? "You're not eligible to reapply yet.");
        } else {
          setError(data.error ?? "Something went wrong. Please try again.");
        }
        setSubmitting(false);
        return;
      }
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      router.push(`/apply/confirmed?type=provider&email=${encodeURIComponent(form.email)}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  const input = (field: keyof FormData, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      type="text"
      value={form[field] as string}
      onChange={(e) => set(field, e.target.value)}
      className="w-full rounded-xl border border-navy/15 px-4 py-3 text-sm text-ink placeholder-ink-soft/50 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
      {...extra}
    />
  );

  const textarea = (field: keyof FormData, placeholder?: string, rows = 4) => (
    <textarea
      value={form[field] as string}
      onChange={(e) => set(field, e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full resize-none rounded-xl border border-navy/15 px-4 py-3 text-sm text-ink placeholder-ink-soft/50 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
    />
  );

  const select = (field: keyof FormData, options: string[], placeholder = "Select one") => (
    <select
      value={form[field] as string}
      onChange={(e) => set(field, e.target.value)}
      className="w-full rounded-xl border border-navy/15 px-4 py-3 text-sm text-ink focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy bg-white"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  const field = (label: string, required: boolean, children: React.ReactNode, hint?: string) => (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-ink">
        {label}{required && <span className="ml-0.5 text-coral">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
    </div>
  );

  const steps = [
    // Step 1 — Contact info
    <div key="s1" className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {field("First name", true, input("firstName", { placeholder: "Jane" }))}
        {field("Last name", true, input("lastName", { placeholder: "Smith" }))}
      </div>
      {field("Email address", true, input("email", { type: "email", placeholder: "jane@example.com" }))}
      {field("Phone number", true, input("phone", { type: "tel", placeholder: "(555) 000-0000" }))}
      {field("Referral code", false, input("referralCode", { placeholder: "Leave blank if none" }), "If someone in the Fixer Nation community referred you, enter their code here.")}
    </div>,

    // Step 2 — Business
    <div key="s2" className="space-y-5">
      {field("Business or practice name", false, input("businessName", { placeholder: "Your business name or DBA" }))}
      {field("Business type", false, select("businessType", BUSINESS_TYPES))}
      {field("Years in business", false, select("yearsInBusiness", YEARS_OPTIONS))}
      {field("Website", false, input("website", { type: "url", placeholder: "https://yoursite.com" }))}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {field("License number", false, input("licenseNumber", { placeholder: "Professional license # if applicable" }))}
        {field("Insurance carrier", false, input("insuranceCarrier", { placeholder: "Carrier name if applicable" }))}
      </div>
    </div>,

    // Step 3 — Services
    <div key="s3" className="space-y-5">
      {field("Service category", false, select("serviceCategory", SERVICE_CATEGORIES, "Choose the closest match"))}
      {field("What services do you offer?", false,
        textarea("serviceDescription", "Describe what you do, who you help, and what a typical engagement looks like.", 5),
        "Be specific. The more detail you give, the better we can match you with the right members."
      )}
      {field("Service areas", false,
        input("serviceAreas", { placeholder: "e.g. Dallas, TX; Fort Worth, TX; Online nationwide" }),
        "Cities, counties, or regions you serve. Separate multiple areas with commas. Type 'Nationwide' if you work remotely with anyone."
      )}
      {field("Pricing model", false, select("pricingModel", PRICING_MODELS))}
      {field("Price range", false, input("priceRange", { placeholder: "e.g. $150/hr or $500–$2,000 per project" }), "Optional. A rough range helps members know what to expect.")}
    </div>,

    // Step 4 — Story
    <div key="s4" className="space-y-5">
      {field("Why do you want to join the Fixer Nation provider network?", false,
        textarea("whyJoining", "What draws you to this community specifically?", 4)
      )}
      {field("Who do you typically serve?", false,
        textarea("targetAudience", "Describe the kinds of people you work with best.", 4)
      )}
      {field("What makes your approach different?", false,
        textarea("differentiation", "What do clients tell you sets you apart from others in your field?", 4)
      )}
    </div>,

    // Step 5 — Online presence
    <div key="s5" className="space-y-5">
      <p className="text-sm text-ink-soft">All social links are optional. Share what's relevant.</p>
      {field("LinkedIn", false, input("linkedinUrl", { type: "url", placeholder: "https://linkedin.com/in/yourname" }))}
      {field("Facebook", false, input("facebookUrl", { type: "url", placeholder: "https://facebook.com/yourpage" }))}
      {field("Instagram", false, input("instagramUrl", { type: "url", placeholder: "https://instagram.com/yourhandle" }))}
      {field("Other link", false, input("otherSocialUrl", { type: "url", placeholder: "Website, podcast, YouTube, etc." }))}
    </div>,

    // Step 6 — Review and sign
    <div key="s6" className="space-y-6">
      <div className="rounded-xl border border-navy/10 bg-cream-panel p-5 text-sm">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">Reviewing your application</p>
        <dl className="space-y-2">
          <div className="flex gap-2"><dt className="w-28 shrink-0 font-semibold text-ink">Name</dt><dd className="text-ink-soft">{form.firstName} {form.lastName}</dd></div>
          <div className="flex gap-2"><dt className="w-28 shrink-0 font-semibold text-ink">Email</dt><dd className="text-ink-soft">{form.email}</dd></div>
          <div className="flex gap-2"><dt className="w-28 shrink-0 font-semibold text-ink">Phone</dt><dd className="text-ink-soft">{form.phone}</dd></div>
          {form.businessName && <div className="flex gap-2"><dt className="w-28 shrink-0 font-semibold text-ink">Business</dt><dd className="text-ink-soft">{form.businessName}</dd></div>}
          {form.serviceCategory && <div className="flex gap-2"><dt className="w-28 shrink-0 font-semibold text-ink">Category</dt><dd className="text-ink-soft">{form.serviceCategory}</dd></div>}
          {form.serviceAreas && <div className="flex gap-2"><dt className="w-28 shrink-0 font-semibold text-ink">Areas</dt><dd className="text-ink-soft">{form.serviceAreas}</dd></div>}
        </dl>
        <button
          type="button"
          onClick={() => { setStep(0); window.scrollTo({ top: 0 }); }}
          className="mt-3 text-xs font-semibold text-navy underline underline-offset-2 hover:opacity-70"
        >
          Edit
        </button>
      </div>

      <div className="space-y-4">
        <p className="text-sm font-semibold text-ink">Agreements</p>
        {[
          { field: "agreedToAccuracy" as const, label: "The information in this application is accurate and complete to the best of my knowledge." },
          { field: "agreedToPolicy" as const, label: "I agree to Fixer Nation's community guidelines and provider conduct standards." },
          { field: "agreedToContact" as const, label: "I agree to be contacted by Fixer Nation about this application and related opportunities." },
        ].map(({ field: f, label }) => (
          <label key={f} className="flex cursor-pointer gap-3">
            <input
              type="checkbox"
              checked={form[f] as boolean}
              onChange={(e) => set(f, e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-navy/30 text-navy focus:ring-navy"
            />
            <span className="text-sm text-ink">{label}<span className="ml-0.5 text-coral">*</span></span>
          </label>
        ))}
      </div>

      {field("Signature", true,
        input("signatureName", { placeholder: "Type your full legal name" }),
        "By typing your name you're confirming this application is accurate."
      )}
    </div>,
  ];

  return (
    <>
      <Head>
        <title>Become a Service Provider — Fixer Nation</title>
        <meta name="description" content="Join the Fixer Nation Service Provider Network. Reach motivated clients who are already looking for the help you offer." />
      </Head>

      <section className="px-6 pb-10 pt-20 text-center lg:px-8">
        <div className="mx-auto max-w-2xl">
          <span className="eyebrow">Service Providers</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-navy lg:text-5xl">
            Put your services in front of the right people
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            Fixer Nation members are working through real challenges. They need what you offer. Apply to join the verified provider network.
          </p>
        </div>
      </section>

      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-xl">
          {/* Progress */}
          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">{STEP_TITLES[step]}</p>
              <p className="text-xs text-ink-soft">Step {step + 1} of {TOTAL_STEPS}</p>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy/10">
              <div
                className="h-full rounded-full bg-navy transition-all duration-300"
                style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-navy/10 bg-white p-8 shadow-[0_16px_34px_-22px_rgba(20,40,56,0.25)]">
            {stepError && (
              <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{stepError}</div>
            )}
            {error && (
              <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            {steps[step]}

            <div className="mt-8 flex items-center justify-between gap-4">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={back}
                  className="rounded-xl border border-navy/20 px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-navy/5"
                >
                  Back
                </button>
              ) : <div />}

              {step < TOTAL_STEPS - 1 ? (
                <button
                  type="button"
                  onClick={next}
                  className="rounded-[10px] bg-amber px-7 py-2.5 text-sm font-bold text-navy-dark shadow-[0_8px_20px_-10px_rgba(242,169,60,0.6)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="rounded-[10px] bg-amber px-7 py-2.5 text-sm font-bold text-navy-dark shadow-[0_8px_20px_-10px_rgba(242,169,60,0.6)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {submitting ? "Submitting…" : "Submit application"}
                </button>
              )}
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-ink-soft">
            Already applied or have questions?{" "}
            <Link href="/contact" className="font-semibold text-navy underline underline-offset-2 hover:opacity-70">
              Contact us
            </Link>
          </p>
        </div>
      </section>

      <section className="bg-navy px-6 py-14 text-center lg:px-8">
        <div className="mx-auto max-w-xl">
          <h2 className="text-2xl font-extrabold text-white">Not a service provider?</h2>
          <p className="mt-3 text-sm text-white/75">Members get access to the library, Morning Boost, the community, and more.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link href="/join" className="inline-flex items-center justify-center rounded-[10px] bg-amber px-7 py-3 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark">
              Join as a member
            </Link>
            <Link href="/become-an-ambassador" className="inline-flex items-center justify-center rounded-[10px] border-2 border-white/30 px-7 py-3 text-sm font-bold text-white no-underline transition-all hover:border-white/60 hover:bg-white/10">
              Become an ambassador
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

BecomeAProviderPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  const name = session?.user?.name ?? "";
  return {
    props: {
      prefillEmail: session?.user?.email ?? "",
      prefillName: name,
    },
  };
};

export default BecomeAProviderPage;
