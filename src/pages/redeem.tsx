import { useState } from "react";
import Head from "next/head";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface Props {
  isSignedIn: boolean;
}

const RedeemPage: NextPageWithLayout<Props> = ({ isSignedIn }) => {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
      setSuccess(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Redeem a gift code — Fixer Nation</title>
      </Head>
      <main className="mx-auto max-w-lg px-6 py-16 lg:px-8">
        <h1 className="mb-2 text-3xl font-extrabold text-navy">Redeem a gift code</h1>
        <p className="mb-8 text-muted">Enter your code below. It'll be applied to your account right away.</p>

        {success ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
            <p className="text-lg font-extrabold text-green-800">Done. Your account has been upgraded.</p>
            <p className="mt-2 text-sm text-green-700">Head to your dashboard to see what you now have access to.</p>
            <a
              href="/dashboard"
              className="mt-4 inline-block rounded-xl bg-navy px-5 py-2.5 text-sm font-bold text-white no-underline hover:bg-navy-dark"
            >
              Go to dashboard
            </a>
          </div>
        ) : !isSignedIn ? (
          <div className="rounded-2xl border border-navy/8 bg-white p-6">
            <p className="text-sm text-ink-soft mb-4">You need to be signed in to redeem a code.</p>
            <a
              href="/signin?callbackUrl=/redeem"
              className="inline-block rounded-xl bg-amber px-5 py-2.5 text-sm font-bold text-navy-dark no-underline shadow-[0_8px_16px_-8px_rgba(242,169,60,0.55)] hover:bg-amber-dark"
            >
              Sign in
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-navy/8 bg-white p-6">
            <label htmlFor="code" className="block text-sm font-bold text-navy mb-2">
              Gift code
            </label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. FN-ABCD-1234"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="characters"
              className="w-full rounded-xl border border-navy/15 bg-cream px-4 py-3 font-mono text-sm text-navy placeholder:text-ink-soft/50 focus:border-amber focus:outline-none focus:ring-2 focus:ring-amber/20"
            />
            {error && (
              <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="mt-4 w-full rounded-xl bg-amber py-3 text-sm font-extrabold text-navy-dark shadow-[0_8px_16px_-8px_rgba(242,169,60,0.55)] transition-all hover:-translate-y-0.5 hover:bg-amber-dark disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0"
            >
              {loading ? "Checking..." : "Redeem code"}
            </button>
          </form>
        )}
      </main>
    </>
  );
};

RedeemPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default RedeemPage;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  return { props: { isSignedIn: !!session } };
};
