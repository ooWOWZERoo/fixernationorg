import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      setDone(true);
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong.");
    }
    setLoading(false);
  }

  return (
    <>
      <Head>
        <title>Reset password — Fixer Nation</title>
      </Head>
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <Link href="/" className="text-2xl font-extrabold tracking-tight text-navy no-underline">
              Fixer Nation
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            {done ? (
              <div className="text-center">
                <p className="text-2xl">📬</p>
                <h1 className="mt-3 text-lg font-extrabold text-navy">Check your email</h1>
                <p className="mt-2 text-sm text-ink-soft">
                  If an account exists for <strong>{email}</strong>, we sent a reset link. It expires in 1 hour.
                </p>
                <Link
                  href="/signin"
                  className="mt-6 block text-sm font-semibold text-navy no-underline hover:underline"
                >
                  Back to sign in
                </Link>
              </div>
            ) : (
              <>
                <h1 className="mb-1 text-xl font-extrabold text-navy">Reset your password</h1>
                <p className="mb-6 text-sm text-ink-soft">
                  Enter your email and we'll send you a link to choose a new password.
                </p>

                {error && (
                  <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-navy" htmlFor="email">Email address</label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      required
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-[10px] bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors"
                  >
                    {loading ? "Sending…" : "Send reset link"}
                  </button>
                </form>

                <div className="mt-5 text-center text-sm">
                  <Link href="/signin" className="font-semibold text-ink-soft no-underline hover:text-navy">
                    Back to sign in
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (session) return { redirect: { destination: "/dashboard", permanent: false } };
  return { props: {} };
};
