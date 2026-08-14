import Head from "next/head";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const TermsPage: NextPageWithLayout = () => {
  return (
    <>
      <Head>
        <title>Terms of Service — Fixer Nation</title>
        <meta name="description" content="The terms that govern your use of Fixer Nation." />
      </Head>

      <div className="mx-auto max-w-[760px] px-6 py-16 lg:px-8">
        <div className="mb-10">
          <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-ink-soft">Legal</span>
          <h1 className="mt-2 text-4xl font-extrabold text-navy">Terms of service</h1>
          <p className="mt-3 text-sm text-ink-soft">Last updated: August 13, 2026</p>
        </div>

        <div className="prose-legal">
          <p>
            These terms govern your use of fixernation.org and any services offered by Fixer
            Nation Issues and Answers ("Fixer Nation," "we," "us," or "our"). By using the site,
            you agree to these terms. If you do not agree, do not use the site.
          </p>

          <h2>Your account</h2>
          <p>
            You must be at least 18 years old to create an account. You are responsible for
            keeping your password secure and for all activity that happens under your account.
            If you suspect unauthorized access, contact us immediately.
          </p>
          <p>
            You agree to provide accurate information when creating your account and to keep it
            up to date. We may suspend or terminate accounts that contain false information or
            that violate these terms.
          </p>

          <h2>Membership and billing</h2>
          <p>
            Some content and features on Fixer Nation require a paid membership. Membership fees
            are charged at the rate displayed at signup. All payments are processed securely
            through Stripe.
          </p>
          <p>
            Memberships renew automatically at the end of each billing period unless you cancel
            before the renewal date. You can cancel at any time from your account settings. After
            cancellation, your membership remains active through the end of the period you already
            paid for. We do not offer prorated refunds for partial periods except where required
            by law.
          </p>
          <p>
            We reserve the right to change membership pricing. We will give you at least 30 days'
            notice of any price increase before it affects your account.
          </p>

          <h2>Books and one-time purchases</h2>
          <p>
            Physical book orders are final. Digital purchases are non-refundable once delivered.
            If you receive a damaged or incorrect item, contact us and we will make it right.
          </p>

          <h2>Content you post</h2>
          <p>
            When you post content on Fixer Nation (questions to Ask The Fixer, posts on FN
            Network, profile information, etc.), you keep ownership of that content. You grant
            us a non-exclusive license to display, store, and distribute it as part of operating
            the service.
          </p>
          <p>
            You are responsible for what you post. You agree not to post content that:
          </p>
          <ul>
            <li>Is false, deceptive, or designed to mislead others</li>
            <li>Harasses, threatens, or targets another person</li>
            <li>Infringes on someone else's copyright or intellectual property</li>
            <li>Contains spam, malware, or unsolicited promotions</li>
            <li>Violates any applicable law</li>
          </ul>
          <p>
            We may remove content that violates these rules and suspend or ban accounts that
            repeatedly break them.
          </p>

          <h2>Our content</h2>
          <p>
            All content published by Fixer Nation, including Morning Boost entries, blog posts,
            books, course materials, and site design, is owned by Fixer Nation Issues and Answers
            or its content contributors. You may not reproduce, redistribute, or commercially use
            this content without our written permission.
          </p>

          <h2>Acceptable use</h2>
          <p>
            You agree to use Fixer Nation only for lawful purposes. You may not attempt to gain
            unauthorized access to any part of the site, interfere with its operation, scrape or
            bulk-download content, or use automated tools to interact with the site without our
            permission.
          </p>

          <h2>Disclaimers</h2>
          <p>
            Fixer Nation provides content for informational and personal development purposes.
            Nothing on the site is professional legal, medical, financial, or psychological
            advice. You are responsible for your own decisions and their consequences.
          </p>
          <p>
            The site is provided "as is." We do not guarantee uninterrupted access or that the
            site will be free of errors.
          </p>

          <h2>Limitation of liability</h2>
          <p>
            To the extent permitted by law, Fixer Nation is not liable for any indirect,
            incidental, or consequential damages arising from your use of the site. Our total
            liability to you for any claim will not exceed the amount you paid us in the 12 months
            before the claim arose.
          </p>

          <h2>Governing law</h2>
          <p>
            These terms are governed by the laws of the State of New York, without regard to
            conflict of law principles. Any disputes will be resolved in the courts of New York.
          </p>

          <h2>Changes to these terms</h2>
          <p>
            We may update these terms. When we do, we will update the "Last updated" date and,
            for material changes, notify you by email. Continued use of the site after changes
            take effect means you accept the updated terms.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these terms? Email us at{" "}
            <a href="mailto:legal@fixernation.org">legal@fixernation.org</a>.
          </p>
        </div>

        <div className="mt-12 flex flex-wrap gap-5 border-t border-navy/10 pt-8 text-sm">
          <Link href="/privacy" className="font-semibold text-navy hover:underline">Privacy policy</Link>
          <Link href="/cookie-policy" className="font-semibold text-navy hover:underline">Cookie policy</Link>
        </div>
      </div>
    </>
  );
};

TermsPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export default TermsPage;
