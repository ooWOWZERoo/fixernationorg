import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface Props {
  mfaEnabled: boolean;
}

type SetupStep = "idle" | "qr" | "verify" | "done";
type DisableStep = "idle" | "confirm";

const AccountSecurityPage: NextPageWithLayout<Props> = ({ mfaEnabled: initialEnabled }) => {
  const [mfaEnabled, setMfaEnabled] = useState(initialEnabled);

  // Enable flow
  const [setupStep, setSetupStep] = useState<SetupStep>("idle");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);

  // Disable flow
  const [disableStep, setDisableStep] = useState<DisableStep>("idle");
  const [disableCode, setDisableCode] = useState("");
  const [disableError, setDisableError] = useState<string | null>(null);
  const [disableLoading, setDisableLoading] = useState(false);

  // ── Enable: step 1 — fetch QR ────────────────────────────────────────────────
  async function startSetup() {
    setSetupLoading(true);
    setSetupError(null);
    try {
      const res = await fetch("/api/account/mfa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSetupError(data.error ?? "Could not start setup.");
        setSetupLoading(false);
        return;
      }
      setQrDataUrl(data.qrDataUrl);
      setManualSecret(data.secret);
      setSetupStep("qr");
    } catch {
      setSetupError("Network error. Try again.");
    } finally {
      setSetupLoading(false);
    }
  }

  // ── Enable: step 2 — verify code ─────────────────────────────────────────────
  async function verifySetup(e: React.FormEvent) {
    e.preventDefault();
    setSetupLoading(true);
    setSetupError(null);
    try {
      const res = await fetch("/api/account/mfa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totpCode: setupCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSetupError(data.error ?? "Verification failed.");
        setSetupLoading(false);
        return;
      }
      setMfaEnabled(true);
      setSetupStep("done");
    } catch {
      setSetupError("Network error. Try again.");
    } finally {
      setSetupLoading(false);
    }
  }

  // ── Disable ───────────────────────────────────────────────────────────────────
  async function submitDisable(e: React.FormEvent) {
    e.preventDefault();
    setDisableLoading(true);
    setDisableError(null);
    try {
      const res = await fetch("/api/account/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totpCode: disableCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDisableError(data.error ?? "Could not disable MFA.");
        setDisableLoading(false);
        return;
      }
      setMfaEnabled(false);
      setDisableStep("idle");
      setDisableCode("");
    } catch {
      setDisableError("Network error. Try again.");
    } finally {
      setDisableLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Security — Fixer Nation</title>
      </Head>

      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-xl">
          <div className="mb-2">
            <Link href="/account" className="text-sm font-semibold text-ink-soft no-underline hover:text-navy">
              ← Account Settings
            </Link>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-navy">Security</h1>
          <p className="mt-1 text-sm text-ink-soft">Manage two-factor authentication for your account.</p>

          {/* MFA card */}
          <div className="mt-10 rounded-2xl border border-navy/8 bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-navy">Two-factor authentication</h2>
                <p className="mt-1 text-sm text-ink-soft">
                  Require a 6-digit code from an authenticator app each time you sign in.
                </p>
              </div>
              <span className={`mt-1 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${mfaEnabled ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                {mfaEnabled ? "On" : "Off"}
              </span>
            </div>

            {/* ── Not enabled — idle ─────────────────────────────────────────── */}
            {!mfaEnabled && setupStep === "idle" && (
              <div className="mt-5">
                <button
                  onClick={startSetup}
                  disabled={setupLoading}
                  className="rounded-[10px] bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors"
                >
                  {setupLoading ? "Setting up…" : "Enable two-factor authentication"}
                </button>
                {setupError && <p className="mt-3 text-sm text-red-600">{setupError}</p>}
              </div>
            )}

            {/* ── Setup: QR step ────────────────────────────────────────────── */}
            {!mfaEnabled && setupStep === "qr" && (
              <div className="mt-5 space-y-5">
                <p className="text-sm text-ink-soft">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.).
                </p>
                {qrDataUrl && (
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="MFA QR code" className="h-44 w-44 rounded-xl border border-slate-200" />
                  </div>
                )}
                <details className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-500">
                    Can't scan? Enter the key manually
                  </summary>
                  <p className="mt-2 break-all font-mono text-xs text-slate-700">{manualSecret}</p>
                </details>
                <button
                  onClick={() => setSetupStep("verify")}
                  className="w-full rounded-[10px] bg-navy py-2.5 text-sm font-bold text-white hover:bg-navy-dark transition-colors"
                >
                  I've added it — continue
                </button>
                <button onClick={() => setSetupStep("idle")} className="w-full text-center text-sm text-slate-400 hover:text-navy">
                  Cancel
                </button>
              </div>
            )}

            {/* ── Setup: verify step ────────────────────────────────────────── */}
            {!mfaEnabled && setupStep === "verify" && (
              <form onSubmit={verifySetup} className="mt-5 space-y-4">
                <p className="text-sm text-ink-soft">
                  Enter the 6-digit code from your authenticator app to confirm setup.
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  required
                  autoFocus
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-center text-2xl font-mono tracking-[0.4em] focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
                />
                {setupError && <p className="text-sm text-red-600">{setupError}</p>}
                <button
                  type="submit"
                  disabled={setupLoading || setupCode.length < 6}
                  className="w-full rounded-[10px] bg-navy py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-50 transition-colors"
                >
                  {setupLoading ? "Verifying…" : "Verify and enable"}
                </button>
                <button type="button" onClick={() => setSetupStep("qr")} className="w-full text-center text-sm text-slate-400 hover:text-navy">
                  ← Back
                </button>
              </form>
            )}

            {/* ── Setup: done ───────────────────────────────────────────────── */}
            {mfaEnabled && setupStep === "done" && (
              <div className="mt-4 rounded-xl bg-green-50 px-4 py-3">
                <p className="text-sm font-semibold text-green-700">
                  Two-factor authentication is now active. Your account requires a code every time you sign in.
                </p>
              </div>
            )}

            {/* ── Enabled — disable flow ────────────────────────────────────── */}
            {mfaEnabled && setupStep !== "done" && (
              <div className="mt-5">
                {disableStep === "idle" && (
                  <button
                    onClick={() => setDisableStep("confirm")}
                    className="rounded-[10px] border border-red-300 px-5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Disable two-factor authentication
                  </button>
                )}

                {disableStep === "confirm" && (
                  <form onSubmit={submitDisable} className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-semibold text-red-700">
                      Enter your authenticator code to confirm you want to turn off MFA.
                    </p>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={disableCode}
                      onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      required
                      autoFocus
                      className="w-full rounded-xl border border-red-300 bg-white px-4 py-2.5 text-center text-2xl font-mono tracking-[0.4em] focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                    {disableError && <p className="text-sm text-red-700">{disableError}</p>}
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={disableLoading || disableCode.length < 6}
                        className="rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {disableLoading ? "Disabling…" : "Confirm disable"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDisableStep("idle"); setDisableCode(""); setDisableError(null); }}
                        className="rounded-lg border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Back to account */}
          <div className="mt-6 text-center">
            <Link href="/account" className="text-sm font-semibold text-ink-soft no-underline hover:text-navy">
              ← Back to Account Settings
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

AccountSecurityPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent("/account/security")}`, permanent: false } };
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { mfaEnabled: true },
  });

  return { props: { mfaEnabled: user?.mfaEnabled ?? false } };
};

export default AccountSecurityPage;
