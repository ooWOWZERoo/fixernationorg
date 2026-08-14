import Head from "next/head";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const PrivacyPage: NextPageWithLayout = () => {
  return (
    <>
      <Head>
        <title>Privacy Policy — Fixer Nation</title>
        <meta name="description" content="How Fixer Nation collects, uses, and protects your personal information." />
      </Head>

      <div className="mx-auto max-w-[760px] px-6 py-16 lg:px-8">
        <div className="mb-10">
          <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-ink-soft">Legal</span>
          <h1 className="mt-2 text-4xl font-extrabold text-navy">Privacy policy</h1>
          <p className="mt-3 text-sm text-ink-soft">Last updated: August 13, 2026</p>
        </div>

        <div className="prose-legal">
          <p>
            Fixer Nation Issues and Answers ("Fixer Nation," "we," "us," or "our") operates
            fixernation.org. This page explains what information we collect when you use the
            site, why we collect it, and what rights you have over it. We keep this as short
            and plain as we can.
          </p>

          <h2>What we collect</h2>
          <p>
            When you create an account, we collect your name and email address. If you purchase
            a membership or product, we collect your billing details through Stripe (our payment
            processor). We never see or store your full credit card number.
          </p>
          <p>
            When you use the site, we collect basic usage data — pages visited, features used,
            and general device/browser information. We use PostHog for this analytics. We also
            collect any content you submit directly, such as questions sent to Ask The Fixer,
            posts made on FN Network, or messages sent to other members.
          </p>

          <h2>How we use it</h2>
          <p>
            We use your information to run the service: process your account, deliver membership
            content (Morning Boost, blog, community features), send transactional emails (receipts,
            password resets, email verification), and respond to questions you submit.
          </p>
          <p>
            If you opt in to marketing emails, we may send you updates about new content and
            offers. You can unsubscribe at any time using the link in any email we send.
          </p>
          <p>
            We use aggregated, anonymized usage data to understand how people use the site and
            where we can improve it. This data is not tied to your identity.
          </p>

          <h2>Who we share it with</h2>
          <p>
            We do not sell your personal information. We share data only with third-party
            services that help us operate the site:
          </p>
          <ul>
            <li><strong>Stripe</strong> — payment processing. Subject to Stripe's privacy policy.</li>
            <li><strong>Postmark</strong> — transactional and notification emails.</li>
            <li><strong>PostHog</strong> — product analytics (anonymized usage data).</li>
            <li><strong>Neon</strong> — managed PostgreSQL database hosting.</li>
            <li><strong>Vercel</strong> — web hosting and deployment infrastructure.</li>
            <li><strong>Cloudflare R2</strong> — file storage for uploaded images.</li>
          </ul>
          <p>
            Each of these providers processes data only as needed to provide their service to us
            and is bound by appropriate data protection agreements.
          </p>
          <p>
            We may disclose information if required by law or to protect the safety and security
            of our users or the platform.
          </p>

          <h2>Cookies</h2>
          <p>
            We use cookies to keep you signed in and to collect anonymous analytics data. See our{" "}
            <Link href="/cookie-policy">Cookie Policy</Link> for details.
          </p>

          <h2>Data retention</h2>
          <p>
            We keep your account data for as long as your account is active. If you delete your
            account, we remove your personal information within 30 days, except where we are
            required to keep it longer for legal or financial record-keeping purposes.
          </p>

          <h2>Your rights</h2>
          <p>
            You can access, correct, or delete your personal data at any time by visiting your{" "}
            <Link href="/account">account settings</Link> or by emailing us. If you are in the
            European Economic Area or California, you have additional rights under GDPR and CCPA
            respectively, including the right to data portability and the right to object to
            certain processing. To exercise these rights, contact us directly.
          </p>

          <h2>Children</h2>
          <p>
            Fixer Nation is intended for users 18 years of age and older. We do not knowingly
            collect personal information from anyone under 18. If you believe a child under 18
            has created an account, contact us and we will remove it.
          </p>

          <h2>Changes to this policy</h2>
          <p>
            We may update this policy from time to time. When we make material changes, we will
            update the "Last updated" date at the top of this page and, where appropriate, notify
            you by email. Continued use of the site after changes take effect means you accept
            the updated policy.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about this policy? Email us at{" "}
            <a href="mailto:privacy@fixernation.org">privacy@fixernation.org</a>.
          </p>
        </div>

        <div className="mt-12 flex flex-wrap gap-5 border-t border-navy/10 pt-8 text-sm">
          <Link href="/terms" className="font-semibold text-navy hover:underline">Terms of service</Link>
          <Link href="/cookie-policy" className="font-semibold text-navy hover:underline">Cookie policy</Link>
        </div>
      </div>
    </>
  );
};

PrivacyPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export default PrivacyPage;
