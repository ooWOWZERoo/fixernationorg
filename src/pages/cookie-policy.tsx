import Head from "next/head";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const CookiePolicyPage: NextPageWithLayout = () => {
  return (
    <>
      <Head>
        <title>Cookie Policy — Fixer Nation</title>
        <meta name="description" content="What cookies Fixer Nation uses and how to control them." />
      </Head>

      <div className="mx-auto max-w-[760px] px-6 py-16 lg:px-8">
        <div className="mb-10">
          <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-ink-soft">Legal</span>
          <h1 className="mt-2 text-4xl font-extrabold text-navy">Cookie policy</h1>
          <p className="mt-3 text-sm text-ink-soft">Last updated: August 13, 2026</p>
        </div>

        <div className="prose-legal">
          <p>
            Cookies are small text files that a website stores on your device when you visit.
            This page explains what cookies fixernation.org uses, why, and how you can control
            them.
          </p>

          <h2>Cookies we use</h2>

          <h3>Session cookies (required)</h3>
          <p>
            We use a session cookie to keep you signed in while you browse. Without it, you
            would be logged out every time you navigate to a new page. This cookie is set by
            next-auth, our authentication library, and is deleted when you sign out or close
            your browser (depending on your browser settings).
          </p>
          <p>
            We also set a short-lived CSRF token cookie used to protect forms from cross-site
            request forgery attacks.
          </p>
          <p>
            These cookies are strictly necessary to run the site. You cannot opt out of them
            and continue using features that require an account.
          </p>

          <h3>Analytics cookies (optional)</h3>
          <p>
            We use PostHog to understand how people use Fixer Nation: which pages get visited,
            where people drop off, and what features get used. PostHog sets a cookie that
            assigns your browser a random ID so it can count unique visits without identifying
            you personally. The data is aggregated and anonymous as far as we are concerned.
          </p>
          <p>
            PostHog offers its own opt-out mechanism. If you prefer not to be tracked, you can
            also use a browser extension like uBlock Origin or Privacy Badger, which will block
            the PostHog script entirely.
          </p>

          <h3>Stripe cookies (payments only)</h3>
          <p>
            When you go through the checkout process, Stripe sets cookies to detect fraud and
            keep your checkout session intact. These cookies are only active during the payment
            flow and are governed by{" "}
            <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
              Stripe's privacy policy
            </a>
            .
          </p>

          <h2>What we do not do</h2>
          <p>
            We do not use advertising cookies, retargeting pixels, or third-party tracking
            networks. We do not sell cookie data or share it with advertisers.
          </p>

          <h2>How to control cookies</h2>
          <p>
            All major browsers let you view, delete, and block cookies in their settings. Keep
            in mind that blocking session cookies will prevent you from signing in. Here are
            direct links to cookie settings for common browsers:
          </p>
          <ul>
            <li>
              <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">
                Google Chrome
              </a>
            </li>
            <li>
              <a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer">
                Mozilla Firefox
              </a>
            </li>
            <li>
              <a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer">
                Apple Safari
              </a>
            </li>
            <li>
              <a href="https://support.microsoft.com/en-us/windows/delete-and-manage-cookies" target="_blank" rel="noopener noreferrer">
                Microsoft Edge
              </a>
            </li>
          </ul>

          <h2>Changes to this policy</h2>
          <p>
            If we start using new cookies or change how we use existing ones, we will update
            this page and the "Last updated" date above.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about cookies? Email us at{" "}
            <a href="mailto:privacy@fixernation.org">privacy@fixernation.org</a>.
          </p>
        </div>

        <div className="mt-12 flex flex-wrap gap-5 border-t border-navy/10 pt-8 text-sm">
          <Link href="/privacy" className="font-semibold text-navy hover:underline">Privacy policy</Link>
          <Link href="/terms" className="font-semibold text-navy hover:underline">Terms of service</Link>
        </div>
      </div>
    </>
  );
};

CookiePolicyPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export default CookiePolicyPage;
