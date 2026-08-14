import Head from "next/head";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const ServerErrorPage: NextPageWithLayout = () => {
  return (
    <>
      <Head>
        <title>Something went wrong — Fixer Nation</title>
      </Head>
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center">
        <p className="mb-3 text-sm font-bold uppercase tracking-widest text-amber-dark">500</p>
        <h1 className="mb-3 text-3xl font-extrabold text-navy">Something went wrong on our end</h1>
        <p className="mb-8 max-w-sm text-muted">
          We hit an unexpected error. It's not you. Try refreshing, or head back home and give it another shot.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl border border-navy/20 px-6 py-3 text-sm font-bold text-navy transition hover:bg-cream-panel"
          >
            Refresh page
          </button>
          <Link
            href="/"
            className="rounded-xl bg-navy px-6 py-3 text-sm font-bold text-white no-underline transition hover:-translate-y-0.5 hover:bg-navy-dark"
          >
            Back to home
          </Link>
        </div>
      </div>
    </>
  );
};

ServerErrorPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default ServerErrorPage;
