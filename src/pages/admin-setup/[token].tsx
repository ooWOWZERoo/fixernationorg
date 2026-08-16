import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

type SetupState =
  | { phase: "loading" }
  | { phase: "invalid"; message: string }
  | { phase: "expired" }
  | { phase: "claimed" }
  | { phase: "form"; email: string; role: string }
  | { phase: "success" };

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

export default function AdminSetupPage() {
  const router = useRouter();
  const { token } = router.query as { token?: string };

  const [state, setState] = useState<SetupState>({ phase: "loading" });
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/admin-setup/${token}`)
      .then((r) => r.json().then((data) => ({ status: r.status, data })))
      .then(({ status, data }) => {
        if (status === 200) {
          setState({ phase: "form", email: data.email, role: data.role });
        } else if (data.error === "ALREADY_CLAIMED") {
          setState({ phase: "claimed" });
        } else if (data.error === "EXPIRED") {
          setState({ phase: "expired" });
        } else {
          setState({ phase: "invalid", message: data.message ?? "This invite link is not valid." });
        }
      })
      .catch(() => setState({ phase: "invalid", message: "Something went wrong. Please try again." }));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin-setup/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), password }),
      });
      const data = await res.json();
      if (res.ok) {
        setState({ phase: "success" });
      } else {
        setError(data.message ?? data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block text-lg font-extrabold text-navy no-underline hover:opacity-80">
            Fixer Nation
          </Link>
          <p className="mt-1 text-xs text-slate-400">Admin account setup</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {state.phase === "loading" && (
            <p className="text-center text-sm text-slate-400">Verifying your invite link…</p>
          )}

          {state.phase === "invalid" && (
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h1 className="text-lg font-bold text-slate-900">Invalid invite link</h1>
              <p className="text-sm text-slate-500">{state.message}</p>
              <p className="text-sm text-slate-400">
                Contact your system administrator if you need a new link.
              </p>
            </div>
          )}

          {state.phase === "expired" && (
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-lg font-bold text-slate-900">Invite link expired</h1>
              <p className="text-sm text-slate-500">This invite was valid for 7 days. Ask a Super Admin to send a new one from the admin backend.</p>
            </div>
          )}

          {state.phase === "claimed" && (
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-lg font-bold text-slate-900">Account already created</h1>
              <p className="text-sm text-slate-500">This invite has already been used.</p>
              <Link
                href="/signin"
                className="inline-block rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-navy-dark"
              >
                Sign in
              </Link>
            </div>
          )}

          {state.phase === "success" && (
            <div className="space-y-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-lg font-bold text-slate-900">Account created</h1>
              <p className="text-sm text-slate-500">
                Your admin account is ready. Sign in to access the backend.
              </p>
              <Link
                href="/signin"
                className="inline-block rounded-lg bg-navy px-5 py-2.5 text-sm font-semibold text-white no-underline transition-colors hover:bg-navy-dark"
              >
                Sign in to your account
              </Link>
            </div>
          )}

          {state.phase === "form" && (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold text-slate-900">Create your admin account</h1>
                <p className="mt-1 text-sm text-slate-500">
                  You've been invited with the role:{" "}
                  <span className="font-semibold text-navy">
                    {ROLE_LABEL[state.role] ?? state.role}
                  </span>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Full name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Email
                  </label>
                  <input
                    type="email"
                    value={state.email}
                    readOnly
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500"
                  />
                  <p className="mt-1 text-xs text-slate-400">This is the address your invite was sent to.</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                  />
                  <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Confirm password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-navy px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-navy-dark disabled:opacity-50"
                >
                  {submitting ? "Creating account…" : "Create my account"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
