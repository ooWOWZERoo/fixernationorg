import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface Props {
  token: string;
}

export default function ResetPasswordPage({ token }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      setLoading(false);
    } else {
      setDone(true);
      setTimeout(() => router.push("/signin"), 2500);
    }
  }

  return (
    <>
      <Head>
        <title>Choose new password — Fixer Nation</title>
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
                <p className="text-2xl">✓</p>
                <h1 className="mt-3 text-lg font-extrabold text-navy">Password updated</h1>
                <p className="mt-2 text-sm text-ink-soft">Redirecting you to sign in…</p>
              </div>
            ) : (
              <>
                <h1 className="mb-1 text-xl font-extrabold text-navy">Choose a new password</h1>
                <p className="mb-6 text-sm text-ink-soft">At least 8 characters.</p>

                {error && (
                  <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-navy" htmlFor="password">New password</label>
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
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-navy" htmlFor="confirm">Confirm password</label>
                    <input
                      id="confirm"
                      type="password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-[10px] bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors"
                  >
                    {loading ? "Saving…" : "Set new password"}
                  </button>
                </form>
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

  const token = context.query.token;
  if (typeof token !== "string" || !token) {
    return { redirect: { destination: "/forgot-password", permanent: false } };
  }

  return { props: { token } };
};
