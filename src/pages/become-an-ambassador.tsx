import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const DRAFT_KEY = "fn_ambassador_draft";
const TOTAL_STEPS = 6;

const STEP_TITLES = [
  "Contact info",
  "Your background",
  "Your community",
  "Why ambassador",
  "Online presence",
  "Review and sign",
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const HOW_HEARD = [
  "Friend or referral",
  "Facebook",
  "Instagram",
  "TikTok",
  "YouTube",
  "Podcast",
  "Search engine",
  "Email",
  "Event",
  "Other",
];

const AUDIENCE_SIZES = [
  "Fewer than 100",
  "100–500",
  "500–1,000",
  "1,000–5,000",
  "5,000–10,000",
  "More than 10,000",
];

const GEO_FOCUS = ["Mostly local", "Regional", "National", "International"];

const PLATFORMS = [
  "Facebook",
  "Instagram",
  "TikTok",
  "YouTube",
  "LinkedIn",
  "X (Twitter)",
  "Podcast",
  "Blog",
  "Email list",
  "Other",
];

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  referralCode: string;
  occupation: string;
  employer: string;
  howHeardAboutFN: string;
  memberSince: string;
  audienceSize: string;
  platformsUsed: string[];
  communityDescription: string;
  geographicFocus: string;
  whyJoining: string;
  missionAlignment: string;
  referralNetwork: string;
  linkedinUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  youtubeUrl: string;
  podcastUrl: string;
  blogUrl: string;
  agreedToAccuracy: boolean;
  agreedToPolicy: boolean;
  agreedToContact: boolean;
  signatureName: string;
};

const EMPTY: FormData = {
  firstName: "", lastName: "", email: "", phone: "", city: "", state: "", referralCode: "",
  occupation: "", employer: "", howHeardAboutFN: "", memberSince: "",
  audienceSize: "", platformsUsed: [], communityDescription: "", geographicFocus: "",
  whyJoining: "", missionAlignment: "", referralNetwork: "",
  linkedinUrl: "", facebookUrl: "", instagramUrl: "", tiktokUrl: "", youtubeUrl: "", podcastUrl: "", blogUrl: "",
  agreedToAccuracy: false, agreedToPolicy: false, agreedToContact: false, signatureName: "",
};

interface Props {
  prefillEmail: string;
  prefillName: string;
}

const BecomeAnAmbassadorPage: NextPageWithLayout<Props> = ({ prefillEmail, prefillName }) => {
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

  const set = (field: keyof FormData, value: string | boolean | string[]) => {
    setForm((f) => ({ ...f, [field]: value }));
    setStepError(null);
  };

  const togglePlatform = (platform: string) => {
    setForm((f) => ({
      ...f,
      platformsUsed: f.platformsUsed.includes(platform)
        ? f.platformsUsed.filter((p) => p !== platform)
        : [...f.platformsUsed, platform],
    }));
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
      const res = await fetch("/api/applications/ambassador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          city: form.city || undefined,
          state: form.state || undefined,
          referralCode: form.referralCode || undefined,
          occupation: form.occupation || undefined,
          employer: form.employer || undefined,
          howHeardAboutFN: form.howHeardAboutFN || undefined,
          memberSince: form.memberSince || undefined,
          audienceSize: form.audienceSize || undefined,
          platformsUsed: form.platformsUsed,
          communityDescription: form.communityDescription || undefined,
          geographicFocus: form.geographicFocus || undefined,
          whyJoining: form.whyJoining || undefined,
          missionAlignment: form.missionAlignment || undefined,
          referralNetwork: form.referralNetwork || undefined,
          linkedinUrl: form.linkedinUrl || undefined,
          facebookUrl: form.facebookUrl || undefined,
          instagramUrl: form.instagramUrl || undefined,
          tiktokUrl: form.tiktokUrl || undefined,
          youtubeUrl: form.youtubeUrl || undefined,
          podcastUrl: form.podcastUrl || undefined,
          blogUrl: form.blogUrl || undefined,
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
      router.push(`/apply/confirmed?type=ambassador&email=${encodeURIComponent(form.email)}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  };

  const inputEl = (field: keyof FormData, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      type="text"
      value={form[field] as string}
      onChange={(e) => set(field, e.target.value)}
      className="w-full rounded-xl border border-navy/15 px-4 py-3 text-sm text-ink placeholder-ink-soft/50 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
      {...extra}
    />
  );

  const textareaEl = (field: keyof FormData, placeholder?: string, rows = 4) => (
    <textarea
      value={form[field] as string}
      onChange={(e) => set(field, e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full resize-none rounded-xl border border-navy/15 px-4 py-3 text-sm text-ink placeholder-ink-soft/50 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
    />
  );

  const selectEl = (field: keyof FormData, options: string[], placeholder = "Select one") => (
    <select
      value={form[field] as string}
      onChange={(e) => set(field, e.target.value)}
      className="w-full rounded-xl border border-navy/15 px-4 py-3 text-sm text-ink focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy bg-white"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  const fieldEl = (label: string, required: boolean, children: React.ReactNode, hint?: string) => (
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
        {fieldEl("First name", true, inputEl("firstName", { placeholder: "Jane" }))}
        {fieldEl("Last name", true, inputEl("lastName", { placeholder: "Smith" }))}
      </div>
      {fieldEl("Email address", true, inputEl("email", { type: "email", placeholder: "jane@example.com" }))}
      {fieldEl("Phone number", true, inputEl("phone", { type: "tel", placeholder: "(555) 000-0000" }))}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {fieldEl("City", false, inputEl("city", { placeholder: "Dallas" }))}
        {fieldEl("State", false, selectEl("state", US_STATES, "Select state"))}
      </div>
      {fieldEl("Referral code", false, inputEl("referralCode", { placeholder: "Leave blank if none" }), "If a Fixer Nation ambassador referred you, enter their code.")}
    </div>,

    // Step 2 — Background
    <div key="s2" className="space-y-5">
      {fieldEl("What do you do for work?", false, inputEl("occupation", { placeholder: "Job title or occupation" }))}
      {fieldEl("Employer or organization", false, inputEl("employer", { placeholder: "Company or organization name" }))}
      {fieldEl("How did you find Fixer Nation?", false, selectEl("howHeardAboutFN", HOW_HEARD))}
      {fieldEl("Are you currently a Fixer Nation member?", false,
        inputEl("memberSince", { placeholder: "e.g. Since January 2025, or leave blank" }),
        "Optional. Tells us how well you already know the community."
      )}
    </div>,

    // Step 3 — Community
    <div key="s3" className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-semibold text-ink">Where do you connect with people? <span className="font-normal text-ink-soft">(pick all that apply)</span></label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PLATFORMS.map((p) => (
            <label key={p} className="flex cursor-pointer items-center gap-2 rounded-lg border border-navy/10 bg-cream-panel px-3 py-2.5 hover:border-navy/25">
              <input
                type="checkbox"
                checked={form.platformsUsed.includes(p)}
                onChange={() => togglePlatform(p)}
                className="h-4 w-4 shrink-0 rounded border-navy/30 text-navy focus:ring-navy"
              />
              <span className="text-sm text-ink">{p}</span>
            </label>
          ))}
        </div>
      </div>
      {fieldEl("Audience size", false, selectEl("audienceSize", AUDIENCE_SIZES, "Roughly how many people follow you across all platforms?"))}
      {fieldEl("Describe your community", false,
        textareaEl("communityDescription", "Who are the people in your network? What topics bring them together?", 4)
      )}
      {fieldEl("Geographic focus", false, selectEl("geographicFocus", GEO_FOCUS))}
    </div>,

    // Step 4 — Why ambassador
    <div key="s4" className="space-y-5">
      {fieldEl("Why do you want to represent Fixer Nation?", false,
        textareaEl("whyJoining", "Be genuine. We're looking for people who mean it.", 5)
      )}
      {fieldEl("How does Fixer Nation's mission connect with your own?", false,
        textareaEl("missionAlignment", "What is it about this community that resonates with you personally?", 4)
      )}
      {fieldEl("Who do you know that could use Fixer Nation?", false,
        textareaEl("referralNetwork", "No need to name names. Just describe who in your world would benefit.", 4)
      )}
    </div>,

    // Step 5 — Online presence
    <div key="s5" className="space-y-5">
      <p className="text-sm text-ink-soft">All links are optional. Share what's most relevant.</p>
      {fieldEl("LinkedIn", false, inputEl("linkedinUrl", { type: "url", placeholder: "https://linkedin.com/in/yourname" }))}
      {fieldEl("Facebook", false, inputEl("facebookUrl", { type: "url", placeholder: "https://facebook.com/yourpage" }))}
      {fieldEl("Instagram", false, inputEl("instagramUrl", { type: "url", placeholder: "https://instagram.com/yourhandle" }))}
      {fieldEl("TikTok", false, inputEl("tiktokUrl", { type: "url", placeholder: "https://tiktok.com/@yourhandle" }))}
      {fieldEl("YouTube", false, inputEl("youtubeUrl", { type: "url", placeholder: "https://youtube.com/@yourchannel" }))}
      {fieldEl("Podcast", false, inputEl("podcastUrl", { type: "url", placeholder: "https://yourpodcast.com" }))}
      {fieldEl("Blog or website", false, inputEl("blogUrl", { type: "url", placeholder: "https://yourblog.com" }))}
    </div>,

    // Step 6 — Review and sign
    <div key="s6" className="space-y-6">
      <div className="rounded-xl border border-navy/10 bg-cream-panel p-5 text-sm">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-soft">Reviewing your application</p>
        <dl className="space-y-2">
          <div className="flex gap-2"><dt className="w-28 shrink-0 font-semibold text-ink">Name</dt><dd className="text-ink-soft">{form.firstName} {form.lastName}</dd></div>
          <div className="flex gap-2"><dt className="w-28 shrink-0 font-semibold text-ink">Email</dt><dd className="text-ink-soft">{form.email}</dd></div>
          <div className="flex gap-2"><dt className="w-28 shrink-0 font-semibold text-ink">Phone</dt><dd className="text-ink-soft">{form.phone}</dd></div>
          {(form.city || form.state) && <div className="flex gap-2"><dt className="w-28 shrink-0 font-semibold text-ink">Location</dt><dd className="text-ink-soft">{[form.city, form.state].filter(Boolean).join(", ")}</dd></div>}
          {form.platformsUsed.length > 0 && <div className="flex gap-2"><dt className="w-28 shrink-0 font-semibold text-ink">Platforms</dt><dd className="text-ink-soft">{form.platformsUsed.join(", ")}</dd></div>}
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
          { field: "agreedToPolicy" as const, label: "I agree to Fixer Nation's community guidelines and ambassador conduct standards." },
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

      {fieldEl("Signature", true,
        inputEl("signatureName", { placeholder: "Type your full legal name" }),
        "By typing your name you're confirming this application is accurate."
      )}
    </div>,
  ];

  return (
    <>
      <Head>
        <title>Become an Ambassador — Fixer Nation</title>
        <meta name="description" content="Become a Fixer Nation Brand Ambassador. Share the mission, grow the community, and earn rewards for every member you bring in." />
      </Head>

      <section className="px-6 pb-10 pt-20 text-center lg:px-8">
        <div className="mx-auto max-w-2xl">
          <span className="eyebrow">Brand Ambassadors</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-navy lg:text-5xl">
            Help people find Fixer Nation
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">
            Ambassadors believe the mission matters. If that's you and you want to represent us, this is where you start.
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
            Questions?{" "}
            <Link href="/contact" className="font-semibold text-navy underline underline-offset-2 hover:opacity-70">
              Contact us
            </Link>
          </p>
        </div>
      </section>

      <section className="bg-navy px-6 py-14 text-center lg:px-8">
        <div className="mx-auto max-w-xl">
          <h2 className="text-2xl font-extrabold text-white">Want to be a service provider instead?</h2>
          <p className="mt-3 text-sm text-white/75">If you offer services to the people Fixer Nation serves, we have a provider program for that.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link href="/become-a-provider" className="inline-flex items-center justify-center rounded-[10px] bg-amber px-7 py-3 text-sm font-bold text-navy-dark no-underline shadow-[0_12px_24px_-10px_rgba(242,169,60,0.65)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark">
              Become a provider
            </Link>
            <Link href="/join" className="inline-flex items-center justify-center rounded-[10px] border-2 border-white/30 px-7 py-3 text-sm font-bold text-white no-underline transition-all hover:border-white/60 hover:bg-white/10">
              Join as a member
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

BecomeAnAmbassadorPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

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

export default BecomeAnAmbassadorPage;
