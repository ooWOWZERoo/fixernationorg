import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const TYPE_LABEL: Record<string, string> = {
  provider: "Service Provider",
  ambassador: "Brand Ambassador",
};

const ConfirmedPage: NextPageWithLayout = () => {
  const { query } = useRouter();
  const type = typeof query.type === "string" ? query.type : "provider";
  const email = typeof query.email === "string" ? query.email : null;
  const verified = typeof query.verified === "string" ? query.verified : null;

  const label = TYPE_LABEL[type] ?? "Application";
  const isVerifySuccess = verified === "yes";
  const isAlreadyVerified = verified === "already";
  const isVerifyError = verified === "error";

  if (isVerifySuccess || isAlreadyVerified) {
    return (
      <>
        <Head>
          <title>Email confirmed — Fixer Nation</title>
        </Head>
        <section className="min-h-[60vh] px-6 py-24 text-center lg:px-8">
          <div className="mx-auto max-w-md">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h1 className="text-3xl font-extrabold text-navy">Email confirmed.</h1>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              {isAlreadyVerified
                ? "Your email was already verified. Your application is in the review queue."
                : "Your email is confirmed and your application is in our review queue."}
            </p>
            <div className="mt-8 rounded-xl border border-navy/10 bg-cream-panel p-5 text-left text-sm text-ink-soft">
              <p className="font-semibold text-ink">What happens next</p>
              <ol className="mt-3 space-y-2 pl-4 list-decimal">
                <li>We review every {label.toLowerCase()} application personally. That usually takes a few business days.</li>
                <li>We'll reach out to this email address when we have an update.</li>
                <li>If we need anything else from you, we'll let you know.</li>
              </ol>
            </div>
            <Link href="/" className="mt-8 inline-block text-sm font-bold text-navy underline underline-offset-2 hover:opacity-70">
              Back to Fixer Nation
            </Link>
          </div>
        </section>
      </>
    );
  }

  if (isVerifyError) {
    return (
      <>
        <Head>
          <title>Verification link expired — Fixer Nation</title>
        </Head>
        <section className="min-h-[60vh] px-6 py-24 text-center lg:px-8">
          <div className="mx-auto max-w-md">
            <h1 className="text-3xl font-extrabold text-navy">That link didn't work.</h1>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              The verification link may have expired or already been used. If your application is recent, check your inbox for a newer email.
            </p>
            <p className="mt-4 text-sm text-ink-soft">
              Need help?{" "}
              <Link href="/contact" className="font-semibold text-navy underline underline-offset-2 hover:opacity-70">
                Contact us
              </Link>
            </p>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Application received — Fixer Nation</title>
        <meta name="description" content="Your Fixer Nation application has been received." />
      </Head>
      <section className="min-h-[60vh] px-6 py-24 text-center lg:px-8">
        <div className="mx-auto max-w-md">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-navy/10">
            <svg className="h-8 w-8 text-navy" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-navy">Application received.</h1>
          <p className="mt-4 text-base leading-relaxed text-ink-soft">
            Your {label.toLowerCase()} application came through.
            {email && (
              <> Check <strong className="text-ink">{email}</strong> for a verification link.</>
            )}
            {!email && <> Check your inbox for a verification link.</>}
          </p>

          <div className="mt-8 rounded-xl border border-navy/10 bg-cream-panel p-5 text-left text-sm text-ink-soft">
            <p className="font-semibold text-ink">What happens next</p>
            <ol className="mt-3 space-y-2 pl-4 list-decimal">
              <li>
                <strong className="text-ink">Verify your email.</strong> Click the link we just sent you. Your application goes into the review queue once that's done.
              </li>
              <li>
                <strong className="text-ink">We review it.</strong> Every {label.toLowerCase()} application is read by a real person. We'll follow up within a few business days.
              </li>
              <li>
                <strong className="text-ink">You hear back.</strong> We'll reach out to confirm next steps — whether that's onboarding or a quick follow-up question.
              </li>
            </ol>
          </div>

          <p className="mt-6 text-sm text-ink-soft">
            Questions?{" "}
            <Link href="/contact" className="font-semibold text-navy underline underline-offset-2 hover:opacity-70">
              Contact us
            </Link>
          </p>
          <Link href="/" className="mt-4 inline-block text-sm font-bold text-navy underline underline-offset-2 hover:opacity-70">
            Back to Fixer Nation
          </Link>
        </div>
      </section>
    </>
  );
};

ConfirmedPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export default ConfirmedPage;
