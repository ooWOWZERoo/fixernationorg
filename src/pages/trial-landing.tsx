import Head from "next/head";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

// Served at trial.fixernation.org via the hostname rewrite in
// src/middleware.ts -- placeholder until real campaign copy/design lands.
const TrialLandingPage: NextPageWithLayout = () => {
  return (
    <>
      <Head>
        <title>Fixer Nation</title>
        <meta name="robots" content="noindex" />
      </Head>
      <section className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-3xl font-bold text-slate-900">Campaign landing page coming soon</h1>
        <p className="mt-3 text-slate-600">This page is a placeholder for trial.fixernation.org.</p>
      </section>
    </>
  );
};

TrialLandingPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export default TrialLandingPage;
