import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Try again.");
      setLoading(false);
    } else {
      setDone(true);
    }
  }

  const callbackUrl = typeof router.query.callbackUrl === "string" ? router.query.callbackUrl : "/";

  return (
    <>
      <Head>
        <title>Create account — Fixer Nation</title>
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
                  We sent a verification link to <strong>{email}</strong>. Click it to activate your account.
                </p>
                <p className="mt-4 text-xs text-ink-soft">
                  Didn't get it? Check your spam folder or{" "}
                  <button
                    onClick={() => setDone(false)}
                    className="font-semibold text-navy hover:underline"
                  >
                    try again
                  </button>
                  .
                </p>
              </div>
            ) : (
              <>
                <h1 className="mb-1 text-xl font-extrabold text-navy">Create your account</h1>
                <p className="mb-6 text-sm text-ink-soft">
                  Already have one?{" "}
                  <Link href={`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="font-semibold text-navy no-underline hover:underline">
                    Sign in
                  </Link>
                </p>

                {error && (
                  <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-navy" htmlFor="name">Full name</label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="name"
                      required
                      maxLength={100}
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                    />
                  </div>
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
                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-navy" htmlFor="password">Password</label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                    />
                    <p className="mt-1 text-xs text-ink-soft">At least 8 characters.</p>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-[10px] bg-amber px-5 py-2.5 text-sm font-bold text-navy-dark shadow-[0_8px_20px_-10px_rgba(242,169,60,0.6)] hover:bg-amber-dark disabled:opacity-50 transition-colors"
                  >
                    {loading ? "Creating account…" : "Create account"}
                  </button>
                </form>

                <p className="mt-5 text-center text-xs text-ink-soft">
                  By creating an account you agree to our{" "}
                  <Link href="/terms" className="font-semibold no-underline hover:underline">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="font-semibold no-underline hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </p>
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
  if (session) {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }
  return { props: {} };
};
