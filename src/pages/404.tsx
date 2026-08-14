import Head from "next/head";
import Link from "next/link";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

const NotFoundPage: NextPageWithLayout = () => {
  return (
    <>
      <Head>
        <title>Page not found — Fixer Nation</title>
      </Head>
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-20 text-center">
        <p className="mb-3 text-sm font-bold uppercase tracking-widest text-amber-dark">404</p>
        <h1 className="mb-3 text-3xl font-extrabold text-navy">We can't find that page</h1>
        <p className="mb-8 max-w-sm text-muted">
          It may have moved, been removed, or the link could be wrong. Either way, it's not here.
        </p>
        <Link
          href="/"
          className="rounded-xl bg-navy px-6 py-3 text-sm font-bold text-white no-underline transition hover:-translate-y-0.5 hover:bg-navy-dark"
        >
          Back to home
        </Link>
      </div>
    </>
  );
};

NotFoundPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default NotFoundPage;
